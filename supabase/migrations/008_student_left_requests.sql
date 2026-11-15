create table if not exists public.student_left_requests (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.students(id) on delete restrict,
 requested_by uuid not null references public.profiles(id) on delete restrict,
 reason text not null check (length(trim(reason)) between 3 and 1000),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists student_left_requests_pending_idx on public.student_left_requests(status,created_at desc);
alter table public.student_left_requests enable row level security;
create policy "active users submit student left requests" on public.student_left_requests
for insert to authenticated with check (
 private.nkkams_is_active_user()
 and requested_by=(select auth.uid())
 and status='pending'
);
create policy "admins read student left requests" on public.student_left_requests
for select to authenticated using (private.nkkams_is_admin());
create policy "admins review student left requests" on public.student_left_requests
for update to authenticated using (private.nkkams_is_admin())
with check (private.nkkams_is_admin() and reviewed_by=(select auth.uid()));
