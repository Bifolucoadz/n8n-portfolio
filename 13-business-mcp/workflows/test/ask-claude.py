"""Ask real Claude (Claude Code, headless) questions through the Brindle MCP servers and save the
conversations (stream-json) for checking and screenshots.

python3 workflows/test/ask-claude.py            # every question below
python3 workflows/test/ask-claude.py overdue    # the ones whose key contains these words

Claude gets only the two Brindle servers (no built-in tools). Saved to samples/conversations/<key>.jsonl.
"""
import json, os, pathlib, subprocess, sys, tempfile, time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CFG = json.loads((HERE.parent / "config.json").read_text())
OUT = ROOT / "samples" / "conversations"
OUT.mkdir(parents=True, exist_ok=True)
SYSTEM = ("You are the assistant for Brindle Studio, a 14-person design and web studio in Manchester. Answer staff questions "
          "using the Brindle tools; never guess numbers. Be brief and practical, in British English. The person you are talking "
          "to is Dan Fletcher, Project Manager, unless they say otherwise. Before logging time or changing data, make sure the "
          "details are clear; for invoices always preview first and only confirm when the user agrees.")
QUESTIONS = [
    ("overdue", "What's overdue for Brightwater Dental?"),
    ("rebrand", "How's the Harbour & Co rebrand looking? Anything I should worry about before the deadline?"),
    ("capacity", "Leo's swamped. Who has room this week to take the Rowan Gin bottle neck tag off him?"),
    ("logtime", "Log 2.5 hours for Amira on the Ashgrove annual report today: first draft of the impact infographics."),
    ("onhold", "Log 3 hours for Ben on the Pennant Law website for yesterday."),
    ("invoices", "Which invoices are overdue, and how much are we owed in total?"),
    ("margin", "Is the Harbour & Co rebrand still making us money?"),
    ("draft", "Draft Northwind's invoice for September.", "Looks right, create it."),
]
mcp = {"mcpServers": {
    "brindle": {"type": "http", "url": "http://localhost:5678/mcp/brindle", "headers": {"Authorization": "Bearer " + CFG["TEAM_TOKEN"]}},
    "brindle-finance": {"type": "http", "url": "http://localhost:5678/mcp/brindle-finance", "headers": {"Authorization": "Bearer " + CFG["FINANCE_TOKEN"]}},
}}
want = sys.argv[1:]
with tempfile.TemporaryDirectory() as work:
    cfg_path = pathlib.Path(work) / "mcp.json"
    cfg_path.write_text(json.dumps(mcp))
    for q in QUESTIONS:
        key, turns = q[0], q[1:]
        if want and not any(w in key for w in want):
            continue
        lines, session = [], None
        t0 = time.time()
        for i, prompt in enumerate(turns):
            cmd = ["claude", "-p", prompt, "--mcp-config", str(cfg_path), "--strict-mcp-config", "--tools", "",
                   "--allowedTools", "mcp__brindle", "mcp__brindle-finance", "--append-system-prompt", SYSTEM,
                   "--output-format", "stream-json", "--verbose"]
            if session:
                cmd += ["--resume", session]
            res = subprocess.run(cmd, cwd=work, capture_output=True, text=True, timeout=600)
            for line in res.stdout.splitlines():
                if not line.strip().startswith("{"):
                    continue
                ev = json.loads(line)
                if ev.get("type") == "system" and ev.get("session_id"):
                    session = ev["session_id"]
                lines.append({"turn": i, "prompt": prompt, **ev})
        (OUT / f"{key}.jsonl").write_text("\n".join(json.dumps(l) for l in lines) + "\n")
        tools = [c.get("name") for l in lines if l.get("type") == "assistant" for c in l["message"].get("content", []) if c.get("type") == "tool_use"]
        final = [l.get("result", "") for l in lines if l.get("type") == "result"]
        print(f"\n### {key} ({time.time() - t0:.0f} s) tools: {tools}\n{final[-1] if final else res.stderr[-500:]}")
