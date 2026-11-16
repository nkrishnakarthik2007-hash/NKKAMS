alter table public.organization_requests alter column employee_id drop not null;
alter table public.organization_requests add column if not exists message text;
alter table public.organization_requests add column if not exists phone text;
alter table public.organization_requests add column if not exists email text;
alter table public.organization_requests add column if not exists requester_user_id uuid references auth.users(id);
alter table public.organization_requests add column if not exists reviewed_by uuid references public.profiles(id);
alter table public.organization_requests add column if not exists reviewed_at timestamptz;
drop policy if exists "student admin delete" on public.students;
drop policy if exists "org requests global read" on public.organization_requests;
create policy "org requests global read" on public.organization_requests for select to authenticated
using(exists(select 1 from public.profiles me where me.id=auth.uid() and me.is_active and me.role in('super_admin','platform_admin')));
revoke all on function public.nkkams_current_role() from public,anon,authenticated;
revoke all on function public.nkkams_current_org() from public,anon,authenticated;
revoke execute on function public.nkkams_is_active_user() from anon;
revoke execute on function public.nkkams_is_admin() from anon;