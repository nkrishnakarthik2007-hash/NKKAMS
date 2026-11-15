-- Student lifecycle editing for all authenticated active staff.
-- Soft removal is enforced by withholding DELETE privileges/policies.
drop policy if exists "student admin insert" on public.students;
drop policy if exists "student admin update" on public.students;
drop policy if exists "student admin delete" on public.students;
create policy "active users add students" on public.students
for insert to authenticated with check (public.nkkams_is_active_user());
create policy "active users update students" on public.students
for update to authenticated using (public.nkkams_is_active_user())
with check (public.nkkams_is_active_user());

create table if not exists public.password_reset_requests (
 id uuid primary key default gen_random_uuid(),
 requester_user_id uuid not null references public.profiles(id) on delete cascade,
 employee_id text not null,
 message text,
 status text not null default 'pending' check(status in ('pending','reviewed','resolved','rejected')),
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists password_reset_requests_status_created_idx
on public.password_reset_requests(status,created_at desc);
alter table public.password_reset_requests enable row level security;
create policy "users submit own reset requests" on public.password_reset_requests
for insert to authenticated with check (
 requester_user_id=(select auth.uid()) and
 employee_id=upper((select employee_id from public.profiles where id=(select auth.uid())))
);
create policy "admins view reset requests" on public.password_reset_requests
for select to authenticated using (public.nkkams_is_admin());
create policy "admins update reset requests" on public.password_reset_requests
for update to authenticated using (public.nkkams_is_admin()) with check (public.nkkams_is_admin());

insert into public.admin_contacts(employee_id,name,whatsapp,email,is_active)
values ('241536','Nairuti Krishna Karthik','9490091800','nkrishnakarthik2007@gmail.com',true)
on conflict (employee_id) do update set
 name=excluded.name,whatsapp=excluded.whatsapp,email=excluded.email,is_active=true;
