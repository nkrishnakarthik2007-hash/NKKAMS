-- Keep transfer acceptance pending Super Admin / Website Admin approval.
create or replace function public.nkkams_accept_head_transfer(p_request_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare req public.organization_head_transfer_requests%rowtype;
begin
 select * into req from public.organization_head_transfer_requests where id=p_request_id for update;
 if req.id is null or req.proposed_head_id<>p_user_id or req.status<>'pending' then raise exception 'Leadership invitation is not available'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and is_active and organization_id=req.organization_id and role='admin') then raise exception 'Only an active organisation admin can accept'; end if;
 update public.organization_head_transfer_requests set status='accepted',responded_at=now() where id=p_request_id;
end $$;
create or replace function public.nkkams_review_head_transfer(p_request_id uuid,p_status text,p_actor_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare actor public.profiles%rowtype; req public.organization_head_transfer_requests%rowtype;
begin
 select * into actor from public.profiles where id=p_actor_id and is_active;
 if actor.id is null or actor.role not in('super_admin','platform_admin') then raise exception 'Only website administrators can review a transfer'; end if;
 if p_status not in('approved','rejected') then raise exception 'Invalid transfer decision'; end if;
 select * into req from public.organization_head_transfer_requests where id=p_request_id for update;
 if req.id is null or req.status not in('pending','accepted') then raise exception 'Transfer request is not pending'; end if;
 if p_status='approved' then
  if not exists(select 1 from public.profiles where id=req.proposed_head_id and is_active and organization_id=req.organization_id and role='admin') then raise exception 'The selected person is no longer an active organisation admin'; end if;
  update public.profiles set role='admin',updated_at=now() where id=req.current_head_id and role='organization_head';
  update public.profiles set role='organization_head',updated_at=now() where id=req.proposed_head_id;
 end if;
 update public.organization_head_transfer_requests set status=p_status,reviewed_by=p_actor_id,reviewed_at=now(),responded_at=coalesce(responded_at,now()) where id=p_request_id;
end $$;
revoke all on function public.nkkams_accept_head_transfer(uuid,uuid) from public,anon,authenticated;
revoke all on function public.nkkams_review_head_transfer(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.nkkams_accept_head_transfer(uuid,uuid) to service_role;
grant execute on function public.nkkams_review_head_transfer(uuid,text,uuid) to service_role;