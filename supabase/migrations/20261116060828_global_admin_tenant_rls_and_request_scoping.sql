create or replace function private.nkkams_is_global_admin()
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_active and p.role in('super_admin','platform_admin'));
$$;
revoke all on function private.nkkams_is_global_admin() from public,anon;
grant usage on schema private to authenticated,service_role;
grant execute on function private.nkkams_is_global_admin() to authenticated,service_role;

drop policy if exists "profiles scoped read" on public.profiles;
create policy "profiles scoped read" on public.profiles for select to authenticated
using(id=(select auth.uid()) or private.nkkams_is_global_admin() or (private.nkkams_is_admin() and organization_id=private.nkkams_current_organization_id()));

drop policy if exists "org users read students" on public.students;
create policy "org users read students" on public.students for select to public
using(private.nkkams_is_active_user() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()));
drop policy if exists "org admins add students" on public.students;
create policy "org admins add students" on public.students for insert to public
with check(private.nkkams_is_admin() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()) and exists(select 1 from public.batches b where b.id=students.batch_id and b.organization_id=students.organization_id and b.is_active));
drop policy if exists "org admins update students" on public.students;
create policy "org admins update students" on public.students for update to public
using(private.nkkams_is_admin() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()))
with check(private.nkkams_is_admin() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()) and exists(select 1 from public.batches b where b.id=students.batch_id and b.organization_id=students.organization_id));

drop policy if exists "org users read attendance" on public.attendance;
create policy "org users read attendance" on public.attendance for select to public
using(private.nkkams_is_active_user() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()));
drop policy if exists "org users mark eligible attendance" on public.attendance;
create policy "org users mark eligible attendance" on public.attendance for insert to public
with check(private.nkkams_is_active_user() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id())
 and attendance_date<=((now() at time zone 'Asia/Kolkata'))::date and (marked_by is null or marked_by=(select auth.uid()))
 and not exists(select 1 from public.holidays h where h.holiday_date=attendance.attendance_date and h.organization_id=attendance.organization_id)
 and exists(select 1 from public.students s where s.id=attendance.student_id and s.organization_id=attendance.organization_id and (s.joining_date is null or s.joining_date<=attendance.attendance_date) and (s.left_date is null or s.left_date>=attendance.attendance_date) and (s.is_active or s.left_date is not null)));
drop policy if exists "org users update eligible attendance" on public.attendance;
create policy "org users update eligible attendance" on public.attendance for update to public
using(private.nkkams_is_active_user() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()) and attendance_date<=((now() at time zone 'Asia/Kolkata'))::date
 and exists(select 1 from public.students s where s.id=attendance.student_id and s.organization_id=attendance.organization_id and (s.joining_date is null or s.joining_date<=attendance.attendance_date) and (s.left_date is null or s.left_date>=attendance.attendance_date) and (s.is_active or s.left_date is not null)))
with check(private.nkkams_is_active_user() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()) and (marked_by is null or marked_by=(select auth.uid()))
 and not exists(select 1 from public.holidays h where h.holiday_date=attendance.attendance_date and h.organization_id=attendance.organization_id)
 and exists(select 1 from public.students s where s.id=attendance.student_id and s.organization_id=attendance.organization_id));
drop policy if exists "org users clear eligible attendance" on public.attendance;
create policy "org users clear eligible attendance" on public.attendance for delete to public
using(private.nkkams_is_active_user() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()) and attendance_date<=((now() at time zone 'Asia/Kolkata'))::date
 and exists(select 1 from public.students s where s.id=attendance.student_id and s.organization_id=attendance.organization_id and (s.joining_date is null or s.joining_date<=attendance.attendance_date) and (s.left_date is null or s.left_date>=attendance.attendance_date)));

drop policy if exists "org members read own batches" on public.batches;
create policy "org members read own batches" on public.batches for select to public
using(private.nkkams_is_active_user() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()));
drop policy if exists "org admins manage own batches" on public.batches;
create policy "org admins manage own batches" on public.batches for all to public
using(private.nkkams_is_admin() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()))
with check(private.nkkams_is_admin() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()));

drop policy if exists "org users read holidays" on public.holidays;
create policy "org users read holidays" on public.holidays for select to public
using(private.nkkams_is_active_user() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()));
drop policy if exists "org admins manage holidays" on public.holidays;
create policy "org admins manage holidays" on public.holidays for all to public
using(private.nkkams_is_admin() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()))
with check(private.nkkams_is_admin() and (private.nkkams_is_global_admin() or organization_id=private.nkkams_current_organization_id()));

