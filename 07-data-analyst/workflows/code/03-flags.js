// Last full week vs the 8 weeks before, per branch and metric (code, not AI). A change is flagged when it
// is at least `anomaly_z` standard deviations from the average AND at least `anomaly_min_change_pct`
// away from it, and the numbers aren't tiny.
// @include lib-ilf.js
const s = settingsOf($('Read Settings').all());
const rows = (() => { const r = $input.first().json.rows; return Array.isArray(r) ? r : JSON.parse(r || '[]'); })();
const Z = Number(s.anomaly_z || 2), MIN = Number(s.anomaly_min_change_pct || 15);
const METRICS = { check_ins: 'check-ins', new_members: 'new members', cancellations: 'cancellations', failed_payments: 'failed payments', revenue: 'revenue (£)' };
const weeks = [...new Set(rows.map(r => r.week))].sort();
const last = weeks[weeks.length - 1];
const flags = [], totals = {};
for (const branch of [...new Set(rows.map(r => r.branch))]) {
  const br = rows.filter(r => r.branch === branch);
  for (const m of Object.keys(METRICS)) {
    const now = Number((br.find(r => r.week === last) || {})[m] || 0);
    const before = br.filter(r => r.week !== last).map(r => Number(r[m]));
    const mean = before.reduce((a, b) => a + b, 0) / before.length;
    const sd = Math.sqrt(before.reduce((a, b) => a + (b - mean) ** 2, 0) / before.length) || 1;
    const z = (now - mean) / Math.max(sd, 1);
    const pct = mean ? 100 * (now - mean) / mean : 0;
    totals[m] = totals[m] || { last: 0, usual: 0 };
    totals[m].last += now; totals[m].usual += mean;
    if (Math.abs(z) >= Z && Math.abs(pct) >= MIN && (mean >= 3 || now >= 5)) {
      flags.push({ branch, metric: METRICS[m], last_week: Math.round(now * 100) / 100, usual: Math.round(mean * 10) / 10, change_pct: Math.round(pct), z: Math.round(z * 10) / 10 });
    }
  }
}
flags.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
const weekLabel = DateTime.fromISO(last).toFormat('d LLL') + ' to ' + DateTime.fromISO(last).plus({ days: 6 }).toFormat('d LLL yyyy');
const prompt = 'Last week: ' + weekLabel + '.\n\nFlagged changes (last week vs the average of the 8 weeks before):\n'
  + (flags.length ? flags.map(f => '- ' + f.branch + ', ' + f.metric + ': ' + f.last_week + ' vs usual ' + f.usual + ' (' + (f.change_pct > 0 ? '+' : '') + f.change_pct + '%, z = ' + f.z + ')').join('\n') : '- none')
  + '\n\nWhole chain last week vs usual:\n' + Object.entries(totals).map(([m, t]) => '- ' + METRICS[m] + ': ' + Math.round(t.last) + ' vs ' + Math.round(t.usual)).join('\n');
return [{ json: { week: last, week_label: weekLabel, flags, totals, prompt } }];
