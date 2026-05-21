-- M9: Per-plan sharing foundation
-- Introduïm `plan_members` (qui té accés a quin pla) i `plans.owner_id` (creator).
-- Tots els plans existents queden amb owner=Ruben i 2 members (Ruben + parella).
-- Substituïm les policies "auth read/write" amplíssimes per checks de membership.
--
-- La whitelist d'auth segueix viva — M10 la treurà quan tinguem auth pública.

-- =====================
-- 1) TAULA plan_members
-- =====================
create table plan_members (
  plan_id   text not null references plans(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index plan_members_user_idx on plan_members(user_id);

alter table plan_members enable row level security;

-- =====================
-- 2) plans.owner_id
-- =====================
alter table plans add column owner_id uuid references auth.users(id);

-- =====================
-- 3) BACKFILL
--    Tots els plans existents pertanyen a Ruben i tenen Ruben+parella com members.
-- =====================
do $$
declare
  ruben_id   uuid;
  parella_id uuid;
begin
  select id into ruben_id   from auth.users where lower(email) = 'rubencampuher@gmail.com' limit 1;
  select id into parella_id from auth.users where lower(email) = 'aconapell@gmail.com'     limit 1;

  if ruben_id is null then
    raise exception 'No s''ha trobat rubencampuher@gmail.com a auth.users — cancel·lant migration.';
  end if;
  if parella_id is null then
    raise exception 'No s''ha trobat aconapell@gmail.com a auth.users — cancel·lant migration.';
  end if;

  update plans set owner_id = ruben_id where owner_id is null;

  insert into plan_members (plan_id, user_id)
    select id, ruben_id from plans
    on conflict do nothing;

  insert into plan_members (plan_id, user_id)
    select id, parella_id from plans
    on conflict do nothing;
end $$;

-- Un cop populated, owner_id és obligatori.
alter table plans alter column owner_id set not null;

-- =====================
-- 4) RLS plan_members
--    - read: només pots veure membres dels plans on tu ja ets membre.
--    - insert: pots inserir-te a tu mateix si ets l'owner del pla (per al
--      flow createPlan). M11 afegirà una segona policy per invitacions.
--    - delete: pots treure't a tu mateix (leave).
-- =====================
create policy "see co-members" on plan_members
  for select to authenticated
  using (
    exists (
      select 1 from plan_members m2
      where m2.plan_id = plan_members.plan_id
        and m2.user_id = auth.uid()
    )
  );

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

-- =====================
-- 5) RLS plans — substitueix les policies "auth read/write" velles
-- =====================
drop policy if exists "auth read"  on plans;
drop policy if exists "auth write" on plans;

create policy "members read" on plans
  for select to authenticated
  using (
    exists (
      select 1 from plan_members m
      where m.plan_id = plans.id and m.user_id = auth.uid()
    )
  );

-- Insert: l'owner_id ha de coincidir amb auth.uid(). El plan_members es crearà
-- en una segona INSERT just després (vegeu lib/plan-actions.ts createPlan).
create policy "owner inserts plan" on plans
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "members update" on plans
  for update to authenticated
  using (
    exists (
      select 1 from plan_members m
      where m.plan_id = plans.id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from plan_members m
      where m.plan_id = plans.id and m.user_id = auth.uid()
    )
  );

create policy "members delete" on plans
  for delete to authenticated
  using (
    exists (
      select 1 from plan_members m
      where m.plan_id = plans.id and m.user_id = auth.uid()
    )
  );

-- =====================
-- 6) RLS taules filles — places, checklist_items, expenses,
--    plan_documents, plan_photos, plan_messages.
--    Totes comprovem membership via plan_members.
-- =====================
drop policy if exists "auth read"  on places;
drop policy if exists "auth write" on places;
create policy "members access" on places
  for all to authenticated
  using (
    exists (
      select 1 from plan_members m
      where m.plan_id = places.plan_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from plan_members m
      where m.plan_id = places.plan_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "auth read"  on checklist_items;
drop policy if exists "auth write" on checklist_items;
create policy "members access" on checklist_items
  for all to authenticated
  using (
    exists (
      select 1 from plan_members m
      where m.plan_id = checklist_items.plan_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from plan_members m
      where m.plan_id = checklist_items.plan_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "auth read"  on expenses;
drop policy if exists "auth write" on expenses;
create policy "members access" on expenses
  for all to authenticated
  using (
    exists (
      select 1 from plan_members m
      where m.plan_id = expenses.plan_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from plan_members m
      where m.plan_id = expenses.plan_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "auth read"  on plan_documents;
drop policy if exists "auth write" on plan_documents;
create policy "members access" on plan_documents
  for all to authenticated
  using (
    exists (
      select 1 from plan_members m
      where m.plan_id = plan_documents.plan_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from plan_members m
      where m.plan_id = plan_documents.plan_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "auth read"  on plan_photos;
drop policy if exists "auth write" on plan_photos;
create policy "members access" on plan_photos
  for all to authenticated
  using (
    exists (
      select 1 from plan_members m
      where m.plan_id = plan_photos.plan_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from plan_members m
      where m.plan_id = plan_photos.plan_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "auth read"  on plan_messages;
drop policy if exists "auth write" on plan_messages;
create policy "members access" on plan_messages
  for all to authenticated
  using (
    exists (
      select 1 from plan_members m
      where m.plan_id = plan_messages.plan_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from plan_members m
      where m.plan_id = plan_messages.plan_id and m.user_id = auth.uid()
    )
  );

-- =====================
-- 7) RLS storage (bucket plan-photos)
--    Els paths actuals són {plan_id}/{filename}, així que extreiem el plan_id
--    del primer segment i comprovem membership.
-- =====================
drop policy if exists "auth read photos"   on storage.objects;
drop policy if exists "auth insert photos" on storage.objects;
drop policy if exists "auth update photos" on storage.objects;
drop policy if exists "auth delete photos" on storage.objects;

create policy "members read photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'plan-photos'
    and exists (
      select 1 from plan_members m
      where m.user_id = auth.uid()
        and m.plan_id = split_part(name, '/', 1)
    )
  );

create policy "members insert photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plan-photos'
    and exists (
      select 1 from plan_members m
      where m.user_id = auth.uid()
        and m.plan_id = split_part(name, '/', 1)
    )
  );

create policy "members update photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'plan-photos'
    and exists (
      select 1 from plan_members m
      where m.user_id = auth.uid()
        and m.plan_id = split_part(name, '/', 1)
    )
  )
  with check (
    bucket_id = 'plan-photos'
    and exists (
      select 1 from plan_members m
      where m.user_id = auth.uid()
        and m.plan_id = split_part(name, '/', 1)
    )
  );

create policy "members delete photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'plan-photos'
    and exists (
      select 1 from plan_members m
      where m.user_id = auth.uid()
        and m.plan_id = split_part(name, '/', 1)
    )
  );
