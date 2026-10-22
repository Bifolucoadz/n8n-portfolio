"""Render the demo documents in samples/out/ (python3 samples/make_samples.py).

Every business, address, tax ID and account number here is invented. EINs start with 00 (never
issued) and phone numbers use the 555-01xx range.
"""
import io, pathlib, random
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)
random.seed(7)

BILL_TO = ["Saltmarsh Kitchen LLC", "Attn: Accounts Payable", "18 Wharfside Lane", "Portland, ME 04101"]


def money(x):
    return f"{x:,.2f}"


def line_rows(lines):
    rows = []
    for desc, qty, price, amount in lines:
        q = f"{qty:g}" if qty is not None else ""
        p = money(price) if price is not None else ""
        rows.append(f"<tr><td>{desc}</td><td class=n>{q}</td><td class=n>{p}</td><td class=n>{money(amount)}</td></tr>")
    return "\n".join(rows)


def invoice_html(d):
    """One invoice layout with a per-supplier look (font, colour, header style)."""
    t = d["theme"]
    totals = "".join(
        f"<tr class='{'grand' if label.startswith('Total') or label.startswith('Amount due') else ''}'><td>{label}</td><td class=n>{d.get('currency_symbol', '$')}{money(v)}</td></tr>"
        for label, v in d["totals"]
    )
    notice = f"<div class=notice>{d['notice']}</div>" if d.get("notice") else ""
    stamp = f"<div class=stamp>{d['stamp']}</div>" if d.get("stamp") else ""
    meta = "".join(f"<tr><th>{k}</th><td>{v}</td></tr>" for k, v in d["meta"])
    return f"""<!doctype html><html><head><meta charset=utf-8><style>
@page {{ size: Letter; margin: 0 }}
* {{ box-sizing: border-box }}
body {{ margin: 0; font-family: {t['font']}; color: #1d1d1f; font-size: 12.5px }}
.page {{ width: 8.5in; min-height: 11in; padding: 0.6in 0.65in; position: relative }}
header {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid {t['accent']}; padding-bottom: 18px }}
.logo {{ font-size: 24px; font-weight: 700; color: {t['accent']}; letter-spacing: {t.get('tracking', '0')} }}
.logo small {{ display: block; font-size: 11px; font-weight: 400; color: #555; letter-spacing: 0; margin-top: 4px; line-height: 1.5 }}
h1 {{ margin: 0; font-size: 30px; font-weight: {t.get('h1weight', 300)}; color: #333; text-align: right; text-transform: uppercase; letter-spacing: 2px }}
.meta {{ margin-top: 8px; border-collapse: collapse; margin-left: auto }}
.meta th {{ text-align: right; padding: 2px 10px; color: #666; font-weight: 400 }}
.meta td {{ text-align: right; padding: 2px 0; font-weight: 600 }}
.parties {{ display: flex; gap: 60px; margin: 26px 0 }}
.parties h3 {{ margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: {t['accent']} }}
.parties p {{ margin: 0; line-height: 1.55 }}
table.lines {{ width: 100%; border-collapse: collapse; margin-top: 8px }}
table.lines th {{ background: {t['head_bg']}; color: {t['head_fg']}; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px }}
table.lines td {{ padding: 8px 10px; border-bottom: 1px solid #e3e3e3 }}
.n {{ text-align: right; white-space: nowrap }}
table.lines th.n {{ text-align: right }}
.totals {{ margin: 18px 0 0 auto; border-collapse: collapse; min-width: 280px }}
.totals td {{ padding: 6px 10px }}
.totals tr.grand td {{ font-weight: 700; font-size: 15px; border-top: 2px solid #333 }}
.notice {{ margin-top: 26px; padding: 14px 16px; border: 2px solid #c0392b; background: #fdf1ef; color: #7b241c; font-weight: 600; line-height: 1.5 }}
.pay {{ margin-top: 28px; font-size: 11.5px; color: #444; line-height: 1.6; border-top: 1px solid #ddd; padding-top: 14px }}
.stamp {{ position: absolute; top: 3.2in; left: 1.6in; transform: rotate(-18deg); font-size: 64px; font-weight: 800; color: rgba(192, 57, 43, .28); border: 8px solid rgba(192, 57, 43, .28); padding: 6px 28px; letter-spacing: 6px }}
footer {{ position: absolute; bottom: 0.5in; left: 0.65in; right: 0.65in; font-size: 10px; color: #888; text-align: center }}
</style></head><body><div class=page>
{stamp}
<header>
  <div class=logo>{d['supplier']}<small>{'<br>'.join(d['supplier_lines'])}</small></div>
  <div><h1>{d.get('title', 'Invoice')}</h1><table class=meta>{meta}</table></div>
</header>
<div class=parties>
  <div><h3>Bill to</h3><p>{'<br>'.join(BILL_TO)}</p></div>
  <div><h3>Ship to</h3><p>Saltmarsh Kitchen<br>Rear loading door<br>18 Wharfside Lane<br>Portland, ME 04101</p></div>
</div>
<table class=lines><thead><tr><th>Description</th><th class=n>Qty</th><th class=n>Unit price</th><th class=n>Amount</th></tr></thead>
<tbody>{line_rows(d['lines'])}</tbody></table>
<table class=totals>{totals}</table>
{notice}
<div class=pay>{d['payment']}</div>
<footer>{d.get('footer', 'Thank you for your business.')}</footer>
</div></body></html>"""


