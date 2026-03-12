# HRX App

A React/Vite SPA that helps users build a resume and find relevant job listings through a guided quiz.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui (Radix UI primitives)
- **Routing**: React Router v6
- **State**: React context + useReducer (hrx-state)
- **Forms**: React Hook Form + Zod
- **Data fetching**: TanStack React Query
- **Job APIs**: hh.ru (HeadHunter) + trudvsem.ru (Работа России) via Vite proxy

## Project Structure

- `src/pages/` — Route-level pages (Index, Quiz, Profile, Results, AdaptResult, Dashboard, Readiness, Guides)
- `src/components/` — Reusable UI components + shadcn/ui primitives in `ui/`
- `src/context/hrx-state.tsx` — Global app state (quiz answers, jobs, theme, etc.)
- `src/data/` — Quiz options, resume helpers, regions, readiness checklist, guides content
  - `quizData.ts` — All quiz data: role groups with hh.ru IDs + search keywords, activities (grouped), software skills (grouped), professional skills (grouped), schedule/employment/salary/restriction options with API mappings
  - `regions.ts` — Region catalog sorted alphabetically
  - `mockResumeHelpers.ts` — Resume text builder from quiz state
- `src/hooks/use-tracking.ts` — Page view tracking hook (sends to /api/track on navigation)
- `src/hooks/use-presets.ts` — Shared preset logic hook (load/save/delete/apply presets, used by HomePresets and PresetManager)
- `src/services/` — API integration layer
  - `jobApi.ts` — Frontend vacancy search client: builds search params from QuizState, calls backend `/api/vacancies/search`, applies scoring/filtering/normalization client-side
  - `regionMapping.ts` — Maps app region IDs to hh.ru area IDs and trudvsem region codes
  - `companyScoring.ts` — Company reliability scoring system
  - `exportResume.ts` — PDF/DOCX/TXT/CSV export
- `src/types/hrx.ts` — TypeScript types for the app state

## Quiz Structure (v3)

6 steps, 10 role groups (47 roles), ~30 software programs, ~27 professional skills:

1. **Где вы находитесь** — Region + Moscow time hours
2. **Целевые должности** — 10 role groups with hh.ru professional_role IDs + search keywords, quick exclusion checkboxes, adjacent roles preference
3. **Опыт работы** — Organization types (9), experience (mapped to hh.ru enum), activities (5 groups), documents (14 types)
4. **Навыки и программы** — Software skills (7 groups, ~30 programs with level selectors), professional skills (5 groups, ~27 skills)
5. **Условия и ограничения** — Schedule days (hh.ru work_schedule_by_days), employment type (hh.ru employment), salary min (single-select, mapped to hh.ru salary param), restrictions with NOT keywords
6. **Проверка** — Summary + "How we'll search" block

## Job Search Integration

Vacancies are fetched in real-time from two public APIs:

1. **hh.ru (HeadHunter)** — `GET /vacancies` with:
   - `text` — role search keywords + NOT exclusion keywords
   - `professional_role` — hh.ru role IDs from selected roles
   - `schedule=remote` — remote-only filter
   - `area` — region from quiz (defaults to `113` = Russia when no region selected)
   - `experience` — mapped from quiz experience selection
   - `salary` + `currency=RUR` + `only_with_salary=true` — minimum salary filter
   - `employment` — full/part/project/probation
   - `work_schedule_by_days` — 5/2, 2/2, flexible, weekend
2. **trudvsem.ru (Работа России)** — `GET /vacancies` or `/vacancies/region/{code}` with `text` param + client-side remote filtering

Architecture: Frontend sends search params to backend `POST /api/vacancies/search`. Backend fetches from hh.ru and trudvsem.ru APIs directly, caches raw results in `vacancy_cache` PostgreSQL table (TTL: 3 hours). Frontend applies scoring, remote filtering, exclusion filtering, and normalization client-side.

Cache key: SHA-256 hash of normalized search params (searchText, roleIds, area, experience, salary, employment, schedules). Identical searches from different users hit the same cache entry.

