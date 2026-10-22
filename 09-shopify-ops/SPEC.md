# Shopify Store Ops: build spec

Portfolio project 9. Four everyday jobs for **Kettle & Fern**, a fictional online tea shop in Portland,
Oregon, on Shopify: abandoned-cart emails, a weekly review report, low-stock alerts, and a help chat that
answers "where's my order?".

Everything is invented: shop, products, customers (example.com emails), tracking numbers, reviews.

## Decisions (2026-10-21)

- Standalone project (one of four new portfolio projects the user asked for).
- No Shopify store yet, so test mode uses data tables shaped like Shopify's data, loaded by
  **Kettle 0: Load Demo Store** relative to today with a seeded generator (same store every time). The
  live path uses the Shopify Admin GraphQL API with a custom-app token (credential "Shopify Admin token",
  header `X-Shopify-Access-Token`, node disabled until it exists). Reviews come from a review app in
  production (Shopify has no reviews API), kept in the Kettle Reviews table.
- Every workflow talks to the store only through **Kettle 1: Store API** (test or live behind one shape).
- Rules in code, AI for wording:
  - abandoned carts: who gets an email (not completed, has an email, marketing consent, not contacted,
    left 1-48 h ago) and which offer (first-order code for first-time customers with $60+, free-shipping
    nudge within $15 of the threshold, otherwise none) are code. `gpt-5.4-mini` writes a short note in the
    owner's voice and may only mention the offer it is given. One email per checkout, ever.
  - reviews: `gpt-5.4-mini` tags each new review (fixed topic list, sentiment, issue); counts and
    week-on-week changes are code; `gpt-5.4` writes the headline and three fixes from those numbers only.
  - low stock: all code (sales per day over 28 days, days left, lead time + 7-day safety buffer,
    reorder quantity for lead time + 30 days, never below the supplier minimum).
  - help chat: `gpt-5.4-mini` agent with two tools. lookup_order needs the order number AND the email
    (a mismatch looks the same as a wrong number); "late" is decided in code (estimate passed or tracking
    quiet for 4 days); open_ticket emails the team and returns a ticket number. No refunds promised.
- The help chat is served from n8n (`/webhook/kettle/help`) as a storefront-style help page.
- Email: Gmail in live mode, the Kettle Outbox table in test mode.
- Times are Pacific (America/Los_Angeles).

## Data tables

| Table | ID | What |
|-------|----|------|
| Kettle Products | Ep9njyaWF13y9SHL | sku, title, category, price, inventory, lead_time_days, min_order_qty, supplier, notes |
| Kettle Orders | KVudLSbZlietFc9a | order_number, email, customer_name, created_at, total, items_json, fulfillment and tracking fields, ship_city |
| Kettle Checkouts | XluYD3lO9tEeAhBS | abandoned checkouts with items, subtotal, recovery_url, completed, accepts_marketing, orders_count, contacted_at, offer |
| Kettle Reviews | D2bbJsHicEHPMugS | review_id, sku, rating, title, body, author, created_at, topics_json, sentiment, issue, analysed_at |
| Kettle Messages | V2SpiVAU4JiGBdNI | help chat history per session |
| Kettle Outbox | 1crkkgyfXiNjy3HZ | test-mode emails |
| Kettle Reports | AyZ17CcwolU182Td | saved review and stock reports |
| Kettle Settings | QbQi6BAEGxZmzGyT | mode, store and owner details, offer rules, stock and lateness thresholds, Shopify domain and API version |

## Workflows

| # | Name | ID | Trigger |
|---|------|----|---------|
| 0 | Load Demo Store | ktlLoadStore0000 | Manual |
| 1 | Store API | ktlStoreApi00001 | Called |
| 2 | Abandoned Carts | ktlAbandoned0002 | Every 30 minutes + manual |
| 3 | Review Insights | ktlReviews000003 | Mondays 8:00 + manual |
| 4 | Low Stock | ktlLowStock00004 | Daily 7:00 + manual |
| 5 | Order Help | ktlOrderHelp0005 | Webhooks GET `kettle/help`, POST `kettle/help/chat` |
| 6 | Send Email | ktlSendEmail0006 | Called |
| 7 | Help Tools | ktlHelpTools0007 | Called by the help agent's tools |

## Build changes (2026-10-21)

- The cart IF used an operator that doesn't exist (`notTrue`); replaced with a negated expression.
- One demo cart was $9 short of testing the free-shipping nudge; it now has a third item.
- Prompt tweaks after the first runs: subjects in sentence case; the help agent starts with the direct
  answer ("Not yet") when an order hasn't shipped.
- The review report subject was cut at 70 characters mid-word; subjects are now cut at a word with "…".
  The stock email shows order-by dates as "Sat 24 Oct".
