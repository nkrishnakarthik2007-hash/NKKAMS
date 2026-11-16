-- Remove public execution of helper functions and pin trigger search paths.
create or replace function public.nkkams_is_active_user()
returns boolean language sql stable security invoker set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active); $$;
create or replace function public.nkkams_is_admin()
returns boolean language sql stable security invoker set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and p.role in('super_admin','platform_admin','organization_head','admin')); $$;
alter function public.touch() set search_path=public;
alter function public.reject_audit_mutation() set search_path=public;