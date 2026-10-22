"""Sheets API bodies for Social Autopilot 1: Setup. Prints them as TS constants (python3 bodies.py)."""
import json

SHEET_TITLE = "Social Autopilot: Content Calendar"
TZ = "Africa/Lagos"

CAL_COLS = ["post_id", "publish_at", "topic", "notes", "link", "image", "platforms", "status",
            "linkedin_text", "telegram_text", "image_link",
            "linkedin_url", "telegram_url", "error",
            "drafted_at", "approved_at", "posted_at", "feedback",
            "image_file_id", "preview_message_id", "reminded_at", "attempts", "updated_at"]
STATUSES = ["idea", "drafting", "in_review", "approved", "publishing", "posted", "test_posted",
            "partial", "failed", "rejected", "needs_fix", "suggested"]

FACTS = (
    "I build automations in n8n with OpenAI. Portfolio demos, built for fictional businesses "
    "(always describe them as demos, never as clients or real results): "
    "1) Lead Generation Engine: finds local businesses on Google Maps, scores each one with AI, writes a "
    "personal opening line, sends a three-email sequence and stops the moment someone replies. "
    "2) Copperline Auto Repair support bot: a website chat assistant for a car repair shop that answers "
    "questions from the shop's own documents, books appointments into Google Calendar and sends the owner "
    "a weekly report. "
    "3) Saltmarsh Kitchen Invoice Desk: an accounts-payable inbox for a restaurant that reads invoices from "
    "email, an upload form or a Drive folder, checks the maths, catches duplicates and changed bank details, "
    "files every document and asks the owner to approve big or unusual bills. "
    "4) Social Autopilot (this system): drafts posts from a content calendar, sends each draft to my phone "
    "for approval and publishes to LinkedIn and Telegram."
)

SETTINGS = [
    ["key", "value", "what it does"],
    ["brand_name", "Samuel Oladele", "Name the posts are written as"],
    ["what_you_do", "I build AI automations for small businesses: instant replies to new leads, follow-ups, "
     "appointment booking, AI support assistants and invoice processing.", "One or two sentences about your offer"],
    ["audience", "Owners and managers of small service businesses (clinics, repair shops, restaurants, agencies) "
     "who lose hours every week to repetitive admin.", "Who the posts are for"],
    ["voice", "Plain, practical and friendly. First person. Short sentences. Concrete examples over hype. "
     "Sounds like a builder explaining what they made, not a marketer.", "How the posts should sound"],
    ["facts", FACTS, "True things the AI may mention. It must not invent clients, numbers or results"],
    ["avoid", "Buzzwords (game-changer, unlock, leverage, revolutionise, delve, seamless), em dashes, "
     "fake urgency, made-up statistics, more than two emojis.", "Words and habits to stay away from"],
    ["call_to_action", "If you want something like this for your business, send me a message.",
     "Closing line idea. The AI adapts it per platform"],
    ["default_link", "", "Optional link added when a row has none (e.g. your portfolio page)"],
    ["hashtags", "#automation #AI #smallbusiness #n8n", "Pool of hashtags. LinkedIn uses up to 3, Telegram none"],
    ["image_style", "Clean modern flat illustration, warm colours, soft light, simple shapes, no text, no logos, no people's faces.",
     "Style for AI images"],
    ["default_image", "ai", "Used when a row's image cell is blank: ai or none"],
    ["default_platforms", "linkedin, telegram", "Used when a row's platforms cell is blank"],
    ["post_days", "Mon, Wed, Fri", "Days that get an automatic slot"],
    ["post_time", "09:00", "Time of the automatic slot (24 h)"],
    ["timezone", TZ, "Time zone for publish_at and post_time"],
    ["draft_hours_ahead", "48", "How many hours before publish_at the draft is written and sent for approval"],
    ["require_approval", "yes", "yes = every post waits for your Approve tap. no = drafts are approved automatically"],
    ["mode", "test", "test = send what would be posted to you in Telegram instead of posting. live = really post"],
    ["telegram_channel", "", "Your public channel, e.g. @samuel_automates (the bot must be an admin)"],
    ["linkedin_visibility", "PUBLIC", "PUBLIC or CONNECTIONS"],
]

SEEDS = [
    ["Why small businesses lose leads in the first five minutes, and how an instant automatic reply fixes it",
     "Most enquiries go to whoever answers first. An automation can reply within seconds, answer the basic questions and offer a booking time. Keep it practical.", "ai"],
    ["Demo walkthrough: a 24/7 chat assistant for a car repair shop",
     "Copperline Auto Repair demo: answers from the shop's own documents, books into Google Calendar, weekly report for the owner. What it handles and what it hands to a human.", "ai"],
    ["Demo walkthrough: an AI inbox that reads supplier invoices for a restaurant",
     "Saltmarsh Kitchen Invoice Desk demo: reads PDFs and phone photos, checks the maths, flags duplicates and changed bank details, asks the owner before paying anything unusual.", "ai"],
    ["Follow-ups are the most boring automation and often the most valuable",
     "Many sales are lost to no follow-up, not to a no. A simple sequence that stops when the person replies. Contrast manual vs automatic.", "none"],
    ["The first three things I automate for a new client",
     "1) instant reply to new enquiries, 2) appointment booking and reminders, 3) a weekly summary so the owner sees what happened. Why this order.", "ai"],
    ["Why my AI automations ask a human before they act",
     "Human-in-the-loop: approvals for big invoices, previews before posts go out. AI drafts, a person decides. Builds trust and catches mistakes.", "none"],
    ["Behind the scenes: this post was drafted by an automation I built",
     "Social Autopilot: topics go in a Google Sheet, AI drafts a version per platform, I approve from my phone, it posts at the scheduled time.", "ai"],
    ["How to find out which admin tasks are worth automating",
     "Simple exercise: for one week write down every repetitive task and how long it takes. Anything done daily and taking over 10 minutes is a candidate.", "none"],
]

