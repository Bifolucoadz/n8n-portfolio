"""Turns a saved Claude conversation (samples/conversations/<key>.jsonl) into an HTML page for screenshots:
the question, every MCP tool call Claude made (server, tool, arguments), and the answer.

python3 workflows/test/render-chat.py overdue invoices ...   → site/chat-<key>.html
"""
import json, pathlib, sys, html

ROOT = pathlib.Path(__file__).resolve().parents[2]
CSS = """
*{box-sizing:border-box}body{margin:0;background:#f3f1ec;font:15px/1.6 Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1f1f1d;-webkit-font-smoothing:antialiased}
.app{display:grid;grid-template-columns:320px 1fr;min-height:100vh}
.side{background:#1d2433;color:#d9deea;padding:26px 22px}
.side h1{font-size:16px;color:#fff;margin:0 0 4px}.side .sub{font-size:12.5px;color:#9aa6bd;margin-bottom:22px}
.srv{background:#263049;border-radius:12px;padding:12px 14px;margin-bottom:12px}
.srv b{color:#fff;font-size:13px;display:flex;align-items:center;gap:8px}.srv b:before{content:"";width:8px;height:8px;border-radius:50%;background:#4ade80}
.srv .u{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#9aa6bd;margin:2px 0 8px}
.srv .t{display:flex;flex-wrap:wrap;gap:5px}.srv .t span{font-family:ui-monospace,Menlo,monospace;font-size:11px;background:#33405e;border-radius:6px;padding:2px 6px;color:#cfd6e6}
.srv .t span.used{background:#d97757;color:#fff}
.foot{font-size:11.5px;color:#7f8aa3;margin-top:18px;line-height:1.5}
.main{padding:30px 44px 40px;max-width:1060px}
.turn{margin-bottom:22px}
.q{display:flex;justify-content:flex-end;margin-bottom:16px}.q div{background:#e7e2d8;border-radius:16px 16px 4px 16px;padding:11px 16px;max-width:80%;font-weight:500}
.calls{display:flex;flex-direction:column;gap:6px;margin:0 0 14px}
.call{display:inline-flex;align-items:center;gap:10px;align-self:flex-start;background:#fff;border:1px solid #e3ded3;border-radius:10px;padding:7px 12px;font-size:13px;max-width:100%}
.call .s{font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:#d97757}.call .s.fin{color:#2f6f9f}
.call .n{font-family:ui-monospace,Menlo,monospace;font-weight:600}
.call .a{font-family:ui-monospace,Menlo,monospace;color:#6b6a65;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ans{background:#fff;border:1px solid #e6e1d6;border-radius:16px;padding:18px 22px}
.ans p{margin:0 0 10px}.ans p:last-child{margin-bottom:0}.ans ul,.ans ol{margin:4px 0 10px;padding-left:22px}.ans li{margin:3px 0}
.ans table{border-collapse:collapse;margin:8px 0 12px;font-size:13.5px;width:100%}.ans th,.ans td{border-bottom:1px solid #ece8df;padding:6px 8px;text-align:left}.ans th{font-size:12px;color:#6b6a65;font-weight:600}
.ans strong{font-weight:650}.ans h1,.ans h2,.ans h3{font-size:15px;margin:12px 0 6px}
"""


def render(key):
    events = [json.loads(l) for l in (ROOT / "samples" / "conversations" / f"{key}.jsonl").read_text().splitlines() if l.strip()]
    init = next(e for e in events if e.get("type") == "system")
    used = set()
    turns = []
    for t in sorted(set(e["turn"] for e in events)):
        evs = [e for e in events if e["turn"] == t]
        blocks = []
        for e in evs:
            if e.get("type") != "assistant":
                continue
            for c in e["message"].get("content", []):
                if c.get("type") == "tool_use":
                    _, server, tool = c["name"].split("__", 2)
                    used.add(c["name"])
                    blocks.append(("call", server, tool, c.get("input", {})))
                elif c.get("type") == "text" and c.get("text", "").strip():
                    blocks.append(("text", c["text"]))
        turns.append((evs[0]["prompt"], blocks))
    servers = {}
    for name in init.get("tools", []):
        if name.startswith("mcp__"):
            _, s, tool = name.split("__", 2)
            servers.setdefault(s, []).append((tool, name in used))
    side = "".join(f'<div class="srv"><b>{html.escape(s)}</b><div class="u">/mcp/{html.escape(s)} · bearer token</div><div class="t">' + "".join(f'<span class="{"used" if u else ""}">{html.escape(t)}</span>' for t, u in sorted(tools)) + "</div></div>" for s, tools in servers.items())
    body = ""
    for prompt, blocks in turns:
        body += f'<div class="turn"><div class="q"><div>{html.escape(prompt)}</div></div>'
        calls = [b for b in blocks if b[0] == "call"]
        texts = [b for b in blocks if b[0] == "text"]
        if calls:
            body += '<div class="calls">' + "".join(f'<div class="call"><span class="s{" fin" if "finance" in b[1] else ""}">{html.escape(b[1])}</span><span class="n">{html.escape(b[2])}</span><span class="a">{html.escape(json.dumps(b[3], ensure_ascii=False))}</span></div>' for b in calls) + "</div>"
        if texts:
            body += '<div class="ans md">' + html.escape(texts[-1][1]) + "</div>"
        body += "</div>"
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Claude + Brindle MCP</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script><style>{CSS}</style></head><body>
<div class="app"><aside class="side"><h1>Claude, connected to Brindle Studio</h1><div class="sub">Two MCP servers built in n8n · {init.get("model", "")}</div>{side}
<div class="foot">A real session: Claude Code in headless mode with only these two servers. Tools in orange were used in this conversation. Data: Brindle Studio's Google Sheet (an invented studio).</div></aside>
<main class="main">{body}</main></div>
<script>document.querySelectorAll('.md').forEach(function (el) {{ el.innerHTML = marked.parse(el.textContent); }});</script></body></html>"""
    out = ROOT / "site" / f"chat-{key}.html"
    out.write_text(page)
    print("wrote", out.name, len(turns), "turns,", sum(1 for _, b in turns for x in b if x[0] == "call"), "tool calls")


for k in sys.argv[1:]:
    render(k)
