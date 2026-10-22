"""Fill __PLACEHOLDER__ lines in src/*.ts and write workflows/*.ts (python3 workflows/build.py).

__SETUP_SQL__     supabase/setup.sql as an SDK string
__PROMPT_NAME__   prompts/name.md (text after the first ---) as an SDK string
__SCHEMA_NAME__   prompts/name.schema.json as a JSON string (the OpenAI node parses it)
__SOME_NAME__     code/<NN>-some-name.js as an SDK string (NN = the src file's number)
"""
import json, re, pathlib, sys

here = pathlib.Path(__file__).parent
root = here.parent


def to_sdk_string(text, indent="        "):
    lines = text.rstrip("\n").split("\n")
    out = []
    for i, line in enumerate(lines):
        s = line.replace("\\", "\\\\").replace("'", "\\'")
        out.append(f"{indent}'{s}\\n'" + (" +" if i < len(lines) - 1 else ""))
    return "\n".join(out)


def slug(key):
    return key.lower().replace("_", "-")


def build(src):
    text = src.read_text()
    prefix = src.stem.split("-")[0]

    def sub(m):
        key = m.group(1)
        if key == "SETUP_SQL":
            return to_sdk_string((root / "supabase" / "setup.sql").read_text())
        if key.startswith("PROMPT_"):
            body = (root / "prompts" / f"{slug(key[7:])}.md").read_text()
            if "\n---\n" in body:
                body = body.split("\n---\n", 1)[1]
            return to_sdk_string(body.strip("\n"))
        if key.startswith("SCHEMA_"):
            schema = json.loads((root / "prompts" / f"{slug(key[7:])}.schema.json").read_text())
            s = json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
            return "        '" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"
        return to_sdk_string((here / "code" / f"{prefix}-{slug(key)}.js").read_text())

    out = re.sub(r"^__([A-Z0-9_]+)__$", sub, text, flags=re.M)
    (here / src.name).write_text(out)
    print("built", src.name, len(out), "chars")


only = sys.argv[1:]
for src in sorted((here / "src").glob("*.ts")):
    if not only or any(src.stem.startswith(o) for o in only):
        build(src)
