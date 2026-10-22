"""Fill __PLACEHOLDER__ lines in src/*.ts and write workflows/*.ts (python3 workflows/build.py).

__SETUP_BODIES__     the Sheets API bodies from setup/bodies.py as TS constants
__CAL_SCHEMA__       Calendar columns as a Sheets resource-mapper schema
__PROMPT_<NAME>__    prompts/<name>.md (text after the first ---) as an SDK string
__SCHEMA_<NAME>__    prompts/<name>-schema.json as a JSON string (the OpenAI node parses it)
__SOME_NAME__        code/<NN>-some-name.js as an SDK string (NN = the src file's number)
"""
import json, re, sys, pathlib
here = pathlib.Path(__file__).parent
prompts = here.parent / "prompts"
sys.path.insert(0, str(here / "setup"))
import bodies  # noqa: E402


def schema_lines(cols, indent="          "):
    return ",\n".join(
        f"{indent}{{ id: '{c}', displayName: '{c}', required: false, defaultMatch: false, display: true, "
        f"type: 'string', canBeUsedToMatch: true }}" for c in cols)


def to_sdk_string(text, indent="        "):
    lines = text.rstrip("\n").split("\n")
    out = []
    for i, line in enumerate(lines):
        s = line.replace("\\", "\\\\").replace("'", "\\'")
        out.append(f"{indent}'{s}\\n'" + (" +" if i < len(lines) - 1 else ""))
    return "\n".join(out)


def build(src):
    text = src.read_text()
    prefix = src.stem.split("-")[0]

    def sub(m):
        key = m.group(1)
        if key == "SETUP_BODIES":
            return "\n".join(f"const {n} = {json.dumps(o, ensure_ascii=False)};" for n, o in
                             [("CREATE_SHEET_BODY", bodies.create), ("SHEET_VALUES_BODY", bodies.values), ("FORMAT_BODY", bodies.fmt)])
        if key == "CAL_SCHEMA":
            return schema_lines(bodies.CAL_COLS)
        if key.startswith("PROMPT_"):
            body = (prompts / f"{key[7:].lower()}.md").read_text().split("\n---\n", 1)[1]
            return to_sdk_string(body.strip("\n"))
        if key.startswith("SCHEMA_"):
            schema = json.dumps(json.loads((prompts / f"{key[7:].lower()}-schema.json").read_text()),
                                ensure_ascii=False, separators=(",", ":"))
            return "        '" + schema.replace("\\", "\\\\").replace("'", "\\'") + "'"
        return to_sdk_string((here / "code" / f"{prefix}-{key.lower().replace('_', '-')}.js").read_text())

    out = re.sub(r"^__([A-Z0-9_]+)__$", sub, text, flags=re.M)
    (here / src.name).write_text(out)
    print("built", src.name, len(out), "chars")


targets = sys.argv[1:]
for src in sorted((here / "src").glob("*.ts")):
    if not targets or any(t in src.name for t in targets):
        build(src)
