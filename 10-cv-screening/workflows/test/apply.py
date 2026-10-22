"""Fill in the real application form for sample applicants, like a person would.

python3 workflows/test/apply.py                 # all nine samples
python3 workflows/test/apply.py amara sofia     # the ones whose file name contains these words
--shots DIR saves a screenshot of the filled form and of the thank-you page for each applicant.

Needs Northgate 1 published (the form lives at /form/northgate-apply). Screening runs in the
background; check the Northgate Candidates table or the dashboard a minute later.
"""
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
SAMPLES = HERE.parents[1] / "samples"
URL = "http://localhost:5678/form/northgate-apply"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
JOB_OPTION = {
    "NG-101": "Customer Success Manager · Leeds, hybrid (NG-101)",
    "NG-102": "Junior Data Analyst · Remote, UK (NG-102)",
    "NG-103": "Warehouse Team Leader, nights · Wakefield (NG-103)",
}

args = [a for a in sys.argv[1:] if not a.startswith("--")]
shots = None
if "--shots" in sys.argv:
    shots = pathlib.Path(sys.argv[sys.argv.index("--shots") + 1])
    args = [a for a in args if a != str(shots)]
    shots.mkdir(parents=True, exist_ok=True)

people = json.loads((SAMPLES / "applicants.json").read_text())
if args:
    people = [p for p in people if any(a.lower() in p["file"] for a in args)]

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(user_agent=UA, viewport={"width": 900, "height": 1400}, device_scale_factor=2)
    page = ctx.new_page()
    for a in people:
        page.goto(URL)
        page.select_option("#field-0", label=JOB_OPTION[a["job"]])
        page.fill("#field-1", a["name"])
        page.fill("#field-2", a["email"])
        page.fill("#field-3", a["phone"])
        page.fill("#field-4", a["linkedin"])
        page.set_input_files("#field-5", str(SAMPLES / "out" / a["file"]))
        page.select_option("#field-6", label=a["right_to_work"])
        page.select_option("#field-7", label=a["notice"])
        page.fill("#field-8", a["salary"])
        page.check("#option0_field-9")
        if shots:
            page.screenshot(path=str(shots / ("form-" + a["file"].replace(".pdf", ".png"))), full_page=True)
        t0 = time.time()
        page.click("button[type=submit]")
        page.wait_for_selector("text=Your application is in", timeout=60000)
        print(f"{a['name']:18} {a['job']}  sent in {time.time() - t0:.1f} s")
        if shots:
            page.screenshot(path=str(shots / ("thanks-" + a["file"].replace(".pdf", ".png"))), full_page=True)
    browser.close()
