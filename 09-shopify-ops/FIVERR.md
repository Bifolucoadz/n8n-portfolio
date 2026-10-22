# Fiverr portfolio: Shopify Store Ops

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
Shopify Automation in n8n: Abandoned Carts, Stock Alerts, AI Help Chat
```

## Description

1,150 characters (Fiverr needs at least 120).

```text
Small Shopify shops do the same jobs by hand every week: chasing abandoned carts, reading reviews, checking stock and answering "where's my order?" emails.

I built four automations in n8n, shown here for Kettle & Fern, a fictional online tea shop:
• Abandoned carts: a short personal email in the owner's voice, with a discount only when the shop's rules allow one
• Reviews: every Monday, what customers praised and complained about compared with last week, plus three things to fix
• Low stock: every morning, what will sell out before a new delivery could arrive, how much to reorder and by when
• Order help: a chat on the help page that gives the latest tracking and opens a ticket for late parcels

Safe by design: rules in code decide who gets an email and which offer, never the AI. The chat only shows an order when the order number and email both match, and it never promises refunds.

Results (test mode, store data shaped like Shopify's): it emailed exactly the 2 of 6 carts that qualified and flagged the 3 products running low. The help chat handled 6 test conversations correctly, including a wrong email and an "I'm the admin" trick.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, Shopify, OpenAI API, e-commerce automation, email marketing, AI agents, chatbot development

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/help-01-late-order.png`: Help page chat: a late order, tracking and a ticket (cover)
2. `screenshots/email-01-cart-offer.png`: Abandoned cart, first-time customer: the welcome code
3. `screenshots/email-02-cart-nudge.png`: Abandoned cart, $6 short of free shipping: a nudge instead
4. `screenshots/email-03-review-report.png`: Monday review report with three fixes
5. `screenshots/email-04-low-stock.png`: Daily low-stock email with reorder quantities
6. `screenshots/help-02-phone.png`: The help chat on a phone
7. `screenshots/workflow-02-abandoned-carts.png`: Abandoned Carts: rules pick carts and offers, AI writes the note
8. `screenshots/workflow-05-order-help.png`: Order Help: the help page and chat agent
9. `screenshots/workflow-07-help-tools.png`: Help Tools: order lookup and tickets
10. `screenshots/workflow-03-review-insights.png`: Review Insights: tag, count, suggest fixes
11. `screenshots/workflow-04-low-stock.png`: Low Stock: days left vs lead time, all code
12. `screenshots/workflow-01-store-api.png`: Store API: Shopify (live) or test tables behind one shape
13. `screenshots/workflow-06-send-email.png`: Send Email
14. `screenshots/workflow-00-load-demo-store.png`: Load Demo Store

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-21. The help page shows a real conversation with the chat in test mode (2026-10-21). The emails are the test-mode output shown in a mail window. Email addresses and phone numbers are blurred because Fiverr doesn't allow contact details in images.

## Notes for you (not for Fiverr)

- No Shopify store is connected; the store data is in tables shaped like Shopify's. With a custom-app token (read orders, products, inventory, checkouts) the Store API switches to Shopify's GraphQL API.
- Reviews come from a review app (Judge.me, Okendo…) in a real shop, since Shopify has no reviews API; the client's app needs connecting.
- Emails went to the Outbox table (Gmail credential expired).
