"""Replay the four demo weeks: switch the demo competitor sites to week N, then run a check stamped with
that week's date (test mode only). Run Radar 6: Reset Demo first.

python3 workflows/test/run-weeks.py          # weeks 1-4
python3 workflows/test/run-weeks.py 3 4      # just these weeks (after the earlier ones)
"""
import json, pathlib, sys, time, urllib.request, datetime

CFG = json.loads((pathlib.Path(__file__).resolve().parent.parent / "config.json").read_text())
BASE = "http://localhost:5678/webhook"
weeks = [int(a) for a in sys.argv[1:]] or [1, 2, 3, 4]
today = datetime.date.today()


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read())


for w in weeks:
    get(f"{BASE}/demo-web/admin?key={CFG['DEMO_KEY']}&week={w}")
    as_of = (today - datetime.timedelta(days=(4 - w) * 7)).isoformat() + "T07:05:00"
    body = json.dumps({"key": CFG["DASHBOARD_KEY"], "as_of": as_of}).encode()
    t0 = time.time()
    req = urllib.request.Request(f"{BASE}/radar/run", data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=600) as r:
        res = json.loads(r.read())
    res = res[0] if isinstance(res, list) else res
    print(f"\n=== week {w} ({as_of[:10]}) in {time.time() - t0:.0f} s: {res.get('pages')} pages, {res.get('changes')} changes, {res.get('alerts')} alerts, {res.get('new_matches')} new matches, {res.get('ai_calls')} AI calls")
    for h in res.get("headlines", []):
        print("  ", h)
