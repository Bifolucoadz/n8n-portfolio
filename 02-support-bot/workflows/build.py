"""Fill __PLACEHOLDER__ markers in src/*.ts with code/*.js converted to SDK string form."""
import re, sys, pathlib
here = pathlib.Path(__file__).parent
def js_to_sdk(path, indent="        "):
    lines = path.read_text().rstrip("\n").split("\n")
    out = []
    for i, line in enumerate(lines):
        s = line.replace("\\", "\\\\").replace("'", "\\'")
        out.append(f"{indent}'{s}\\n'" + (" +" if i < len(lines) - 1 else ""))
    return "\n".join(out)
for src in sorted((here / "src").glob("*.ts")):
    text = src.read_text()
    prefix = src.stem.split("-")[0]
    def sub(m):
        if m.group(1) == "SYSTEM_PROMPT":
            body = (here.parent / "prompts" / "system-prompt.md").read_text().split("\n---\n", 1)[1].strip("\n")
            tmp = here / "code" / ".system-prompt.txt"
            tmp.write_text(body + "\n")
            converted = js_to_sdk(tmp)
            tmp.unlink()
            return converted
        name = m.group(1).lower().replace("_", "-")
        return js_to_sdk(here / "code" / f"{prefix}-{name}.js")
    out = re.sub(r"^__([A-Z_]+)__$", sub, text, flags=re.M)
    (here / src.name).write_text(out)
    print("built", src.name, len(out), "chars")
