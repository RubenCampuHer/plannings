-- M11.1: Plan invitations (co-edició)
-- Convidem persones per email a un pla concret. Generem un token random,
-- expira en 7 dies, single-use. Quan el convidat clica el link i el seu
-- email d'auth coincideix, l'afegim a plan_members.

create table plan_invitations (
  id          uuid primary key default gen_random_uuid(),
  plan_id     text not null references plans(id) on delete cascade,
  email       text not null,
  token       text not null unique,
  invited_by  uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index plan_invitations_plan_idx  on plan_invitations(plan_id);
create index plan_invitations_email_idx on plan_invitations(lower(email));
create index plan_invitations_token_idx on plan_invitations(token);

alter table plan_invitations enable row level security;

-- Members del pla poden veure les invitations del seu pla (per gestionar-les).
create policy "members read plan invitations" on plan_invitations
  for select to authenticated
  using (public.is_plan_member(plan_id));

-- Members del pla poden crear invitations.
create policy "members create invitations" on plan_invitations
  for insert to authenticated
  with check (
    public.is_plan_member(plan_id)
    and invited_by = auth.uid()
  );

-- Members poden esborrar invitations del seu pla (p.ex. cancel·lar).
create policy "members delete invitations" on plan_invitations
  for delete to authenticated
  using (public.is_plan_member(plan_id));

-- L'invitat (per email) també pot llegir la SEVA invitation per veure de
-- quin pla és. Útil al flow d'accept.
create policy "invitee reads own invitation" on plan_invitations
  for select to authenticated
  using (lower(email) = lower((auth.jwt() ->> 'email')));

-- L'invitat pot marcar l'accepted_at quan acceptés. Però la verificació
-- (token + email match) es fa al server action que crida amb service role.
-- No necessitem una update policy per a usuaris anon/authenticated.
