create or replace function public.complete_organization_head_transfer(p_request_id uuid,p_actor_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp
as $$
declare req public.organization_head_transfer_requests%rowtype; actor_role text; current_head uuid; proposed_role text; proposed_org uuid;
begin
 select role::text into actor_role from public.profiles where id=p_actor_id and is_active=true;
 if actor_role not in('super_admin','platform_admin') then raise exception 'Only a Website Admin or Super Admin can approve a leadership transfer.'; end if;
 select * into req from public.organization_head_transfer_requests where id=p_request_id for update;
 if not found or req.status<>'accepted' then raise exception 'The proposed organisation admin must accept before approval.'; end if;
 select head_user_id into current_head from public.organizations where id=req.organization_id for update;
 if current_head is distinct from req.current_head_id then raise exception 'The organisation head has changed. Submit a new request.'; end if;
 select role::text,organization_id into proposed_role,proposed_org from public.profiles where id=req.proposed_head_id and is_active=true for update;
 if proposed_org is distinct from req.organization_id or proposed_role<>'admin' then raise exception 'The proposed head must be an active Organisation Admin in this organisation.'; end if;
 update public.profiles set role='admin',updated_by=p_actor_id,updated_at=now() where id=req.current_head_id and role='organization_head';
 update public.profiles set role='organization_head',updated_by=p_actor_id,updated_at=now() where id=req.proposed_head_id;
 update public.organizations set head_user_id=req.proposed_head_id where id=req.organization_id;
 update public.organization_head_transfer_requests set status='approved',reviewed_by=p_actor_id,reviewed_at=now() where id=p_request_id;
end $$;
revoke all on function public.complete_organization_head_transfer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_organization_head_transfer(uuid,uuid) to service_role;