INVOICES = [
    {
        "file": "harborline-produce-INV-10482.pdf",
        "supplier": "Harborline Produce Co.",
        "supplier_lines": ["44 Commercial Dock Rd, South Portland, ME 04106", "(207) 555-0171 · orders@harborline-produce.example", "EIN 00-0482231"],
        "theme": {"font": "'Avenir Next', Avenir, Helvetica, sans-serif", "accent": "#2e7d32", "head_bg": "#2e7d32", "head_fg": "#fff"},
        "meta": [("Invoice #", "INV-10482"), ("Date", "Sep 28, 2026"), ("Terms", "Net 14"), ("Due", "Oct 12, 2026"), ("Customer #", "SMK-0091")],
        "lines": [
            ("Heirloom tomatoes, 25 lb case", 2, 48.50, 97.00),
            ("Romaine hearts, 24 ct case", 3, 36.75, 110.25),
            ("Yellow onions, 50 lb sack", 2, 31.20, 62.40),
            ("Russet potatoes, 50 lb", 2, 28.90, 57.80),
            ("Lemons, 115 ct case", 1, 54.00, 54.00),
            ("Fresh herbs, assorted bunches", 36, 1.85, 66.60),
            ("Maine blueberries, 12 pint flat", 2, 42.00, 84.00),
            ("Fuel surcharge", 1, 12.50, 12.50),
        ],
        "totals": [("Subtotal", 544.55), ("Sales tax (exempt food)", 0.00), ("Total due", 544.55)],
        "payment": "Pay by ACH to Harbor Mutual Bank, account XXXXXX3391, or by check to the address above. Please quote INV-10482.",
    },
    {
        "file": "pinecrest-dairy-2291.pdf",
        "supplier": "PINECREST DAIRY COOPERATIVE",
        "supplier_lines": ["1200 Ridge Farm Road, Gorham, ME 04038", "(207) 555-0188 · billing@pinecrestdairy.example", "Federal Tax ID 00-0559817"],
        "theme": {"font": "Georgia, 'Times New Roman', serif", "accent": "#1f4e79", "head_bg": "#e8eef5", "head_fg": "#1f4e79", "tracking": "1px", "h1weight": 400},
        "meta": [("Invoice No.", "2291"), ("Invoice Date", "09/28/2026"), ("Payment Terms", "Net 7"), ("Due Date", "10/05/2026"), ("Route", "Tue/Fri #4")],
        "lines": [
            ("Whole milk, gallon", 12, 4.65, 55.80),
            ("Heavy cream 40%, quart", 18, 6.20, 111.60),
            ("Unsalted butter, 36 x 1 lb case", 2, 118.80, 237.60),
            ("Crème fraîche, 5 lb tub", 2, 27.40, 54.80),
            ("Aged white cheddar, 5 lb block", 2, 44.25, 88.50),
            ("Deli paper sheets, case (T)", 1, 32.00, 32.00),
            ("Delivery fee", 1, 15.00, 15.00),
        ],
        "totals": [("Subtotal", 595.30), ("Maine sales tax 5.5% on taxable items (T)", 1.76), ("Total", 597.06)],
        "payment": "Remit to Pinecrest Dairy Cooperative. ACH: Kennebec Savings, account XXXXXX7720. Late payments subject to 1.5% monthly finance charge.",
        "footer": "Member-owned since 1952 · Thank you for buying local",
    },
    {
        "file": "frostline-refrigeration-FR-7731.pdf",
        "supplier": "Frostline Refrigeration Services",
        "supplier_lines": ["9 Industrial Way, Westbrook, ME 04092", "24/7 service (207) 555-0164 · ar@frostline-refrigeration.example", "EIN 00-0927745"],
        "theme": {"font": "'Helvetica Neue', Helvetica, Arial, sans-serif", "accent": "#0277bd", "head_bg": "#0277bd", "head_fg": "#fff"},
        "meta": [("Invoice", "FR-7731"), ("Date", "September 29, 2026"), ("Terms", "Net 15"), ("Due", "October 14, 2026"), ("Work order", "WO-30552")],
        "lines": [
            ("Emergency service call, after hours (walk-in cooler down)", 1, 225.00, 225.00),
            ("Refrigeration technician labor, hours", 6.5, 135.00, 877.50),
            ("Scroll compressor 1.5 HP, walk-in cooler", 1, 1085.00, 1085.00),
            ("Refrigerant R-448A, lb", 12, 18.50, 222.00),
            ("Filter drier and sight glass kit", 1, 64.00, 64.00),
        ],
        "totals": [("Subtotal", 2473.50), ("Sales tax 5.5% on parts ($1,371.00)", 75.41), ("Amount due", 2548.91)],
        "payment": "Parts carry a 1-year warranty, labor 90 days. Pay by ACH to Northern Trust Bank of Maine, account XXXXXX5108, or by card at frostline-refrigeration.example/pay.",
    },
    {
        "file": "gullrock-seafood-55120.pdf",
        "supplier": "Gullrock Seafood Co.",
        "supplier_lines": ["Pier 6, Portland Fish Exchange, Portland, ME 04101", "(207) 555-0152 · invoices@gullrockseafood.example", "EIN 00-0611402"],
        "theme": {"font": "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif", "accent": "#00695c", "head_bg": "#004d40", "head_fg": "#fff"},
        "meta": [("Invoice #", "55120"), ("Date", "2026-09-29"), ("Terms", "Net 14"), ("Due", "2026-10-13"), ("Catch date", "2026-09-28")],
        "lines": [
            ("Atlantic salmon fillet, skin-on, lb", 20, 11.40, 228.00),
            ("Live Maine lobster 1.25 lb, each", 12, 13.75, 165.00),
            ("Sea scallops U10 dry-packed, lb", 10, 26.50, 310.00),
            ("PEI mussels, 10 lb bag", 4, 22.00, 88.00),
            ("Haddock fillet, lb", 20, 9.80, 196.00),
        ],
        "totals": [("Subtotal", 987.00), ("Tax", 0.00), ("Total", 987.00)],
        "payment": "Pay by ACH to Casco Fishermen's Bank, account XXXXXX2264. Claims for quality must be made within 24 hours of delivery.",
    },
    {
        "file": "bluewick-linen-8840.pdf",
        "supplier": "Bluewick Linen Service",
        "supplier_lines": ["310 Mill Street, Biddeford, ME 04005", "(207) 555-0145 · accounts@bluewicklinen.example", "EIN 00-0733950"],
        "theme": {"font": "'Trebuchet MS', Helvetica, sans-serif", "accent": "#283593", "head_bg": "#e8eaf6", "head_fg": "#283593"},
        "meta": [("Invoice", "8840"), ("Date", "Sep 30, 2026"), ("Terms", "Net 30"), ("Due", "Oct 30, 2026"), ("Account", "SALT-218")],
        "lines": [
            ("Tablecloths 54x54, white, each", 60, 1.35, 81.00),
            ("Napkins 20x20, white, dozen", 50, 1.20, 60.00),
            ("Chef coats, each", 8, 2.50, 20.00),
            ("Bistro aprons, each", 20, 0.95, 19.00),
            ("Bar towels, bundle of 25", 10, 4.80, 48.00),
            ("Route delivery", 1, 12.00, 12.00),
        ],
        "totals": [("Subtotal", 240.00), ("Sales tax 5.5%", 13.20), ("Total due", 253.20)],
        "notice": "IMPORTANT: We have changed banks. Please update your records and send this and all future payments to our new account: First Coastal Bank, account XXXXXX9047. Payments to our old account will be returned.",
        "payment": "Questions about this invoice? Reply to this email or call (207) 555-0145.",
    },
]

