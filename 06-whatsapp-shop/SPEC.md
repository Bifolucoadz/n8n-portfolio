# WhatsApp Shop: build spec

Portfolio project 6. A WhatsApp ordering assistant for **Honeycrumb Bakery**, a fictional cake and
pastry shop in Lekki, Lagos. Customers chat in WhatsApp (text, voice notes or a location pin): they
browse the menu, build an order, get the delivery fee for their area, and pay with a Paystack link
inside the chat. The bakery gets paid orders on a Google Sheet kitchen board and in Telegram;
changing an order's status on the board messages the customer.

Everything is invented: bakery, products, prices, staff and addresses. Paystack runs in test mode.

## Decisions (2026-10-21)

- Channel: **WhatsApp Cloud API** (Meta test number while building; up to 5 verified recipients).
  Incoming messages through n8n's WhatsApp Trigger, which needs n8n on a public address: the free
  **ngrok static domain** shared with project 5 (`hosting/start-public.sh`), with `WEBHOOK_URL` set.
- Payments: **Paystack test mode** (user's pick). Payment links from `/transaction/initialize`;
  the Paystack webhook is only a signal: every payment is confirmed with `/transaction/verify` before
  an order is marked paid (no HMAC needed in n8n, where `crypto` is blocked).
- Model: `gpt-5.4-mini` agent (reasoning low) with tools; prices, totals, fees, lead times and order
  states are computed in code, never by the model.
- Storage: **n8n data tables** (fast, local, no Supabase dependency; Supabase is paused). The Google
  Sheet is the owner's kitchen board, written in the background.
- Memory: the last 12 messages per customer from the `Honeycrumb Chats` table, passed in the prompt
  (one data-table read; no memory node).
- All outbound WhatsApp goes through one sub-workflow (`Send WhatsApp`). With `test = true` it writes
  to the `Honeycrumb Outbox` table instead of sending, so the whole flow can be tested without Meta.
- Owner alerts: Telegram, outbound only (the existing bot is polled by project 4, so no Telegram
  buttons here). Owner actions happen on the kitchen board sheet.
- Voice notes are transcribed (OpenAI `gpt-4o-transcribe`) and handled like text, because many
  customers in Lagos order by voice note.
- WhatsApp's 24-hour rule: free-form replies only within 24 hours of the customer's last message.
  Status updates outside the window are skipped and noted on the board (production would use an
  approved template).

## Shop facts (fictional)

| | |
|---|---|
| Name | Honeycrumb Bakery, cakes, pastries and small chops |
| Pickup | 14 Admiralty Way, Lekki Phase 1, Lagos (Mon-Sat 8 am-7 pm) |
| Delivery | Lagos zones with fixed fees (table below), 10 am-6 pm, Mon-Sat |
| Lead time | Celebration cakes 48 hours, everything else same day if ordered before 2 pm |
| Payment | Paystack (cards, bank transfer, USSD); orders start only after payment |

## Data tables

| Table | Columns |
|-------|---------|
| `Honeycrumb Products` | sku, name, category, description, price_ngn, image_url, lead_hours, available, options |
| `Honeycrumb Zones` | area, aliases, fee_ngn, eta |
| `Honeycrumb Orders` | order_id, phone, customer_name, status, items_json, subtotal_ngn, delivery_fee_ngn, total_ngn, fulfilment, area, address, deliver_on, window, note, paystack_ref, pay_url, turn_id, reminder_sent, created_at, paid_at, updated_at |
| `Honeycrumb Customers` | phone, name, last_inbound_at, handoff_until, orders_count |
| `Honeycrumb Chats` | phone, role, text, message_id, at |
| `Honeycrumb Outbox` | phone, kind, body, at (test mode) |
| `Honeycrumb Settings` | key, value |

Order states: `cart` → `awaiting_payment` → `paid` → `baking` → `out_for_delivery` / `ready_for_pickup`
→ `delivered`; also `cancelled`, `expired`. One open cart per phone.

## Agent tools (one sub-workflow, `action` switch)

| Tool | Does |
|------|------|
| `search_menu` | Products by words or category, with SKU, price, lead time, options |
| `send_photos` | Sends up to 3 product photos with captions |
| `update_cart` | add / remove / set quantity / clear, with a cake message option; returns the cart and totals |
| `delivery_quote` | Fee and delivery time for an area (aliases like "VI", "Ajah"), or pickup |
| `checkout` | Validates name, fulfilment, address, date and lead times; creates the Paystack link; order → `awaiting_payment` |
| `order_status` | The customer's recent orders and their status |
| `request_human` | Pauses the bot for this chat for 2 hours and alerts the owner on Telegram |

After the agent, `Send Reply` sends the text, or an interactive **Pay ₦X** button when this turn
created a payment link.

## Workflows

| # | Workflow | Trigger |
|---|----------|---------|
| 0 | Honeycrumb 0: Setup | Manual: kitchen board sheet, owner chat (menu, zones and settings were loaded into the data tables directly) |
| 1 | Honeycrumb 1: WhatsApp In | WhatsApp Trigger (messages) |
| 2 | Honeycrumb 2: Handle Message | Sub-workflow (also run directly in tests) |
| 3 | Honeycrumb 3: Shop Tools | Agent tools |
| 4 | Honeycrumb 4: Send WhatsApp | Sub-workflow (text, payment button, image, read receipt) |
| 5 | Honeycrumb 5: Paystack Webhook | Webhook `POST /webhook/honeycrumb/paystack` |
| 6 | Honeycrumb 6: Kitchen Board | Every minute: reads the board and compares statuses (the Sheets Trigger would need another Google credential) |
| 7 | Honeycrumb 7: Reminders | Every 15 minutes: one payment reminder after 1 hour, expiry after 24 hours |
| 8 | Honeycrumb 8: Daily Summary | 21:00 Africa/Lagos + manual |

Errors go to **Social Autopilot 0: Error Alerts** (Telegram).

## Testing

- Without Meta: run Honeycrumb 2 with `test = true` and scripted customer messages; replies land in
  the Outbox table. Paystack test links are real (test mode).
- With Meta: the user messages the test number from their phone; pays with Paystack's test card.

## Build notes (2026-10-21)

- Same build tooling as project 5 (`build.py`, `deploy.js`, `lib-shop.js`). `deploy.js` keeps the
  nodes that need a not-yet-created credential disabled (`DISABLED` list) so 2, 3 and 4 could be
  published and tested.
- A tool sub-workflow called from a sub-workflow must be published, even in a manual test run
  ("Workflow is not active and cannot be executed").
- First test run: the agent guessed "Friday morning" for a 48-hour cake. Fix: every turn's prompt
  now carries the earliest delivery and pickup slots for same-day, 24-hour and 48-hour items, and the
  prompt forbids working out dates.
- An empty Telegram chat ID made the Telegram node take 36 s to fail; owner alerts are now skipped
  until `owner_chat_id` is set.
