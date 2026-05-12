-- M2: schema inicial per a la web 'plannings'
-- Reflecteix els tipus de lib/types.ts. Tot en snake_case dins del DB,
-- el mapping a camelCase es fa a la capa lib/plans.ts.

create type plan_type as enum ('deep', 'weekend', 'day', 'wishlist');
create type plan_status as enum ('planning', 'active', 'completed', 'archived');

create table plans (
  id              text primary key,
  title           text not null,
  type            plan_type not null,
  status          plan_status not null default 'planning',
  cover           text not null,
  destination     text,
  start_date      date,
  end_date        date,
  budget_total    numeric,
  budget_currency text,
  summary         text not null,
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table places (
  id            text primary key,
  plan_id       text not null references plans(id) on delete cascade,
  name          text not null,
  country       text,
  lat           double precision not null,
  lng           double precision not null,
  notes         text,
  order_index   integer not null default 0,
  arrival_date  date
);
create index places_plan_id_idx on places(plan_id);

create table checklist_items (
  id        text primary key,
  plan_id   text not null references plans(id) on delete cascade,
  text      text not null,
  done      boolean not null default false,
  due_date  date
);
create index checklist_plan_id_idx on checklist_items(plan_id);

create table expenses (
  id            text primary key,
  plan_id       text not null references plans(id) on delete cascade,
  category      text not null,
  description   text,
  amount        numeric not null,
  currency      text not null,
  is_estimated  boolean not null default true
);
create index expenses_plan_id_idx on expenses(plan_id);

create table plan_documents (
  id          text primary key,
  plan_id     text not null references plans(id) on delete cascade,
  filename    text not null,
  mime_type   text not null,
  uploaded_at date not null,
  size_kb     integer
);
create index documents_plan_id_idx on plan_documents(plan_id);

create table plan_photos (
  id        text primary key,
  plan_id   text not null references plans(id) on delete cascade,
  caption   text,
  gradient  text,
  taken_at  date
);
create index photos_plan_id_idx on plan_photos(plan_id);

-- Row Level Security: tot obert de moment (M2-B sense auth).
-- A M2-A afegirem auth + policies que limitin a la whitelist de 2 emails.
alter table plans            enable row level security;
alter table places           enable row level security;
alter table checklist_items  enable row level security;
alter table expenses         enable row level security;
alter table plan_documents   enable row level security;
alter table plan_photos      enable row level security;

create policy "open read all"  on plans           for select using (true);
create policy "open write all" on plans           for all    using (true) with check (true);
create policy "open read all"  on places          for select using (true);
create policy "open write all" on places          for all    using (true) with check (true);
create policy "open read all"  on checklist_items for select using (true);
create policy "open write all" on checklist_items for all    using (true) with check (true);
create policy "open read all"  on expenses        for select using (true);
create policy "open write all" on expenses        for all    using (true) with check (true);
create policy "open read all"  on plan_documents  for select using (true);
create policy "open write all" on plan_documents  for all    using (true) with check (true);
create policy "open read all"  on plan_photos     for select using (true);
create policy "open write all" on plan_photos     for all    using (true) with check (true);