# Not in the demo email set: fresh documents for trying the upload form or Drive folder after the demo.
EXTRA = [
    dict(INVOICES[1], file="pinecrest-dairy-2307.pdf",
         meta=[("Invoice No.", "2307"), ("Invoice Date", "10/02/2026"), ("Payment Terms", "Net 7"), ("Due Date", "10/09/2026"), ("Route", "Tue/Fri #4")],
         lines=[("Whole milk, gallon", 10, 4.65, 46.50), ("Heavy cream 40%, quart", 16, 6.20, 99.20), ("Unsalted butter, 36 x 1 lb case", 1, 118.80, 118.80),
                ("Buttermilk, half gallon", 6, 3.45, 20.70), ("Delivery fee", 1, 15.00, 15.00)],
         totals=[("Subtotal", 300.20), ("Maine sales tax 5.5% on taxable items (T)", 0.00), ("Total", 300.20)]),
]

DUPLICATE = dict(INVOICES[0], file="harborline-produce-INV-10482-copy.pdf", stamp="COPY",
                 notice="Reminder: this invoice is due Oct 12, 2026. If you have already paid, please disregard.")

RECEIPT_HTML = """<!doctype html><html><head><meta charset=utf-8><style>
body { margin: 0; background: #fff }
.r { width: 300px; padding: 22px 18px 30px; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #222; line-height: 1.45 }
.c { text-align: center } .b { font-weight: 700 } .big { font-size: 18px }
.row { display: flex; justify-content: space-between } hr { border: 0; border-top: 1px dashed #555; margin: 8px 0 }
</style></head><body><div class=r>
<div class='c b big'>LEDGESTONE HARDWARE</div>
<div class=c>215 Congress Ave<br>Portland ME 04101<br>(207) 555-0129</div><hr>
<div>09/30/2026 2:22 PM<br>Store 04 Reg 2 Trans 0042-118</div><hr>
<div class=row><span>SHELF LINER 12X10</span><span></span></div><div class=row><span>  2 @ 12.99</span><span>25.98</span></div>
<div class=row><span>MOP HEAD COTTON LG</span><span></span></div><div class=row><span>  3 @ 8.49</span><span>25.47</span></div>
<div class=row><span>LED BULB A19 4PK</span><span>15.99</span></div>
<div class=row><span>ZIP TIES 8IN 100CT</span><span>6.49</span></div><hr>
<div class=row><span>SUBTOTAL</span><span>73.93</span></div>
<div class=row><span>ME SALES TAX 5.5%</span><span>4.07</span></div>
<div class='row b big'><span>TOTAL</span><span>78.00</span></div><hr>
<div class=row><span>VISA ************4417</span><span>78.00</span></div>
<div>AUTH 0X19QK  CHIP READ</div><hr>
<div class=c>RETURNS WITH RECEIPT<br>WITHIN 30 DAYS<br><br>THANK YOU!</div>
</div></body></html>"""

