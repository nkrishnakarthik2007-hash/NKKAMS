create or replace function private.nkkams_guard_student_left_fields()
returns trigger
language plpgsql
security invoker
set search_path=public,private
as $$
declare actor_role public.nkkams_role;
begin
 if auth.uid() is null then return new; end if;
 select role into actor_role from public.profiles where id=auth.uid() and is_active=true;
 if actor_role is null then raise exception 'Active staff account required'; end if;
 if actor_role='teacher' and (
   new.left_date is distinct from old.left_date
   or new.is_active is distinct from old.is_active
 ) then raise exception 'Only an Admin can mark a student as Left or reactivate a student'; end if;
 return new;
end;
$$;
drop trigger if exists nkkams_guard_student_left_fields on public.students;
create trigger nkkams_guard_student_left_fields before update on public.students
for each row execute function private.nkkams_guard_student_left_fields();