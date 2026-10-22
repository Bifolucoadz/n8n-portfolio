"""Render the demo knowledge base into knowledge/out/ (python3 knowledge/build.py).

- Prescribing Information (PI) Markdown -> label-style PDFs with a text layer (Playwright).
- Quenvara PI v4.0 (superseded) is derived from v5.0 by the replacements in QUENVARA_V4.
- The Dear HCP letter -> an image-only "scanned" PDF (no text layer), to exercise OCR.
- SOPs and standard response letters -> Markdown files uploaded as Google Docs.
- The product catalog -> CSV uploaded as a Google Sheet.
- manifest.json lists every file, its Drive folder and how to upload it.

Everything here is fictional: company, medicines, studies, NDC numbers, people and phone numbers.
"""
import io, json, pathlib, random, re, shutil
import markdown
from PIL import Image, ImageFilter, ImageEnhance
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
SRC, OUT = HERE / "src", HERE / "out"
random.seed(11)

HEADER_KEYS = ["Document No.", "Title", "Product", "Document type", "Version", "Effective date",
               "Classification", "Owner"]

# Quenvara PI v4.0: what v5.0 changed, undone. Each pair must match exactly once.
QUENVARA_V4 = [
    ("Version: 5.0", "Version: 4.0"),
    ("Effective date: 2026-03-01", "Effective date: 2024-06-01"),
    ("| 15 to 29 mL/min | 2.5 mg twice daily | Not recommended | 2.5 mg twice daily |",
     "| 15 to 29 mL/min | Not recommended | Not recommended | Not recommended |"),
    ("Monitor renal function at least every 6 months in patients with CrCl 15 to 49 mL/min, and more often in situations where renal function may decline.",
     "Monitor renal function at least once a year in patients with CrCl 30 to 49 mL/min."),
    ("\nThe 2.5 mg twice daily dose for patients with nonvalvular atrial fibrillation and CrCl 15 to 29 mL/min was added in version 5.0 based on the RENEW-Q study (14.4).\n", ""),
    ("| Low | 30 mL/min or more | 24 hours before |\n| Low | 15 to 29 mL/min | 36 hours before |\n| Moderate or high | 30 mL/min or more | 48 hours before |\n| Moderate or high | 15 to 29 mL/min | 72 hours before |",
     "| Low | 30 mL/min or more | 24 hours before |\n| Moderate or high | 30 mL/min or more | 48 hours before |"),
    ("such as ketoconazole, itraconazole, ritonavir or clarithromycin.", "such as ketoconazole, itraconazole or ritonavir."),
    ("\n### 14.4 RENEW-Q\n\nRENEW-Q randomized 612 patients with nonvalvular atrial fibrillation and CrCl 15 to 29 mL/min to Quenvara 2.5 mg twice daily or warfarin. Stroke or systemic embolism occurred at 2.3 versus 2.6 per 100 patient-years, and major bleeding at 3.9 versus 6.8 per 100 patient-years.\n", ""),
    ("| 5.0 | 2026-03-01 | 2.3: 2.5 mg twice daily for nonvalvular atrial fibrillation with CrCl 15 to 29 mL/min (RENEW-Q, 14.4); renal monitoring every 6 months. 2.6: interruption times for CrCl 15 to 29 mL/min. 7.1: clarithromycin added. |\n", ""),
    ("| 4.0 | 2024-06-01 | 2.2: dose criteria updated. 5.5 added. |",
     "| 4.0 | 2024-06-01 | 2.2: dose criteria updated. 5.5 added. |\n| 3.1 | 2023-01-20 | 8.7 hepatic impairment wording updated. |"),
]

