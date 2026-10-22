"""Tiny MCP client for testing the Brindle servers over Streamable HTTP.

  python3 workflows/test/mcp.py team list
  python3 workflows/test/mcp.py team call project_status '{"project": "Harbour & Co rebrand"}'
  python3 workflows/test/mcp.py finance call invoices '{}'

Tokens and the base URL come from workflows/config.json (BASE_URL defaults to http://localhost:5678).
"""
import json, sys, time, urllib.request, pathlib

cfg = json.loads((pathlib.Path(__file__).parent.parent / "config.json").read_text())
BASE = cfg.get("BASE_URL", "http://localhost:5678")
SERVERS = {"team": ("/mcp/brindle", cfg["TEAM_TOKEN"]), "finance": ("/mcp/brindle-finance", cfg["FINANCE_TOKEN"])}


def post(url, token, body, session=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream", "Authorization": "Bearer " + token}
    if session:
        headers["mcp-session-id"] = session
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        sid = r.headers.get("mcp-session-id") or session
        text = r.read().decode()
    msgs = [json.loads(l[5:].strip()) for l in text.splitlines() if l.startswith("data:")] or ([json.loads(text)] if text.strip().startswith("{") else [])
    return sid, msgs


def connect(server):
    path, token = SERVERS[server]
    url = BASE + path
    sid, _ = post(url, token, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "brindle-test", "version": "1"}}})
    post(url, token, {"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)
    return url, token, sid


def list_tools(server):
    url, token, sid = connect(server)
    _, msgs = post(url, token, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, sid)
    return msgs[0]["result"]["tools"]


def call(server, name, args):
    url, token, sid = connect(server)
    t = time.time()
    _, msgs = post(url, token, {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": name, "arguments": args}}, sid)
    res = msgs[-1].get("result", msgs[-1])
    text = "".join(c.get("text", "") for c in res.get("content", [])) if isinstance(res, dict) else str(res)
    return round(time.time() - t, 2), res.get("isError", False), text


if __name__ == "__main__":
    server, cmd = sys.argv[1], sys.argv[2]
    if cmd == "list":
        for t in list_tools(server):
            s = t["inputSchema"]
            print(t["name"], "| required:", s.get("required", []), "| optional:", [k for k in s.get("properties", {}) if k not in s.get("required", [])])
    else:
        secs, err, text = call(server, sys.argv[3], json.loads(sys.argv[4] if len(sys.argv) > 4 else "{}"))
        print(f"{secs}s error={err}")
        print(text[:3000])
