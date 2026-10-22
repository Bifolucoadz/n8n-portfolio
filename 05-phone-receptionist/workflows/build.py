"""Fill __PLACEHOLDER__ lines in src/*.ts and write workflows/*.ts (python3 workflows/build.py [names]).

__SOME_NAME__        code/<NN>-some-name.js as an SDK string (NN = the src file's number, e.g. 00a)
__PROMPT_<NAME>__    prompts/<name>.md (text after the first ---) as an SDK string
A code file line `// @include lib-x.js` is replaced by code/lib-x.js.
"""
import json, re, sys, pathlib
here = pathlib.Path(__file__).parent
prompts = here.parent / "prompts"


def to_sdk_string(text, indent="        "):
    lines = text.rstrip("\n").split("\n")
    out = []
    for i, line in enumerate(lines):
        s = line.replace("\\", "\\\\").replace("'", "\\'")
        out.append(f"{indent}'{s}\\n'" + (" +" if i < len(lines) - 1 else ""))
    return "\n".join(out)


def prompt_text(key):
    return (prompts / f"{key.lower().replace('_', '-')}.md").read_text().split("\n---\n", 1)[1].strip("\n")


def code_file(name):
    text = (here / "code" / name).read_text()
    text = re.sub(r"^// @include (\S+)$", lambda m: (here / "code" / m.group(1)).read_text().rstrip("\n"), text, flags=re.M)
    # A __PROMPT_X__ line inside a code file becomes a JS string literal of the prompt.
    return re.sub(r"^__PROMPT_([A-Z0-9_]+)__$", lambda m: json.dumps(prompt_text(m.group(1)), ensure_ascii=False), text, flags=re.M)


def build(src):
    text = src.read_text()
    prefix = src.stem.split("-")[0]

    def sub(m):
        key = m.group(1)
        if key.startswith("PROMPT_"):
            return to_sdk_string(prompt_text(key[7:]))
        return to_sdk_string(code_file(f"{prefix}-{key.lower().replace('_', '-')}.js"))

    out = re.sub(r"^__([A-Z0-9_]+)__$", sub, text, flags=re.M)
    (here / src.name).write_text(out)
    print("built", src.name, len(out), "chars")


targets = sys.argv[1:]
for src in sorted((here / "src").glob("*.ts")):
    if not targets or any(t in src.name for t in targets):
        build(src)
