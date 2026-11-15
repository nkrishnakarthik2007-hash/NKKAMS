drop policy if exists "attendance insert active" on public.attendance;
drop policy if exists "attendance update active" on public.attendance;
create policy "active users mark eligible attendance"
on public.attendance for insert to authenticated
with check (
 public.nkkams_is_active_user()
 and (marked_by is null or marked_by=(select auth.uid()))
 and not exists (select 1 from public.holidays h where h.holiday_date=attendance_date)
 and exists (
   select 1 from public.students s
   where s.id=student_id
     and (s.joining_date is null or s.joining_date<=attendance_date)
     and (s.left_date is null or s.left_date>=attendance_date)
     and (s.is_active or s.left_date is not null)
 )
);
create policy "active users update eligible attendance"
on public.attendance for update to authenticated
using (
 public.nkkams_is_active_user()
 and exists (
   select 1 from public.students s
   where s.id=student_id
     and (s.joining_date is null or s.joining_date<=attendance_date)
     and (s.left_date is null or s.left_date>=attendance_date)
     and (s.is_active or s.left_date is not null)
 )
)
with check (
 public.nkkams_is_active_user()
 and (marked_by is null or marked_by=(select auth.uid()))
 and not exists (select 1 from public.holidays h where h.holiday_date=attendance_date)
 and exists (
   select 1 from public.students s
   where s.id=student_id
     and (s.joining_date is null or s.joining_date<=attendance_date)
     and (s.left_date is null or s.left_date>=attendance_date)
     and (s.is_active or s.left_date is not null)
 )
);