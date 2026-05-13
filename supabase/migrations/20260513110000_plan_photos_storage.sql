-- Storage real per a les fotos dels plans.
-- M4.2-3: bucket privat 'plan-photos' + RLS authenticated + nous camps a plan_photos.

-- 1) Columnes noves a plan_photos.
--    storage_path: path dins del bucket, p.ex. "asia-2027/<uuid>.jpg".
--    mime_type: per saber com renderitzar i validar uploads.
alter table plan_photos add column storage_path text;
alter table plan_photos add column mime_type    text;

-- 2) Bucket privat amb límit de 20MB/imatge i mime types restringits.
--    Public=false → cal signed URLs per accedir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'plan-photos', 'plan-photos', false,
    20971520, -- 20 MB
    array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif','image/gif']
  )
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3) RLS al bucket: només authenticated (=whitelist via trigger d'auth).
--    No restringim per path: els dos usuaris veuen tot el contingut compartit.
drop policy if exists "auth read photos"   on storage.objects;
drop policy if exists "auth insert photos" on storage.objects;
drop policy if exists "auth update photos" on storage.objects;
drop policy if exists "auth delete photos" on storage.objects;

create policy "auth read photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'plan-photos');

create policy "auth insert photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'plan-photos');

create policy "auth update photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'plan-photos')
  with check (bucket_id = 'plan-photos');

create policy "auth delete photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'plan-photos');
