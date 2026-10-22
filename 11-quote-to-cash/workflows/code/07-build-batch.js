// Turns the plan into ONE Sheets API batchUpdate: new rows are appended to each tab (appendCells) and
// changed quote fields are written cell by cell (updateCells), so the whole plan is saved in a single,
// all-or-nothing request. Values are written as plain text or numbers, never as formulas.
const COLUMNS = __TABLES__;
const plan = $('When Called').first().json.plan || {};
const meta = $('Read Sheet Map').first().json;
const sheetId = {}, quoteRow = {};
for (const sh of meta.sheets || []) {
  sheetId[sh.properties.title] = sh.properties.sheetId;
  if (sh.properties.title === 'Quotes') ((sh.data && sh.data[0] && sh.data[0].rowData) || []).forEach((r, i) => {
    const v = r.values && r.values[0] && r.values[0].effectiveValue;
    if (v && i > 0) quoteRow[String(v.stringValue || v.numberValue)] = i;
  });
}
const cell = v => v === null || v === undefined || v === '' ? {} : (typeof v === 'number' ? { userEnteredValue: { numberValue: v } } : (typeof v === 'boolean' ? { userEnteredValue: { boolValue: v } } : { userEnteredValue: { stringValue: typeof v === 'object' ? JSON.stringify(v) : String(v) } }));
const requests = [];
const append = (tab, objs) => {
  if (!objs || !objs.length) return;
  if (sheetId[tab] === undefined) throw new Error('The sheet has no ' + tab + ' tab');
  requests.push({ appendCells: { sheetId: sheetId[tab], rows: objs.map(o => ({ values: COLUMNS[tab].map(c => cell(o[c])) })), fields: 'userEnteredValue' } });
};
append('Quotes', plan.quote_inserts);
append('Events', plan.events);
append('Payments', plan.payments);
append('Schedule', plan.schedule);
if (plan.mode !== 'live') append('Outbox', (plan.emails || []).filter(e => e.to).map(e => Object.assign({ at: DateTime.now().setZone('Europe/London').set({ millisecond: 0 }).toISO({ suppressMilliseconds: true }) }, e)));
const missing = [];
for (const u of plan.quote_updates || []) {
  const row = quoteRow[u.quote_id];
  if (row === undefined) { missing.push(u.quote_id); continue; }
  for (const [k, v] of Object.entries(u)) {
    const col = COLUMNS.Quotes.indexOf(k);
    if (k === 'quote_id' || col < 0) continue;
    requests.push({ updateCells: { start: { sheetId: sheetId.Quotes, rowIndex: row, columnIndex: col }, rows: [{ values: [cell(v)] }], fields: 'userEnteredValue' } });
  }
}
if (missing.length) throw new Error('Quote not found in the sheet: ' + missing.join(', '));
return [{ json: { has_writes: requests.length > 0, body: { requests }, count: requests.length } }];
