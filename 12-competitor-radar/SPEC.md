# Competitor Radar: build spec

Portfolio project 12. Competitor monitoring for **Cobble & Spoke**, a fictional online e-bike shop in
Edinburgh. The radar checks rivals' product, home, careers and news pages every 6 hours, works out what
changed, has GPT-5.4 explain why it matters and rate it, alerts the team about important moves straight away,
and sends a Monday digest. Everything runs on one Google Sheet.

The four competitors (Torque Street, Glenvolt, Pedalpoint Electric, Hilltrack E-Bikes) are invented, and
their websites are served by n8n itself (Radar 0), so the demo never scrapes a real business.

## Decisions (2026-10-22)

- User asked for three new projects with Google Sheets as storage; this is idea 2 ("Competitor Radar").
- **Demo sites, not real ones**: Radar 0 serves four differently built sites (JSON-LD product data, plain
  product cards, a price table, a site that later shows a bot check and then a redesign) at
  `/webhook/demo-web/page?site=…&page=…`. An admin link (`demo-web/admin?key=…&week=1-4`) moves a four-week
  story on: price cuts and rises, new and dropped bikes, a sell-out, a Black Friday banner, "free delivery to
  Scotland", new job ads (Country Manager Germany, Store Lead Edinburgh pop-up), a news post about an
  Edinburgh showroom, a 503 maintenance page and a bot check. The week is kept in workflow static data.
  (n8n webhook paths with `:params` need the webhook ID in the URL, so query parameters are used.)
- **Fingerprint first, AI second**: each page is cleaned (scripts and styles removed, noisy lines from
  Settings `ignore_lines` dropped) and fingerprinted with SHA-256. Unchanged pages cost nothing. Product pages
  with JSON-LD are read in code; others are read by GPT-5.4 mini (strict schema), only when they changed.
- **No false alarms**: if a product page suddenly has under 40% of its products (or the AI says it isn't a
  product list, e.g. a bot check), the radar reports "check this page" (significance 3), keeps the last good
  data and fingerprint, and does not report every product as removed. Fetch failures count up; the third in a
  row raises a "page down" change.
- **One analyst call per run**: all changes go to GPT-5.4 together with our products and the price gap to the
  matching bike (worked out in code). It returns a kind (for page text: promotion, hiring, news, messaging),
  headline, why it matters, a next step and significance 1-5, and matches new competitor bikes to ours
  (prompts/analyst.md, prompts/analysis.json).
- **Rules the AI can't override**: a rival now ≥ `undercut_pct` (3%) below our matched bike, or a price cut
  ≥ `big_drop_pct` (15%), is always rated at least 4; page problems are always 3. Anything ≥
  `alert_threshold` (4) is emailed straight away (one email per run).
- **Price position** uses only each page's latest snapshot, so a bike a rival stopped selling drops out
  instead of keeping its old price.
- Test mode: emails go to the **Outbox** tab. A run started from the webhook can pass `as_of` (test mode
  only) to stamp it with another date, which is how the demo replays four weeks in a few minutes.
- Writes go through **Radar 5: Save Changes** as a plan; `cellFormat: RAW`. Reads use one Sheets API
  `values:batchGet` per run.
- Error alerts: the shared Social Autopilot 0 workflow (Telegram).

## Sheet tabs

| Tab | Columns |
|-----|---------|
| Settings | key, value, note |
| Watchlist | page_id, competitor, page_type (products, home, careers, news), url, active, last_checked, last_status, last_hash, last_method (json-ld, ai, text), fail_count, last_items_json, last_text, note |
| Our Products | sku, name, category, price, battery_wh, range_km, motor, url |
| Matches | competitor, competitor_product, our_sku, confidence, matched_by (manual, ai), matched_at |
| Prices | checked_at, competitor, product, price, was_price, in_stock, page_id, our_sku |
| Changes | change_id, detected_at, run_id, competitor, page_id, page_type, kind, item, before, after, delta_pct, our_sku, our_price, significance, headline, why_it_matters, suggested_action, alerted, status (new, seen) |
| Runs | run_id, started_at, finished_at, trigger, pages, unchanged, changed, failed, changes, alerts, ai_calls, ms |
| Outbox | at, to, subject, kind, links, html |

## Workflows

| # | Name | ID | Trigger |
|---|------|----|---------|
| 0 | Demo Competitor Sites | csrDemoSites0000 | Webhooks `demo-web/page`, `demo-web/admin` (demo only) |
| 1 | Run Checks | csrRunChecks0001 | Every 6 hours, webhook `radar/run` (key), called by 3, manual |
| 2 | Check Page | csrCheckPage0002 | Called by 1, once per page |
| 3 | Dashboard | csrDashboard0003 | Webhooks `radar/dashboard`, `radar/action` |
| 4 | Weekly Digest | csrWeeklyDgst04 | Mondays 8:00 Europe/London + manual |
| 5 | Save Changes | csrSaveChange005 | Called (plan) |
| 6 | Reset Demo | csrResetDemo0006 | Manual |
| 7 | Create Spreadsheet | csrCreateSheet07 | Manual (once) |

## Build changes (2026-10-22)

- Demo site URLs moved from `demo-web/:site/:page` to query parameters (path parameters need the webhook ID
  in the URL).
- Price table picks the most confident match first (a dearer full-suspension bike was shown against our
  hardtail before).
- Added a test inbox page (`/webhook/radar/outbox?key=…`).

## Build notes

- Code in `workflows/code/*.js` (shared `lib-cs.js`, `lib-radar-dash.js`), dashboard in `site/`, prompts and
  schemas in `prompts/`; `python3 workflows/build.py`, then `node workflows/deploy.js workflows/<file>.ts`.
- The four weeks were simulated locally before deployment (scratchpad harness, AI calls mocked): baseline in
  week 1; week 2: 5 changes (1 alert by rule), Pedalpoint down (no false alarm); week 3: 9 changes incl.
  Hilltrack's bot check reported as "check page"; week 4: 7 changes, Hilltrack's redesign read by the AI.
