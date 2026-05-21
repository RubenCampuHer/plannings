-- M11.2: share_token a plans
-- Cada pla pot tenir un únic token actiu de "compartir per duplicar". L'owner
-- el genera quan vol compartir. Qualsevol persona amb el link + autenticada
-- pot duplicar el pla al seu propi compte (nou owner, nou plan_id).
--
-- Sense RLS extra: les policies de plans ja protegeixen quins plans veu cada
-- usuari. Per al flow de duplicat, l'endpoint fa servir service role per
-- llegir el pla origen a partir del token sense passar per RLS.

alter table plans add column share_token text unique;
