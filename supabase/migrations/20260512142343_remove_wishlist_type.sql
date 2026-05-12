-- Treure el tipus 'wishlist' (somnis) del sistema.
-- Primer esborrem els plans existents amb aquest tipus (cascade s'encarrega de
-- llocs/checklists/expenses/fotos/docs). Després substituïm l'enum.

delete from plans where type = 'wishlist';

alter type plan_type rename to plan_type_old;
create type plan_type as enum ('deep', 'weekend', 'day');
alter table plans
  alter column type type plan_type using type::text::plan_type;
drop type plan_type_old;
