"""Fill in the estimator's site-visit form like a person would, and wait for the draft.

python3 workflows/test/site-visit.py            # all sample visits in samples/visits.json
python3 workflows/test/site-visit.py olivia     # the ones whose key contains these words
--shots DIR saves the filled form and the "draft ready" page.

Needs Mossgrove 1 published (/form/mossgrove-site-visit, behind the estimator login in config.json).
"""
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CFG = json.loads((HERE.parent / "config.json").read_text())
URL = "http://localhost:5678/form/mossgrove-site-visit"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

args = [a for a in sys.argv[1:] if not a.startswith("--")]
shots = None
if "--shots" in sys.argv:
    shots = pathlib.Path(sys.argv[sys.argv.index("--shots") + 1])
    args = [a for a in args if a != str(shots)]
    shots.mkdir(parents=True, exist_ok=True)
visits = json.loads((ROOT / "samples" / "visits.json").read_text())
if args:
    visits = [v for v in visits if any(a.lower() in v["key"] for a in args)]

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(user_agent=UA, viewport={"width": 900, "height": 1500}, device_scale_factor=2,
                              http_credentials={"username": CFG["ESTIMATOR_USER"], "password": CFG["ESTIMATOR_PASSWORD"]})
    page = ctx.new_page()
    for v in visits:
        page.goto(URL)
        page.fill("#field-0", v["client_name"])
        page.fill("#field-1", v["client_email"])
        page.fill("#field-2", v["client_phone"])
        page.fill("#field-3", v["site_address"])
        page.fill("#field-4", v["postcode"])
        page.select_option("#field-5", label=v["estimator"])
        page.fill("#field-6", v["notes"])
        if v["voice"]:
            page.set_input_files("#field-7", str(ROOT / "samples" / v["voice"]))
        if shots:
            page.screenshot(path=str(shots / f"form-{v['key']}.png"), full_page=True)
        t0 = time.time()
        page.click("button[type=submit]")
        page.wait_for_selector("h1:has-text('Draft Q-')", timeout=180000)
        print(f"{v['client_name']:16} draft ready in {time.time() - t0:.1f} s: {page.locator('h1').first.inner_text()}")
        if shots:
            page.screenshot(path=str(shots / f"draft-{v['key']}.png"), full_page=True)
    browser.close()