drop policy if exists "org members read own organization" on public.organizations;
create policy "org members read own organization" on public.organizations for select to public
using(private.nkkams_is_active_user() and (private.nkkams_is_global_admin() or id=private.nkkams_current_organization_id()));
drop policy if exists "super admin manage organizations" on public.organizations;
create policy "super admin manage organizations" on public.organizations for all to public
using(private.nkkams_is_global_admin()) with check(private.nkkams_is_global_admin());

drop policy if exists "super admin review organization requests" on public.organization_requests;
create policy "super admin review organization requests" on public.organization_requests for all to authenticated
using(private.nkkams_is_global_admin()) with check(private.nkkams_is_global_admin());

drop policy if exists "contacts admin manage" on public.admin_contacts;
create policy "contacts admin manage" on public.admin_contacts for all to authenticated
using(private.nkkams_is_global_admin()) with check(private.nkkams_is_global_admin());

drop policy if exists "audit admin read" on public.audit_events;
create policy "audit admin read" on public.audit_events for select to authenticated
using(private.nkkams_is_global_admin());

drop policy if exists "admins view reset requests" on public.password_reset_requests;
create policy "admins view reset requests" on public.password_reset_requests for select to authenticated
using(requester_user_id=(select auth.uid()) or private.nkkams_is_global_admin()
 or exists(select 1 from public.profiles actor join public.profiles target on target.id=password_reset_requests.requester_user_id
  where actor.id=(select auth.uid()) and actor.is_active and actor.organization_id=target.organization_id and private.nkkams_is_admin()
   and (actor.role='organization_head' or target.role='teacher')));
drop policy if exists "admins update reset requests" on public.password_reset_requests;
create policy "admins update reset requests" on public.password_reset_requests for update to authenticated
using(private.nkkams_is_global_admin()
 or exists(select 1 from public.profiles actor join public.profiles target on target.id=password_reset_requests.requester_user_id
  where actor.id=(select auth.uid()) and actor.is_active and actor.organization_id=target.organization_id and private.nkkams_is_admin()
   and (actor.role='organization_head' or (actor.role='admin' and target.role='teacher'))))
with check(private.nkkams_is_global_admin()
 or exists(select 1 from public.profiles actor join public.profiles target on target.id=password_reset_requests.requester_user_id
  where actor.id=(select auth.uid()) and actor.is_active and actor.organization_id=target.organization_id and private.nkkams_is_admin()
   and (actor.role='organization_head' or (actor.role='admin' and target.role='teacher'))));

drop policy if exists "active users submit student left requests" on public.student_left_requests;
create policy "active users submit student left requests" on public.student_left_requests for insert to authenticated
with check(private.nkkams_is_active_user() and requested_by=(select auth.uid()) and status='pending'
 and exists(select 1 from public.profiles actor join public.students s on s.id=student_left_requests.student_id where actor.id=(select auth.uid()) and actor.organization_id=s.organization_id));
drop policy if exists "admins read student left requests" on public.student_left_requests;
create policy "admins read student left requests" on public.student_left_requests for select to authenticated
using(private.nkkams_is_global_admin() or requested_by=(select auth.uid())
 or exists(select 1 from public.profiles actor join public.students s on s.id=student_left_requests.student_id
  where actor.id=(select auth.uid()) and actor.is_active and actor.organization_id=s.organization_id and actor.role in('organization_head','admin')));
drop policy if exists "admins review student left requests" on public.student_left_requests;
create policy "admins review student left requests" on public.student_left_requests for update to authenticated
using(private.nkkams_is_global_admin()
 or exists(select 1 from public.profiles actor join public.students s on s.id=student_left_requests.student_id
  where actor.id=(select auth.uid()) and actor.is_active and actor.organization_id=s.organization_id and actor.role in('organization_head','admin')))
with check((private.nkkams_is_global_admin() or exists(select 1 from public.profiles actor join public.students s on s.id=student_left_requests.student_id
  where actor.id=(select auth.uid()) and actor.is_active and actor.organization_id=s.organization_id and actor.role in('organization_head','admin')))
 and reviewed_by=(select auth.uid()));