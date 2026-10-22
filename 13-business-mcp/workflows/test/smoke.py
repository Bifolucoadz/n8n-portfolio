"""Calls every tool once through the real MCP servers (and the refusals). python3 workflows/test/smoke.py [names]"""
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from mcp import call

CASES = [
    ("team", "search", {"query": "harbour"}),
    ("team", "client_overview", {"client": "Brightwater Dental"}),
    ("team", "project_status", {"project": "Harbour & Co rebrand"}),
    ("team", "list_tasks", {"status": "overdue"}),
    ("team", "my_week", {"person": "Leo Martins"}),
    ("team", "team_capacity", {}),
    ("team", "log_time", {"person": "Ben Okafor", "project": "Pennant Law website", "hours": 2}),
    ("team", "log_time", {"person": "Sofia Russo", "project": "PR-106", "hours": 30}),
    ("finance", "invoices", {}),
    ("finance", "client_finances", {"client": "Northwind"}),
    ("finance", "profitability", {"project": "Harbour & Co rebrand"}),
    ("finance", "draft_invoice", {"client": "Northwind Cycles"}),
]
want = sys.argv[1:]
for server, tool, args in CASES:
    if want and not any(w in tool for w in want):
        continue
    secs, err, text = call(server, tool, args)
    print(f"--- {server}/{tool} {json.dumps(args)}  {secs}s error={err}\n{text[:500]}\n")
