"""Fill __PLACEHOLDER__ lines in src/*.ts and write workflows/*.ts (python3 workflows/build.py).

__EXTRACTION_PROMPT__  prompts/extraction.md (text after the first ---) as an SDK string
__EXTRACTION_SCHEMA__  prompts/extraction-schema.json as a JSON string (the OpenAI node parses it)
__SOME_NAME__          code/<NN>-some-name.js as an SDK string (NN = the src file's number)
"""
import json, re, pathlib
here = pathlib.Path(__file__).parent
prompts = here.parent / "prompts"

# Register columns, for the Sheets nodes' resource-mapper schemas (__DOC_SCHEMA__, __LINE_SCHEMA__).
COLUMNS = {
    "DOC_SCHEMA": ["doc_id", "received_at", "status", "flags", "supplier", "doc_type", "invoice_number", "invoice_date",
                   "due_date", "currency", "subtotal", "tax", "total", "category", "payment_status", "drive_link", "summary",
                   "source", "sender", "original_filename", "supplier_status", "decided_by", "decided_at", "duplicate_of",
                   "line_count", "confidence", "bank_last4", "file_hash"],
    "LINE_SCHEMA": ["doc_id", "line_no", "supplier", "invoice_number", "invoice_date", "description", "quantity",
                    "unit_price", "amount", "category", "line_check"],
}
NUMERIC = {"subtotal", "tax", "total", "line_count", "line_no", "quantity", "unit_price", "amount"}


def schema_lines(cols, indent="          "):
    return ",\n".join(
        f"{indent}{{ id: '{c}', displayName: '{c}', required: false, defaultMatch: false, display: true, "
        f"type: '{'number' if c in NUMERIC else 'string'}', canBeUsedToMatch: true }}" for c in cols)


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
        if key == "EXTRACTION_PROMPT":
            body = (prompts / "extraction.md").read_text().split("\n---\n", 1)[1]
            return to_sdk_string(body.strip("\n"))
        if key in COLUMNS:
            return schema_lines(COLUMNS[key])
        if key == "EXTRACTION_SCHEMA":
            schema = json.dumps(json.loads((prompts / "extraction-schema.json").read_text()), ensure_ascii=False, separators=(",", ":"))
            return "        '" + schema.replace("\\", "\\\\").replace("'", "\\'") + "'"
        return to_sdk_string((here / "code" / f"{prefix}-{key.lower().replace('_', '-')}.js").read_text())

    out = re.sub(r"^__([A-Z0-9_]+)__$", sub, text, flags=re.M)
    (here / src.name).write_text(out)
    print("built", src.name, len(out), "chars")


for src in sorted((here / "src").glob("*.ts")):
    build(src)
