drop policy if exists "active users mark eligible attendance" on public.attendance;
drop policy if exists "active users update eligible attendance" on public.attendance;
create policy "active users mark eligible attendance"
on public.attendance for insert to authenticated
with check (
 private.nkkams_is_active_user()
 and attendance_date <= (now() at time zone 'Asia/Kolkata')::date
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
 private.nkkams_is_active_user()
 and attendance_date <= (now() at time zone 'Asia/Kolkata')::date
 and exists (
   select 1 from public.students s
   where s.id=student_id
     and (s.joining_date is null or s.joining_date<=attendance_date)
     and (s.left_date is null or s.left_date>=attendance_date)
     and (s.is_active or s.left_date is not null)
 )
)
with check (
 private.nkkams_is_active_user()
 and attendance_date <= (now() at time zone 'Asia/Kolkata')::date
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