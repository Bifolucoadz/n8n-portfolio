"""Fill __PLACEHOLDER__ lines in src/*.ts and write workflows/*.ts (python3 workflows/build.py [names]).

__SOME_NAME__      code/<NN>-some-name.js as an SDK string (NN = the src file's number prefix)
__PROMPT_<NAME>__  prompts/<name>.md (text after the first ---) as an SDK string
__HTML_<NAME>__    site/<name>.html as an SDK string
__SQL_<NAME>__     sql/<name>.sql as an SDK string
__JSON_<NAME>__    prompts/<name>.json as an SDK string (JSON schemas for structured output)
__SCHEMA_<TABLE>__ data table resource-mapper schema for every column of <TABLE> in tables.json
__MAP_<TABLE>__    `column: expr('{{ $json.column }}')` for every column of <TABLE>
A code file line `// @include lib-x.js` is replaced by code/lib-x.js; a line __PROMPT_X__ / __HTML_X__
inside a code file becomes a JS string literal of that file.
"""
import json, re, sys, pathlib
here = pathlib.Path(__file__).parent
root = here.parent


def to_sdk_string(text, indent="        "):
    lines = text.rstrip("\n").split("\n")
    out = []
    for i, line in enumerate(lines):
        s = line.replace("\\", "\\\\").replace("'", "\\'")
        out.append(f"{indent}'{s}\\n'" + (" +" if i < len(lines) - 1 else ""))
    return "\n".join(out)


def asset(kind, key):
    name = key.lower().replace("_", "-")
    if kind == "PROMPT":
        return (root / "prompts" / f"{name}.md").read_text().split("\n---\n", 1)[1].strip("\n")
    if kind == "JSON":
        return json.dumps(json.loads((root / "prompts" / f"{name}.json").read_text()))
    if kind == "HTML":
        return (root / "site" / f"{name}.html").read_text()
    if kind == "SQL":
        return (root / "sql" / f"{name}.sql").read_text()
    raise KeyError(kind)


def code_file(name):
    text = (here / "code" / name).read_text()
    while re.search(r"^// @include (\S+)$", text, flags=re.M):  # includes may include others
        text = re.sub(r"^// @include (\S+)$", lambda m: (here / "code" / m.group(1)).read_text().rstrip("\n"), text, flags=re.M)
    return re.sub(r"^__(PROMPT|HTML|SQL|JSON)_([A-Z0-9_]+)__$", lambda m: json.dumps(asset(m.group(1), m.group(2)), ensure_ascii=False), text, flags=re.M)


TABLES = json.loads((here / "tables.json").read_text()) if (here / "tables.json").exists() else {}


def table_schema(name, indent="          "):
    return ",\n".join(f"{indent}{{ id: '{c}', displayName: '{c}', required: false, defaultMatch: false, display: true, type: '{t}', readOnly: false, removed: false }}" for c, t in TABLES[name])


def table_map(name, indent="          "):
    return ",\n".join(f"{indent}{c}: expr('{{{{ $json.{c} }}}}')" for c, _ in TABLES[name])


def build(src):
    text = src.read_text()
    prefix = src.stem.split("-")[0]

    def sub(m):
        key = m.group(1)
        if key.startswith("SCHEMA_"):
            return table_schema(key[7:])
        if key.startswith("MAP_"):
            return table_map(key[4:])
        for kind in ("PROMPT", "HTML", "SQL", "JSON"):
            if key.startswith(kind + "_"):
                return to_sdk_string(asset(kind, key[len(kind) + 1:]))
        return to_sdk_string(code_file(f"{prefix}-{key.lower().replace('_', '-')}.js"))

    out = re.sub(r"^__([A-Z0-9_]+)__$", sub, text, flags=re.M)
    (here / src.name).write_text(out)
    print("built", src.name, len(out), "chars")


targets = sys.argv[1:]
for src in sorted((here / "src").glob("*.ts")):
    if not targets or any(t in src.name for t in targets):
        build(src)
