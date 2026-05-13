# plannings

Web privada per a 2 usuaris (Ruben + parella) tipus diari compartit de plans: viatges llargs, escapades de cap de setmana i sortides d'un dia. Catalana, càlida, gens corporativa.

## Stack

- **Frontend**: Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · framer-motion · lucide-react
- **Base de dades + Auth**: Supabase (Postgres + Auth magic link + RLS)
- **Mapes**: react-leaflet + OpenStreetMap tiles
- **Geocoding**: Nominatim (OSM, gratis, sense API key)
- **IA**: Google Gemini 2.5 Flash via `@google/genai` (free tier generós)
- **Schema versionat**: Supabase CLI + migrations

## Funcionalitats actuals

### Plans
- 3 tipus: **viatge llarg** (`deep`), **escapada** (`weekend`), **dia** (`day`)
- 4 estats: `planning` / `active` / `completed` / `archived`
- Camps: títol, destinació, dates, pressupost, resum, cos Markdown, portada (degradat CSS o preset)
- CRUD complet: crear, editar, esborrar, arxivar/desarxivar
- **Plans niats** (`parent_plan_id`): un viatge llarg pot tenir sub-plans per país/regió, cada un amb el seu propi mapa/fotos/checklist. Pare → "Sub-plans" card a la sidebar amb llista i botó "+ Afegir sub-plan". Fill → breadcrumb cap al pare. Home i arxiu només mostren top-level. `ON DELETE SET NULL`: si esborres el pare, els fills queden orfes top-level.

