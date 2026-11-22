# Deploying AccessLens

Backend on **Railway** (Docker, Chromium), frontend on **Vercel**, database on **Supabase** (already set up).
Do it in this order: **Railway → copy its domain → edit `vercel.json` → Vercel → update `CLIENT_URL` on Railway.**

> Everything below is done by hand in the web dashboards of **your own** accounts. Nothing in this repo needs the Railway or Vercel CLI.

---

## 0. Before you start

| You need | Where it comes from |
|---|---|
| Supabase `DATABASE_URL` (transaction pooler, port 6543) and `DIRECT_URL` (session pooler, port 5432) | Supabase → *Project settings → Database → Connection string* → **Transaction pooler** and **Session pooler**. They are already in `server/.env`. |
| Groq API key | https://console.groq.com/keys |
| Two **new** JWT secrets | Run the one-liner below. Never reuse the development secrets. |

Generate the two production JWT secrets (prints two different 96-character strings; copy one into each variable):

```bash
node -e "const c=require('crypto');console.log(c.randomBytes(48).toString('hex'));console.log(c.randomBytes(48).toString('hex'))"
```

The database already has the schema and Row Level Security (migrations were applied to Supabase). The Docker image applies any new migration by itself on every start (`prisma migrate deploy`).

---

## 1. Railway (backend + scan worker)

### 1.1 Sizing: read this first

Each scan launches headless Chromium next to Node.

| | |
|---|---|
| Minimum RAM | **1 GB** (Node ~150 MB + one Chromium ~400-700 MB while scanning). It runs, but with no headroom. |
| Recommended | **2 GB** with `SCAN_CONCURRENCY=1` (the production default). Use 4 GB if you raise it to 2. |
| CPU | 1 vCPU is enough for one scan at a time. A scan takes ~10-25 s. |

