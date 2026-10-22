"""Upload the sample call recordings through the real form, like a rep would.

python3 workflows/test/upload.py                  # all three
python3 workflows/test/upload.py calloway         # the ones whose file name contains these words
--shots DIR saves a screenshot of the result page for each call.

Needs Tidewater 1 published (the form lives at /form/tidewater-call). The page waits while the call is
processed (about a minute) and prints the review link.
"""
import pathlib, re, sys, time
from playwright.sync_api import sync_playwright

SAMPLES = pathlib.Path(__file__).resolve().parents[2] / "samples"
URL = "http://localhost:5678/form/tidewater-call"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
CALLS = [
    ("calloway-discovery.wav", "Calloway Dental Group: patient reminders (D-1001)"),
    ("pemberton-demo-followup.wav", "Pemberton Freight: customer tracking portal (D-1002)"),
    ("ostara-negotiation.wav", "Ostara Home Care: caregiver scheduling app (D-1003)"),
]
args = [a for a in sys.argv[1:] if not a.startswith("--")]
shots = None
if "--shots" in sys.argv:
    shots = pathlib.Path(sys.argv[sys.argv.index("--shots") + 1])
    args = [a for a in args if a != str(shots)]
    shots.mkdir(parents=True, exist_ok=True)
calls = [c for c in CALLS if not args or any(a in c[0] for a in args)]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(user_agent=UA, viewport={"width": 900, "height": 1300}, device_scale_factor=2)
    for file, deal in calls:
        page.goto(URL)
        page.select_option("#field-0", label=deal)
        page.select_option("#field-1", label="Maya Collins")
        page.set_input_files("#field-2", str(SAMPLES / file))
        t0 = time.time()
        page.click("button[type=submit]")
        page.wait_for_selector("text=Review and send the follow-up", timeout=300000)
        link = page.get_attribute("a:has-text('Review and send the follow-up')", "href")
        print(f"{file:30} processed in {time.time() - t0:.0f} s  {link}")
        if shots:
            page.screenshot(path=str(shots / ("result-" + file.replace(".wav", ".png"))), full_page=True)
    browser.close()
