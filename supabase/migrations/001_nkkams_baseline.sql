-- NKKAMS clean baseline schema. Run only after reviewing the security notes.
create extension if not exists pgcrypto;
create type public.nkkams_role as enum ('super_admin','admin','teacher');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id text not null unique,
  full_name text not null,
  role public.nkkams_role not null default 'teacher',
  is_active boolean not null default true,
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
  is_active boolean not null default true
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

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.holidays enable row level security;
alter table public.admin_contacts enable row level security;
alter table public.audit_events enable row level security;

-- A signed-in active profile can read the staff/student/attendance workspace.
create policy "profiles read active workspace" on public.profiles for select to authenticated
using (id = auth.uid() or exists(select 1 from public.profiles me where me.id=auth.uid() and me.role in ('super_admin','admin') and me.is_active));
create policy "students workspace read" on public.students for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active));
create policy "students admin write" on public.students for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('super_admin','admin')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('super_admin','admin')));
create policy "attendance workspace read" on public.attendance for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active));
create policy "attendance workspace insert" on public.attendance for insert to authenticated
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active) and (marked_by is null or marked_by=auth.uid()));
create policy "attendance workspace update" on public.attendance for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active));
create policy "holidays read" on public.holidays for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active));
create policy "holidays admin write" on public.holidays for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('super_admin','admin')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('super_admin','admin')));
create policy "contacts read" on public.admin_contacts for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active));
create policy "contacts admin write" on public.admin_contacts for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('super_admin','admin')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('super_admin','admin')));
create policy "audit admin read" on public.audit_events for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in ('super_admin','admin')));

create index attendance_date_idx on public.attendance(attendance_date);
create index attendance_student_date_idx on public.attendance(student_id,attendance_date);
create index students_name_idx on public.students(name);
