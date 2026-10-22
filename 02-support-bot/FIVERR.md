# Fiverr portfolio: Customer Support Bot

Text for Fiverr's "Add project" form. Copy from inside the boxes so the line breaks survive.

## Project name

```text
AI Customer Support Chatbot with Appointment Booking in n8n
```

## Description

1,110 characters (Fiverr needs at least 120).

```text
Customers message after hours and hear nothing back, and staff spend the day repeating prices and opening times. Every slow answer can be a lost booking.

I built a website chat assistant in n8n, shown here for Copperline Auto Repair, a fictional garage:
• Answers from the business's own Google Doc. Edit the doc and the bot knows within 5 minutes
• Checks the live Google Calendar and books appointments right in the chat, with a confirmation email
• Hands a chat to staff when needed, with a summary and the full transcript
• Logs questions it couldn't answer; a Monday report suggests what to add to the doc
• Custom chat page with tappable time slots, on phone or desktop

Safe by design: it never guesses prices, safety issues get "stop driving, call the tow line" first, every slot is re-checked so bookings can't clash, and per-chat limits stop abuse.

Results: 30 test questions (prices, hours, safety, bookings, off-topic) all answered correctly, 6.6 seconds per reply on average. A full booking takes 3 messages.

The same setup suits any business that takes bookings: salons, clinics, repair shops.
```

## Other fields

- Duration: 1-2 weeks
- Skills and tools: n8n, OpenAI API, Supabase, Google Calendar, Google Sheets, chatbot development, AI agents

## Images

Upload in this order; the first is the cover. If the form caps the number of files, keep the first ones.

1. `screenshots/02-chat-agent.png`: Chat Agent: the assistant, its tools and memory (cover)
2. `screenshots/04-book-appointment.png`: Book Appointment: validate, re-check the slot, create the event, confirm
3. `screenshots/03-check-availability.png`: Check Availability: free slots from the calendar
4. `screenshots/01-knowledge-sync.png`: Knowledge Sync: Google Doc to the knowledge base every 5 minutes
5. `screenshots/05-hand-off-to-staff.png`: Hand Off to Staff: summary and transcript to the team
6. `screenshots/06-weekly-report.png`: Weekly Report: chats, bookings and unanswered questions
7. `screenshots/07-log-chat-turn.png`: Log Chat Turn: background logging

Workflow images are renders of the live n8n workflows, 2880×1732 px (5:3, the same ratio as the 1280×769 Fiverr recommends, so they scale down cleanly). Sticky notes are moved into a band above the nodes and a few nodes nudged apart so the text is readable; nodes, connections and settings are as in n8n. Light mode, captured 2026-10-21 (every other project is in dark mode).

## Notes for you (not for Fiverr)

- A screenshot of the chat page (site/chat.html) would make a stronger cover than a workflow. It needs the tunnel up, or a render with a mocked webhook like the MedInfo chat shots.
