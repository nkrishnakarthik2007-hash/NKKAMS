-- Suspended organisations remain visible to global administrators, but their members
-- cannot read or change tenant data until the organisation is reactivated.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated,service_role;
create or replace function private.nkkams_actor_role()
returns text language sql stable security definer set search_path=public,private
as $$ select role::text from public.profiles where id=auth.uid() and is_active=true $$;
create or replace function private.nkkams_actor_org()
returns uuid language sql stable security definer set search_path=public,private
as $$ select organization_id from public.profiles where id=auth.uid() and is_active=true $$;
create or replace function private.nkkams_org_is_active(p_org_id uuid)
returns boolean language sql stable security definer set search_path=public,private
as $$ select exists(select 1 from public.organizations where id=p_org_id and status='active') $$;
revoke all on function private.nkkams_actor_role() from public,anon;
revoke all on function private.nkkams_actor_org() from public,anon;
revoke all on function private.nkkams_org_is_active(uuid) from public,anon;
grant execute on function private.nkkams_actor_role() to authenticated,service_role;
grant execute on function private.nkkams_actor_org() to authenticated,service_role;
grant execute on function private.nkkams_org_is_active(uuid) to authenticated,service_role;
drop policy if exists "profiles tenant read" on public.profiles;
create policy "profiles tenant read" on public.profiles for select to authenticated using(id=auth.uid() or private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id)));
drop policy if exists "students tenant read" on public.students;
create policy "students tenant read" on public.students for select to authenticated using(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id)));
drop policy if exists "students tenant insert" on public.students;
create policy "students tenant insert" on public.students for insert to authenticated with check(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id) and private.nkkams_actor_role() in('organization_head','admin','teacher')));
drop policy if exists "students tenant update" on public.students;
create policy "students tenant update" on public.students for update to authenticated using(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id) and private.nkkams_actor_role() in('organization_head','admin','teacher'))) with check(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id) and private.nkkams_actor_role() in('organization_head','admin','teacher')));
drop policy if exists "attendance tenant read" on public.attendance;
create policy "attendance tenant read" on public.attendance for select to authenticated using(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id)));
drop policy if exists "attendance tenant insert" on public.attendance;
create policy "attendance tenant insert" on public.attendance for insert to authenticated with check((private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id))) and (marked_by is null or marked_by=auth.uid()));
drop policy if exists "attendance tenant update" on public.attendance;
create policy "attendance tenant update" on public.attendance for update to authenticated using(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id))) with check((private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id))) and (marked_by is null or marked_by=auth.uid()));
drop policy if exists "holidays tenant read" on public.holidays;
create policy "holidays tenant read" on public.holidays for select to authenticated using(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id)));
drop policy if exists "holidays tenant manage" on public.holidays;
create policy "holidays tenant manage" on public.holidays for all to authenticated using(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id) and private.nkkams_actor_role() in('organization_head','admin'))) with check(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id) and private.nkkams_actor_role() in('organization_head','admin')));
drop policy if exists "contacts tenant read" on public.admin_contacts;
create policy "contacts tenant read" on public.admin_contacts for select to authenticated using(is_active and (private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id))));
drop policy if exists "contacts scoped manage" on public.admin_contacts;
create policy "contacts scoped manage" on public.admin_contacts for all to authenticated using(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id) and private.nkkams_actor_role()='organization_head')) with check(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id) and private.nkkams_actor_role()='organization_head'));
drop policy if exists "batches tenant read" on public.batches;
create policy "batches tenant read" on public.batches for select to authenticated using(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id)));
drop policy if exists "batches tenant manage" on public.batches;
create policy "batches tenant manage" on public.batches for all to authenticated using(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id) and private.nkkams_actor_role() in('organization_head','admin'))) with check(private.nkkams_actor_role() in('super_admin','platform_admin') or (organization_id=private.nkkams_actor_org() and private.nkkams_org_is_active(organization_id) and private.nkkams_actor_role() in('organization_head','admin')));