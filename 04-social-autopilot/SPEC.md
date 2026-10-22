# Social Autopilot: build spec

Portfolio project 4. A content calendar that runs itself for the user's own AI automation brand.
You put topics in a Google Sheet. The workflows schedule each one into the next free posting slot,
have AI write a version for each platform (and an image if wanted), send a preview to your phone in
Telegram with Approve / Rewrite / Reject buttons, and publish approved posts at their time to
**LinkedIn** and a **Telegram channel**. Every Monday you get a report with what went out, gaps in
the coming week and three new topic ideas.

It is real, not a demo business: it posts for the user, so the portfolio piece also markets them.
It shows scheduling, AI content generation, image generation, human approval on a phone and
multi-platform publishing, which is the social media package small businesses ask for.

## Decisions (2026-10-07)

- Platforms: LinkedIn (personal profile) and a Telegram channel. Chosen by the user (Bluesky was in
  the first build and removed on 2026-10-08 at the user's request). Facebook,
  Instagram and X left out (Meta app setup and X's paid API).
- Accounts: the user's own brand. Content source: AI drafts from a content calendar. Approval:
  every post approved by a person (a `require_approval` setting can switch this off for clients
  who want it fully automatic).
- Approvals by **Telegram**, not email: the samuelgurru Gmail is restricted (2026-10-03), and a phone
  tap is faster.
- n8n runs on the user's Mac with no public URL, so neither the Telegram Trigger (needs an HTTPS
  webhook) nor n8n's send-and-wait links (point at localhost, dead on a phone) work. Workflow 3 polls
  Telegram's `getUpdates` every minute (long poll, 50 s), which works anywhere. The Bot API takes the
  token in the URL, so the token is stored in the n8n data table `Social Autopilot State`, not in
  workflow JSON. Telegram *sending* uses the normal Telegram credential; both must be the same bot
  (workflow 1 checks).
- Only the approver can act: updates from any other Telegram user are ignored. The first person to
  send `/start` to the bot becomes the approver (stored in the data table); clear that row to reset.
- AI: OpenAI `gpt-5.5` (reasoning low) through the OpenAI node's Responses API with a strict JSON
  schema, the pattern proven in project 3. Images: `gpt-image-2` through the Images API (HTTP node,
  OpenAI credential) as JPEG, about 120-250 KB. The n8n OpenAI
  image operation can't choose JPEG.
- The AI may only state facts from the topic, notes, linked page or the `facts` setting. Portfolio
  projects are demos for fictional businesses and must be described that way, never as clients.
- **Test mode** (`mode = test`, default): everything runs, but instead of posting, the bot sends you
  exactly what would have gone out, and the row becomes `test_posted`. Switch to `live` in Settings.
- Execution history: the two polling workflows (2 every 5 min, 3 every minute) don't save successful
  runs, so they don't flood the shared execution list. Real work happens in sub-workflows 4-6,
  which save everything.
- Error alerts go to the approver in Telegram (workflow 0), not the shared `Lead Engine 0` Gmail
  alert, which is broken while samuelgurru's Gmail is restricted.

## Environment

- n8n 2.30.7, local, http://localhost:5678, built through the n8n MCP server, same conventions as
  projects 2 and 3 (`workflows/src/*.ts` + `workflows/code/*.js` → `workflows/*.ts` via
  `workflows/build.py`; `workflows/json/` exports).
- Workflow names start with `Social Autopilot N:`. Tags `portfolio`, `social-autopilot`.
- Time zone `Africa/Lagos` (the Mac's zone); changeable in Settings.

## Accounts and credentials

| n8n credential | Used for | Status |
|----------------|----------|--------|
| `OpenAI account` (GQdth43VUJxkSsw9) | Writing posts, images | exists |
| `Google Sheets account` (D8rKxzgMrJwmFZoQ) | Content calendar | exists (samuelgurru, still works) |
| `Google Drive account` (sN9bbP0t0u0A88QU) | Image folder | exists (samuelgurru) |
| `Telegram account` (V3kTN1drqw8YNjzk) | Previews, notifications, channel posts | exists; bot to be confirmed |
| `LinkedIn account` | Posting to the user's profile | **user creates** |

## Content calendar (Google Sheet `Social Autopilot: Content Calendar`)

### Calendar tab, one row per post

| Column | Who fills it | Meaning |
|--------|--------------|---------|
| `post_id` | workflow | `P-xxxxx`, assigned on first sight |
| `publish_at` | you or workflow | `2026-10-12 09:00` in the Settings time zone. Blank = next free slot from `post_days` + `post_time` |
| `topic` | you | What the post is about (required) |
| `notes` | you | Angle, facts, example, anything the AI should use |
| `link` | you | Optional URL to share. The page is read for context |
| `image` | you | `ai` (generate one), `none`, or an image URL / Drive link. Blank = `default_image` setting |
| `platforms` | you | `linkedin, telegram`. Blank = `default_platforms` |
| `status` | both | see lifecycle |
| `linkedin_text`, `telegram_text` | workflow, editable | The drafts. Edit a cell before approving and the edited text is what goes out |
| `image_link` | workflow | Drive link to the image used |
| `linkedin_url`, `telegram_url` | workflow | Links to the live posts |
| `error` | workflow | Last problem, in plain words |
| `drafted_at`, `approved_at`, `posted_at` | workflow | Timestamps |
| `feedback` | workflow | Your last change request (from a Telegram reply) |
| `image_file_id`, `preview_message_id`, `reminded_at`, `attempts`, `updated_at` | workflow | Bookkeeping |

### Lifecycle

```
idea ──(48 h before publish_at)──> drafting ──> in_review ──[Approve]──> approved ──(publish_at)──> publishing ──> posted
  ▲                                    ▲            │                                                  ├──> partial (some platforms failed)
  │                                    └─[Rewrite / reply]                                             └──> failed ──[Retry]──> approved
  │                                                 ├──[Reject]──> rejected
suggested (weekly ideas; /use or set to idea)       └──[Post now]──> approved with publish_at = now
needs_fix: publish_at unreadable, or drafting failed 3 times
test_posted: the test-mode equivalent of posted
```

### Settings tab (key / value / what it does)

`brand_name`, `what_you_do`, `audience`, `voice`, `facts`, `avoid`, `call_to_action`,
`default_link`, `hashtags`, `image_style`, `default_image`, `default_platforms`, `post_days`,
`post_time`, `timezone`, `draft_hours_ahead` (48), `require_approval` (yes), `mode` (test / live),
`telegram_channel` (`@name` of the public channel), `linkedin_visibility` (PUBLIC).

## Workflows

| # | Workflow | Trigger | What it does |
|---|----------|---------|--------------|
| 0 | Error Alerts | Error Trigger | Telegram message to the approver with workflow, node, error, execution link |
| 1 | Setup | Manual (ran once) | Created the sheet (Calendar + Settings tabs, formatting, 8 starter topics) and the Drive folder *Social Autopilot/Images* |
| 2 | Clock | Every 5 min | Reads the calendar once: assigns IDs and slots, flags bad dates, starts drafts that are due, starts publishing for approved posts that are due, reminds you about posts still waiting for approval at their time, un-sticks rows stuck in `drafting`/`publishing` |
| 3 | Telegram Listener | Every minute | Long-polls `getUpdates`, saves the offset, hands each update to workflow 4 (no wait) |
| 4 | Handle Telegram Update | Sub-workflow | Buttons: approve, rewrite, reject, post now, retry. A reply to a preview = change request → AI rewrite. Commands: `/start`, `/help`, `/queue`, `/idea <topic>`, `/use <post_id>` |
| 5 | Draft Post | Sub-workflow | Reads the row, settings and recent posts; reads the linked page; AI writes the LinkedIn and Telegram versions (JSON schema); checks lengths (Telegram caption 1024, LinkedIn 3000); makes or fetches the image and files it in Drive; saves to the sheet; sends the preview with buttons |
| 6 | Publish Post | Sub-workflow | Loads the image, posts to each selected platform that hasn't been posted yet (LinkedIn image/article/text, Telegram photo or text), records links or errors, tells you what went out |
| 7 | Weekly Report | Monday 08:00 + manual | Last 7 days: posts and links, failures. Next 7 days: schedule and empty slots. AI suggests 3 topics, added as `suggested` |
| 8 | Check Connections | Manual | Checks the bot token (removes any old webhook), approver, that the Telegram credential is the same bot, channel admin rights, LinkedIn; saves the LinkedIn member ID to the data table; reports in Telegram |

## Reliability and safety

- Nothing posts without an `approved` status, set only by the approver's button (or by you in the sheet).
- Each platform is posted at most once per row: a platform with a URL already is skipped, so
  **Retry** after a partial failure only retries the failed platforms.
- Rows move to `publishing` before any post is made, so overlapping Clock runs can't double-post.
- Approval after the slot has passed posts on the next Clock run (within 5 minutes).
- Limits per Clock run: 3 drafts, 2 publishes.
- External calls retry (3 tries, 5 s apart); AI and image failures leave the row in `idea` with the
  error, and 3 failures move it to `needs_fix`.
- Text from linked pages is treated as data, not instructions.
- LinkedIn access tokens last 60 days; reconnect the credential when the check in workflow 1 fails.
- The Mac must be awake for schedules to run (see project 2/3 notes).

## Build changes (2026-10-07)

- Setup and the connection check are separate workflows (1 and 8): n8n allows one manual trigger
  per workflow, and the check is run again and again.
- `publish_at` is a plain-text column so typed dates stay `2026-10-12 09:00` (no date serials). The
  code also accepts serial numbers in case someone pastes a real date.
- All sheet writes use `cellFormat: RAW` with auto-mapped partial updates; tested that untouched
  columns keep their values. The Clock matches on `row_number` (to give new rows an ID), everything
  else on `post_id`.
- A Code node's `this.helpers.httpRequest` works for JSON and GET, but a Buffer body is sent as
  `{"type":"Buffer",...}` through the task runner, so binary uploads need an HTTP Request node.
- The LinkedIn node already escapes LinkedIn's "little text" characters, so post text is passed as is.
  It returns `{ urn }`; the post link is `https://www.linkedin.com/feed/update/<urn>/`.
- LinkedIn's member ID comes from `/v2/userinfo` (`sub`), saved by workflow 8 to the data table, so
  no ID is hard-coded in Publish Post.
- Weekly report: the suggestions branch is placed above the Telegram message on the canvas so it
  runs first; a failed Telegram send no longer loses the ideas.
- Sub-workflows must be published before their callers; Publish Post can't be published until the
  LinkedIn credential exists, and the handler can't be published until Publish Post is.
- 2026-10-08: Bluesky removed at the user's request. Gone: the Bluesky branch of Publish Post (login,
  image upload, post), the Bluesky check, the `bluesky` field in the writer schema, the Bluesky stats
  in the weekly report (LinkedIn and Telegram engagement need partner API access, so the report now
  lists what went out without likes), the `bluesky_text` / `bluesky_url` / `bluesky_uri` columns and the
  `bluesky_handle` setting. `default_platforms` is `linkedin, telegram`.
