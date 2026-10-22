// Code for the one-off "remove Bluesky" sheet migration (2026-10-08).
// Input: GET Calendar!1:1 and Settings!A:C. Output: the values update and the structural batchUpdate.
const header = ($('Read Calendar Header').first().json.values || [[]])[0];
const settings = $('Read Settings Tab').first().json.values || [];
const data = [];
let handleRow = -1;
settings.forEach((r, i) => {
  const key = String(r[0] || '').trim();
  const row = i + 1;
  if (key === 'default_platforms') {
    const kept = String(r[1] || '').split(/[,;]+/).map(x => x.trim()).filter(x => x && !/^(bluesky|bsky)$/i.test(x));
    data.push({ range: 'Settings!B' + row, values: [[kept.join(', ') || 'linkedin, telegram']] });
  }
  if (key === 'facts') data.push({ range: 'Settings!B' + row, values: [[String(r[1] || '').replace(/LinkedIn, Bluesky and Telegram/g, 'LinkedIn and Telegram')]] });
  if (key === 'hashtags') data.push({ range: 'Settings!C' + row, values: [['Pool of hashtags. LinkedIn uses up to 3, Telegram none']] });
  if (key === 'bluesky_handle') handleRow = i;
});
const cols = header.map((h, i) => [String(h).trim(), i]).filter(([h]) => ['bluesky_text', 'bluesky_url', 'bluesky_uri'].includes(h)).map(([, i]) => i).sort((a, b) => b - a);
const requests = cols.map(i => ({ deleteDimension: { range: { sheetId: 0, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 } } }));
if (handleRow >= 0) requests.push({ deleteDimension: { range: { sheetId: 1, dimension: 'ROWS', startIndex: handleRow, endIndex: handleRow + 1 } } });
return [{ json: { values_body: { valueInputOption: 'RAW', data }, structure_body: { requests }, removed_columns: cols.length, removed_setting: handleRow >= 0 } }];