BILL_HTML = """<!doctype html><html><head><meta charset=utf-8><style>
body { margin: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px }
.p { width: 816px; padding: 48px 56px }
.top { display: flex; justify-content: space-between; border-bottom: 4px solid #111; padding-bottom: 14px }
.brand { font-size: 26px; font-weight: 800 } .brand small { display: block; font-size: 12px; font-weight: 400; margin-top: 4px }
.box { border: 2px solid #111; padding: 10px 14px; min-width: 250px } .box div { display: flex; justify-content: space-between; padding: 2px 0 }
h2 { font-size: 15px; margin: 26px 0 8px; text-transform: uppercase; letter-spacing: 1px }
table { width: 100%; border-collapse: collapse } td, th { padding: 7px 8px; border-bottom: 1px solid #999; text-align: left } .n { text-align: right }
.due { margin-top: 22px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; border: 3px solid #111; padding: 12px 16px }
.stub { margin-top: 40px; border-top: 2px dashed #111; padding-top: 18px; display: flex; justify-content: space-between; font-size: 12px }
</style></head><body><div class=p>
<div class=top><div class=brand>TIDEWATER ELECTRIC COOPERATIVE<small>PO Box 0412, Brunswick, ME 04011 · Member services (207) 555-0110</small></div>
<div class=box><div><span>Account number</span><b>40-1187-22</b></div><div><span>Bill number</span><b>B-2609-401187</b></div><div><span>Statement date</span><b>09/24/2026</b></div><div><span>Service period</span><b>08/22 - 09/21/2026</b></div></div></div>
<p><b>Service address:</b> Saltmarsh Kitchen LLC, 18 Wharfside Lane, Portland ME 04101 · Rate: Small Commercial (SC-2)</p>
<h2>Charges this period</h2>
<table><tr><th>Item</th><th class=n>Usage</th><th class=n>Rate</th><th class=n>Amount</th></tr>
<tr><td>Energy supply charge</td><td class=n>3,210 kWh</td><td class=n>$0.1385</td><td class=n>$444.59</td></tr>
<tr><td>Delivery charge</td><td class=n>3,210 kWh</td><td class=n>$0.0612</td><td class=n>$196.45</td></tr>
<tr><td>Customer charge</td><td class=n></td><td class=n></td><td class=n>$24.50</td></tr>
<tr><td><b>Total current charges</b></td><td></td><td></td><td class=n><b>$665.54</b></td></tr></table>
<h2>Account summary</h2>
<table><tr><td>Previous balance</td><td class=n>$702.11</td></tr><tr><td>Payment received 09/02 - thank you</td><td class=n>-$702.11</td></tr><tr><td>Current charges</td><td class=n>$665.54</td></tr></table>
<div class=due><span>AMOUNT DUE BY 10/06/2026</span><span>$665.54</span></div>
<div class=stub><div>Return this stub with your payment.<br>Make checks payable to Tidewater Electric Cooperative.</div><div>Account 40-1187-22<br>Amount due $665.54<br>Due 10/06/2026</div></div>
</div></body></html>"""

