-- Seed d'exemples per provar les funcionalitats noves (no és una migration).
-- Idempotent: tornar a executar-lo no duplica res.
--
-- Aplica'l com vulguis:
--   a) Supabase Dashboard → SQL Editor → enganxa-ho i Run.
--   b) psql amb la connection string del projecte.
--
-- Què afegeix:
--   • Sub-plans `asia-tailandia-2027` i `asia-vietnam-2027` (fills d'`asia-oceania-2027`).
--   • Plan `active` `berlin-mai-2026` perquè aparegui la card "ara mateix" al home.
--   • Plan `day` `cinema-divendres-2026` amb el template aplicat per veure els stubs fadeats.

-- =====================
-- PLANS
-- =====================
insert into plans
  (id, title, type, status, cover, destination, start_date, end_date,
   budget_total, budget_currency, summary, body, parent_plan_id, created_at, updated_at)
values
-- 1) Sub-plan Tailàndia (fill d'asia-oceania-2027)
('asia-tailandia-2027', 'Tailàndia (3 setmanes)', 'deep', 'planning',
 'linear-gradient(135deg, #F4A26E 0%, #F8C8A0 60%, #C9DCC4 100%)',
 'Tailàndia',
 '2027-03-08', '2027-03-29', 1800, 'EUR',
 'Primera etapa del viatge llarg. Comencem per Bangkok, pugem al nord (Chiang Mai) i acabem a les illes del sud.',
 E'## La idea\n\nNo volem córrer. Tres setmanes és just el que cal per tastar les tres cares de Tailàndia: caos i sopars de carrer (Bangkok), muntanya i temples (Chiang Mai), i mar (illes del sud).\n\n## Bangkok (4-5 dies)\n\n- Sopar a algun *street food* del **Chinatown** una nit.\n- **Wat Pho** i **Wat Arun** dia tranquil.\n- **Chatuchak market** dissabte si caiem en cap de setmana.\n- Dormir prop de **Banglamphu** o **Phra Nakhon** — més calmat que Sukhumvit.\n\n## Chiang Mai (7-8 dies)\n\n- Visitar el **Doi Suthep** un dia clar al matí.\n- **Cooking class** una tarda.\n- Excursió de dia o dos al **Doi Inthanon**.\n- Mirar si val la pena pujar a **Pai** (ruta panoràmica, però 3h de minivan amb revolts).\n\n## Illes del sud (7-9 dies)\n\nDecidir entre **Krabi/Railay** (escalada, més tranquil) o **Phuket → Koh Phi Phi → Koh Lanta** (més bullici). Probablement combinarem una nit Krabi + 4-5 nits a Koh Lanta.\n\n## Logística\n\n- Vols interns Bangkok ↔ Chiang Mai amb Nok Air o AirAsia.\n- **Visat**: no cal per estades < 30 dies amb passaport espanyol.\n- Targeta SIM al mateix aeroport de Bangkok (AIS o TrueMove).',
 'asia-oceania-2027', '2026-05-13', '2026-05-13'),

-- 2) Sub-plan Vietnam (fill d'asia-oceania-2027)
('asia-vietnam-2027', 'Vietnam (3 setmanes)', 'deep', 'planning',
 'linear-gradient(135deg, #A8C4A2 0%, #F8C8A0 50%, #F4A26E 100%)',
 'Vietnam',
 '2027-04-01', '2027-04-22', 1600, 'EUR',
 'De nord a sud, descobrint un país que diuen que enamora. Hanoi i Hoi An com a peces claus.',
 E'## La idea\n\nEntrem per **Hanoi**, baixem fent parada al centre (**Hoi An**) i acabem al sud (**Saigon** i el **Mekong**). Costes amb tren nocturn quan tingui sentit.\n\n## Hanoi (5 dies)\n\n- Casc antic per perdre-s''hi a peu.\n- Excursió a **Ha Long Bay** o **Lan Ha Bay** (millor: menys turística).\n- **Train Street** pel vermut.\n\n## Hoi An i centre (6-7 dies)\n\n- Hoi An és el cor del viatge: ciutat antiga, mercats nocturns, fer-nos un vestit a mida si fa gràcia.\n- Una nit a **Hue** per veure la ciutadella imperial.\n- Banys a **An Bang Beach** al matí.\n\n## Saigon i Mekong (6-7 dies)\n\n- 2-3 dies a la ciutat (Bui Vien, mercats).\n- Excursió de 2 dies pel **Mekong** des de Can Tho.\n- Dia a **Mui Ne** si tenim temps (dunes vermelles).\n\n## Logística\n\n- **Visat electrònic** (e-Visa) obligatori per espanyols — 30 dies, gestionar 1 mes abans.\n- Vacuna recomanada: **tifoidea**, **hepatitis A**.\n- Tren nocturn Hanoi → Hue és una experiència.',
 'asia-oceania-2027', '2026-05-13', '2026-05-13'),

-- 3) Plan actiu "Berlín a maig" — dispara la card "ara mateix" al home.
('berlin-mai-2026', 'Una setmana a Berlín', 'weekend', 'active',
 'linear-gradient(160deg, #B8CFD8 0%, #6B97A8 50%, #3A2E2A 100%)',
 'Berlín, Alemanya',
 '2026-05-11', '2026-05-17', 720, 'EUR',
 'Set dies de mercats de vinils, dj sets a galeries i passejades llargues pel Tiergarten. Hi som ara mateix.',
 E'## La setmana\n\nVam arribar dilluns al matí. Allotjament a **Friedrichshain**, a quatre minuts del RAW Gelände. Plovia. Vam dormir tot el matí.\n\n## Imprescindibles\n\n- Sopar tailandès a **Edd''s** un dia entre setmana.\n- Vermut a **Klunkerkranich** si fa sol.\n- Diumenge: vinils al **Flohmarkt am Mauerpark** + karaoke a la tarda.\n- **East Side Gallery** caminant al vespre.\n\n## Notes del moment\n\nDimecres va sortir el sol per fi, vam fer pícnic al Tiergarten. Dijous concert a la Volksbühne. Divendres pendent decidir.',
 null, '2026-05-08', '2026-05-13'),

