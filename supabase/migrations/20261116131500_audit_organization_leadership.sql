-- Record all organisation leadership appointments and transfers in the audit trail.
create or replace function public.admin_set_organization_head(p_actor_id uuid, p_organization_id uuid, p_new_head_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare actor_role text; target_role text; target_org uuid; old_head uuid;
begin
 select role::text into actor_role from public.profiles where id=p_actor_id and is_active=true;
 if actor_role not in('super_admin','platform_admin') then
  raise exception 'Only a website administrator can appoint an organisation head.';
 end if;
 select head_user_id into old_head from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'Organisation not found.'; end if;
 select role::text,organization_id into target_role,target_org from public.profiles where id=p_new_head_id and is_active=true for update;
 if not found or target_org is distinct from p_organization_id or target_role not in('admin','organization_head') then
  raise exception 'Choose an active Admin from this organisation.';
 end if;
 if old_head is not null and old_head<>p_new_head_id then
  update public.profiles set role='admin',updated_by=p_actor_id,updated_at=now() where id=old_head and role='organization_head';
 end if;
 update public.profiles set role='organization_head',updated_by=p_actor_id,updated_at=now() where id=p_new_head_id;
 update public.organizations set head_user_id=p_new_head_id where id=p_organization_id;
 update public.organization_head_transfer_requests set status='cancelled',reviewed_by=p_actor_id,reviewed_at=now()
  where organization_id=p_organization_id and status in('pending','accepted');
 insert into public.audit_events(actor_id,operation,table_name,record_id,details)
 values(p_actor_id,'ORGANIZATION_HEAD_APPOINTED','organizations',p_organization_id::text,
  jsonb_build_object('organization_id',p_organization_id,'previous_head_id',old_head,'new_head_id',p_new_head_id));
end
$function$;

create or replace function public.complete_organization_head_transfer(p_request_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare req public.organization_head_transfer_requests%rowtype; actor_role text; current_head uuid; proposed_role text; proposed_org uuid;
begin
 select role::text into actor_role from public.profiles where id=p_actor_id and is_active=true;
 if actor_role not in('super_admin','platform_admin') then
  raise exception 'Only a Website Admin or Super Admin can approve a leadership transfer.';
 end if;
 select * into req from public.organization_head_transfer_requests where id=p_request_id for update;
 if not found or req.status<>'accepted' then
  raise exception 'The proposed organisation admin must accept before approval.';
 end if;
 select head_user_id into current_head from public.organizations where id=req.organization_id for update;
 if current_head is distinct from req.current_head_id then
  raise exception 'The organisation head has changed. Submit a new request.';
 end if;
 select role::text,organization_id into proposed_role,proposed_org from public.profiles where id=req.proposed_head_id and is_active=true for update;
 if proposed_org is distinct from req.organization_id or proposed_role<>'admin' then
  raise exception 'The proposed head must be an active Organisation Admin in this organisation.';
 end if;
 update public.profiles set role='admin',updated_by=p_actor_id,updated_at=now() where id=req.current_head_id and role='organization_head';
 update public.profiles set role='organization_head',updated_by=p_actor_id,updated_at=now() where id=req.proposed_head_id;
 update public.organizations set head_user_id=req.proposed_head_id where id=req.organization_id;
 update public.organization_head_transfer_requests set status='approved',reviewed_by=p_actor_id,reviewed_at=now() where id=p_request_id;
 update public.organization_head_transfer_requests set status='cancelled',reviewed_by=p_actor_id,reviewed_at=now()
  where organization_id=req.organization_id and id<>p_request_id and status in('pending','accepted');
 insert into public.audit_events(actor_id,operation,table_name,record_id,details)
 values(p_actor_id,'ORGANIZATION_HEAD_TRANSFERRED','organization_head_transfer_requests',p_request_id::text,
  jsonb_build_object('organization_id',req.organization_id,'request_id',p_request_id,'previous_head_id',req.current_head_id,'new_head_id',req.proposed_head_id));
end
$function$;
