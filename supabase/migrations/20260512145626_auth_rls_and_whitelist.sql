-- M2-A: Auth, whitelist i RLS estricte
-- Crea taula allowed_emails, trigger que rebutja signups d'emails fora de la whitelist,
-- i tanca les policies obertes que teníem perquè només els autenticats puguin llegir/escriure.

-- =====================
-- WHITELIST
-- =====================
create table allowed_emails (
  email      text primary key,
  added_at   timestamptz not null default now(),
  note       text
);

insert into allowed_emails (email, note) values
  ('ruben@aima.chat',     'Ruben'),
  ('aconapell@gmail.com', 'Parella');

-- Trigger: si algú intenta crear un usuari amb un email fora de la whitelist, peta.
create or replace function public.enforce_email_whitelist()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.email is null then
    return new;
  end if;
  if not exists (
    select 1 from public.allowed_emails where lower(email) = lower(new.email)
  ) then
    raise exception 'Email % no està autoritzat a entrar a plannings.', new.email
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_whitelist on auth.users;
create trigger enforce_email_whitelist
  before insert on auth.users
  for each row execute function public.enforce_email_whitelist();

-- =====================
-- RLS TANCADA
-- =====================
-- Treure les policies obertes inicials
drop policy if exists "open read all"  on plans;
drop policy if exists "open write all" on plans;
drop policy if exists "open read all"  on places;
drop policy if exists "open write all" on places;
drop policy if exists "open read all"  on checklist_items;
drop policy if exists "open write all" on checklist_items;
drop policy if exists "open read all"  on expenses;
drop policy if exists "open write all" on expenses;
drop policy if exists "open read all"  on plan_documents;
drop policy if exists "open write all" on plan_documents;
drop policy if exists "open read all"  on plan_photos;
drop policy if exists "open write all" on plan_photos;

-- Només els autenticats poden tocar res. Com que la whitelist controla qui pot
-- arribar a estar autenticat, qualsevol auth.users existent ja és de confiança.
create policy "auth read"  on plans           for select to authenticated using (true);
create policy "auth write" on plans           for all    to authenticated using (true) with check (true);
create policy "auth read"  on places          for select to authenticated using (true);
create policy "auth write" on places          for all    to authenticated using (true) with check (true);
create policy "auth read"  on checklist_items for select to authenticated using (true);
create policy "auth write" on checklist_items for all    to authenticated using (true) with check (true);
create policy "auth read"  on expenses        for select to authenticated using (true);
create policy "auth write" on expenses        for all    to authenticated using (true) with check (true);
create policy "auth read"  on plan_documents  for select to authenticated using (true);
create policy "auth write" on plan_documents  for all    to authenticated using (true) with check (true);
create policy "auth read"  on plan_photos     for select to authenticated using (true);
create policy "auth write" on plan_photos     for all    to authenticated using (true) with check (true);

-- allowed_emails: amagada per defecte. Només la pot llegir l'usuari autenticat
-- per veure'n la pròpia entrada (no és sensible, però no cal exposar-la sencera).
alter table allowed_emails enable row level security;
create policy "self only" on allowed_emails
  for select to authenticated
  using (lower(email) = lower((auth.jwt() ->> 'email')));
