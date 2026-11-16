create or replace function public.nkkams_review_org_request(p_request_id uuid,p_status text,p_actor_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare actor public.profiles%rowtype; req public.organization_requests%rowtype; orgid uuid;
begin
 select * into actor from public.profiles where id=p_actor_id and is_active;
 if actor.id is null or actor.role not in('super_admin','platform_admin') then raise exception 'Not authorized'; end if;
 if p_status not in('approved','rejected') then raise exception 'Invalid review status'; end if;
 select * into req from public.organization_requests where id=p_request_id and status='pending' for update;
 if req.id is null then raise exception 'Request not found or already reviewed'; end if;
 if p_status='approved' then
  if exists(select 1 from public.organizations where slug=req.slug) then raise exception 'An organisation with this name is already registered'; end if;
  insert into public.organizations(name,slug,created_by) values(req.organization_name,req.slug,p_actor_id) returning id into orgid;
  insert into public.batches(organization_id,name,created_by) values(orgid,'Default',p_actor_id);
 end if;
 update public.organization_requests set status=p_status,reviewed_by=p_actor_id,reviewed_at=now() where id=p_request_id;
end $$;

create or replace function public.nkkams_review_head_transfer(p_request_id uuid,p_status text,p_actor_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare actor public.profiles%rowtype; req public.organization_head_transfer_requests%rowtype;
begin
 select * into actor from public.profiles where id=p_actor_id and is_active;
 if actor.id is null or actor.role not in('super_admin','platform_admin') then raise exception 'Only website administrators can review a transfer'; end if;
 if p_status not in('approved','rejected') then raise exception 'Invalid transfer decision'; end if;
 select * into req from public.organization_head_transfer_requests where id=p_request_id for update;
 if req.id is null or req.status not in('pending','accepted') then raise exception 'Transfer request is not pending'; end if;
 if p_status='approved' then
  if req.status<>'accepted' then raise exception 'The proposed organisation admin must accept before approval'; end if;
  if not exists(select 1 from public.profiles where id=req.proposed_head_id and is_active and organization_id=req.organization_id and role='admin') then raise exception 'The selected person is no longer an active organisation admin'; end if;
  update public.profiles set role='admin',updated_by=p_actor_id,updated_at=now() where id=req.current_head_id and role='organization_head';
  update public.profiles set role='organization_head',updated_by=p_actor_id,updated_at=now() where id=req.proposed_head_id;
 end if;
 update public.organization_head_transfer_requests set status=p_status,reviewed_by=p_actor_id,reviewed_at=now(),responded_at=coalesce(responded_at,now()) where id=p_request_id;
end $$;

drop policy if exists "student left requests create" on public.student_left_requests;
create policy "student left requests create" on public.student_left_requests for insert to authenticated
with check(requested_by=auth.uid() and exists(
 select 1 from public.profiles me join public.students st on st.id=student_left_requests.student_id
 where me.id=auth.uid() and me.is_active and me.organization_id=st.organization_id
 and private.nkkams_org_is_active(st.organization_id)
));
drop policy if exists "student left requests scoped read" on public.student_left_requests;
create policy "student left requests scoped read" on public.student_left_requests for select to authenticated
using(
 requested_by=auth.uid()
 or exists(select 1 from public.profiles me where me.id=auth.uid() and me.is_active and me.role in('super_admin','platform_admin'))
 or exists(select 1 from public.profiles me join public.students st on st.id=student_left_requests.student_id
  where me.id=auth.uid() and me.is_active and me.role in('organization_head','admin')
  and me.organization_id=st.organization_id and private.nkkams_org_is_active(st.organization_id))
);
drop policy if exists "student left requests scoped update" on public.student_left_requests;
create policy "student left requests scoped update" on public.student_left_requests for update to authenticated
using(
 exists(select 1 from public.profiles me where me.id=auth.uid() and me.is_active and me.role in('super_admin','platform_admin'))
 or exists(select 1 from public.profiles me join public.students st on st.id=student_left_requests.student_id
  where me.id=auth.uid() and me.is_active and me.role in('organization_head','admin')
  and me.organization_id=st.organization_id and private.nkkams_org_is_active(st.organization_id))
)
with check(
 exists(select 1 from public.profiles me where me.id=auth.uid() and me.is_active and me.role in('super_admin','platform_admin'))
 or exists(select 1 from public.profiles me join public.students st on st.id=student_left_requests.student_id
  where me.id=auth.uid() and me.is_active and me.role in('organization_head','admin')
  and me.organization_id=st.organization_id and private.nkkams_org_is_active(st.organization_id))
);

drop policy if exists "reset requests scoped read" on public.password_reset_requests;
create policy "reset requests scoped read" on public.password_reset_requests for select to authenticated
using(
 requester_user_id=auth.uid()
 or exists(select 1 from public.profiles me where me.id=auth.uid() and me.is_active and me.role in('super_admin','platform_admin'))
 or exists(select 1 from public.profiles me join public.profiles target on target.id=password_reset_requests.requester_user_id
  where me.id=auth.uid() and me.is_active and me.role in('organization_head','admin')
  and me.organization_id=target.organization_id and private.nkkams_org_is_active(target.organization_id))
);
drop policy if exists "reset requests scoped update" on public.password_reset_requests;
create policy "reset requests scoped update" on public.password_reset_requests for update to authenticated
using(
 exists(select 1 from public.profiles me where me.id=auth.uid() and me.is_active and me.role in('super_admin','platform_admin'))
 or exists(select 1 from public.profiles me join public.profiles target on target.id=password_reset_requests.requester_user_id
  where me.id=auth.uid() and me.is_active and me.role in('organization_head','admin')
  and me.organization_id=target.organization_id and private.nkkams_org_is_active(target.organization_id))
)
with check(
 exists(select 1 from public.profiles me where me.id=auth.uid() and me.is_active and me.role in('super_admin','platform_admin'))
 or exists(select 1 from public.profiles me join public.profiles target on target.id=password_reset_requests.requester_user_id
  where me.id=auth.uid() and me.is_active and me.role in('organization_head','admin')
  and me.organization_id=target.organization_id and private.nkkams_org_is_active(target.organization_id))
);

drop policy if exists "head transfers scoped read" on public.organization_head_transfer_requests;
create policy "head transfers scoped read" on public.organization_head_transfer_requests for select to authenticated
using(
 exists(select 1 from public.profiles me where me.id=auth.uid() and me.is_active and me.role in('super_admin','platform_admin'))
 or ((proposed_head_id=auth.uid() or current_head_id=auth.uid()) and private.nkkams_org_is_active(organization_id))
);
revoke all on function public.nkkams_review_org_request(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.nkkams_review_head_transfer(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.nkkams_review_org_request(uuid,text,uuid) to service_role;
grant execute on function public.nkkams_review_head_transfer(uuid,text,uuid) to service_role;