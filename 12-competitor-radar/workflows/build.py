"""Fill __PLACEHOLDER__ lines in src/*.ts and write workflows/*.ts (python3 workflows/build.py [names]).

__SOME_NAME__      code/<NN>-some-name.js as an SDK string (NN = the src file's number prefix)
__PROMPT_<NAME>__  prompts/<name>.md (text after the first ---) as an SDK string
__HTML_<NAME>__    site/<name>.html as an SDK string
__JSON_<NAME>__    prompts/<name>.json as an SDK string (JSON schemas for structured output)
__SCHEMA_<TAB>__   Google Sheets resource-mapper schema for every column of <TAB> in tables.json
                   (tab names in upper case with _ for spaces: __SCHEMA_PRICE_BOOK__)
@@KEY@@            anywhere in a line: the value of KEY in config.json (spreadsheet ID, credential IDs)
A code file line `// @include lib-x.js` is replaced by code/lib-x.js; a line __PROMPT_X__ / __HTML_X__ /
__JSON_X__ inside a code file becomes a JS literal of that file; __TABLES__ anywhere becomes tables.json.
"""
import json, re, sys, pathlib
here = pathlib.Path(__file__).parent
root = here.parent
CONFIG = json.loads((here / "config.json").read_text()) if (here / "config.json").exists() else {}
TABLES = json.loads((here / "tables.json").read_text())


def to_sdk_string(text, indent="        "):
    # Long code is split into parenthesised groups of 100 lines: one long chain of + is too deep for the SDK parser.
    lines = [f"'{line}\\n'" for line in (l.replace("\\", "\\\\").replace("'", "\\'") for l in text.rstrip("\n").split("\n"))]
    if len(lines) <= 120:
        return "\n".join(f"{indent}{s}" + (" +" if i < len(lines) - 1 else "") for i, s in enumerate(lines))
    groups = [lines[i:i + 100] for i in range(0, len(lines), 100)]
    return f" +\n".join(f"{indent}(\n" + " +\n".join(f"{indent}  {s}" for s in g) + f"\n{indent})" for g in groups)


def asset(kind, key):
    name = key.lower().replace("_", "-")
    if kind == "PROMPT":
        return (root / "prompts" / f"{name}.md").read_text().split("\n---\n", 1)[1].strip("\n")
    if kind == "JSON":
        return json.dumps(json.loads((root / "prompts" / f"{name}.json").read_text()))
    if kind == "HTML":
        return (root / "site" / f"{name}.html").read_text()
    raise KeyError(kind)


def config_values(text):
    def sub(m):
        if m.group(1) not in CONFIG:
            raise KeyError("config.json has no " + m.group(1))
        return str(CONFIG[m.group(1)])
    return re.sub(r"@@([A-Z0-9_]+)@@", sub, text)


def code_file(name):
    text = (here / "code" / name).read_text()
    text = re.sub(r"^// @include (\S+)$", lambda m: (here / "code" / m.group(1)).read_text().rstrip("\n"), text, flags=re.M)
    text = text.replace("__TABLES__", json.dumps(TABLES))
    return re.sub(r"^__(PROMPT|HTML|JSON)_([A-Z0-9_]+)__$", lambda m: json.dumps(asset(m.group(1), m.group(2)), ensure_ascii=False), text, flags=re.M)


def tab_name(key):
    for name in TABLES:
        if name.upper().replace(" ", "_") == key:
            return name
    raise KeyError("tables.json has no tab for " + key)


def sheet_schema(key, indent="          "):
    return ",\n".join(f"{indent}{{ id: '{c}', displayName: '{c}', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }}" for c in TABLES[tab_name(key)])


def build(src):
    text = src.read_text()
    prefix = src.stem.split("-")[0]

    def sub(m):
        key = m.group(1)
        if key.startswith("SCHEMA_"):
            return sheet_schema(key[7:])
        for kind in ("PROMPT", "HTML", "JSON"):
            if key.startswith(kind + "_"):
                return to_sdk_string(asset(kind, key[len(kind) + 1:]))
        return to_sdk_string(code_file(f"{prefix}-{key.lower().replace('_', '-')}.js"))

    out = config_values(re.sub(r"^__([A-Z0-9_]+)__$", sub, text, flags=re.M))
    (here / src.name).write_text(out)
    print("built", src.name, len(out), "chars")


targets = sys.argv[1:]
for src in sorted((here / "src").glob("*.ts")):
    if not targets or any(t in src.name for t in targets):
        build(src)