col = {c: i for i, c in enumerate(CAL_COLS)}
seed_rows = []
for topic, notes, image in SEEDS:
    row = [""] * len(CAL_COLS)
    row[col["topic"]], row[col["notes"]], row[col["image"]], row[col["status"]] = topic, notes, image, "idea"
    seed_rows.append(row)

create = {"properties": {"title": SHEET_TITLE, "timeZone": TZ}, "sheets": [
    {"properties": {"sheetId": 0, "title": "Calendar", "gridProperties": {"frozenRowCount": 1, "frozenColumnCount": 3}}},
    {"properties": {"sheetId": 1, "title": "Settings", "gridProperties": {"frozenRowCount": 1}}}]}

values = {"valueInputOption": "RAW", "data": [
    {"range": "Calendar!A1", "values": [CAL_COLS] + seed_rows},
    {"range": "Settings!A1", "values": SETTINGS}]}


def rgb(r, g, b): return {"red": r, "green": g, "blue": b}


def header(sid):
    return {"repeatCell": {"range": {"sheetId": sid, "startRowIndex": 0, "endRowIndex": 1},
                           "cell": {"userEnteredFormat": {"textFormat": {"bold": True}, "backgroundColor": rgb(0.93, 0.95, 0.97)}},
                           "fields": "userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor"}}


def width(sid, a, b, px):
    return {"updateDimensionProperties": {"range": {"sheetId": sid, "dimension": "COLUMNS", "startIndex": a, "endIndex": b},
                                          "properties": {"pixelSize": px}, "fields": "pixelSize"}}


def cells(sid, a, b, fmt, fields):
    return {"repeatCell": {"range": {"sheetId": sid, "startRowIndex": 1, "startColumnIndex": a, "endColumnIndex": b},
                           "cell": {"userEnteredFormat": fmt}, "fields": fields}}


def status_rule(value, color):
    s = col["status"]
    return {"addConditionalFormatRule": {"index": 0, "rule": {
        "ranges": [{"sheetId": 0, "startRowIndex": 1, "startColumnIndex": s, "endColumnIndex": s + 1}],
        "booleanRule": {"condition": {"type": "TEXT_EQ", "values": [{"userEnteredValue": value}]},
                        "format": {"backgroundColor": rgb(*color)}}}}}


C = col
fmt = {"requests": [
    header(0), header(1),
    # publish_at stays text so "2026-10-12 09:00" is never turned into a date serial
    cells(0, C["publish_at"], C["publish_at"] + 1, {"numberFormat": {"type": "TEXT"}}, "userEnteredFormat.numberFormat"),
    cells(0, C["topic"], C["notes"] + 1, {"wrapStrategy": "WRAP", "verticalAlignment": "TOP"}, "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment"),
    cells(0, C["linkedin_text"], C["telegram_text"] + 1, {"wrapStrategy": "CLIP", "verticalAlignment": "TOP"}, "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment"),
    {"setDataValidation": {"range": {"sheetId": 0, "startRowIndex": 1, "startColumnIndex": C["status"], "endColumnIndex": C["status"] + 1},
                           "rule": {"condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": s} for s in STATUSES]},
                                    "strict": False, "showCustomUi": True}}},
    {"setDataValidation": {"range": {"sheetId": 0, "startRowIndex": 1, "startColumnIndex": C["image"], "endColumnIndex": C["image"] + 1},
                           "rule": {"condition": {"type": "ONE_OF_LIST", "values": [{"userEnteredValue": "ai"}, {"userEnteredValue": "none"}]},
                                    "strict": False, "showCustomUi": True,
                                    "inputMessage": "ai, none, or paste an image URL / Drive link"}}},
    width(0, C["post_id"], C["post_id"] + 1, 90), width(0, C["publish_at"], C["publish_at"] + 1, 130),
    width(0, C["topic"], C["topic"] + 1, 300), width(0, C["notes"], C["notes"] + 1, 340),
    width(0, C["link"], C["platforms"] + 1, 140), width(0, C["status"], C["status"] + 1, 110),
    width(0, C["linkedin_text"], C["telegram_text"] + 1, 320), width(0, C["error"], C["error"] + 1, 260),
    width(1, 0, 1, 170), width(1, 1, 2, 520), width(1, 2, 3, 420),
    cells(1, 1, 3, {"wrapStrategy": "WRAP", "verticalAlignment": "TOP"}, "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment"),
    status_rule("idea", (0.95, 0.95, 0.95)), status_rule("suggested", (0.93, 0.93, 0.98)),
    status_rule("drafting", (0.89, 0.93, 0.99)), status_rule("in_review", (1.0, 0.93, 0.76)),
    status_rule("approved", (0.80, 0.90, 0.99)), status_rule("publishing", (0.80, 0.90, 0.99)),
    status_rule("posted", (0.78, 0.91, 0.78)), status_rule("test_posted", (0.88, 0.95, 0.86)),
    status_rule("partial", (1.0, 0.86, 0.70)), status_rule("failed", (0.98, 0.80, 0.78)),
    status_rule("needs_fix", (0.98, 0.80, 0.78)), status_rule("rejected", (0.90, 0.90, 0.90)),
]}

if __name__ == "__main__":
    for name, obj in [("CREATE_SHEET_BODY", create), ("SHEET_VALUES_BODY", values), ("FORMAT_BODY", fmt)]:
        print(f"const {name} = {json.dumps(obj, ensure_ascii=False)};")
