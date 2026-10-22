# Social Autopilot

A content calendar that runs itself. Topics go in a Google Sheet. Each topic gets a posting slot,
AI writes a LinkedIn and a Telegram version (plus an image if wanted), you approve it from
your phone in Telegram, and it is published at its time. Every Monday you get a report and three
new topic ideas.

Portfolio project 4. It posts for the owner's own brand, so it is also a working marketing channel.
Decisions and design details are in [SPEC.md](SPEC.md).

## How it works

```
Google Sheet (Calendar)          Telegram (your phone)
  topic, notes, link, image        preview + [Approve] [Rewrite] [Post now] [Reject]
        │                          reply "shorter, end with a question" → rewritten
        ▼                                   ▲            │
 2 Clock (5 min) ──48 h before──> 5 Draft Post ──────────┘            │
        │                         GPT-5.5 + gpt-image-2               ▼
        │                                              3 Listener (1 min) → 4 Handle Update
        └──approved + due──> 6 Publish Post ──> LinkedIn · Telegram channel
                                     └──> links back in the sheet, "✅ Posted" in Telegram
 7 Weekly Report (Mon 08:00) → last week, next week, gaps, 3 new ideas
```

| # | Workflow | ID | Trigger | Status |
|---|----------|----|---------|--------|
| 0 | Error Alerts | `iTxd64lDk3gI0bKG` | Error Trigger | Published |
| 1 | Setup | `V95GRAL4NapIgnfw` | Manual | Ran once on 2026-10-07 (don't run again) |
| 2 | Clock | `1J9foYt6NhBIh0AC` | Every 5 min | Not published yet (step 6 below) |
| 3 | Telegram Listener | `OuvjrqK6gsSlEXN5` | Every minute | Not published yet |
| 4 | Handle Telegram Update | `Ct82LJwhDk3wIS1M` | Sub-workflow | Not published yet (needs 6) |
| 5 | Draft Post | `Pw338SAVybgIkdmI` | Sub-workflow | Published, tested live |
| 6 | Publish Post | `3bhvmihQquHwukP6` | Sub-workflow | Needs the LinkedIn credential before it can be published |
| 7 | Weekly Report | `Ohg9TlwdT0io4WoI` | Monday 08:00 + manual | Not published yet |
| 8 | Check Connections | `TXRs9BSsr7XffLRv` | Manual | Run it after each setup step |

Resources: [content calendar](https://docs.google.com/spreadsheets/d/1yAp5Z0eIMMvYO9DDx_Gtb_4CCNquU5vxNWaLH-WCzN8/edit)
(samuelgurru@gmail.com), Drive folder *Social Autopilot* (images in *Images*), n8n data table
*Social Autopilot State*. All IDs are in `workflows/ids.md`.

## Setup (about 15 minutes, once)

**1. Telegram bot and channel**
- In Telegram, open **@BotFather**. Either `/mybots` → pick the bot already used by n8n's *Telegram account*
  credential → *API Token*, or `/newbot` to make one (e.g. "Samuel Autopilot"). If you make a new one,
  paste its token into the n8n credential **Telegram account** too. Both must be the same bot.
- In n8n: **Overview → Data tables → Social Autopilot State** → put the token in the `value` of the
  `telegram_bot_token` row.
- Create a **public channel** (e.g. `@samuel_automates`), add the bot as an **admin** with *Post messages*,
  and put `@samuel_automates` in the Settings tab, `telegram_channel`.

**2. LinkedIn**
- https://www.linkedin.com/developers/apps → *Create app* (needs a LinkedIn company page; any page you
  own works). In *Products* add **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
- In *Auth*, add the redirect URL `http://localhost:5678/rest/oauth2-credential/callback`.
- In n8n: *Credentials → Add → LinkedIn OAuth2 API*, name it **LinkedIn account**, paste the client ID
  and secret, leave *Organization Support* off, *Connect*.
- LinkedIn tokens last 60 days. When posting starts failing with an auth error, open the credential and
  reconnect.

**3. Settings tab:** check `brand_name` (currently "Samuel Oladele"), `what_you_do`, `voice`, `facts`,
`call_to_action`, `default_link` (e.g. your portfolio page), `post_days` / `post_time`.

**4. Tell Claude it's done.** Claude attaches the LinkedIn credential, publishes workflows 6, 4, 3 and 2,
and runs **Check Connections**.

**5. Claim the bot:** send `/start` to your bot in Telegram. You become the approver (only you can
approve). Run **8 Check Connections** again; every line should be ✅.

## Using it

- **Add topics** in the Calendar tab (topic, optional notes / link / image), or text the bot
  `/idea Why follow-up emails win deals`. Leave `publish_at` blank to take the next free Mon/Wed/Fri 09:00.
- About 48 h before the slot, the draft arrives in Telegram with the image. **Approve**, **Rewrite**
  (fresh take), **Post now** or **Reject**, or reply to it with what to change.
- You can also edit the text cells in the sheet before approving; the sheet is what gets posted.
- Not approved by post time? You get one reminder; once approved it goes out within 5 minutes.
- `/queue` shows what's coming. The Monday report adds three ideas as `suggested`; `/use P-XXXXX` schedules one.
- **Test mode** is on (`mode = test`): at post time you get exactly what would go out, and nothing is
  public. Set `mode` to `live` when you're happy.

## Tests (2026-10-07, re-tested 2026-10-08)

| Test | Result |
|------|--------|
| Setup workflow | Sheet, tabs, formatting, 8 starter topics, Drive folders created |
| Partial row updates (by row number and by post_id) | Other cells untouched; values written RAW |
| Draft Post, live (topic 1) | GPT-5.5 wrote all versions, no invented numbers; gpt-image-2 JPEG 155 KB saved to Drive; sheet row `in_review`. Telegram preview skipped (no approver yet), as designed |
| Publish Post, test mode | Image loaded from Drive, test message built, row `test_posted` |
| Re-test after removing Bluesky (2026-10-08) | Draft wrote LinkedIn + Telegram versions and a new image; Publish in test mode handled both platforms and saved `test_posted`; sheet columns and settings migrated; row cleaned afterwards |
| Clock + handler logic | 28 local scenario checks pass (`node workflows/test/logic.test.js`) |
| Check Connections | Reports each missing piece correctly |
| Weekly Report (manual run) | Summary built (empty slots Fri 9, Mon 12, Wed 14 Oct); 3 new ideas from GPT-5.5 added to the sheet as `suggested`; Telegram send failed only because no approver is set yet |
| Not yet tested live | Telegram buttons and replies, LinkedIn and channel posting (need the setup above) |

## Files

- `SPEC.md`: decisions, sheet design, lifecycle, reliability rules.
- `prompts/writer.md`, `prompts/ideas.md` (+ JSON schemas): the AI instructions.
- `workflows/src/*.ts` + `workflows/code/*.js` → `python3 workflows/build.py` → `workflows/*.ts` (SDK source).
- `node workflows/check.js workflows/<file>.ts` validates a built workflow with n8n's own SDK.
- `workflows/test/`: local logic tests for the Clock and the Telegram handler.
- `workflows/json/`: exports from n8n.
