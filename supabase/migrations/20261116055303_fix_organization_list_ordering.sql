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
revoke all on function public.nkkams_list_organizations(uuid) from public,anon,authenticated;
grant execute on function public.nkkams_list_organizations(uuid) to service_role;