Plan limits (check the live pricing page before you rely on these numbers, https://docs.railway.com/pricing/plans): the **Free** plan is 0.5 GB RAM, which is **not enough**: scans will be killed for running out of memory. The **30-day trial** is 1 GB RAM / 2 vCPU: it works for demos with `SCAN_CONCURRENCY=1`, as long as you don't run scans in parallel. The **Hobby** plan ($5/month) allows up to 8 GB per replica: use this for anything you show recruiters. Resource usage is billed per second, so an idle service costs very little.

### 1.2 Create the service

1. https://railway.com → **New Project → Deploy from GitHub repo** → pick `ai-accessibility-auditor` (authorize the GitHub app for your personal account if asked).
2. Open the new service → **Settings**:
   - **Root Directory:** `server`
   - **Builder:** Dockerfile (picked up from `server/railway.json`)
   - **Region:** **Southeast Asia (Singapore)**: the closest region to Mumbai and to your Supabase project (`ap-south-1`).
   - **Healthcheck path:** `/api/health` (already in `railway.json`)
3. **Variables** tab → add the variables from section 1.3.
4. **Settings → Networking → Generate Domain.** Copy it (for example `accesslens-api-production.up.railway.app`). This is `RAILWAY_DOMAIN`. Set the target port to **4000** if Railway asks (the app listens on `PORT`, which Railway injects).
5. Wait for the deploy to turn green, then open `https://RAILWAY_DOMAIN/api/health`. You should see `"database":"connected"`.

### 1.3 Railway variables

Names only. Values come from where the last column says.

| Variable | Value / where it comes from |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase transaction pooler string (port 6543, ends with `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase session pooler string (port 5432), used for migrations |
| `JWT_ACCESS_SECRET` | first string from the one-liner in section 0 |
| `JWT_REFRESH_SECRET` | second string (must differ from the first, or the server refuses to start) |
| `CLIENT_URL` | your Vercel URL, e.g. `https://accesslens.vercel.app`. Comma-separate several; trailing slashes and quotes are tolerated. **Set it after step 2, then redeploy.** |
| `TRUST_PROXY` | `1` (Railway is one proxy hop) |
| `COOKIE_SAMESITE` | `lax` (the frontend proxies `/api`, so the cookie is first-party) |
| `GROQ_API_KEY` | from console.groq.com (leave empty to run on guided fixes only) |
| `GROQ_MODEL_FAST` / `GROQ_MODEL_SMART` | optional, defaults `openai/gpt-oss-20b` / `openai/gpt-oss-120b` |
| `SCAN_CONCURRENCY` | `1` (also the production default) |
| `SCAN_WORKER_ENABLED` | `true` |
| `DB_POOL_MAX` | `5` (default). Supabase's pooler has a limited connection budget |
| `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES_DAYS` | optional (`15m`, `7`) |
| `SCAN_RATE_LIMIT_PER_HOUR`, `SCAN_MAX_ACTIVE_PER_USER`, `SCAN_NAV_TIMEOUT_MS`, `SCAN_TOTAL_TIMEOUT_MS`, `SCAN_MAX_PAGE_BYTES` | optional, see `server/.env.example` |
| `AI_RATE_LIMIT_PER_HOUR`, `AI_MAX_CONCURRENT`, `AI_TIMEOUT_MS` | optional, see `server/.env.example` |

Do **not** set `PORT` (Railway sets it) and do **not** add `TEST_DATABASE_URL` (tests only).

### 1.4 What is already handled

* `docker-entrypoint.sh` runs `prisma migrate deploy`, then `exec`s Node, so `SIGTERM` reaches the app.
* Graceful shutdown: on `SIGTERM` running scans get up to 10 s to finish, otherwise they go back to the queue and another start picks them up.
* Health check `/api/health` retries the database once or twice, so a Supabase cold start doesn't mark a deploy as failed.
* `tini` reaps orphaned Chromium processes.

---

## 2. Vercel (frontend)

### 2.1 Put the Railway domain into `client/vercel.json`

Open `client/vercel.json` and replace **every** `RAILWAY_DOMAIN` with the domain from step 1.2.4 (no `https://`, no trailing slash). There are three places: the `/api` rewrite, and `connect-src` twice (`https://` and `wss://`). Commit and push.

```text
"destination": "https://accesslens-api-production.up.railway.app/api/:path*"
connect-src 'self' https://accesslens-api-production.up.railway.app wss://accesslens-api-production.up.railway.app
```

### 2.2 Create the project

1. https://vercel.com → **Add New → Project** → import the GitHub repo.
2. **Root Directory:** `client`. Framework preset: **Vite** (build command `npm run build`, output `dist`: already in `vercel.json`). The build also prerenders the public pages.
3. **Environment Variables** (all environments):

| Variable | Value |
|---|---|
| `VITE_API_URL` | `/api` |
| `VITE_SOCKET_URL` | `https://RAILWAY_DOMAIN` (Vercel can't proxy WebSockets, so the browser connects to Railway directly for live scan progress) |
| `VITE_SITE_URL` | your final public URL, e.g. `https://accesslens.vercel.app` (used for canonical links, Open Graph tags, `sitemap.xml`, `robots.txt`) |

4. **Deploy.** Open the Vercel URL.

### 2.3 Close the loop

Go back to Railway → **Variables** → set `CLIENT_URL` to the Vercel URL (add your custom domain too, comma-separated) → the service redeploys. Without this, sign-in and every state-changing request are rejected by the origin check (CSRF protection).

If you later add a custom domain on Vercel, add it to `CLIENT_URL` **and** to `VITE_SITE_URL`, and redeploy both.

---

## 3. Order of steps (summary)

1. Railway: create service from `server/`, variables (except `CLIENT_URL`), generate domain, check `/api/health`.
2. Edit `client/vercel.json` with the Railway domain; commit and push.
3. Vercel: import `client/`, set the three `VITE_*` variables, deploy.
4. Railway: set `CLIENT_URL` to the Vercel URL, wait for the redeploy.
5. Seed the demo account (section 4) and run `docs/SMOKE_TEST.md`.

---

## 4. Demo account in production (optional)

Creates `demo@accesslens.dev` with nine scans over three sites and cached AI fixes (so trends and compare have data). It refuses to run in production unless you pass `--force`, and it **resets** that one account each time it runs. Your own `server/.env` already points at Supabase, so from your machine:

```powershell
cd server
$env:NODE_ENV = "production"; npm run seed:demo -- --force
```

```bash
cd server
NODE_ENV=production npm run seed:demo -- --force
```

Demo login: `demo@accesslens.dev` / `AccessLens-Demo-2026`. (Change the password in `server/scripts/seed-demo.ts` before publishing the account if you prefer another one.)

---

## 5. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sign-in works locally but returns 403 in production | `CLIENT_URL` on Railway doesn't contain the exact Vercel origin (scheme + host). |
| `/api/...` returns the Vercel 404 page | `RAILWAY_DOMAIN` placeholder still in `vercel.json`, or no redeploy after editing. |
| Console shows a CSP error for the socket | `wss://RAILWAY_DOMAIN` not replaced in `connect-src`. |
| Scans fail with `SCAN_FAILED`, Railway logs mention killed / OOM | Not enough RAM for Chromium: use a plan with at least 1 GB (2 GB recommended). |
| Deploy turns red on the health check | `DATABASE_URL`/`DIRECT_URL` wrong or Supabase paused (free projects pause after a week of inactivity: open the dashboard and restore). |
| Live progress doesn't update | `VITE_SOCKET_URL` missing, then the app falls back to polling every few seconds. |
| `prisma migrate deploy` hangs | `DIRECT_URL` must be the **session** pooler (5432), not the transaction pooler. |

New tables must enable Row Level Security in the same migration that creates them (a test fails otherwise); see `server/prisma/migrations/*_enable_rls`.
