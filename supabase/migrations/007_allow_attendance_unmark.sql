create policy "active users clear eligible attendance"
on public.attendance for delete to authenticated
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
);