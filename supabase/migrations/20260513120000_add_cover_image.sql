-- M4.2: portada com a imatge real (a sobre del degradat existent).
-- cover_image_path opcional: si està definit, el detall i les cards usen la imatge;
-- si no, segueix el degradat de la columna `cover` (que es manté com a fallback sempre).
alter table plans add column cover_image_path text;
