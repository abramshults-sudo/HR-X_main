# HRX App

A React/Vite SPA that helps users build a resume and find relevant job listings through a guided quiz. Target audience: 40-65 years old, looking for remote work.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS, shadcn/ui (Radix UI primitives)
- **Routing**: React Router v6
- **State**: React context + useReducer (hrx-state)
- **Forms**: React Hook Form + Zod
- **Data fetching**: TanStack React Query
- **Job APIs**: hh.ru (HeadHunter) + trudvsem.ru (Работа России) via Vite proxy

## Project Structure

- `src/pages/` — Route-level pages (Index, Quiz, Results, AdaptResult, Dashboard, Readiness, Guides)
- `src/components/` — Reusable UI components + shadcn/ui primitives in `ui/`
- `src/context/hrx-state.tsx` — Global app state (quiz answers, jobs, theme, localStorage persistence)
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

## Quiz Structure (v5)

Pre-quiz: remote experience level selector ("none" / "some"). 6 steps with validation and localStorage persistence:

- **Pre-step**: Remote experience level — "Нет опыта удалёнки" or "Уже работал(а) удалённо"
  - If saved state exists in localStorage, restore dialog is shown
  - Link to readiness checklist (/readiness) for unsure users
1. **Где вы находитесь** — Region (required) + Moscow time hours
2. **Целевые должности** — Two-level accordion: category groups → specific roles. Max-height 300px with scroll. Badge shows selected count (highlighted) or total roles. Quick exclusions.
3. **Опыт работы** — Organization types, experience (required), activities grouped with "show more" pattern (first 5 shown, rest behind button)
4. **Навыки и программы** — Software skills with smart pre-select based on chosen roles (recommendation banner). Professional skills grouped.
5. **Условия и ограничения** — Schedule, employment, salary, accessibility, restrictions
6. **Проверка** — Summary with edit links + search preview

### Quiz Features
- **Step tooltips**: "?" icon on each step header shows inline help text explaining why the step matters. Closes automatically on step change.
- **Smart program recommendations (step 4)**: Based on selected roles, recommended programs are suggested with a one-click "add" button. Resets when roles are modified. Programs split into "Основные" (recommended/selected) and "Дополнительные" (collapsed by default).
- **Activity simplification (step 3)**: Groups show first 5 items, rest behind "Показать ещё N" button.

### Quiz Validation (per step)
- Step 1: Region required
- Step 2: At least 1 target role required
- Step 3: Experience/total years required
- Steps 4-6: No required fields
- Validation error shown inline after "Next" attempt

### Quiz State Persistence
- Saved to localStorage after each quiz state change
- 7-day TTL, cleared on successful completion
- Restore dialog on /quiz if saved state exists
- Schema validation on restore (arrays, required fields)

## Job Search Integration

Vacancies are fetched in real-time from two public APIs:

1. **hh.ru (HeadHunter)** — `GET /vacancies` with role IDs, schedule=remote, region, salary, experience params
2. **trudvsem.ru (Работа России)** — `GET /vacancies` with text search + client-side remote filtering

Architecture: Frontend sends search params to backend `POST /api/vacancies/search`. Backend fetches, caches in PostgreSQL (TTL: 3h). Frontend applies scoring, filtering, match calculation.

### Job Match Score
Each vacancy gets a match percentage (0-100%) based on:
- Role hints shown as subtitles on step 2 option cards
- Mobile paywall: fixed bottom CTA button for unpaid users on Results page
- Role keyword match (40% weight)
- Skills/program match (30% weight)
- Salary compatibility (20% weight)
- Remote availability (10% weight)
Jobs sorted by match score. Low-match (<20%) hidden behind "Show all" button.

### Source Filtering
Jobs can be filtered by source (hh.ru, trudvsem.ru, or all) via dropdown in Results.

## Results Page

### Free users (not paid):
- Full resume preview (SectionCard)
- Registration banner for anonymous users
- 8 best-matching job cards with match scores
- Paywall upgrade card

### Paid users:
- Tabs: Resume, Jobs, Export
- Resume tab: AI generation (GPT-4o-mini), download PDF/DOCX/TXT
- Jobs tab: Full list view with match scores, filters (date, source, scoring), adapt button per card
- Export tab: Archive, profile/vacancy download

