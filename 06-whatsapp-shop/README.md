# WhatsApp Shop

A WhatsApp ordering assistant for **Honeycrumb Bakery**, a fictional cake and pastry shop in Lekki,
Lagos. "Honey" helps customers choose (text, Pidgin or voice notes), builds the order, quotes
delivery by area, checks lead times and opening days, and sends a **Pay ₦X** button (Paystack).
Paid orders land on a Google Sheet kitchen board and in the owner's Telegram; when staff change an
order's status on the board, the customer gets a WhatsApp update.

Portfolio project 6. Decisions and details are in [SPEC.md](SPEC.md).

## How it works

```
Customer (WhatsApp) ──> 1 WhatsApp In ──> 2 Handle Message ── GPT-5.4 mini agent ──> 3 Shop Tools
                          (signature)      dedupe · hand-off      search_menu · update_cart ·
                                           voice → Whisper        delivery_quote · checkout (Paystack) ·
                                           12-message context     order_status · request_human
                                                │
                                                └──> 4 Send WhatsApp (text / Pay button / read+typing)
Paystack ──> 5 Paystack Webhook ── verify API ──> paid · WhatsApp confirmation · kitchen board · Telegram
Kitchen board sheet ──> 6 Kitchen Board (every minute) ──> status update to the customer
7 Reminders (15 min): one payment nudge after 1 h, expiry after 24 h · 8 Daily Summary (9 pm)
```

| # | Workflow | ID | Status |
|---|----------|----|--------|
| 0 | Honeycrumb 0: Setup | `hcbShopSetup0000` | Built; run after Google is reconnected |
| 1 | Honeycrumb 1: WhatsApp In | `hcbWhatsAppIn001` | Built; needs the WhatsApp credentials and the public address |
| 2 | Honeycrumb 2: Handle Message | `hcbHandleMsg0002` | **Published**, tested (voice-note download disabled until the WhatsApp credential exists) |
| 3 | Honeycrumb 3: Shop Tools | `hcbShopTools0003` | **Published**, tested in mock-payment mode (Paystack node disabled until its credential exists) |
| 4 | Honeycrumb 4: Send WhatsApp | `hcbSendWA0000004` | **Published**, test mode works (real send disabled until the credential exists) |
| 5 | Honeycrumb 5: Paystack Webhook | `hcbPaystack00005` | Built; needs the Paystack credential |
| 6 | Honeycrumb 6: Kitchen Board | `hcbKitchen000006` | Built; needs Setup |
| 7 | Honeycrumb 7: Reminders | `hcbReminders0007` | Built, not published |
| 8 | Honeycrumb 8: Daily Summary | `hcbDailySum00008` | Built, not published |
| T | Honeycrumb T: Test Chat | `hcbTestChat0000T` | Test harness (`POST /webhook/honeycrumb/test-chat`); unpublished so it isn't public |

Data tables: Honeycrumb Products (15 items), Zones (11 Lagos areas), Orders, Customers, Chats,
Outbox, Settings (`payments = mock` until the Paystack key exists).

## Tested so far (2026-10-21)

- `workflows/test/logic.test.js` (24 checks) and `flows.test.js` (14 checks): menu search, cart maths,
  30-character cake messages, sold-out items, zone aliases ("VI", "Lakowe"), checkout rules (48-hour
  cakes, closed Sundays, windows, missing address), the Pay button payload, WhatsApp message types,
  Paystack verification (wrong amount and duplicate webhooks refused), kitchen-board updates inside
  and outside WhatsApp's 24-hour window, reminders, expiry and the daily summary.
- `workflows/test/chat.js`: five scripted conversations through the real agent in test mode, all as
  expected: a full order (cake for 15 → 8-inch, message on cake, Lekki delivery ₦2,000, summary,
  confirmation, order HC-VLJV with a **Pay ₦57,000** button), Pidgin with a too-soon cake (offered the
  correct earliest slot, Friday 4pm-6pm), delivery quotes and an uncovered area, a damaged-cake
  complaint handed to a person (bot then stays quiet), and a prompt-injection discount request
  (refused). Replies took 2-6 seconds.
- Not yet run live: WhatsApp, Paystack, the kitchen board sheet.

## Setup still to do

1. Google and Telegram, as in project 5 (reconnect Google Sheets; `/start` the bot). Claude runs **0 Setup**.
2. **ngrok:** same tunnel as project 5 (`hosting/start-public.sh`).
3. **Meta:** developers.facebook.com → app (Business) → WhatsApp → API Setup: add your phone as a
   test recipient. In n8n create **WhatsApp account** (WhatsApp API: access token + Business Account ID)
   and **WhatsApp Trigger account** (WhatsApp OAuth API: App ID + App Secret). Tell Claude the
   Phone number ID.
4. **Paystack:** in n8n create **Paystack Test** (Header Auth, `Authorization` = `Bearer sk_test_...`);
   set the Test Webhook URL in Paystack to `https://<ngrok domain>/webhook/honeycrumb/paystack`.
5. Claude attaches the credentials, re-enables the four disabled nodes, sets `payments = paystack`,
   publishes 1, 5, 6, 7, 8, and you message the test number from your phone.
