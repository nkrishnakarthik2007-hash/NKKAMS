-- Preserve platform Super Admin while granting an explicit second role inside an organisation.
create table if not exists public.organization_memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('organization_head','admin','teacher')),
  batch_id uuid null references public.batches(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id),
  constraint organization_memberships_batch_role_check check (
    (role = 'teacher' and batch_id is not null) or (role <> 'teacher' and batch_id is null)
  )
);
create index if not exists organization_memberships_org_idx on public.organization_memberships(organization_id, is_active);
alter table public.organization_memberships enable row level security;
revoke all on public.organization_memberships from anon, authenticated;
grant all on public.organization_memberships to service_role;

insert into public.organization_memberships(user_id, organization_id, role, is_active, granted_by)
select p.id, o.id, 'organization_head', true, p.id
from public.profiles p cross join public.organizations o
where p.employee_id = '241536' and lower(o.name) = 'hetero'
on conflict (user_id, organization_id)
do update set role='organization_head', batch_id=null, is_active=true;

update public.profiles p set organization_id=o.id, batch_id=null, phone='9490091800', updated_at=now()
from public.organizations o
where p.employee_id='241536' and lower(o.name)='hetero';

create or replace function private.nkkams_actor_role()
returns text language sql stable security definer set search_path=public,private
as $function$
  select case when p.role='super_admin'::nkkams_role then
    coalesce((select m.role from public.organization_memberships m
      where m.user_id=p.id and m.organization_id=p.organization_id and m.is_active=true limit 1),p.role::text)
    else p.role::text end
  from public.profiles p where p.id=auth.uid() and p.is_active=true
$function$;
grant execute on function private.nkkams_actor_role() to authenticated, service_role;