### Job Cards
- Match percentage badge (green/yellow/gray)
- Green "ИИ адаптация резюме" button (prominent)
- Company scoring toggle
- Details accordion with source link

## Company Scoring System

Each vacancy receives a reliability score (0-100). Scoring is **enabled by default**.
Score levels: trusted (75+), normal (50-74), suspicious (30-49), risky (<30).

## Paywall / Access Control

Price: 300 ₽ (payment not yet connected, testing via promo codes).

- Free users see: quiz (full), 8 job previews with match scores, resume preview
- Paid users see: full job list with filters, full resume + export, AI adaptation, presets and archive
- Features promoted in paywall: AI resume adaptation (first), all vacancies, full resume, company checks

## Homepage

- Title: "УДАЛЁННАЯ РАБОТА — с опытом и без"
- Subtitle: "Пройдите 10-минутный опрос — получите готовое резюме и список вакансий"
- Benefits: resume, job search, AI adaptation per vacancy, speed
- Trust note: "Начать можно без регистрации. Для сохранения результатов — создайте аккаунт (бесплатно)"
- User counter: fetches from `/api/admin/user-count-public` (real DB count or demo value from admin settings)
- Links: Readiness checklist, Guides

## SEO

- Lang: ru
- Title: "HR-X — Удалённая работа с опытом и без"
- OG/Twitter meta tags configured in index.html (og:image, twitter:image, summary_large_image)
- Favicon: SVG in public/favicon.svg
- Apple touch icon: public/favicon.svg
- OG image: public/og-image.svg
- Sitemap: /sitemap.xml (dynamic, served by Express)
- robots.txt references sitemap
- Structured data (JSON-LD): WebApplication schema in index.html, JobPosting schema injected dynamically for search results
- Structured data component: src/components/JobStructuredData.tsx

## Analytics

Analytics integration managed through admin panel (no hardcoded IDs):
- **Yandex Metrika**: Set ID in admin → API-ключи → "Яндекс.Метрика (ID счётчика)"
- **Google Analytics**: Set ID in admin → API-ключи → "Google Analytics (ID, напр. G-XXXXXXXXXX)"
- Scripts auto-injected via `src/components/AnalyticsProvider.tsx` (fetches IDs from `/api/analytics-ids`)
- Event tracking: `src/lib/analytics.ts` — `trackEvent()` and `trackPageView()` fire to both YM and GA
- Tracked events: quiz_complete, quiz_step, payment_success, resume_generate, resume_adapt, registration, promo_applied, access_granted_view, job_search, resume_download
- Page views tracked automatically via `src/hooks/use-tracking.ts`

## Access Control

- `/access-granted` — shown after successful promo code / payment activation
- AI endpoints (`/api/ai/adapt`, `/api/ai/generate`) require `hasPaid=true` (403 if not paid)
- Free users: quiz + 8 job previews + resume preview
- Paid users: full jobs + filters + AI adaptation + resume export

## Running the App

```
npm run dev
```

The dev server runs on port 5000.

## Backend Server

Express server on port 3001 with PostgreSQL database:

- `server/index.ts` — Express app setup, session middleware, DB table initialization
- `server/db.ts` — PostgreSQL connection pool + Drizzle ORM
- `server/auth.ts` — Auth routes
- `server/routes.ts` — CRUD API for presets and results
- `server/vacancyCache.ts` — Vacancy search with PostgreSQL caching
- `server/ai.ts` — AI resume adaptation via OpenAI ChatGPT
- `server/admin.ts` — Admin panel backend

## AI Resume Adaptation

Route: POST `/api/ai/adapt` (payment-gated). Uses OpenAI GPT-4o-mini.
Route: POST `/api/ai/generate` (payment-gated). Uses OpenAI GPT-4o-mini.
Route: POST `/api/ai/cover-letter` (payment-gated). Uses OpenAI GPT-4o-mini. Generates a cover letter (up to 1000 chars) based on resume + vacancy.
Features: ATS keyword integration, hallucination check, match scoring, cover letter generation.
All AI endpoints check `hasPaid` status — unpaid users get 403.

## Admin Panel

Route: `/admin` — password-protected. Stats, logs, promo codes, API key management, analytics IDs (Yandex Metrika, Google Analytics), user counter settings (real/demo mode + custom demo value).
