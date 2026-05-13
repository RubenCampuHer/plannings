-- Limita la whitelist exactament a aconapell@gmail.com i rubencampuher@gmail.com.
-- També elimina qualsevol auth.user previ (creat amb magic link) perquè es puguin
-- registrar de nou amb contrasenya via el nou flow.

delete from public.allowed_emails;

insert into public.allowed_emails (email, note) values
  ('aconapell@gmail.com',     'Parella'),
  ('rubencampuher@gmail.com', 'Ruben');

-- Esborra usuaris existents (típicament creats amb magic link sense password)
-- perquè el signUp amb password els pugui crear nets.
delete from auth.users
  where lower(email) not in (select lower(email) from public.allowed_emails);
