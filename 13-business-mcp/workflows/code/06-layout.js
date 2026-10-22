// The tabs, in order, with frozen header rows (from workflows/tables.json).
const COLUMNS = __TABLES__;
const colours = { 'Settings': [0.45, 0.5, 0.55], 'Team': [0.36, 0.25, 0.63], 'Clients': [0.12, 0.3, 0.5], 'Projects': [0.18, 0.49, 0.31], 'Tasks': [0.72, 0.47, 0.12], 'Time': [0.82, 0.22, 0.16], 'Invoices': [0.1, 0.1, 0.1], 'Audit': [0.6, 0.6, 0.6] };
return [{ json: {
  body: {
    properties: { title: 'Brindle Studio: business data (demo)', locale: 'en_GB', timeZone: 'Europe/London' },
    sheets: Object.keys(COLUMNS).map((title, i) => ({ properties: { sheetId: i + 1, title, index: i, gridProperties: { frozenRowCount: 1, columnCount: Math.max(COLUMNS[title].length, 10) }, tabColor: { red: colours[title][0], green: colours[title][1], blue: colours[title][2] } } }))
  },
  headers: { valueInputOption: 'RAW', data: Object.entries(COLUMNS).map(([t, cols]) => ({ range: "'" + t + "'!A1", values: [cols] })) },
  format: { requests: Object.keys(COLUMNS).map((t, i) => ({ repeatCell: { range: { sheetId: i + 1, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.93, green: 0.95, blue: 0.93 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } })) }
} }];
