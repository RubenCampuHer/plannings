-- Permet jerarquia de plans (parent_plan_id): per a viatges llargs amb sub-plans per país/regió.
-- ON DELETE SET NULL: si esborres el pare, els fills queden orfes top-level en lloc de desaparèixer.
-- L'usuari pot reparenta'ls o esborrar-los manualment després.
alter table plans
  add column parent_plan_id text references plans(id) on delete set null;

create index plans_parent_id_idx on plans(parent_plan_id);
