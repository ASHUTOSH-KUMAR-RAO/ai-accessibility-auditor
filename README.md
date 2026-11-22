# AccessLens — AI Website Accessibility Auditor

Enter any URL → scan for WCAG problems → get a score, plain-language explanations and AI-fixed code.

**Status: Phase 4 — the report.** Sign in, scan a public website, watch the progress live, then read a full accessibility report: score and grade, charts, every issue with WCAG criteria and who it affects, and a screenshot viewer that shows each problem on the page. AI-written fixes (Phase 5) and PDF/share/compare (Phase 6) come next.

| | |
|---|---|
| Client | React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui · Framer Motion · GSAP · TanStack Query |
| Server | Node · Express 5 · TypeScript · zod · Playwright + axe-core · Socket.io |
| Report UI | TanStack Query + Virtual · Prism (lazy) · hand-built accessible bar charts (no chart library) · Framer Motion · GSAP |
| Database | PostgreSQL (local Docker → Supabase) · Prisma 7 |
| Deploy | Vercel (client) · Railway (server) |

## Structure

```
client/   React app (Vercel)      server/   Express API (Railway)
docs/screenshots/                 docker-compose.yml  local Postgres
```

## Run locally

Requires Node ≥ 22 and Docker.

> **Chromium:** run `npm run playwright:install` once in `server/` (downloads the browser the scanner drives).
> **Tests** share the dev database: stop the dev server first (its worker would consume the queue tests' scans).

```bash
# 1. Database (host port 5455 to avoid clashing with other local Postgres)
docker compose up -d --wait

# 2. Server
cd server
cp .env.example .env
npm install
npm run playwright:install    # once: Chromium for the scanner
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
| `SCAN_WORKER_ENABLED` | `true` runs the scan worker in this process. Set `false` on API-only instances |
| `SCAN_CONCURRENCY` | Scans run at the same time per instance (default 2) |
| `SCAN_RATE_LIMIT_PER_HOUR` / `SCAN_MAX_ACTIVE_PER_USER` | Per-user limits (defaults 10 / 2) |
| `SCAN_NAV_TIMEOUT_MS` / `SCAN_TOTAL_TIMEOUT_MS` | Navigation 30 s / whole scan 60 s |
| `SCAN_MAX_PAGE_BYTES` | Abort pages downloading more than this (default 30 MB) |
| `COOKIE_SAMESITE` | `lax` (default, right for the proxied setup), `strict` or `none`. Cookies are always `Secure` in production |

**client/.env** — `VITE_API_URL` (default `/api`, same-origin: Vite proxies it in dev, Vercel in production). `VITE_SOCKET_URL` (optional, see *Live progress*).

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

## Scan engine

**Flow.** `POST /api/scans` validates the URL, stores a `QUEUED` scan and returns `202` at once. A database-backed worker claims jobs with `FOR UPDATE SKIP LOCKED` (safe with several instances, no Redis), runs Playwright Chromium + axe-core (WCAG 2.0/2.1/2.2 A + AA and best-practice rules) in a fresh isolated context, then stores the score, per-severity counts, every affected element (selector, HTML, failure summary, bounding box) and a compressed screenshot.

**Score (0–100).** `score = clamp(100 − Σ over failing rules of W[impact] × (1 + 0.5·log2(nodes)), 0, 100)`, with `W = critical 10, serious 6, moderate 3, minor 1`. A rule counts once at full weight and grows slowly with the number of affected elements (+0.5·W per doubling). No violations = 100. Examples: 1 critical on 1 element → 90; 1 critical on 8 → 75; 1 critical + 5 serious → 60. Severity counts are *affected elements*; only the first 50 per rule (1500 per scan) are stored as Issue rows, the true totals are still counted and scored. Implemented in `server/src/services/scanner/score.ts`.

**Screenshot storage.** JPEG (≤ 500 KB, height ≤ 5000 px, quality stepped down to fit) kept as `bytea` in its own table `ScanScreenshot`. No disk or volume, so it behaves the same on Railway, and listing scans never loads image bytes. Served by `GET /api/scans/:id/screenshot` (owner only).

**SSRF protection** (`server/src/services/scanner/ssrf.ts`, `egress-proxy.ts`):
- http/https only, no credentials, no whitespace/control characters, max 2048 chars; ports 80/443 only; no `localhost`, `*.local`, `*.internal`, single-label names.
- The hostname is resolved and **every** address must be public: IPv4 deny-list (private, loopback, link-local incl. 169.254.169.254, CGNAT, multicast, reserved…) and IPv6 allow-list (2000::/3 minus special ranges) with IPv4-mapped / NAT64 / 6to4 unwrapped. Decimal/hex/octal IP forms are normalised by the URL parser first.
- **Playwright's `route()` does not see redirect hops** (verified), so it is not enough on its own. Chromium is forced through a **per-scan egress proxy** that re-validates every connection it makes (redirects, sub-resources, iframes) and connects only to the IPs it just validated, so DNS rebinding has no gap. `route()` stays as a fast pre-check.
- Downloads, popups, new tabs, dialogs, service workers and WebSockets are blocked; WebRTC UDP is disabled; each scan has a throw-away context (no cookies/storage).
- User-facing errors are fixed, friendly codes: `INVALID_URL, BLOCKED_HOST, DNS_FAILED, TIMEOUT, SITE_UNREACHABLE, PAGE_TOO_LARGE, SCAN_FAILED`. Raw errors only go to the server log.
- Residual risk: Chromium itself is the sandbox boundary inside the container. On Railway also restrict egress at the network level if you can.

**Limits.** Per user: 10 scans/hour and 2 active (both configurable, enforced in a per-user advisory-locked transaction). Deleting a finished scan does not refund the hourly budget check, since it counts rows: users could delete to reset it (acceptable for now; use soft-delete if it matters).

**Live progress.** Socket.io on the API's HTTP server; handshake carries the access token, each user joins `user:<id>`; events `scan:queued | scan:progress | scan:completed | scan:failed | scan:cancelled`. The client keeps one socket for signed-in users, updates the TanStack Query cache from events, refetches on reconnect and falls back to polling (every 3 s) while the socket is down. **Vercel rewrites cannot proxy WebSocket upgrades**, so in production set `VITE_SOCKET_URL` to the API origin (CORS uses `CLIENT_URL`); without it Socket.io still works over long-polling through the rewrite.

**Crash safety.** Running scans heartbeat every 3 s. Scans whose heartbeat is older than 30 s are re-queued (once more), then failed. SIGTERM stops claiming, lets running scans finish for 10 s, then hands them back to the queue.

## The report (Phase 4)

**API** (all owner-scoped; soft-deleted scans are invisible):
- `GET /api/scans/:id/report`: summary + grade, severity / WCAG principle / level breakdowns, rules grouped with WCAG criteria (names + W3C links), "who is affected", true affected-element totals, needs-review and passed lists, and the screenshot markers (numbered boxes).
- `GET /api/scans/:id/rules/:ruleId/nodes`: a rule's affected elements (cursor-paginated). `POST /api/scans/:id/rescan`. `GET /api/scans` now takes `q, status, viewport, minScore, maxScore, sort=date|score, order`. `GET /api/scans/stats`.
- **Grade:** A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, otherwise F (`services/report/grade.ts`). **Level** comes from axe's own tags (A, AA, else best-practice); **principle** from the first WCAG criterion of the rule. "Who is affected" is a maintained map (`audiences.ts`) with a fallback from axe's category tags.
- **Soft delete:** `deletedAt`. A deleted scan disappears at once but its row still counts toward the hourly limit; rows are purged after 7 days. Scans made before Phase 4 still open (rules are rebuilt from the stored Issue rows and flagged "saved sample").
- Favicons are fetched by the scanner **through the egress proxy** and inlined as a small `data:` URI, so the viewer's browser never contacts the scanned site.

**Severity colours** are checked with the dataviz skill's validator, not by eye: the four marks (`#d55e00 #cc79a7 #0072b2 #009e73`; dark theme uses `#c777a5` for serious) pass colour-blind separation (adjacent ΔE ≥ 8), the normal-vision floor (≥ 15) and ≥ 3:1 on the card surface in both themes. Text never wears them: labels are ink; the colour lives in icons, outlines and bars. Every severity also has its own icon and fill pattern.

**Screenshot viewer:** boxes + numbered markers per affected element (colour, icon shape and outline/fill pattern per severity). "Show on page" zooms and pulses the element; clicking a marker (or Enter) opens its issue. Markers use a roving tabindex (Tab once, then arrow keys / Home / End); `+` `-` `0` zoom the focused viewer. Desktop: sticky side panel. Mobile: full-height bottom sheet.

## Deploy

- **Vercel**: root directory `client`, framework Vite; `vercel.json` rewrites all routes to the SPA. Add a rewrite **before** the SPA fallback so `/api/*` reaches Railway and cookies stay first-party:
  ```json
  { "rewrites": [
    { "source": "/api/:path*", "destination": "https://<your-railway-app>.up.railway.app/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ] }
  ```
  Set `CLIENT_URL` on Railway to the Vercel origin (it is also the CSRF allow-list) and `TRUST_PROXY=1`.
- **Railway**: root directory `server`; `railway.json` builds `server/Dockerfile`: a slim **Chromium-only** image (`node:22-bookworm-slim` + the headless shell and its OS libraries, installed by the same pinned Playwright version the app uses, so nothing to keep in sync; ~1.7 GB vs 4.8 GB for the official all-browsers image). It runs as the non-root `node` user, applies `prisma migrate deploy`, then `exec`s node under `tini` so SIGTERM reaches the app. Health check: `/api/health`. Set the server env vars above. **Memory:** Chromium needs headroom: plan for ~1 GB for the default `SCAN_CONCURRENCY=2` (≈ 400–500 MB per concurrent scan + the API). Use 2 GB if you raise concurrency. Several instances are safe (jobs are claimed with `SKIP LOCKED`).

## Design system

Concept: *accessibility made visible* — a fixed Braille-cell texture (real 2×3 cells spelling "accessibility is a right not a feature…") over paper grain, warm paper / deep ink themes, amber accent only for actions and focus. Fraunces (display) + Atkinson Hyperlegible Next (body). Tokens live in `client/src/index.css`. Target: WCAG 2.2 AA in light and dark. Reduced-motion users get the same motion at lower intensity, never none.

API responses always use `{ success, message, data, error }`.

## Phase 5: AI fixes (Groq)

- **Per-element fix** `POST /api/scans/:id/issues/:issueId/ai-fix` (JSON, or SSE with `Accept: text/event-stream` to stream the explanation): explanation, minimal HTML fix, CSS, React/JSX, how to fix / test, WCAG criteria, confidence.
- **Verified fixes**: the fix is re-checked with axe for that one rule in an isolated, offline Chromium context (sanitised markup, CSP `default-src 'none'`, all requests aborted). Status: `VERIFIED`, `NOT_VERIFIED` (retried once with the smart model) or `NOT_APPLICABLE` (page-level rules).
- **Contrast** colours are computed (WCAG formula), never chosen by the model.
- **Guided fixes (no AI)** are used without a key, on timeout/429/invalid output, or when the hourly AI limit is reached.
- **Scan summary** `GET|POST /api/scans/:id/ai-summary` (smart model, cached per scan; `{ "regenerate": true }` to redo).
- **Safety**: page HTML is sent only as JSON data (never in instructions) after stripping scripts, handlers, `data:` URIs, input values and URL tokens; AI output is validated with zod, refused if it contains scripts/handlers, and rendered only as text (links only to w3.org / deque.com).
- **Cache** (`AiFix`, shared across users) keyed by rule + normalised HTML + failure summary + model + prompt version. Per-user limit `AI_RATE_LIMIT_PER_HOUR` (cache hits are free), `AI_MAX_CONCURRENT` parallel calls.
- Config: `GROQ_API_KEY`, `GROQ_MODEL_FAST` (default `openai/gpt-oss-20b`), `GROQ_MODEL_SMART` (`openai/gpt-oss-120b`), `AI_TIMEOUT_MS`. Leave the key empty for guided-only mode.

Screenshots: `docs/screenshots/phase5-*.webp`.

## Phase 6: Smart features

- **Vision simulator** (screenshot panel → "Vision simulator"): protanopia, deuteranopia, tritanopia (Machado et al. 2009 matrices), achromatopsia, low-vision blur and cataract-like haze. SVG `feColorMatrix` filters run in the browser (the matrices are defined for linear RGB, which is the SVG filter default). Simulated / slider / side-by-side.
- **Keyboard tab-order map** (report → "Keyboard"): the scanner presses Tab (max 100 stops, 8 s budget) after axe and the screenshot and stores the order with the scan (`Scan.tabOrder`). Warnings: focus jumps, invisible focus, focus dropped (`onfocus="blur()"`), off-screen focus, keyboard traps, interactive elements Tab can't reach. Older scans show "Not available".
- **PDF report** `GET /api/scans/:id/report.pdf`: self-contained HTML (data: URIs only) → Chromium `page.pdf` with JavaScript off and every request aborted; tagged, bookmarked, real text. Uses saved AI fixes only, never calls the AI. Cached per scan; the fingerprint changes when a fix or summary changes.
- **Share links** `POST /api/scans/:id/shares`: 256-bit token (only its SHA-256 is stored, shown once), expiry 24 h / 7 d / 30 d / never, optional hidden screenshot, revoke any time, max 10 active per scan. Public, read-only API under `/api/public/:token/*` and page `/r/:token` (noindex, no-referrer, rate limited, no owner data, saved AI fixes only).
- **Compare + sites**: `GET /api/compare?a=&b=` matches issues by fingerprint (rule + normalised selector + markup hash, then moved / changed / fuzzy matching). `/compare`, `/sites`, `/sites/:host` (score trend with a data table).
- **Exports + badge**: `GET /api/scans/:id/export.csv|json?rules=` (CSV is formula-injection safe), `GET /api/badge/:token.svg` (works only while the link is active).

Screenshots: `docs/screenshots/phase6-*.webp`. Client unit tests: `cd client && npm test`.
