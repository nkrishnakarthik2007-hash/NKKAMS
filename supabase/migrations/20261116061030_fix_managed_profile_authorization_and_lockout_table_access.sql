create or replace function public.update_managed_profile(p_actor_id uuid,p_employee_id text,p_name text,p_email text,p_phone text)
returns void language plpgsql security definer set search_path=public
as $$
declare actor public.profiles%rowtype; target public.profiles%rowtype;
begin
 select * into actor from public.profiles where id=p_actor_id and is_active;
 select * into target from public.profiles where upper(employee_id)=upper(p_employee_id);
 if actor.id is null or target.id is null then raise exception 'Not authorized or user not found'; end if;
 if target.role='super_admin' or (target.role='platform_admin' and actor.role<>'super_admin') then raise exception 'This website administrator account is protected from your role'; end if;
 if actor.role not in('super_admin','platform_admin','organization_head','admin') then raise exception 'Not authorized'; end if;
 if actor.role in('organization_head','admin') then
  if actor.organization_id is null or actor.organization_id is distinct from target.organization_id then raise exception 'Cannot manage accounts outside your organisation'; end if;
  if actor.role='admin' and target.role<>'teacher' then raise exception 'Organisation Admin can manage Teachers only'; end if;
  if actor.role='organization_head' and target.role not in('admin','teacher') then raise exception 'Organisation Head can manage Organisation Admins and Teachers only'; end if;
  if not exists(select 1 from public.organizations o where o.id=actor.organization_id and o.status='active') then raise exception 'Your organisation is suspended'; end if;
 end if;
 update public.profiles set name=p_name,email=p_email,phone=p_phone,updated_by=p_actor_id,updated_at=now() where id=target.id;
 update public.admin_contacts set name=p_name,email=p_email,whatsapp=p_phone,updated_by=p_actor_id where employee_id=upper(p_employee_id);
end $$;
revoke all on function public.update_managed_profile(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.update_managed_profile(uuid,text,text,text,text) to service_role;
alter table public.login_security enable row level security;
revoke all on table public.login_security from public,anon,authenticated;
drop policy if exists "login security deny direct access" on public.login_security;
create policy "login security deny direct access" on public.login_security for all to anon,authenticated using(false) with check(false);
grant all on table public.login_security to service_role;