-- 4) Plan `day` amb template aplicat sense omplir — mostrar el fade dels stubs.
('cinema-divendres-2026', 'Dia de cinema i sopar', 'day', 'planning',
 'linear-gradient(135deg, #F8C8A0 0%, #F4A26E 40%, #C9DCC4 100%)',
 'Barcelona',
 '2026-05-22', '2026-05-22', 50, 'EUR',
 'Pel·lícula a la tarda i sopar tranquil. Encara per concretar.',
 E'## El plan\n\nDia per cinema i sopar. Pla relaxat, sense pressa.\n\n## Cinema\n\n- Pel·lícula: \n- Sessió a: \n- Cinema: \n\n## Sopar\n\n- On: \n- Hora: \n- Reserva feta?:',
 null, '2026-05-12', '2026-05-12')
on conflict (id) do update set
  title=excluded.title, type=excluded.type, status=excluded.status, cover=excluded.cover,
  destination=excluded.destination, start_date=excluded.start_date, end_date=excluded.end_date,
  budget_total=excluded.budget_total, budget_currency=excluded.budget_currency,
  summary=excluded.summary, body=excluded.body,
  parent_plan_id=excluded.parent_plan_id, updated_at=excluded.updated_at;

-- =====================
-- PLACES (sub-plans i Berlín)
-- =====================
insert into places (id, plan_id, name, country, lat, lng, order_index, arrival_date, notes) values
-- Tailàndia
('th1','asia-tailandia-2027','Bangkok','Tailàndia',13.7563,100.5018,0,'2027-03-08','Arribada. 4-5 nits prop de Banglamphu.'),
('th2','asia-tailandia-2027','Chiang Mai','Tailàndia',18.7883,98.9853,1,'2027-03-14','Cooking class i Doi Suthep.'),
('th3','asia-tailandia-2027','Pai','Tailàndia',19.358,98.4366,2,'2027-03-19','Opcional si tenim ganes de muntanya.'),
('th4','asia-tailandia-2027','Krabi','Tailàndia',8.0863,98.9063,3,'2027-03-22','Escalada i Railay.'),
('th5','asia-tailandia-2027','Koh Lanta','Tailàndia',7.6017,99.0359,4,'2027-03-25','5 nits per acabar.'),
-- Vietnam
('vn1','asia-vietnam-2027','Hanoi','Vietnam',21.0285,105.8542,0,'2027-04-01','Casc antic + Ha Long.'),
('vn2','asia-vietnam-2027','Hue','Vietnam',16.4637,107.5909,1,'2027-04-07','Ciutadella imperial. Una nit.'),
('vn3','asia-vietnam-2027','Hoi An','Vietnam',15.8801,108.338,2,'2027-04-09','Cor del viatge. 4-5 nits.'),
('vn4','asia-vietnam-2027','Ho Chi Minh','Vietnam',10.7626,106.6602,3,'2027-04-14','Saigon. 3 nits.'),
('vn5','asia-vietnam-2027','Can Tho','Vietnam',10.0452,105.7469,4,'2027-04-18','Excursió Mekong de 2 dies.'),
-- Berlín (5 punts)
('br1','berlin-mai-2026','RAW Gelände','Alemanya',52.5081,13.4541,0,'2026-05-11',null),
('br2','berlin-mai-2026','Tiergarten','Alemanya',52.5145,13.3501,1,null,'Pícnic dimecres.'),
('br3','berlin-mai-2026','East Side Gallery','Alemanya',52.5050,13.4396,2,null,null),
('br4','berlin-mai-2026','Mauerpark','Alemanya',52.5419,13.4017,3,'2026-05-17','Flohmarkt diumenge.'),
('br5','berlin-mai-2026','Klunkerkranich','Alemanya',52.4789,13.4419,4,null,'Vermut amb vistes.')
on conflict (id) do nothing;