MENU_HTML = """<!doctype html><html><head><meta charset=utf-8><style>
@page { size: Letter; margin: 0 }
body { margin: 0; font-family: Georgia, serif; color: #2b2b2b; background: #faf7f0 }
.p { width: 8.5in; height: 11in; padding: 0.9in 1in; text-align: center }
h1 { font-size: 40px; letter-spacing: 8px; font-weight: 400; margin: 0 } .sub { letter-spacing: 4px; font-size: 12px; margin: 8px 0 40px }
h2 { font-size: 14px; letter-spacing: 5px; font-weight: 400; margin: 34px 0 14px; color: #8a6d3b }
.i { margin: 12px 0 } .i b { font-weight: 400; font-size: 17px } .i span { display: block; font-size: 12.5px; color: #666; font-style: italic }
.f { margin-top: 50px; font-size: 11px; color: #888 }
</style></head><body><div class=p>
<h1>SALTMARSH</h1><div class=sub>KITCHEN · FALL MENU 2026</div>
<h2>TO START</h2>
<div class=i><b>Oysters on the half shell · 21</b><span>mignonette, lemon, horseradish</span></div>
<div class=i><b>Roasted squash soup · 12</b><span>brown butter, sage, toasted pepitas</span></div>
<div class=i><b>Heirloom tomato salad · 15</b><span>whipped feta, basil, sourdough crumb</span></div>
<h2>MAINS</h2>
<div class=i><b>Pan-seared scallops · 38</b><span>sweet corn purée, chanterelles, bacon lardons</span></div>
<div class=i><b>Lobster roll · 34</b><span>butter-toasted bun, chives, hand-cut fries</span></div>
<div class=i><b>Roast half chicken · 29</b><span>fingerlings, charred broccolini, jus</span></div>
<h2>TO FINISH</h2>
<div class=i><b>Blueberry crumble · 11</b><span>vanilla bean ice cream</span></div>
<div class=f>18 Wharfside Lane, Portland, Maine · (207) 555-0136 · A fictional restaurant for a portfolio demo</div>
</div></body></html>"""


