-- Seed inicial: els 6 plans de lib/mock-data.ts.
-- Idempotent: si torna a executar-se, només actualitza els camps.

-- =====================
-- PLANS
-- =====================
insert into plans (id, title, type, status, cover, destination, start_date, end_date, budget_total, budget_currency, summary, body, created_at, updated_at) values
('asia-oceania-2027', 'Sis mesos per Àsia i Oceania', 'deep', 'planning',
 'linear-gradient(135deg, #F4A26E 0%, #E27A45 45%, #6B97A8 100%)',
 'Sud-est asiàtic · Austràlia · Nova Zelanda',
 '2027-03-08', '2027-08-30', 18000, 'EUR',
 'Sis mesos travessant Àsia i acabant a Oceania. Tenim la columna vertebral i moltes ganes — encara queden mil decisions per prendre.',
 E'## La idea\n\nUna temporada llarga, sense pressa, deixant que cada lloc duri el que ha de durar. Comencem pel **sud-est asiàtic** (3 mesos) i acabem creuant fins a **Oceania** (3 mesos més). El pressupost és aproximat i molts dies encara estan oberts.\n\n## Etapes\n\n1. **Tailàndia (~3 setmanes)** — Bangkok, Chiang Mai, illes del sud.\n2. **Vietnam (~3 setmanes)** — Hanoi, Hoi An, deltes del Mekong.\n3. **Cambodja (~10 dies)** — Phnom Penh i Siem Reap.\n4. **Indonèsia (~4 setmanes)** — Bali, Yogyakarta, alguna illa més.\n5. **Singapur (~4 dies)** — escala.\n6. **Austràlia (~7 setmanes)** — Sydney, costa est cap a Cairns.\n7. **Nova Zelanda (~6 setmanes)** — Auckland, illa nord i sud.\n\n## Pendents\n\n- Decidir si volem fer una ruta tipus *banana pancake* o saltar més.\n- Mirar visats múltiples per Austràlia.\n- Tancar dates per allargar/escurçar trams segons preu.\n- Cap a març del 2026 caldria reservar primer vol llarg.',
 '2026-01-15', '2026-05-10'),

('tarifa-surf-2026', 'Surf a Tarifa', 'weekend', 'planning',
 'linear-gradient(135deg, #8FB4C2 0%, #B8CFD8 45%, #F8C8A0 100%)',
 'Tarifa, Cadis',
 '2026-07-10', '2026-07-12', 380, 'EUR',
 'Tres dies de surf, vent i platja amb la teva taula nova. Hostal senzill i poc més.',
 E'## Plan del cap de setmana\n\nVol o tren fins a Sevilla i cotxe llogat fins a Tarifa. Hi som divendres a la nit i tornem diumenge tard.\n\n## On dormir\n\nMirar **Hostal Africa** o **La Casa Amarilla** — pensions petites al casc antic, sobre 60 €/nit.\n\n## Què fer\n\n- Surf a **Los Lances** (per a la teva primera vegada amb taula nova).\n- Migdia a **Bolonia**, banyets i menjar peix.\n- Vespres a **Punta Paloma** per la posta.',
 '2026-04-30', '2026-05-04'),

('dia-gracia-carmel', 'Diumenge per Gràcia i el Carmel', 'day', 'planning',
 'linear-gradient(135deg, #F4A26E 0%, #F8C8A0 60%, #C9DCC4 100%)',
 'Barcelona',
 '2026-05-24', '2026-05-24', 60, 'EUR',
 'Matí pausat al barri, vermut a la plaça i pujada als búnquers per la posta.',
 E'## El plan\n\nComencem amb cafè a **Onna** o **Slowmov**. Volta per **Plaça del Diamant**, llibreria, vermut a algun bar de tota la vida. Pugem a peu fins als **Búnquers del Carmel** abans de la posta.\n\n## Per a sopar\n\nSi tornem aviat, fer-nos un *pa amb tomàquet* a casa i obrir vi.',
 '2026-05-08', '2026-05-08'),

