-- M8.1: plan_messages per al copilot de xat.
-- Una conversa per plan (no cal una taula plan_conversations separada de moment);
-- els missatges són append-only amb role 'user' / 'assistant'.

create table plan_messages (
  id           uuid primary key default gen_random_uuid(),
  plan_id      text not null references plans(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  created_at   timestamptz not null default now()
);

create index plan_messages_plan_idx on plan_messages(plan_id, created_at);

alter table plan_messages enable row level security;

create policy "auth read"
  on plan_messages for select to authenticated using (true);

create policy "auth write"
  on plan_messages for all to authenticated using (true) with check (true);
