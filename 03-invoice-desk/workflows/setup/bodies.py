"""Sheets API bodies for Invoice Desk 0: Setup. Prints them as TS constants."""
import json
SHEET_TITLE = "Invoice Desk: Saltmarsh Kitchen"
DOC_COLS = ["doc_id","received_at","status","flags","supplier","doc_type","invoice_number","invoice_date","due_date","currency","subtotal","tax","total","category","payment_status","drive_link","summary","source","sender","original_filename","supplier_status","decided_by","decided_at","duplicate_of","line_count","confidence","bank_last4","file_hash"]
LINE_COLS = ["doc_id","line_no","supplier","invoice_number","invoice_date","description","quantity","unit_price","amount","category","line_check"]
SUP_COLS = ["supplier","aliases","email_domain","tax_id","default_category","bank_last4","status","added_at","added_by"]
SUPPLIERS = [
 ["Harborline Produce Co.","Harborline Produce; Harborline","harborline-produce.example","00-0482231","Food & beverage","3391","active","2026-01-15","setup"],
 ["Pinecrest Dairy Cooperative","Pinecrest Dairy; Pinecrest Dairy Co-op","pinecrestdairy.example","00-0559817","Food & beverage","7720","active","2026-01-15","setup"],
 ["Gullrock Seafood Co.","Gullrock Seafood","gullrockseafood.example","00-0611402","Food & beverage","2264","active","2026-02-03","setup"],
 ["Bluewick Linen Service","Bluewick Linen","bluewicklinen.example","00-0733950","Linen & uniforms","4418","active","2026-02-03","setup"],
 ["Tidewater Electric Cooperative","Tidewater Electric; Tidewater Electric Co-op","tidewater-electric.example","","Utilities","","active","2026-01-15","setup"],
]
create = {"properties":{"title":SHEET_TITLE,"timeZone":"America/New_York"},"sheets":[
  {"properties":{"sheetId":0,"title":"Documents","gridProperties":{"frozenRowCount":1,"frozenColumnCount":1}}},
  {"properties":{"sheetId":1,"title":"Line Items","gridProperties":{"frozenRowCount":1}}},
  {"properties":{"sheetId":2,"title":"Suppliers","gridProperties":{"frozenRowCount":1}}}]}
values = {"valueInputOption":"RAW","data":[
  {"range":"Documents!A1","values":[DOC_COLS]},
  {"range":"'Line Items'!A1","values":[LINE_COLS]},
  {"range":"Suppliers!A1","values":[SUP_COLS]+SUPPLIERS}]}
def bold(sid): return {"repeatCell":{"range":{"sheetId":sid,"startRowIndex":0,"endRowIndex":1},"cell":{"userEnteredFormat":{"textFormat":{"bold":True},"backgroundColor":{"red":0.93,"green":0.95,"blue":0.97}}},"fields":"userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor"}}
def money(sid, a, b): return {"repeatCell":{"range":{"sheetId":sid,"startRowIndex":1,"startColumnIndex":a,"endColumnIndex":b},"cell":{"userEnteredFormat":{"numberFormat":{"type":"NUMBER","pattern":"#,##0.00"}}},"fields":"userEnteredFormat.numberFormat"}}
def width(sid, a, b, px): return {"updateDimensionProperties":{"range":{"sheetId":sid,"dimension":"COLUMNS","startIndex":a,"endIndex":b},"properties":{"pixelSize":px},"fields":"pixelSize"}}
def status_rule(value, rgb):
    r,g,b = rgb
    return {"addConditionalFormatRule":{"index":0,"rule":{"ranges":[{"sheetId":0,"startRowIndex":1,"startColumnIndex":2,"endColumnIndex":3}],"booleanRule":{"condition":{"type":"TEXT_EQ","values":[{"userEnteredValue":value}]},"format":{"backgroundColor":{"red":r,"green":g,"blue":b}}}}}}
fmt = {"requests":[bold(0),bold(1),bold(2),money(0,10,13),money(1,6,9),
  width(0,0,1,150),width(0,1,2,170),width(0,2,3,130),width(0,3,4,280),width(0,4,5,220),width(0,15,17,260),
  width(1,5,6,320),width(1,10,11,280),width(2,0,2,240),
  status_rule("auto_approved",(0.85,0.94,0.85)),status_rule("approved",(0.78,0.91,0.78)),
  status_rule("pending_approval",(1.0,0.93,0.76)),status_rule("needs_review",(0.98,0.80,0.78)),
  status_rule("rejected",(0.92,0.70,0.70)),status_rule("duplicate",(0.90,0.90,0.90)),
  status_rule("not_invoice",(0.93,0.93,0.96)),status_rule("error",(0.98,0.80,0.78))]}
for name, obj in [("CREATE_SHEET_BODY", create), ("SHEET_VALUES_BODY", values), ("FORMAT_BODY", fmt)]:
    print(f"const {name} = {json.dumps(obj, ensure_ascii=False)};")
