# AccessLens — AI Website Accessibility Auditor

Enter any URL → scan for WCAG problems → get a score, plain-language explanations and AI-fixed code.

**Status: Phase 1 — project setup + design system.** Scanner, live progress, auth and AI fixes arrive in later phases.

| | |
|---|---|
| Client | React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui · Framer Motion · GSAP · TanStack Query |
| Server | Node · Express 5 · TypeScript · zod |
| Database | PostgreSQL (local Docker → Supabase) · Prisma 7 |
| Deploy | Vercel (client) · Railway (server) |

## Structure

```
client/   React app (Vercel)      server/   Express API (Railway)
docs/screenshots/                 docker-compose.yml  local Postgres
```

## Run locally

Requires Node ≥ 22 and Docker.

```bash
# 1. Database (host port 5455 to avoid clashing with other local Postgres)
docker compose up -d --wait

# 2. Server
cd server
cp .env.example .env
npm install
npm run prisma:migrate        # creates tables
npm run dev                   # http://localhost:4000/api/health

# 3. Client (new terminal)
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

## Environment variables

**server/.env**

| Variable | Purpose |
|---|---|
| `PORT` | API port (Railway injects it) |
| `DATABASE_URL` | Pooled connection used at runtime (Supabase: transaction pooler, `:6543`, `?pgbouncer=true`) |
| `DIRECT_URL` | Direct connection used by `prisma migrate` (Supabase: `:5432`) |
| `CLIENT_URL` | Allowed origin(s), comma-separated, e.g. `https://app.vercel.app,http://localhost:5173` |
| `TRUST_PROXY` | Proxy hops to trust (`1` on Railway) |

**client/.env** — `VITE_API_URL` (default `http://localhost:4000/api`).

The server validates env with zod at boot and exits with the names of bad variables (never values).

## Scripts

Server: `dev` · `build` · `start` · `prisma:generate` · `prisma:migrate` · `prisma:deploy` · `test`
Client: `dev` · `build` · `preview` · `lint`

## Deploy

- **Vercel**: root directory `client`, framework Vite; `vercel.json` rewrites all routes to the SPA. Set `VITE_API_URL`.
- **Railway**: root directory `server`; `railway.json` runs `prisma migrate deploy`, starts the API and health-checks `/api/health`. Set the server env vars above.

## Design system

Concept: *accessibility made visible* — a fixed Braille-cell texture (real 2×3 cells spelling "accessibility is a right not a feature…") over paper grain, warm paper / deep ink themes, amber accent only for actions and focus. Fraunces (display) + Atkinson Hyperlegible Next (body). Tokens live in `client/src/index.css`. Target: WCAG 2.2 AA in light and dark. Reduced-motion users get the same motion at lower intensity, never none.

API responses always use `{ success, message, data, error }`.