Cache behavior:
- TTL: 3 hours — subsequent requests with same params return cached data instantly
- Force refresh: `?refresh=true` query param bypasses cache and fetches fresh data
- UI shows cache age ("Вакансии из кэша, найдены N мин. назад") with "Обновить" link

Backend endpoint: `server/vacancyCache.ts` — handles API fetching with retry logic, pagination (up to 20 hh.ru pages), region fallback, and PostgreSQL caching. Stats endpoint: `GET /api/vacancies/cache-stats`.

Vite proxies `/api/vacancies/*` to Express on port 3001.

Strict remote-only filtering: hh.ru uses `schedule=remote` + post-filter by `schedule.id` and `work_format`; trudvsem.ru uses keyword search + schedule field matching.

Geography filter: non-Russia locations (Belarus, Kazakhstan, etc.) are excluded client-side via `isRussianLocation()`. hh.ru defaults to `area=113` (Russia) when no specific region is selected.

Pagination: hh.ru fetches all available pages (`per_page=100`, up to 20 pages / 2000 vacancies max). Trudvsem fetches all available pages (`limit=100`, up to offset 1000).

Fallback search: if strict params return 0 results, relaxed search without experience/salary is attempted (area=113 is preserved).

## Company Scoring System

Each vacancy receives a reliability score (0-100). Scoring is **enabled by default** (toggle in Results page).

Score levels: trusted (75+), normal (50-74), suspicious (30-49), risky (<30).
Status auto-assignment: trusted → "fit", risky → "not_recommended", others → "review".

"Скрыть не рекомендованные" filter is **off** by default — all vacancies (including yellow/red) are shown with warnings.

## QuizState Key Fields

- `targetRoles: string[]` — selected role titles (lookup metadata via `findRoleOption()`)
- `excludedRoleQuick: string[]` — quick exclusion checkbox labels
- `salaryMin: string` — single salary label like "От 40 000 ₽" (parsed to number for API)
- `employmentTypes: string[]` — employment type labels (mapped to hh.ru `employment` param)
- `schedules: string[]` — schedule day labels (mapped to hh.ru `work_schedule_by_days`)
- `restrictions: string[]` — restriction labels (mapped to NOT keywords for search)

## Running the App

```
npm run dev
```

The dev server runs on port 5000.

## Swipe Job Sorting

Jobs tab has a "quick sort" mode (default) with Tinder-like swipe cards:
- Swipe right / tap heart = save, swipe left / tap X = archive
- Undo button returns last decision
- Three sub-tabs: Pending, Saved, Archived
- Decision map (`decisions: Record<string, SwipeDecision>`) keyed by job ID
- `decisionHistory: string[]` for ordered undo
- Can switch to traditional list view via "Список" button

## Resume Export

File exports implemented via browser-side generation:
- **TXT**: Plain text blob download via `file-saver`
- **PDF**: window.print() in new tab (Cyrillic-safe)
- **DOCX**: Built as OpenXML zip archive via `jszip` (Word-compatible)
- **CSV**: Vacancy list export with BOM for Excel compatibility (`;` delimiter), includes reliability score (total + level)

## Backend Server

Express server on port 3001 with PostgreSQL database:

- `server/index.ts` — Express app setup, session middleware, DB table initialization
- `server/db.ts` — PostgreSQL connection pool + Drizzle ORM
- `server/auth.ts` — Auth routes: POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- `server/routes.ts` — CRUD API: GET/POST/DELETE /api/presets, GET/POST/DELETE /api/results
- `server/vacancyCache.ts` — Vacancy search with PostgreSQL caching (TTL 3h): POST /api/vacancies/search, GET /api/vacancies/cache-stats
- `server/ai.ts` — AI resume adaptation via OpenAI ChatGPT: POST /api/ai/adapt
- `server/storage.ts` — Database access layer (Drizzle ORM)
- `shared/schema.ts` — Drizzle schema: users, presets, saved_results tables

Auth: email + bcrypt password hashing, express-session with connect-pg-simple (sessions in PostgreSQL).

Dev command: `concurrently "tsx server/index.ts" "vite"` — runs Express API server and Vite dev server together.

Vite proxies `/api/auth/*`, `/api/presets`, `/api/results`, `/api/admin/*`, `/api/promo/*`, `/api/ai/*` to Express on port 3001.

