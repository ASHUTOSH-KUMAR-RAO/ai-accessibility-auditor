# AccessLens — AI Website Accessibility Auditor

Enter any URL → scan for WCAG problems → get a score, plain-language explanations and AI-fixed code.

**Status: Phase 2 — authentication.** Scanner, live progress and AI fixes arrive in later phases.

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
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 chars each and **must differ** (server refuses to start otherwise). Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES_DAYS` | Defaults `15m` / `7` |
| `COOKIE_SAMESITE` | `lax` (default, right for the proxied setup), `strict` or `none`. Cookies are always `Secure` in production |

**client/.env** — `VITE_API_URL` (default `/api`, same-origin: Vite proxies it in dev, Vercel in production).

The server validates env with zod at boot and exits with the names of bad variables (never values).

## Scripts

Server: `dev` · `build` · `start` · `prisma:generate` · `prisma:migrate` · `prisma:deploy` · `test` (needs the Docker DB)
Client: `dev` · `build` · `preview` · `lint`

## Authentication

- Access token (JWT, 15 min) is returned in the response body and kept **in memory** on the client. Refresh token (JWT, 7 days) lives in an `httpOnly` cookie scoped to `/api/auth`; only its SHA-256 hash is stored.
- Refresh tokens are **single-use** and rotated on every `/auth/refresh`. Replaying a used token revokes all of that user's sessions.
- `/auth/refresh` and `/auth/logout` check the request `Origin` (or `Referer`) against `CLIENT_URL` (CSRF).
- Login errors are generic and equal-time (no user enumeration); login/register have their own rate limits.
- Client refreshes are single-flight per tab and serialised across tabs with the Web Locks API.

## Deploy

- **Vercel**: root directory `client`, framework Vite; `vercel.json` rewrites all routes to the SPA. Add a rewrite **before** the SPA fallback so `/api/*` reaches Railway and cookies stay first-party:
  ```json
  { "rewrites": [
    { "source": "/api/:path*", "destination": "https://<your-railway-app>.up.railway.app/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ] }
  ```
  Set `CLIENT_URL` on Railway to the Vercel origin (it is also the CSRF allow-list) and `TRUST_PROXY=1`.
- **Railway**: root directory `server`; `railway.json` runs `prisma migrate deploy`, starts the API and health-checks `/api/health`. Set the server env vars above.

## Design system

Concept: *accessibility made visible* — a fixed Braille-cell texture (real 2×3 cells spelling "accessibility is a right not a feature…") over paper grain, warm paper / deep ink themes, amber accent only for actions and focus. Fraunces (display) + Atkinson Hyperlegible Next (body). Tokens live in `client/src/index.css`. Target: WCAG 2.2 AA in light and dark. Reduced-motion users get the same motion at lower intensity, never none.

API responses always use `{ success, message, data, error }`.
