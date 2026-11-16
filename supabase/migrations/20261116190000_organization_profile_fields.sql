alter table public.organizations
  add column if not exists organization_type text,
  add column if not exists location text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists description text;

alter table public.organization_requests
  alter column contact_name drop not null,
  add column if not exists organization_type text,
  add column if not exists location text,
  add column if not exists description text;