## AI Resume Adaptation

Route: POST `/api/ai/adapt` (auth-gated). Uses OpenAI GPT-4o-mini.

Flow:
1. Takes user resume text (built from quiz state) + vacancy description
2. Sends to GPT with detailed HR-expert prompt (Russian market adapted)
3. Returns adapted resume + match score + list of changes + match details
4. Auto-runs hallucination check (compares adapted vs original, flags fabrications)
5. If hallucinations detected — auto-fixes by removing fabricated data

Prompt features:
- ATS keyword integration (2-3% density)
- Achievement quantification with strong action verbs
- Strict anti-hallucination rules (no fabricated companies, dates, metrics)
- Russian job market specifics (hh.ru compatibility, date format, education format)
- Response in structured JSON with matchScore, matchDetails, hallucinationCheck

API key: read from `OPENAI_API_KEY` env var or `app_settings` table (admin panel).

Frontend: `src/pages/AdaptResult.tsx` — real-time AI adaptation with loading state, match visualization, changes list, hallucination check results, copy button.

## Admin Panel

Route: `/admin` — password-protected admin dashboard.

- `server/admin.ts` — Admin router: login/logout, logs viewer, promo codes CRUD, API key settings
- `src/pages/Admin.tsx` — Admin frontend: login form, stats cards, tabbed interface (Logs, Promos, API Keys)
- `shared/schema.ts` — Additional tables: `promo_codes`, `admin_logs`, `app_settings`

Auth: `ADMIN_PASSWORD` env var, `req.session.isAdmin = true`, middleware `requireAdmin`.

Features:
- **Dashboard stats**: users count, active promos, total logs, payment events
- **Logs viewer**: filterable by category (payment, promo, admin, settings), paginated
- **Promo codes**: create (auto-generate or custom code), toggle active/inactive, delete. Types: discount, free_access, bonus
- **API keys**: view masked keys (OPENAI_API_KEY, YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY), update values. Keys stored in app_settings table + applied to process.env at runtime
- **Promo validation endpoint**: POST `/api/promo/validate` — validates and redeems promo codes (auth-gated)

## Paywall / Access Control

Price: 300 ₽ (payment not yet connected, testing via promo codes).

- `users.has_paid` boolean — controls access to paid features
- `src/components/Paywall.tsx` — Paywall component (gradient mask + promo code input) and PaywallBlock (standalone block)
- `useAuth().hasPaid` — frontend access check
- Free users see: quiz (full), 3 job previews (count shown), resume preview (first 3-4 lines with gradient fade)
- Paid users see: full job list with swiper/filters, full resume + export (PDF/DOCX/TXT), presets and archive
- Promo code `free_access` type grants `has_paid = true` on redemption
- Promo validation: POST `/api/promo/validate` — atomic redemption with race-condition protection

## Free Content Pages

### Readiness Checklist (`/readiness`)
- 10-question quiz to assess readiness for remote work
- Answers: Yes / Partially / No (scored 10/5/0 points each)
- Result tiers: 80-100% (good), 50-79% (needs improvement), 0-49% (needs preparation)
- Personalized recommendations for weak areas
- Data: `src/data/readinessData.ts`, Page: `src/pages/Readiness.tsx`
- CTAs: link to main quiz, guides, restart

### Mini-Guides (`/guides`)
- 6 practical guides for remote work audience (40-65 years)
- Topics: cover letter, video interview, resume mistakes, scam protection, first day, remote professions
- Each guide has intro, structured sections, conclusion, and CTA
- Data: `src/data/guidesData.ts`, Page: `src/pages/Guides.tsx`
- Navigation: accessible from main page, readiness results, and cross-linked between guides

## User Features (Auth-Gated)

- **Quiz Presets**: Save/load/delete named quiz configurations. PresetManager component on Quiz step 6.
- **Results Archive**: Save/load/delete job search results. ResultsArchive component on Results "Экспорт" tab.
- Auth context: `src/context/auth-context.tsx` — provides user state, login/register/logout functions.
- Auth page: `src/pages/Auth.tsx` — login/register form at /auth route.
