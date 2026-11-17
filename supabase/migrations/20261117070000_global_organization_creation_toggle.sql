-- Global organisation self-service registration control.
-- The setting is read and changed only through the privileged admin-users Edge Function.
create table if not exists public.platform_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant all on public.platform_settings to service_role;
insert into public.platform_settings(setting_key,setting_value)
values ('organization_creation_enabled','true'::jsonb)
on conflict (setting_key) do nothing;
