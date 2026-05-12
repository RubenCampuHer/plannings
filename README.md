# plannings

Web privada per a 2 usuaris (Ruben + parella) tipus diari compartit de plans: viatges llargs, escapades de cap de setmana i sortides d'un dia. Catalana, càlida, gens corporativa.

## Stack

- **Frontend**: Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · framer-motion · lucide-react
- **Base de dades + Auth**: Supabase (Postgres + Auth magic link + RLS)
- **Mapes**: react-leaflet + OpenStreetMap tiles
- **Geocoding**: Nominatim (OSM, gratis, sense API key)
- **IA**: Google Gemini 2.0 Flash via `@google/genai` (free tier 1500 req/dia)
- **Schema versionat**: Supabase CLI + migrations

## Funcionalitats actuals

### Plans
- 3 tipus: **viatge llarg** (`deep`), **escapada** (`weekend`), **dia** (`day`)
- 4 estats: `planning` / `active` / `completed` / `archived`
- Camps: títol, destinació, dates, pressupost, resum, cos Markdown, portada (degradat CSS o preset)
- CRUD complet: crear, editar, esborrar, arxivar/desarxivar

### Detall del plan
- Mapa amb marcadors numerats + polilínia entre punts
- Galeria de fotos (encara amb degradats CSS — imatges reals a M4.2)
- Checklist amb items i due dates
- Despeses per categoria amb total i moneda
- Documents (metadata només — upload real a M4)
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
  plan-detail/
    cover-hero.tsx          # Portada del plan amb parallax
    map-section.tsx         # Wrapper SSR-safe del mapa
    map-view.tsx            # react-leaflet (client-only)
    markdown-body.tsx       # Renderitzat Markdown
    plan-actions-bar.tsx    # Botons Editar/Arxivar/Esborrar
    plan-form.tsx           # Formulari de crear/editar
    places-editor.tsx       # Buscador Nominatim + llista de llocs + mini-mapa
    polish-with-ai.tsx      # Botó Polish + panel de suggeriments
    day-plan-templates.tsx  # Chips composables per a plans de dia
    photo-gallery.tsx       # Galeria de fotos (gradient placeholder)
    expense-table.tsx       # Taula de despeses amb total
    checklist.tsx           # Llista d'items (read-only, M3.3 farà editable)
    document-list.tsx       # Llista de documents
    place-list.tsx          # Llista numerada de llocs
  ui/                       # Primitives (Button, Badge, Chip)
lib/
  supabase-server.ts        # Client Supabase server-side amb cookies
  supabase-middleware.ts    # Client per al proxy/middleware
  plans.ts                  # Lectures (getPlans, getPlanById, ...)
  plan-actions.ts           # Server actions CRUD (create, update, delete, archive)
  place-actions.ts          # Server actions llocs + geocodeSearch (Nominatim)
  ai-actions.ts             # Server actions Polish amb IA (Gemini)
  auth-actions.ts           # requestMagicLink, signOut
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
- M3.4: PlacesEditor amb geocoding Nominatim
- M5.1: Polish amb IA (Gemini 2.0 Flash)

### Pròxim
- M3.3 — checklist editable inline al detall (~1h)
- M4.1 — TOC automàtic d'H2 als plans `deep` (~2h, sense schema)
- M4.2-4 — imatges reals via Supabase Storage (portada + galeria + body inline) (~7h total)
- M5.2 — import des de Word (mammoth + Gemini) per al viatge d'Àsia 2027 (~4h)

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
