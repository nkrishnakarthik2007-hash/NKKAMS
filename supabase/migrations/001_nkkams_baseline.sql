-- NKKAMS baseline schema (matches the live Supabase database).
create extension if not exists pgcrypto;
do $$ begin create type public.nkkams_role as enum ('super_admin','admin','teacher'); exception when duplicate_object then null; end $$;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 employee_id text not null unique,
 name text not null,
 role public.nkkams_role not null default 'teacher',
 is_active boolean not null default true,
 email text,
 phone text,
 created_by uuid references public.profiles(id),
 updated_by uuid references public.profiles(id),
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create table public.students (
 id uuid primary key default gen_random_uuid(),
 employee_id text not null unique,
 name text not null,
 joining_date date,
 left_date date,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 check (left_date is null or joining_date is null or left_date >= joining_date)
);
create table public.attendance (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.students(id) on delete restrict,
 attendance_date date not null,
 status text not null check(status in ('present','absent')),
 marked_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(student_id,attendance_date)
);
create table public.holidays (
 holiday_date date primary key,
 reason text,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.admin_contacts (
 id uuid primary key default gen_random_uuid(),
 employee_id text unique,
 name text not null,
 whatsapp text,
 email text,
 is_active boolean not null default true,
 created_by uuid references public.profiles(id),
 updated_by uuid references public.profiles(id)
);
create table public.audit_events (
 id bigint generated always as identity primary key,
 actor_id uuid references public.profiles(id),
 operation text not null,
 table_name text not null,
 record_id text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create or replace function public.nkkams_is_active_user()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active); $$;
create or replace function public.nkkams_is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('super_admin','admin')); $$;
revoke execute on function public.nkkams_is_active_user() from public, anon;
grant execute on function public.nkkams_is_active_user() to authenticated;
revoke execute on function public.nkkams_is_admin() from public, anon;
grant execute on function public.nkkams_is_admin() to authenticated;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.holidays enable row level security;
alter table public.admin_contacts enable row level security;
alter table public.audit_events enable row level security;
create policy "profile self read" on public.profiles for select to authenticated using (id=auth.uid() or public.nkkams_is_admin());
create policy "student read active" on public.students for select to authenticated using (public.nkkams_is_active_user());
create policy "student admin insert" on public.students for insert to authenticated with check (public.nkkams_is_admin());
create policy "student admin update" on public.students for update to authenticated using (public.nkkams_is_admin()) with check (public.nkkams_is_admin());
create policy "student admin delete" on public.students for delete to authenticated using (public.nkkams_is_admin());
create policy "attendance read active" on public.attendance for select to authenticated using (public.nkkams_is_active_user());
create policy "attendance insert active" on public.attendance for insert to authenticated with check (public.nkkams_is_active_user() and (marked_by is null or marked_by=auth.uid()));
create policy "attendance update active" on public.attendance for update to authenticated using (public.nkkams_is_active_user()) with check (public.nkkams_is_active_user() and (marked_by is null or marked_by=auth.uid()));
create policy "holidays read active" on public.holidays for select to authenticated using (public.nkkams_is_active_user());
create policy "holidays admin manage" on public.holidays for all to authenticated using (public.nkkams_is_admin()) with check (public.nkkams_is_admin());
create policy "contacts read active" on public.admin_contacts for select to authenticated using (public.nkkams_is_active_user());
create policy "contacts admin manage" on public.admin_contacts for all to authenticated using (public.nkkams_is_admin()) with check (public.nkkams_is_admin());
create policy "audit admin read" on public.audit_events for select to authenticated using (public.nkkams_is_admin());
create index attendance_date_idx on public.attendance(attendance_date);
create index attendance_student_date_idx on public.attendance(student_id,attendance_date);
create index students_name_idx on public.students(name);

create or replace function public.update_managed_profile(
 p_actor_id uuid,p_employee_id text,p_name text,p_email text,p_phone text
) returns void language plpgsql security definer set search_path=public
as $$
begin
 if not exists(select 1 from public.profiles p where p.id=p_actor_id and p.is_active and p.role in ('super_admin','admin')) then
  raise exception 'Not authorized';
 end if;
 update public.profiles set name=p_name,email=p_email,phone=p_phone,updated_by=p_actor_id,updated_at=now()
 where employee_id=upper(p_employee_id);
 if not found then raise exception 'User not found'; end if;
 update public.admin_contacts set name=p_name,email=p_email,whatsapp=p_phone,updated_by=p_actor_id
 where employee_id=upper(p_employee_id);
end $$;
revoke execute on function public.update_managed_profile(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.update_managed_profile(uuid,text,text,text,text) to service_role;