def receipt_photo(png_bytes, path):
    """Turn a clean receipt render into a phone photo: tilt, table background, shadow, noise."""
    rec = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    rec = ImageEnhance.Brightness(rec).enhance(0.97)
    w, h = rec.size
    bg = Image.new("RGB", (int(w * 1.7), int(h * 1.25)), (122, 104, 86))
    px = bg.load()
    for y in range(bg.size[1]):
        for x in range(0, bg.size[0], 1):
            g = int(10 * ((x * 0.013 + y * 0.004) % 1)) + random.randint(-6, 6)
            r0, g0, b0 = px[x, y]
            px[x, y] = (r0 + g, g0 + g, b0 + g)
    shadow = Image.new("L", (w, h), 0)
    ImageDraw.Draw(shadow).rectangle([0, 0, w, h], fill=120)
    rec_rgba = rec.convert("RGBA").rotate(-2.2, expand=True, resample=Image.BICUBIC)
    sh = shadow.rotate(-2.2, expand=True).filter(ImageFilter.GaussianBlur(18))
    ox, oy = (bg.size[0] - rec_rgba.size[0]) // 2, (bg.size[1] - rec_rgba.size[1]) // 2
    bg.paste((40, 30, 20), (ox + 14, oy + 18), sh)
    bg.paste(rec_rgba, (ox, oy), rec_rgba)
    bg = bg.filter(ImageFilter.GaussianBlur(0.6))
    bg = ImageEnhance.Contrast(bg).enhance(0.92)
    bg.save(path, "JPEG", quality=82)


def scanned_pdf(png_bytes, path):
    """Image-only PDF that looks scanned: grey, slightly skewed, speckled, no text layer."""
    img = Image.open(io.BytesIO(png_bytes)).convert("L")
    img = img.rotate(0.9, expand=False, fillcolor=255, resample=Image.BICUBIC)
    px = img.load()
    for _ in range(9000):
        x, y = random.randrange(img.size[0]), random.randrange(img.size[1])
        px[x, y] = random.randint(90, 200)
    img = img.filter(ImageFilter.GaussianBlur(0.7))
    img = ImageEnhance.Contrast(img).enhance(1.15)
    img.save(path, "PDF", resolution=150)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for d in INVOICES + [DUPLICATE] + EXTRA:
            page.set_content(invoice_html(d))
            page.pdf(path=str(OUT / d["file"]), format="Letter", print_background=True)
            print("wrote", d["file"])
        page.set_content(MENU_HTML)
        page.pdf(path=str(OUT / "saltmarsh-fall-menu.pdf"), format="Letter", print_background=True)
        print("wrote saltmarsh-fall-menu.pdf")
        shot = browser.new_page(device_scale_factor=2, viewport={"width": 336, "height": 600})
        shot.set_content(RECEIPT_HTML)
        receipt_photo(shot.locator(".r").screenshot(), OUT / "ledgestone-hardware-receipt.jpg")
        print("wrote ledgestone-hardware-receipt.jpg")
        bill = browser.new_page(device_scale_factor=1.5, viewport={"width": 816, "height": 1056})
        bill.set_content(BILL_HTML)
        scanned_pdf(bill.screenshot(full_page=True), OUT / "tidewater-electric-bill-scan.pdf")
        print("wrote tidewater-electric-bill-scan.pdf")
        browser.close()


if __name__ == "__main__":
    main()
