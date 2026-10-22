# Fiverr portfolio: Competitor Radar

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
AI Competitor Price and Website Monitoring in n8n
```

## Description

1,105 characters (Fiverr needs at least 120).

```text
Prices, launches and promotions change every week, and checking rivals' websites by hand means you hear about it late.

I built a competitor radar in n8n, shown here for Cobble & Spoke, a fictional e-bike shop:
• Checks rivals' product, home, careers and news pages every 6 hours
• Reads prices from structured data, or with AI when a site has none
• Spots price cuts, new and dropped products, stock-outs, sales banners, job ads and news
• AI explains each change: what happened, the gap to your own product, why it matters, what to do, rated 1 to 5
• Important changes are emailed straight away; a Monday digest and a dashboard show the rest

Built to avoid false alarms: unchanged pages are skipped (the AI only runs when a page really changed), and a bot check or a redesign is reported as "check this page", not as every product removed. Rules make sure an undercut is never rated low.

Results (four-week demo with invented rivals): 21 changes found with no false alarms, including a rival's new showroom in the shop's city (rated 5) and a £450 undercut. A full check of 9 pages takes 13-49 seconds.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, OpenAI API, web scraping, Google Sheets, price monitoring, AI automation, Gmail

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/dashboard-01-what-changed.png`: Radar dashboard: what changed, rated 1 to 5 (cover)
2. `screenshots/email-01-alert.png`: Instant alert email for important changes
3. `screenshots/dashboard-03-price-history.png`: Price position against each rival, with history
4. `screenshots/email-02-weekly-digest.png`: Monday digest
5. `screenshots/dashboard-02-alerts-and-prices.png`: Alerts only, with the price table
6. `screenshots/dashboard-04-pages-watched.png`: Page health: read by structured data or AI
7. `screenshots/demo-site-torque-street.png`: One of the invented competitor sites the demo watches
8. `screenshots/workflow-01-run-checks.png`: Run Checks: every page, one AI analysis, rules, save, alert
9. `screenshots/workflow-02-check-page.png`: Check Page: fetch, fingerprint, read products, compare
10. `screenshots/workflow-03-dashboard.png`: Dashboard and its actions
11. `screenshots/workflow-04-weekly-digest.png`: Weekly Digest
12. `screenshots/workflow-05-save-changes.png`: Save Changes
13. `screenshots/workflow-00-demo-sites.png`: Demo competitor sites (demo only)
14. `screenshots/workflow-06-reset-demo.png`: Reset Demo
15. `screenshots/workflow-07-create-sheet.png`: Create Spreadsheet

Workflow images are renders of the live n8n workflows, 2880×1728 px (5:3, the ratio of the 1280×769 Fiverr recommends); nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-22. The dashboard and emails are live screens after replaying the four demo weeks with the real AI; the emails are shown in the test inbox.

## Notes for you (not for Fiverr)

- The rivals and their websites are invented and served by n8n (Radar 0), so the demo never scrapes a real business. For a client, point the Watchlist at their real competitors.
- "No false alarms" means: every reported change was a real change on the demo sites, and the maintenance page and bot check were not reported as products removed.
- Test mode: alerts and the digest went to the Outbox tab; Gmail is not tested live.
