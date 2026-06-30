-- Itinerari per zones: cada lloc pot pertànyer a una zona/etapa geogràfica
-- (ex. "Siem Reap", "Phnom Penh"). L'estança Itinerari agrupa per aquest camp;
-- la data (arrival_date) segueix sent la data d'inici de la zona.
-- Nullable: els llocs sense zona surten a "Sense zona assignada".

alter table places add column if not exists zone text;