('roma-febrer', 'Escapada a Roma', 'weekend', 'completed',
 'linear-gradient(135deg, #A8C4A2 0%, #F8C8A0 50%, #F4A26E 100%)',
 'Roma, Itàlia',
 '2026-02-14', '2026-02-16', 540, 'EUR',
 'Tres dies caminant per cafès, gelats i pasta. Va ploure dissabte i va ser perfecte.',
 E'## Què vam fer\n\nVam dormir prop de **Trastevere**. Dissabte plovia, vam acabar tot el matí en un cafè petit prop del Vaticà. Diumenge vam pujar al **Pincio** abans del vol.\n\n## Coses que recordar per la pròxima\n\n- Reservar el **Vaticà** amb antelació de veritat.\n- El gelat de **Otaleg** val cada cèntim.',
 '2026-01-08', '2026-02-17')
on conflict (id) do update set
  title=excluded.title, type=excluded.type, status=excluded.status, cover=excluded.cover,
  destination=excluded.destination, start_date=excluded.start_date, end_date=excluded.end_date,
  budget_total=excluded.budget_total, budget_currency=excluded.budget_currency,
  summary=excluded.summary, body=excluded.body, updated_at=excluded.updated_at;

-- =====================
-- PLACES
-- =====================
insert into places (id, plan_id, name, country, lat, lng, order_index, arrival_date) values
('p1','asia-oceania-2027','Bangkok','Tailàndia',13.7563,100.5018,0,'2027-03-08'),
('p2','asia-oceania-2027','Chiang Mai','Tailàndia',18.7883,98.9853,1,'2027-03-22'),
('p3','asia-oceania-2027','Hanoi','Vietnam',21.0285,105.8542,2,'2027-04-05'),
('p4','asia-oceania-2027','Hoi An','Vietnam',15.8801,108.338,3,'2027-04-15'),
('p5','asia-oceania-2027','Phnom Penh','Cambodja',11.5564,104.9282,4,'2027-05-01'),
('p6','asia-oceania-2027','Siem Reap','Cambodja',13.3633,103.8564,5,'2027-05-08'),
('p7','asia-oceania-2027','Yogyakarta','Indonèsia',-7.7956,110.3695,6,'2027-05-18'),
('p8','asia-oceania-2027','Bali','Indonèsia',-8.4095,115.1889,7,'2027-05-28'),
('p9','asia-oceania-2027','Singapur','Singapur',1.3521,103.8198,8,'2027-06-12'),
('p10','asia-oceania-2027','Sydney','Austràlia',-33.8688,151.2093,9,'2027-06-18'),
('p11','asia-oceania-2027','Cairns','Austràlia',-16.9186,145.7781,10,'2027-07-12'),
('p12','asia-oceania-2027','Auckland','Nova Zelanda',-36.8485,174.7633,11,'2027-07-25'),
('p13','asia-oceania-2027','Queenstown','Nova Zelanda',-45.0312,168.6626,12,'2027-08-15'),
('tp1','tarifa-surf-2026','Tarifa centre','Espanya',36.0143,-5.6063,0,null),
('tp2','tarifa-surf-2026','Playa de Los Lances','Espanya',36.0289,-5.6196,1,null),
('tp3','tarifa-surf-2026','Bolonia','Espanya',36.0855,-5.7733,2,null),
('tp4','tarifa-surf-2026','Punta Paloma','Espanya',36.0667,-5.7197,3,null),
('bp1','dia-gracia-carmel','Plaça del Diamant','Espanya',41.4051,2.1571,0,null),
('bp2','dia-gracia-carmel','Slowmov','Espanya',41.4072,2.1572,1,null),
('bp3','dia-gracia-carmel','Búnquers del Carmel','Espanya',41.4185,2.158,2,null),
('rp1','roma-febrer','Trastevere','Itàlia',41.8896,12.4695,0,null),
('rp2','roma-febrer','Pincio','Itàlia',41.9116,12.4831,1,null),
('rp3','roma-febrer','Pantheon','Itàlia',41.8986,12.4769,2,null)
on conflict (id) do nothing;

