# Smoke test for the live app

Run this after every deploy. About 10 minutes. Use a **private window** so nothing is cached. Replace `LIVE_URL` with your Vercel URL and `API_URL` with your Railway domain.

Tick each line. If one fails, see "If something fails" at the bottom.

## 1. Backend and routing

- [ ] `https://API_URL/api/health` shows `"status":"ok"` and `"database":"connected"`.
- [ ] `LIVE_URL/api/health` shows the same (this proves the Vercel rewrite to Railway works).
- [ ] `LIVE_URL/robots.txt` and `LIVE_URL/sitemap.xml` load and contain your real domain (not `localhost`).
- [ ] `LIVE_URL/features`, `/privacy`, `/terms`, `/cookies`, `/sample` load directly (hard refresh) without a flash of a blank page.
- [ ] `LIVE_URL/dashboard` while signed out sends you to the sign-in page. `LIVE_URL/some-nonsense` shows the friendly 404 page.

## 2. Landing and sample (no account)

- [ ] Landing: headline, scanning mockup animates, facts count up, vision demo switches types, FAQ opens, marquee scrolls left to right and the Pause button stops it.
- [ ] Toggle the theme in the footer: the whole page switches, and stays switched after a reload (no flash).
- [ ] "See a sample report" opens `/sample`: issue map, Vision simulator tab, Keyboard tab, "View AI fix" on an element.
- [ ] Cookie notice appears once, "Got it" dismisses it for good.

## 3. Account and scan

- [ ] Type `example.com` in the landing hero while signed out → you land on sign-up → create an account → the scan **starts by itself** (you end up on the scan page).
- [ ] The progress screen moves through the stages live (if it only changes every few seconds, `VITE_SOCKET_URL` is missing).
- [ ] The report opens: score, summary card, charts, Issues / Needs review / Passed / Keyboard tabs.
- [ ] Scan `https://www.w3.org/WAI/demos/bad/before/home.html` (a page that is broken on purpose): about 7 failing rules, score around 13.

## 4. Report features

- [ ] "AI fix" on an image element: text streams in, the Fix tab shows a before/after diff and a "Verified fix" badge (or "Guided fix (no AI)" if no Groq key).
- [ ] A colour-contrast element shows swatches, ratios and AA / AAA chips.
- [ ] Vision simulator: pick a type, slider compare works with the keyboard (arrow keys).
- [ ] Keyboard tab: path drawn on the screenshot, warnings listed.
- [ ] "PDF report": a file downloads and opens; text can be selected.
- [ ] "Export CSV" / "Export JSON" download.
- [ ] "Share": create a link, copy it, open it in **another browser profile / incognito while signed out**: the report loads read-only. Revoke it, reload that tab: "This link doesn't work".
- [ ] Re-scan the same site, then "Compare with previous scan": Fixed / New / Still present show.

## 5. Mobile

- [ ] Open `LIVE_URL` on a phone (or DevTools at 375 px): no sideways scrolling anywhere, the menu opens, the footer shows Product and Legal side by side.
- [ ] Dashboard on mobile: the drawer opens with the menu button.
- [ ] History page (`/scans`) at 375 px does not scroll sideways.

## 6. Security spot checks

- [ ] Browser DevTools → Network → any `/api/...` response has no stack traces in errors.
- [ ] `LIVE_URL/r/not-a-real-token` shows "This link doesn't work" (404), not a server error.
- [ ] Scanning `http://localhost` or `http://192.168.0.1` is rejected with "We can only scan public websites".
- [ ] Response headers on `LIVE_URL` include `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`.

## 7. Cleanup

- [ ] If you seeded the demo account, sign in as `demo@accesslens.dev` and check the dashboard shows 9 scans, 3 sites, trends.
- [ ] Delete the test account's scans you don't want to keep.

## If something fails

See the troubleshooting table at the end of `docs/DEPLOY.md`. The three usual suspects: `CLIENT_URL` (403 on sign-in), `RAILWAY_DOMAIN` still a placeholder in `client/vercel.json` (404 on `/api`), and too little RAM on Railway (scans fail).
