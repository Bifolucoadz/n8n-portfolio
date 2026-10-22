# Competitor Radar (Cobble & Spoke)

Competitor monitoring for an online e-bike shop. Every 6 hours the radar checks rivals' product, home,
careers and news pages. Each page is fingerprinted, so unchanged pages cost nothing. Products are read from
structured data, or by GPT-5.4 mini when a site has none, and the radar works out what changed: price cuts and
rises, new and dropped bikes, stock, banners, job ads and news. GPT-5.4 then explains each change in one call:
a headline with the price gap to the shop's matching bike, why it matters, a next step, and a 1-5 rating. It
also matches new rival bikes to the shop's range. Anything rated 4 or 5 is emailed straight away; there's a
Monday digest and a dashboard. All data lives in one Google Sheet.

Demo for a fictional shop in Edinburgh. Its four rivals are invented, and their websites are served by n8n
(Radar 0), so the demo never scrapes a real business. Decisions and data design are in [SPEC.md](SPEC.md).

## Links (n8n on this Mac)

- Dashboard: http://localhost:5678/webhook/radar/dashboard?key=5EEHpAZzPOuMzkSjMopGhm9D
- Test inbox (alerts and digests test mode kept): http://localhost:5678/webhook/radar/outbox?key=5EEHpAZzPOuMzkSjMopGhm9D
- Demo competitor sites: e.g. http://localhost:5678/webhook/demo-web/page?site=torque-street&page=bikes
  (sites: torque-street bikes/home/careers, glenvolt shop/news, pedalpoint prices/careers, hilltrack range/home)
- Demo week: http://localhost:5678/webhook/demo-web/admin?key=aft4Xk1dxydLOo6S&week=1 (1-4)
- Google Sheet: https://docs.google.com/spreadsheets/d/1TyTgZFE87WFKQzOTdusFeov6m27SAixpu-Xiz7DHD7g/edit

## Workflows

| # | Workflow | ID | What it does |
|---|----------|----|--------------|
| 0 | Demo Competitor Sites | csrDemoSites0000 | Four invented rival sites that change week 1-4. Demo only. Published. |
| 1 | Run Checks | csrRunChecks0001 | Every 6 h / webhook / dashboard: check each page, GPT-5.4 analysis, save, alert. Published. |
| 2 | Check Page | csrCheckPage0002 | Fetch, clean, fingerprint, read products (JSON-LD or GPT-5.4 mini), compare. Published. |
| 3 | Dashboard | csrDashboard0003 | Dashboard, actions (seen, watch a page, check now), test inbox. Published. |
| 4 | Weekly Digest | csrWeeklyDgst04 | Monday 8:00 email: the week's changes, price position, page problems. Published. |
| 5 | Save Changes | csrSaveChange005 | Writes a plan to the sheet; Gmail in live mode, Outbox in test mode. Published. |
| 6 | Reset Demo | csrResetDemo0006 | Settings, our 8 bikes, 9 watched pages, known matches; demo sites to week 1. Manual. |
| 7 | Create Spreadsheet | csrCreateSheet07 | Run once: creates the sheet and its tabs. Manual. |

## Running the demo

1. Run **Radar 6: Reset Demo**.
2. `python3 workflows/test/run-weeks.py` replays the four demo weeks (it moves the demo sites to week N and
   runs a check stamped with that week's date). About 2.5 minutes in all.
3. Open the dashboard; run **Radar 4** (Send Now) for the digest. Alerts and the digest are in the test inbox.

## Status (2026-10-22)

Tested in test mode on the live workflows, with the real AI:

| Run | Result |
|-----|--------|
| Week 1 | First snapshot of 9 pages in 27 s; 2 AI reads (the two sites without structured data). |
| Week 2 | 36 s: 5 changes, 2 alerts. "Torque Street cut Commuter One to £1,649, £150 under our Metro 500" (5); Glenvolt's new Gravel GX matched to our Gravel 500 by the AI and rated 4 (£100 under). Pedalpoint's 503 maintenance page counted as a failed check, not a change. |
| Week 3 | 49 s: 9 changes, 4 alerts. "Glenvolt announced an Edinburgh showroom" (5), Ridge 625 cut £400 under ours (5), Black Friday banner (4). Hilltrack's bot-check page reported as "check page" (3), not as all products removed. |
| Week 4 | 39 s: 7 changes, 4 alerts, including "Store Lead, Edinburgh pop-up" job ad (5) and a £450 undercut; Hilltrack's redesigned page (no structured data) read by the AI. |
| Check now, nothing new | 9 pages in 13 s, no AI calls (fingerprints unchanged). |
| Digest | 16 changes in the week, price position for all 8 bikes. |

Before deployment the four weeks were also simulated locally with the AI mocked, which caught a dropped bike
still counting in the price table (fixed: only each page's latest snapshot counts).

## Going live

1. Point the **Watchlist** tab at real competitor pages (delete the demo rows and Radar 0), or use **Watch
   this page** on the dashboard. Keep an eye on each site's terms and robots rules; the radar fetches each
   page once per run.
2. Reconnect **Gmail account 2**, set `mode` to `live` and `alert_email` in Settings.
3. Put your own products in **Our Products**; matches for known rival bikes can be added in **Matches** (the
   AI suggests the rest).

## Files

- `prompts/`: the product reader and the analyst instructions with their JSON schemas.
- `site/dashboard.html`, `site/inbox.html`: pages filled with data by Radar 3.
- `workflows/src/*.ts` + `workflows/code/*.js` → `python3 workflows/build.py` → `workflows/*.ts`;
  `node workflows/deploy.js workflows/<file>.ts` validates and imports. `workflows/json/*.local.json` is what
  was imported. `workflows/test/run-weeks.py` replays the demo.
