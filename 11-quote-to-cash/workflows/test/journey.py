"""The whole journey in a browser, like the owner and a client would do it, with screenshots.

python3 workflows/test/journey.py SHOTS_DIR [QUOTE_ID]   (default Q-1010, Olivia Grant from site-visit.py)

1. Owner: prices the custom item, saves and sends (dashboard).   2. Client: opens the quote, adds an extra,
signs.   3. Client: pays the deposit (test checkout) and is booked in.   4. Owner: marks the job done (final
invoice).   5. Client: pays the balance.   6. Downloads the quote, invoice and receipt PDFs.
"""
import json, pathlib, sys, time, urllib.request
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
CFG = json.loads((HERE.parent / "config.json").read_text())
BASE = "http://localhost:5678/webhook/mossgrove"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
SHOTS = pathlib.Path(sys.argv[1]); SHOTS.mkdir(parents=True, exist_ok=True)
QID = sys.argv[2] if len(sys.argv) > 2 else "Q-1010"
DASH = f"{BASE}/dashboard?key={CFG['DASHBOARD_KEY']}&q={QID}"


def step(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


with sync_playwright() as p:
    b = p.chromium.launch()
    owner = b.new_context(user_agent=UA, viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    client = b.new_context(user_agent=UA, viewport={"width": 1280, "height": 900}, device_scale_factor=2)
    o = owner.new_page(); c = client.new_page()
    o.on("dialog", lambda d: d.accept())

    # 1. Owner prices the custom item and sends
    o.goto(DASH); o.wait_for_timeout(1500)
    q = o.evaluate(f"D.quotes.find(x => x.quote_id === '{QID}')")
    token = q["token"]
    step(f"{QID} {q['client_name']}: {q['status']}, total {q['total']}, custom {[x['description'] for x in q['custom']]}")
    o.screenshot(path=str(SHOTS / "owner-1-draft.png"))
    o.click("#bEdit"); o.wait_for_timeout(300)
    for i, _ in enumerate(q["custom"]):
        o.fill(f"[data-c='{i}']", "280"); o.dispatch_event(f"[data-c='{i}']", "change"); o.wait_for_timeout(200)
    o.screenshot(path=str(SHOTS / "owner-2-editing.png"))
    o.click("#bSaveSend")
    o.wait_for_selector(".toast:has-text('Sent to')", timeout=90000); step("sent")
    o.wait_for_timeout(800); o.screenshot(path=str(SHOTS / "owner-3-sent.png"))

    # 2. Client opens, adds the extra, signs
    c.goto(f"{BASE}/quote?t={token}"); c.wait_for_timeout(1500)
    c.screenshot(path=str(SHOTS / "client-1-quote.png"), full_page=True)
    if c.locator(".extra input").count():
        c.locator(".extra").first.click(); c.wait_for_timeout(300)
    c.screenshot(path=str(SHOTS / "client-2-extra.png"))
    c.click("#accept"); c.fill("#sigName", q["client_name"]); c.check("#sigAgree")
    c.screenshot(path=str(SHOTS / "client-3-sign.png"))
    c.click("#acceptGo")
    c.wait_for_url("**done=accepted**", timeout=90000); c.wait_for_timeout(1200); step("accepted")
    c.screenshot(path=str(SHOTS / "client-4-accepted.png"))

    # 3. Deposit
    c.click(".banner a.btn.primary"); c.wait_for_selector("#go"); c.wait_for_timeout(800)
    c.screenshot(path=str(SHOTS / "client-5-checkout.png"))
    c.click("#go"); c.wait_for_url("**paid=deposit**", timeout=90000); c.wait_for_timeout(1200); step("deposit paid")
    c.screenshot(path=str(SHOTS / "client-6-booked.png"), full_page=True)

    # 4. Owner: job done
    o.goto(DASH); o.wait_for_timeout(1500)
    o.screenshot(path=str(SHOTS / "owner-4-booked.png"))
    o.click("#bComplete"); o.wait_for_selector(".toast:has-text('Invoice')", timeout=90000); step("invoice sent")
    o.wait_for_timeout(800); o.screenshot(path=str(SHOTS / "owner-5-invoiced.png"))

    # 5. Client pays the balance
    c.goto(f"{BASE}/quote?t={token}"); c.wait_for_timeout(1200)
    c.screenshot(path=str(SHOTS / "client-7-invoice.png"))
    c.click(".banner a.btn.primary"); c.wait_for_selector("#go"); c.wait_for_timeout(500)
    c.click("#go"); c.wait_for_url("**paid=balance**", timeout=90000); c.wait_for_timeout(1200); step("balance paid")
    c.screenshot(path=str(SHOTS / "client-8-paid.png"))

    o.goto(DASH); o.wait_for_timeout(1500)
    o.screenshot(path=str(SHOTS / "owner-6-paid.png"))
    b.close()

# 6. PDFs
for doc in ["quote", "invoice", "receipt"]:
    with urllib.request.urlopen(f"{BASE}/pdf?t={token}&doc={doc}", timeout=60) as r:
        (SHOTS / f"{QID}-{doc}.pdf").write_bytes(r.read())
    step(f"saved {doc} PDF")
