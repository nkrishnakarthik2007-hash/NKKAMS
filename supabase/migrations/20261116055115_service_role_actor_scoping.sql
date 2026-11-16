-- Service-role RPCs must receive the authenticated actor explicitly because the Edge Function
-- uses the service-role client (auth.uid() is NULL in that client).
create or replace function public.nkkams_list_organizations(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor_id and is_active and role in('super_admin','platform_admin')) then raise exception 'Not authorized'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'slug',o.slug,'status',o.status,
 'head',(select jsonb_build_object('name',p.name,'employee_id',p.employee_id) from public.profiles p where p.organization_id=o.id and p.role='organization_head' and p.is_active limit 1),
 'candidates',coalesce((select jsonb_agg(jsonb_build_object('name',p.name,'employee_id',p.employee_id,'role',p.role)) from public.profiles p where p.organization_id=o.id and p.is_active and p.role in('admin','organization_head')),'[]'::jsonb),
 'user_count',(select count(*) from public.profiles p where p.organization_id=o.id and p.is_active),
 'batch_count',(select count(*) from public.batches b where b.organization_id=o.id),
 'student_count',(select count(*) from public.students s where s.organization_id=o.id)
 ) order by o.name),'[]'::jsonb) into result from public.organizations o;
 return result;
end $$;
create or replace function public.nkkams_list_org_requests(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
begin
 if not exists(select 1 from public.profiles where id=p_actor_id and is_active and role in('super_admin','platform_admin')) then raise exception 'Not authorized'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'organization_name',r.organization_name,'contact_name',r.contact_name,'phone',r.phone,'email',r.email,'message',r.message,'employee_id',r.employee_id,'created_at',r.created_at)) from public.organization_requests r where r.status='pending'),'[]'::jsonb);
end $$;
create or replace function public.nkkams_list_transfers(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare actor public.profiles%rowtype;
begin
 select * into actor from public.profiles where id=p_actor_id and is_active;
 if actor.id is null then raise exception 'Not authorized'; end if;
 if actor.role in('super_admin','platform_admin') then
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'organization_name',o.name,'current_head',jsonb_build_object('name',old.name,'employee_id',old.employee_id),'proposed_head',jsonb_build_object('name',newp.name,'employee_id',newp.employee_id),'status',r.status,'created_at',r.requested_at)) from public.organization_head_transfer_requests r join public.organizations o on o.id=r.organization_id join public.profiles old on old.id=r.current_head_id join public.profiles newp on newp.id=r.proposed_head_id where r.status in('pending','accepted')),'[]'::jsonb);
 elsif actor.role='organization_head' then
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'organization_name',o.name,'current_head',jsonb_build_object('name',old.name,'employee_id',old.employee_id),'proposed_head',jsonb_build_object('name',newp.name,'employee_id',newp.employee_id),'status',r.status,'created_at',r.requested_at)) from public.organization_head_transfer_requests r join public.organizations o on o.id=r.organization_id join public.profiles old on old.id=r.current_head_id join public.profiles newp on newp.id=r.proposed_head_id where r.current_head_id=actor.id and r.status in('pending','accepted')),'[]'::jsonb);
 elsif actor.role='admin' then
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'current_head',jsonb_build_object('name',old.name,'employee_id',old.employee_id),'status',r.status,'created_at',r.requested_at)) from public.organization_head_transfer_requests r join public.profiles old on old.id=r.current_head_id where r.proposed_head_id=actor.id and r.status='pending'),'[]'::jsonb);
 else return '[]'::jsonb; end if;
end $$;
create or replace function public.nkkams_create_transfer(p_actor_id uuid,p_employee_id text)
returns void language plpgsql security definer set search_path=public
as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype;
begin
 select * into actor from public.profiles where id=p_actor_id and is_active;
 if actor.id is null or actor.role<>'organization_head' or actor.organization_id is null then raise exception 'Only the current organisation head can request a transfer'; end if;
 select * into target from public.profiles where upper(employee_id)=upper(p_employee_id) and organization_id=actor.organization_id and role='admin' and is_active;
 if target.id is null then raise exception 'Choose an active organisation admin'; end if;
 if exists(select 1 from public.organization_head_transfer_requests where organization_id=actor.organization_id and status in('pending','accepted')) then raise exception 'A leadership transfer is already pending'; end if;
 insert into public.organization_head_transfer_requests(organization_id,current_head_id,proposed_head_id) values(actor.organization_id,actor.id,target.id);
end $$;
create or replace function public.nkkams_set_organization_head(p_actor_id uuid,p_organization_id uuid,p_employee_id text)
returns void language plpgsql security definer set search_path=public
as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype; old_head uuid;
begin
 select * into actor from public.profiles where id=p_actor_id and is_active;
 if actor.id is null or actor.role not in('super_admin','platform_admin') then raise exception 'Only website administrators can directly change organisation leadership'; end if;
 select * into target from public.profiles where upper(employee_id)=upper(p_employee_id) and is_active and organization_id=p_organization_id and role in('admin','organization_head');
 if target.id is null then raise exception 'Choose an active admin from this organisation'; end if;
 select id into old_head from public.profiles where organization_id=p_organization_id and role='organization_head' and is_active;
 if old_head is not null and old_head<>target.id then update public.profiles set role='admin',updated_by=actor.id,updated_at=now() where id=old_head; end if;
 update public.profiles set role='organization_head',updated_by=actor.id,updated_at=now() where id=target.id;
 insert into public.audit_events(actor_id,operation,table_name,record_id,details) values(actor.id,'change_organization_head','profiles',target.id::text,jsonb_build_object('organization_id',p_organization_id,'previous_head_id',old_head,'new_head_id',target.id));
end $$;
revoke all on function public.nkkams_list_organizations(uuid) from public,anon,authenticated;
revoke all on function public.nkkams_list_org_requests(uuid) from public,anon,authenticated;
revoke all on function public.nkkams_list_transfers(uuid) from public,anon,authenticated;
revoke all on function public.nkkams_create_transfer(uuid,text) from public,anon,authenticated;
revoke all on function public.nkkams_set_organization_head(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.nkkams_list_organizations(uuid) to service_role;
grant execute on function public.nkkams_list_org_requests(uuid) to service_role;
grant execute on function public.nkkams_list_transfers(uuid) to service_role;
grant execute on function public.nkkams_create_transfer(uuid,text) to service_role;
grant execute on function public.nkkams_set_organization_head(uuid,uuid,text) to service_role;