PDF_CSS = """
@page { size: Letter; margin: 0.7in 0.75in 0.8in }
* { box-sizing: border-box }
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10.5px; line-height: 1.45; color: #111 }
.docmeta { border: 1.5px solid #1f3b57; padding: 8px 12px; margin-bottom: 12px; font-size: 10px; columns: 2; column-gap: 24px }
.docmeta div { break-inside: avoid; margin: 1px 0 }
.docmeta b { color: #1f3b57 }
.brand { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #1f3b57; padding-bottom: 6px; margin-bottom: 10px }
.brand .co { font-weight: 700; font-size: 15px; color: #1f3b57; letter-spacing: .5px }
.brand .tag { font-size: 9px; color: #555 }
blockquote { margin: 0 0 12px; padding: 6px 10px; background: #fff4e5; border-left: 4px solid #e08a00; font-size: 9.5px }
blockquote p { margin: 0 }
h1 { font-size: 17px; margin: 6px 0 10px; color: #1f3b57 }
h2 { font-size: 12.5px; margin: 14px 0 6px; padding: 3px 6px; background: #e8eef4; color: #1f3b57; break-after: avoid }
h3 { font-size: 11px; margin: 10px 0 4px; break-after: avoid }
p { margin: 0 0 6px }
ul { margin: 0 0 6px 18px; padding: 0 }
li { margin: 1px 0 }
table { border-collapse: collapse; width: 100%; margin: 4px 0 10px; font-size: 9.8px; break-inside: avoid }
th, td { border: 1px solid #9aa9b8; padding: 3px 6px; text-align: left; vertical-align: top }
th { background: #dfe7ef }
"""

LETTER_CSS = """
* { box-sizing: border-box }
body { margin: 0; background: #fff }
.page { width: 1275px; padding: 110px 120px; font-family: Georgia, 'Times New Roman', serif; font-size: 25px; line-height: 1.5; color: #1a1a1a }
.lh { display: flex; justify-content: space-between; border-bottom: 3px solid #1f3b57; padding-bottom: 14px; margin-bottom: 30px }
.lh .co { font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 700; font-size: 38px; color: #1f3b57 }
.lh .addr { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 18px; text-align: right; color: #444 }
.meta { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 18px; color: #333; margin-bottom: 26px }
h1 { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 34px; letter-spacing: 1px; text-align: center; border: 3px solid #111; padding: 10px; margin: 0 0 28px }
h2 { font-size: 27px; margin: 28px 0 10px }
p { margin: 0 0 16px }
ul { margin: 0 0 16px 34px; padding: 0 }
"""


def parse_header(md_text):
    """Split the 'Key: value' header block from the body."""
    meta, body_lines, in_header = {}, [], True
    for line in md_text.split("\n"):
        clean = line.replace("**", "").strip()
        m = re.match(r"^([A-Za-z .]+):\s*(.+)$", clean)
        if in_header and m and m.group(1).strip() in HEADER_KEYS:
            meta[m.group(1).strip()] = m.group(2).strip()
            continue
        if in_header and clean == "":
            continue
        in_header = False
        body_lines.append(line)
    return meta, "\n".join(body_lines)


def md_to_html(md_text):
    return markdown.markdown(md_text, extensions=["tables"])


def pi_html(md_text):
    meta, body = parse_header(md_text)
    meta_html = "".join(f"<div><b>{k}:</b> {v}</div>" for k, v in meta.items())
    return f"""<!doctype html><html><head><meta charset=utf-8><style>{PDF_CSS}</style></head><body>
<div class=brand><span class=co>LARKMOOR THERAPEUTICS</span><span class=tag>Fictional company, for software demonstration only</span></div>
<div class=docmeta>{meta_html}</div>
{md_to_html(body)}
</body></html>""", meta


def render_pdf(page, md_text, path):
    html, meta = pi_html(md_text)
    page.set_content(html, wait_until="load")
    footer = (f"<div style='font-size:8px;width:100%;padding:0 0.75in;color:#555;display:flex;justify-content:space-between;font-family:Arial'>"
              f"<span>{meta['Document No.']} &middot; Version {meta['Version']} &middot; Effective {meta['Effective date']}</span>"
              f"<span>Page <span class=pageNumber></span> of <span class=totalPages></span></span></div>")
    page.pdf(path=str(path), format="Letter", print_background=True, display_header_footer=True,
             header_template="<div></div>", footer_template=footer,
             margin={"top": "0.7in", "bottom": "0.8in", "left": "0.75in", "right": "0.75in"})
    return meta