-- =====================
-- CHECKLIST
-- =====================
insert into checklist_items (id, plan_id, text, done, due_date) values
('c1','asia-oceania-2027','Comprar guies del sud-est asiàtic',true,null),
('c2','asia-oceania-2027','Revisar vacunes a sanitat internacional',false,'2026-12-01'),
('c3','asia-oceania-2027','Treure visat múltiple per Austràlia',false,'2027-01-10'),
('c4','asia-oceania-2027','Reservar primer vol Barcelona → Bangkok',false,'2026-09-01'),
('c5','asia-oceania-2027','Renovar passaport',true,null),
('c6','asia-oceania-2027','Decidir ruta interna per Indonèsia',false,null),
('c7','asia-oceania-2027','Mirar assegurança de viatge llarga durada',false,'2027-02-01'),
('tc1','tarifa-surf-2026','Reservar hostal',false,null),
('tc2','tarifa-surf-2026','Llogar cotxe a Sevilla',false,null),
('tc3','tarifa-surf-2026','Comprovar previsió de vent',false,null),
('tc4','tarifa-surf-2026','Crema solar i mossegada',false,null),
('bc1','dia-gracia-carmel','Mirar hora de la posta',false,null),
('bc2','dia-gracia-carmel','Comprar vi al matí',false,null),
('rc1','roma-febrer','Comprar entrades Vaticà',true,null),
('rc2','roma-febrer','Reservar restaurant divendres',true,null),
('rc3','roma-febrer','Carregar bateria portàtil',true,null)
on conflict (id) do nothing;

-- =====================
-- EXPENSES
-- =====================
insert into expenses (id, plan_id, category, description, amount, currency, is_estimated) values
('e1','asia-oceania-2027','Vols','Internacionals i interns',4200,'EUR',true),
('e2','asia-oceania-2027','Allotjament','Mix de hostals i Airbnb',5800,'EUR',true),
('e3','asia-oceania-2027','Menjar',null,3200,'EUR',true),
('e4','asia-oceania-2027','Activitats','Bussejar, trekkings, museus',2400,'EUR',true),
('e5','asia-oceania-2027','Transports locals',null,1600,'EUR',true),
('e6','asia-oceania-2027','Visats i assegurança',null,800,'EUR',true),
('te1','tarifa-surf-2026','Vols/tren',null,90,'EUR',true),
('te2','tarifa-surf-2026','Cotxe llogat',null,110,'EUR',true),
('te3','tarifa-surf-2026','Allotjament',null,130,'EUR',true),
('te4','tarifa-surf-2026','Menjar i extres',null,80,'EUR',true),
('be1','dia-gracia-carmel','Cafès i vermut',null,25,'EUR',true),
('be2','dia-gracia-carmel','Llibres',null,25,'EUR',true),
('be3','dia-gracia-carmel','Sopar',null,10,'EUR',true),
('re1','roma-febrer','Vols',null,180,'EUR',false),
('re2','roma-febrer','Allotjament',null,220,'EUR',false),
('re3','roma-febrer','Menjar',null,95,'EUR',false),
('re4','roma-febrer','Entrades',null,45,'EUR',false)
on conflict (id) do nothing;

-- =====================
-- DOCUMENTS
-- =====================
insert into plan_documents (id, plan_id, filename, mime_type, uploaded_at, size_kb) values
('d1','asia-oceania-2027','ruta-asia-oceania-v3.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document','2026-04-22',312),
('d2','asia-oceania-2027','vols-tentatius.pdf','application/pdf','2026-05-01',145)
on conflict (id) do nothing;

-- =====================
-- PHOTOS
-- =====================
insert into plan_photos (id, plan_id, caption, gradient) values
('ph1','asia-oceania-2027','Inspiració Bali','linear-gradient(135deg, #A8C4A2, #F4A26E)'),
('ph2','asia-oceania-2027','Costa est Austràlia','linear-gradient(135deg, #8FB4C2, #B8CFD8)'),
('ph3','asia-oceania-2027','Temples Siem Reap','linear-gradient(135deg, #F4A26E, #E27A45)'),
('ph4','asia-oceania-2027','Fiordland','linear-gradient(135deg, #6B97A8, #3A2E2A)'),
('tph1','tarifa-surf-2026','Los Lances','linear-gradient(135deg, #B8CFD8, #8FB4C2)'),
('tph2','tarifa-surf-2026','Bolonia','linear-gradient(135deg, #F8C8A0, #F4A26E)'),
('rph1','roma-febrer','Trastevere al matí','linear-gradient(135deg, #F4A26E, #F8C8A0)'),
('rph2','roma-febrer','Pantheon','linear-gradient(135deg, #A8C4A2, #C9DCC4)')
on conflict (id) do nothing;