-- =====================
-- CHECKLIST
-- =====================
insert into checklist_items (id, plan_id, text, done, due_date) values
-- Tailàndia
('thc1','asia-tailandia-2027','Reservar primera nit a Bangkok',false,'2027-02-01'),
('thc2','asia-tailandia-2027','Mirar vols interns BKK ↔ Chiang Mai',false,'2027-01-15'),
('thc3','asia-tailandia-2027','Cooking class a Chiang Mai (Asia Scenic o Sammy''s)',false,null),
('thc4','asia-tailandia-2027','Decidir Krabi vs Phi Phi',false,null),
-- Vietnam
('vnc1','asia-vietnam-2027','Tramitar e-Visa (1 mes abans!)',false,'2027-03-01'),
('vnc2','asia-vietnam-2027','Vacunes: tifoidea + hepatitis A',false,'2026-12-15'),
('vnc3','asia-vietnam-2027','Reservar creuer Ha Long (Lan Ha millor)',false,'2027-03-15'),
('vnc4','asia-vietnam-2027','Tren nocturn Hanoi → Hue',false,'2027-03-20'),
-- Berlín
('brc1','berlin-mai-2026','Comprovar el temps cada matí',true,null),
('brc2','berlin-mai-2026','Comprar abonament setmanal BVG',true,null),
('brc3','berlin-mai-2026','Comprar disc a Mauerpark',false,'2026-05-17'),
('brc4','berlin-mai-2026','Anar al concert de la Volksbühne',true,null),
('brc5','berlin-mai-2026','Recordar que dilluns torna a ploure',false,null)
on conflict (id) do nothing;

-- =====================
-- EXPENSES (només Berlín, per donar vida a la card)
-- =====================
insert into expenses (id, plan_id, category, description, amount, currency, is_estimated) values
('bre1','berlin-mai-2026','Vols','Anada i tornada',180,'EUR',false),
('bre2','berlin-mai-2026','Allotjament','Airbnb a Friedrichshain',280,'EUR',false),
('bre3','berlin-mai-2026','Menjar',null,160,'EUR',true),
('bre4','berlin-mai-2026','Concert + entrades',null,55,'EUR',false),
('bre5','berlin-mai-2026','Transport BVG',null,45,'EUR',false)
on conflict (id) do nothing;