### Detall del plan
- **Estances** (`?v=mapa|album`): segmented control sota el hero que separa el cos del plan ("Resum", default sense param), el mapa+llocs ("Mapa") i la galeria de fotos ("Àlbum") en vistes germanes. Mapa només si hi ha llocs; Àlbum sempre per a `deep`/`weekend`, només si hi ha fotos per a `day`.
- Mapa amb marcadors numerats + polilínia entre punts (a l'estança Mapa)
- Galeria de fotos reals a l'estança Àlbum: upload drag-drop o clic (multi-fitxer, jpg/png/webp/heic/avif/gif, max 20MB), Supabase Storage privat amb signed URLs (TTL 1h), delete amb trash icon a hover. Plans `deep` i `weekend` tenen Àlbum sempre (per pujar la primera); `day` només si ja hi ha fotos.
- Checklist editable + despeses + documents a la sidebar (visible només al Resum)
- TOC automàtic d'H2 a la sidebar (≥3 H2) amb active highlight via IntersectionObserver
- Renderitzat Markdown amb headings, llistes, èmfasi, etc.

### Editar plan (`/plans/[id]/edit`)
- Formulari amb tots els camps top-level
- Plantilles ràpides per a "dia": chips de cinema/sopar/vermut/passeig/concert/etc. que componen títol+resum+body Markdown
- **Editor de llocs**: buscador Nominatim ("Cinema Verdi Barcelona" → coords automàtiques) + llista numerada + mini-mapa en directe
- **Polish amb IA**: botó que crida Gemini per enriquir el cos + suggerir llocs (amb search_query) + suggerir items de checklist. L'usuari tilda què acceptar.

### Auth
- Magic link (no contrasenyes) via Supabase
- Whitelist hardcoded a la BD (trigger SQL rebutja signups d'emails no autoritzats)
- Sign-out menu amb inicial de l'usuari
- Middleware Next.js que redirigeix a `/login` si no autenticat

## Setup local

### Requisits
- Node.js 20+
- Compte de Supabase
- API key gratuïta de Google AI Studio (per al Polish amb IA)

### Instal·lació
```bash
npm install
```

### Variables d'entorn
Crea un fitxer `.env.local` a l'arrel amb:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<el-teu-projecte>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
GOOGLE_AI_API_KEY=AIza...
```

- **Supabase URL i anon key**: a Supabase Dashboard → Project Settings → API
- **Gemini key**: a https://aistudio.google.com/app/apikey (free tier sense targeta)

### Base de dades
Si treballes des de zero:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --include-seed
```

Migrations a `supabase/migrations/` (versionades). Seed inicial a `supabase/seed.sql` (4 plans d'exemple).

### Configuració Auth a Supabase Dashboard
1. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
2. **Authentication → Email Templates → Magic Link**: enganxa-hi el contingut de `supabase/email-templates/magic-link.html`
3. **Whitelist d'emails**: editar manualment a Supabase Dashboard → Table Editor → `allowed_emails`

### Dev server
```bash
npm run dev
```

Obre http://localhost:3000 — et redirigirà a `/login`. Demana un magic link al teu email whitelistejat.

## Estructura del projecte

```
app/
  page.tsx                  # Home: llista plans actius + filtres
  archive/                  # Plans arxivats
  login/                    # Magic link form
  auth/callback/            # Intercanvi de code per sessió
  plans/[id]/               # Detall del plan
  plans/[id]/edit/          # Form d'edició + PlacesEditor + Polish IA
  plans/new/                # Crear plan
components/
  plan-card.tsx             # Targeta de plan a la home
  plan-filters.tsx          # Chips de filtre + cerca
  site-header.tsx           # Header amb nav i avatar
  user-menu.tsx             # Dropdown sign-out
  home-calendar.tsx         # Vista temporal al home: plans agrupats per mes d'inici
  plan-detail/
    cover-hero.tsx          # Portada del plan amb parallax
    map-section.tsx         # Wrapper SSR-safe del mapa
    map-view.tsx            # react-leaflet (client-only)
    plan-breadcrumb.tsx     # "← Pare" als sub-plans
    plan-rooms.tsx          # Segmented control Resum/Mapa/Àlbum (estances via ?v=)
    plan-toc.tsx            # Sumari sticky d'H2 amb active highlight (≥3 H2)
    sub-plans-card.tsx      # Llista de sub-plans + "+ Afegir sub-plan" (al pare)
    sub-plans-timeline.tsx  # Mini-Gantt horitzontal dels sub-plans amb indicador "avui"
    editable-summary.tsx    # Toggle inline del summary (italic prose ⇄ textarea)
    editable-body.tsx       # Toggle inline del body (Markdown render ⇄ textarea + image inserter)
    word-import-flow.tsx    # Upload .docx + preview de l'estructura proposada + crear
    plan-actions-bar.tsx    # Botons Editar/Arxivar/Esborrar
    plan-form.tsx           # Formulari de crear/editar
    places-editor.tsx       # Buscador Nominatim + llista de llocs + mini-mapa
    polish-with-ai.tsx      # Botó Polish + panel de suggeriments
    day-plan-templates.tsx  # Chips composables per a plans de dia
    cover-editor.tsx        # Pujar/treure imatge de portada des de /plans/[id]/edit
    inline-image-inserter.tsx # Botó al label del body que puja i insereix `![](pp:...)` al cursor
    markdown-body.tsx       # Render Markdown async + IDs a H2 + fade dels stubs + resolució `pp:` a signed URLs
    photo-gallery.tsx       # Galeria amb imatges reals (Supabase Storage) + delete
    photo-uploader.tsx      # Drag-drop / clic per pujar fotos (direct-upload al bucket)
    expense-table.tsx       # Taula de despeses amb total
    checklist.tsx           # Llista editable: afegir, marcar fet, esborrar (optimistic)
    document-list.tsx       # Llista de documents
    place-list.tsx          # Llista numerada de llocs
  ui/                       # Primitives (Button, Badge, Chip)
lib/
  supabase-server.ts        # Client Supabase server-side amb cookies
  supabase-browser.ts       # Singleton del client de navegador (per upload directe)
  supabase-middleware.ts    # Client per al proxy/middleware
  plans.ts                  # Lectures (getPlans, getPlanById, ...)
  plan-actions.ts           # Server actions CRUD (create, update, delete, archive)
  place-actions.ts          # Server actions llocs + geocodeSearch (Nominatim)
  checklist-actions.ts      # Server actions checklist (add/toggle/delete)
  photo-actions.ts          # Server actions fotos (registerPhoto / deletePhoto)
  cover-actions.ts          # Server actions portada (setCoverImage / clearCoverImage)
  ai-actions.ts             # Server actions Polish amb IA (Gemini)
  word-import-actions.ts    # Server actions import .docx (mammoth + Gemini analyze + create plans)
  auth-actions.ts           # signInWithPassword, signUpWithPassword, signOut
  toc.ts                    # extractH2Headings + slugger (per al sumari)
  types.ts                  # Tipus TypeScript (Plan, Place, etc.)
  format.ts                 # Helpers de format (dates, money, labels)
  utils.ts                  # cn() per Tailwind
proxy.ts                    # Middleware d'auth (Next.js 16: proxy en lloc de middleware)
supabase/
  migrations/               # SQL versionat
  seed.sql                  # Dades inicials
  email-templates/          # HTML per magic link email
  config.toml               # Config CLI
```

## Disseny

- **Paleta**: crema `#FBF7F0` · melocotó `#F4A26E` · sàlvia `#A8C4A2` · blau polsegós `#8FB4C2` · tinta marró `#3A2E2A`
- **Tipografies**: Fraunces (serif, titulars) + Inter (sans, cos) + Caveat (handwriting, detalls)
- **Estètica**: bordes generosos, ombres suaus, microanimacions a hover. Càlida, no corporativa.

## Roadmap

### Fet ✅
- M1: Esqueleto + UI + dades mock
- M2-A: Auth magic link + whitelist trigger + RLS estricta
- M2-B: Supabase migrations + seed + connexió de `lib/plans.ts`
- M3.1: Esborrar + arxivar
- M3.2: Editar + crear plans (top-level)
- M3.3: Checklist editable inline al detall (afegir/marcar/esborrar amb optimistic UI)
- M3.4: PlacesEditor amb geocoding Nominatim
- M4.1: TOC automàtic d'H2 a la sidebar (smooth scroll + IntersectionObserver per active highlight)
- M4.2: Portada amb imatge real opcional (column `cover_image_path`) + edit inline via CoverEditor; degradat es manté com a fallback
- M4.3: Àlbum amb fotos reals via Supabase Storage (bucket privat + signed URLs + uploader drag-drop)
- M4.4: Imatges inline al body Markdown (`![alt](pp:plan-id/inline-uuid.jpg)`). MarkdownBody async resol `pp:` a signed URLs a render time; botó "Inserir imatge" a l'edit page puja al bucket i insereix la referència al cursor del textarea
- M5.1: Polish amb IA (Gemini 2.5 Flash)
- M6 (V1): "Ara mateix" auto-detectat per dates (status=`active` O avui dins `[start_date, end_date]`) + mini-Gantt al detall del pare amb sub-plans (barres horitzontals + indicador vertical "avui")
- M6 (V2): Calendari general al home entre "ara mateix" i el grid; agrupa plans per mes d'inici en ordre cronològic amb indicador "som aquí" al mes actual
- Edició inline del Resum: summary i body editables directament al detall (pencil icon a hover) sense haver d'anar a `/edit`. Manté el flow del Polish IA + image inserter dins el mode edit del body.
- M5.2: Import des de Word (`.docx`) a `/plans/import`. Mammoth extreu text; Gemini 2.5 Flash decideix si és un pla únic o un pla pare amb sub-plans per país. UI mostra preview (comptadors checklist + body) i només crea res després de "Crear N plans". Sense places (corre Polish IA després si vols).
- Plans niats: parent_plan_id + sub-plans card al pare + breadcrumb al fill

### Pròxim
- M7 — Polish imatges amb IA: Gemini llegeix el body i proposa search queries → Pexels API torna candidats → l'usuari pica quines acceptar → descàrrega server-side + puja al bucket `plan-photos` → apareixen a l'Àlbum. Calen API key gratuita de Pexels (200 req/h) i prompt nou.
- M8 — Conversa amb el plan (AI copilot): panell de xat al detall que rep com a context tot el plan (body, places, checklist, expenses, sub-plans). Dos modes barrejats: **preguntar** ("què val la pena visitar a Hoi An a l'abril?", "quant em deixaré aproximadament?") i **modificar** ("afegeix una parada de 3 dies a Pai", "treu el lloc X", "reescriu la secció de Vols"). Gemini amb function calling per a mutacions, preview de canvis abans d'aplicar, historial de conversa persistit per plan (nova taula `plan_conversations`). Pot ser el feature més diferencial del producte un cop els fonaments estan estables.

### Pendent fora roadmap
- Deploy a Vercel (no fet, tot local)
- Rotar `service_role` key de Supabase (exposada al chat durant el setup)
- Polish UX mòbil (`PlanActionsBar` només a `sm+`)

## Convencions

- **Catalan first**: tots els textos d'UI són en català
- **Server Components per defecte**, `"use client"` només on cal interactivitat
- **Server actions** per a totes les mutacions (no API routes)
- **snake_case al DB, camelCase a TypeScript** — mapping a `lib/plans.ts`
- **Migrations sempre per CLI**, mai SQL directe al dashboard (que quedi al repo)
- **No commitejar mai `.env.local`** — `.gitignore` ja la cobreix
