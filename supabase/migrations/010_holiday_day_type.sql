alter table public.holidays
add column if not exists day_type text not null default 'holiday'
check (day_type in ('holiday','non_working'));