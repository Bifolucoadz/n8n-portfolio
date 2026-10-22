# Fiverr portfolio: WhatsApp Shop

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
WhatsApp Ordering Bot with Paystack Payments in n8n
```

## Description

1,181 characters (Fiverr needs at least 120).

```text
Small food businesses take most orders on WhatsApp by hand: the same price questions, delivery fees worked out one by one, payments to chase and cake messages to remember. Orders get missed.

I built a WhatsApp ordering assistant in n8n, shown here for Honeycrumb Bakery, a fictional bakery in Lagos:
• Answers menu, price, allergen and delivery questions in English or Pidgin, voice notes included
• Builds the cart, adds cake messages, quotes delivery by area and checks lead times and opening days
• Sends a Paystack Pay button in the chat and confirms the order only after payment is verified
• Paid orders go to a Google Sheet kitchen board; changing a status there messages the customer
• Hands complaints to a person, sends payment reminders and a nightly sales summary

Safe by design: the AI never sets prices or totals; code does, from the menu. Every payment is re-checked with Paystack, so a fake confirmation can't mark an order paid.

Results (test mode, payment link mocked): a full order reached a ₦57,000 Pay button in 5 messages. It offered the right date for a too-soon cake, refused a discount trick and handed a complaint to a person. Replies took 2-6 seconds.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, WhatsApp Business API, Paystack, OpenAI API, Google Sheets, AI agents, chatbot development

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/chat-01-order.png`: A full order, from menu question to Pay button (cover)
2. `screenshots/chat-02-tricky-messages.png`: Too-soon cake, discount trick, complaint hand-off
3. `screenshots/workflow-02-handle-message.png`: Handle Message: the AI agent
4. `screenshots/workflow-03-shop-tools.png`: Shop Tools: menu, cart, delivery, checkout
5. `screenshots/workflow-01-whatsapp-in.png`: WhatsApp In
6. `screenshots/workflow-04-send-whatsapp.png`: Send WhatsApp
7. `screenshots/workflow-05-paystack-webhook.png`: Paystack Webhook: verifies every payment
8. `screenshots/workflow-06-kitchen-board.png`: Kitchen Board
9. `screenshots/workflow-07-reminders.png`: Reminders
10. `screenshots/workflow-08-daily-summary.png`: Daily Summary

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Dark mode, captured 2026-10-21. The two chat screens are the assistant's real replies from the scripted test run (test mode, 2026-10-21), rendered as chat screens with a caption saying so. They were not sent through WhatsApp, and the payment link was mocked.

## Notes for you (not for Fiverr)

- Once WhatsApp and Paystack are connected, real phone screenshots and a paid test order can replace the chat renders, and the Results line can quote live numbers.
