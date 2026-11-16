-- Holidays are tenant-specific; two organisations may observe different dates.
update public.holidays set organization_id=(select id from public.organizations where slug='hetero') where organization_id is null;
alter table public.holidays alter column organization_id set not null;
alter table public.holidays drop constraint if exists holidays_pkey;
alter table public.holidays add constraint holidays_pkey primary key(organization_id,holiday_date);