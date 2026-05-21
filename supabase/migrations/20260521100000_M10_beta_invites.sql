-- M10: Beta invites
-- Substituïm la taula estàtica `allowed_emails` per `beta_invites`, que té el
-- mateix paper (gatekeeping de qui pot fer signup) però admet metadata útil
-- (qui ha convidat, quan, si s'ha utilitzat). El trigger d'auth queda redirigit
-- a la nova taula.
--
-- Mantenim `allowed_emails` deprecada (no l'eliminem) per si calgués revertir.
-- M11 hi afegirà la lògica d'invitacions per-pla.

-- =====================
-- 1) TAULA beta_invites
-- =====================
create table beta_invites (
  email      text primary key,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  used_at    timestamptz,
  note       text
);

-- Migrem entrades existents de allowed_emails (Ruben + parella).
insert into beta_invites (email, note, used_at)
  select lower(email), note, now()
  from allowed_emails
on conflict (email) do nothing;

alter table beta_invites enable row level security;

-- Només l'usuari pot veure la seva pròpia entrada (no exposem la llista).
create policy "self only" on beta_invites
  for select to authenticated
  using (lower(email) = lower((auth.jwt() ->> 'email')));

-- =====================
-- 2) TRIGGER reescrit
-- =====================
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
    select 1 from public.beta_invites where lower(email) = lower(new.email)
  ) then
    raise exception 'Aquest correu (%) no està convidat a la beta de plannings.', new.email
      using errcode = 'check_violation';
  end if;
  -- Marquem la invitació com utilitzada per saber qui ha entrat.
  update public.beta_invites
    set used_at = coalesce(used_at, now())
    where lower(email) = lower(new.email);
  return new;
end;
$$;

-- Recreem el trigger (el nom és el mateix; CREATE OR REPLACE FUNCTION ja l'actualitza,
-- però fem el drop+create per ser explícits si la signatura canvia en el futur).
drop trigger if exists enforce_email_whitelist on auth.users;
create trigger enforce_email_whitelist
  before insert on auth.users
  for each row execute function public.enforce_email_whitelist();
