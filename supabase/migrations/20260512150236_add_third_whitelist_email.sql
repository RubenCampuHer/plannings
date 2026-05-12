-- Afegim un tercer email autoritzat (el Gmail personal de Ruben).
insert into allowed_emails (email, note) values
  ('rubencampuher@gmail.com', 'Ruben (Gmail personal)')
on conflict (email) do nothing;