def scanned_pdf(page, md_text, path):
    """Letterhead HTML -> screenshot -> grey, slightly rotated, noisy pages -> image-only PDF."""
    meta, body = parse_header(md_text)
    meta_line = " &nbsp;|&nbsp; ".join(f"{k}: {meta[k]}" for k in ["Document No.", "Version", "Effective date"])
    html = f"""<!doctype html><html><head><meta charset=utf-8><style>{LETTER_CSS}</style></head><body><div class=page>
<div class=lh><span class=co>LARKMOOR THERAPEUTICS</span><span class=addr>400 Fenwick Street, Cambridge, MA 02142<br>Fictional company, for demonstration only</span></div>
<div class=meta>{meta_line}<br>Product: {meta['Product']} &nbsp;|&nbsp; Document type: {meta['Document type']}</div>
{md_to_html(body)}</div></body></html>"""
    page.set_viewport_size({"width": 1275, "height": 1650})
    page.set_content(html, wait_until="load")
    full = Image.open(io.BytesIO(page.screenshot(full_page=True))).convert("L")
    pages, top = [], 0
    while top < full.height:
        crop = full.crop((0, top, 1275, min(top + 1650, full.height)))
        sheet = Image.new("L", (1275, 1650), 255)
        sheet.paste(crop, (0, 0))
        pages.append(sheet)
        top += 1650
    scanned = []
    for i, sheet in enumerate(pages):
        img = sheet.rotate(random.uniform(-0.8, 0.8), resample=Image.BICUBIC, fillcolor=246)
        img = ImageEnhance.Contrast(img).enhance(1.15).filter(ImageFilter.GaussianBlur(0.6))
        px = img.load()
        for _ in range(9000):
            x, y = random.randrange(img.width), random.randrange(img.height)
            px[x, y] = max(0, px[x, y] - random.randint(40, 120))
        scanned.append(img.convert("RGB"))
    scanned[0].save(path, "PDF", resolution=150, save_all=True, append_images=scanned[1:])
    return meta, len(scanned)


def apply_replacements(text, pairs):
    for old, new in pairs:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f"replacement matched {count} times: {old[:60]!r}")
        text = text.replace(old, new)
    return text


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    manifest = []
    qnv5 = (SRC / "quenvara-pi.md").read_text()
    pdfs = [
        ("Quenvara Prescribing Information v5.0.pdf", qnv5),
        ("Quenvara Prescribing Information v4.0.pdf", apply_replacements(qnv5, QUENVARA_V4)),
        ("Lumetra Prescribing Information v2.1.pdf", (SRC / "lumetra-pi.md").read_text()),
        ("Aurivex Prescribing Information v3.0.pdf", (SRC / "aurivex-pi.md").read_text()),
    ]
    docs = [
        ("srl-quenvara-mechanical-valves.md", "Medical", "LRK-SRL-QNV-001 Quenvara: mechanical heart valves"),
        ("srl-quenvara-crushing.md", "Medical", "LRK-SRL-QNV-002 Quenvara: crushing tablets and feeding tubes"),
        ("srl-aurivex-infants.md", "Medical", "LRK-SRL-AUR-001 Aurivex: infants younger than 3 months"),
        ("srl-lumetra-temperature.md", "Medical", "LRK-SRL-LUM-001 Lumetra: temperature excursions"),
        ("sop-pv-001-adverse-events.md", "Internal", "SOP-PV-001 Adverse event intake and reporting"),
        ("sop-mi-002-off-label.md", "Internal", "SOP-MI-002 Handling unsolicited off-label requests"),
        ("sop-qa-004-complaints.md", "Internal", "SOP-QA-004 Product complaint intake"),
    ]
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for name, md_text in pdfs:
            meta = render_pdf(page, md_text, OUT / name)
            manifest.append({"file": name, "name": name, "folder": "Public", "kind": "pdf",
                             "doc_code": meta["Document No."], "version": meta["Version"]})
        letter_name = "Aurivex Dear HCP letter 2026-08 (scan).pdf"
        meta, n = scanned_pdf(page, (SRC / "aurivex-dhcp-letter.md").read_text(), OUT / letter_name)
        manifest.append({"file": letter_name, "name": letter_name, "folder": "Public", "kind": "pdf",
                         "doc_code": meta["Document No."], "version": meta["Version"], "pages": n, "scanned": True})
        browser.close()
    for src_name, folder, title in docs:
        shutil.copy(SRC / src_name, OUT / src_name)
        meta, _ = parse_header((SRC / src_name).read_text())
        manifest.append({"file": src_name, "name": title, "folder": folder, "kind": "gdoc",
                         "doc_code": meta["Document No."], "version": meta["Version"]})
    shutil.copy(SRC / "product-catalog.csv", OUT / "product-catalog.csv")
    manifest.append({"file": "product-catalog.csv", "name": "Larkmoor Product Catalog", "folder": "Data", "kind": "gsheet",
                     "doc_code": "LRK-CATALOG", "version": "live"})
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    for m in manifest:
        print(f"{m['folder']:9} {m['kind']:6} {m['name']}")


if __name__ == "__main__":
    main()
