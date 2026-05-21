-- M9 hotfix: les policies de plan_members feien EXISTS contra plan_members,
-- cosa que reanviava la pròpia policy i provocava "infinite recursion detected
-- in policy for relation plan_members".
--
-- Solució estàndard de Postgres: una funció SECURITY DEFINER que comprova
-- la membership en nom de l'usuari. Com que SECURITY DEFINER salta la RLS
-- de la taula consultada, no hi ha recursió. La marquem com `stable` perquè
-- el planner la pugui inlineiar dins de la mateixa transacció.

create or replace function public.is_plan_member(p_plan_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from plan_members
    where plan_id = p_plan_id
      and user_id = auth.uid()
  );
$$;

-- Permís d'execució per a l'usuari autenticat.
revoke all on function public.is_plan_member(text) from public;
grant execute on function public.is_plan_member(text) to authenticated;

-- ==========================================================================
-- Reescrivim totes les policies que feien EXISTS contra plan_members.
-- ==========================================================================

-- plan_members
drop policy if exists "see co-members"     on plan_members;
drop policy if exists "owner self-insert"  on plan_members;
drop policy if exists "leave plan"         on plan_members;

create policy "see co-members" on plan_members
  for select to authenticated
  using (public.is_plan_member(plan_id));

create policy "owner self-insert" on plan_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from plans p
      where p.id = plan_members.plan_id
        and p.owner_id = auth.uid()
    )
  );

create policy "leave plan" on plan_members
  for delete to authenticated
  using (user_id = auth.uid());

-- plans
drop policy if exists "members read"        on plans;
drop policy if exists "owner inserts plan"  on plans;
drop policy if exists "members update"      on plans;
drop policy if exists "members delete"      on plans;

create policy "members read" on plans
  for select to authenticated
  using (public.is_plan_member(id));

create policy "owner inserts plan" on plans
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "members update" on plans
  for update to authenticated
  using (public.is_plan_member(id))
  with check (public.is_plan_member(id));

create policy "members delete" on plans
  for delete to authenticated
  using (public.is_plan_member(id));

-- Taules filles
drop policy if exists "members access" on places;
create policy "members access" on places
  for all to authenticated
  using (public.is_plan_member(plan_id))
  with check (public.is_plan_member(plan_id));

drop policy if exists "members access" on checklist_items;
create policy "members access" on checklist_items
  for all to authenticated
  using (public.is_plan_member(plan_id))
  with check (public.is_plan_member(plan_id));

drop policy if exists "members access" on expenses;
create policy "members access" on expenses
  for all to authenticated
  using (public.is_plan_member(plan_id))
  with check (public.is_plan_member(plan_id));

drop policy if exists "members access" on plan_documents;
create policy "members access" on plan_documents
  for all to authenticated
  using (public.is_plan_member(plan_id))
  with check (public.is_plan_member(plan_id));

drop policy if exists "members access" on plan_photos;
create policy "members access" on plan_photos
  for all to authenticated
  using (public.is_plan_member(plan_id))
  with check (public.is_plan_member(plan_id));

drop policy if exists "members access" on plan_messages;
create policy "members access" on plan_messages
  for all to authenticated
  using (public.is_plan_member(plan_id))
  with check (public.is_plan_member(plan_id));

-- Storage (plan-photos bucket). El path comença amb el plan_id.
drop policy if exists "members read photos"   on storage.objects;
drop policy if exists "members insert photos" on storage.objects;
drop policy if exists "members update photos" on storage.objects;
drop policy if exists "members delete photos" on storage.objects;

create policy "members read photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'plan-photos'
    and public.is_plan_member(split_part(name, '/', 1))
  );

create policy "members insert photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plan-photos'
    and public.is_plan_member(split_part(name, '/', 1))
  );

create policy "members update photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'plan-photos'
    and public.is_plan_member(split_part(name, '/', 1))
  )
  with check (
    bucket_id = 'plan-photos'
    and public.is_plan_member(split_part(name, '/', 1))
  );

create policy "members delete photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'plan-photos'
    and public.is_plan_member(split_part(name, '/', 1))
  );
