// Builds Brindle Studio's demo data with dates relative to today: the team, clients, projects, tasks,
// invoices, and eight weeks of timesheets (made with a fixed random seed, so a reset gives the same
// numbers on the same day). Project budgets are set from the hours logged, so some projects are on
// track and one is over budget.
// @include lib-bms.js
// @include seed-bms.js
let seed = 20261022;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const today = nowDt().startOf('day');
const d = n => today.plus({ days: n }).toISODate();
const half = n => Math.round(n * 2) / 2;
const projects = Object.fromEntries(PROJECTS.map(p => [p[0], { project_id: p[0], client_id: p[1], name: p[2], type: p[3], billing: p[4], status: p[5], lead: p[6], start: d(p[7]), due: p[8] === null ? '' : d(p[8]), ratio: p[9], fee: p[10] }]));
const team = TEAM.map(t => ({ person_id: t[0], name: t[1], role: t[2], team: t[3], email: t[1].split(' ')[0].toLowerCase() + '@brindle.example', is_manager: t[4], weekly_hours: t[5], cost_rate: t[6], bill_rate: t[7], active: 'yes' }));
const tasksByProject = {};
const tasks = TASKS.map((t, i) => {
  const row = { task_id: 'T-' + (1001 + i), project_id: t[0], title: t[1], assignee: t[2], status: t[3], priority: t[4], due: t[5] === null ? '' : d(t[5]), created_at: isoOf(today.plus({ days: (t[5] === null ? -10 : t[5]) - 18 }).set({ hour: 9 })), updated_at: isoOf(today.plus({ days: t[3] === 'done' ? (t[5] || 0) : -1 }).set({ hour: 16 })) };
  (tasksByProject[t[0]] = tasksByProject[t[0]] || []).push(row);
  return row;
});
const NOTES = { Strategy: ['Client call', 'Workshop prep', 'Strategy notes'], Design: ['Design work', 'Revisions after feedback', 'Design review'], Development: ['Development', 'Bug fixes', 'Code review'], Delivery: ['Project management', 'Client call', 'Planning and scheduling'], Operations: ['Admin'] };
const time = [];
let n = 0;
const weekStartIso = today.startOf('week').toISODate();
const add = (date, person, pid, hours, note, source) => {
  const p = projects[pid];
  const mine = (tasksByProject[pid] || []).filter(t => t.assignee === person);
  const task = mine.length && rnd() < 0.7 ? mine[Math.floor(rnd() * mine.length)] : null;
  time.push({ entry_id: 'E-' + String(++n).padStart(5, '0'), date, person, project_id: pid, task_id: task ? task.task_id : '', hours, billable: p.billing === 'internal' ? 'no' : 'yes', note: note || (task ? task.title : ''), logged_at: isoOf(DateTime.fromISO(date, { zone: TZ }).set({ hour: 17, minute: 30 })), source: source || 'timesheet', invoice_id: '' });
};
for (let off = -56; off <= -1; off++) {
  const day = today.plus({ days: off });
  if (day.weekday > 5) continue;
  const date = day.toISODate();
  for (const t of team) {
    const util = date >= weekStartIso ? (THIS_WEEK[t.name] || 0.9) : 0.82 + rnd() * 0.16;
    let hours = half(t.weekly_hours / 5 * util * (0.9 + rnd() * 0.2));
    if (rnd() < 0.04 && date < weekStartIso) continue; // the odd day off
    const live = (ALLOC[t.name] || []).filter(([pid]) => { const p = projects[pid]; return p.start <= date && (p.status !== 'done' || !p.due || date <= p.due); });
    if (!live.length) continue;
    // Split the day across every live project by weight (with some day-to-day wobble); slivers under half
    // an hour go to the biggest share
    const shares = live.map(([pid, w]) => [pid, w * (0.7 + rnd() * 0.6)]);
    const sum = shares.reduce((a, x) => a + x[1], 0);
    const parts = shares.map(([pid, w]) => [pid, half(hours * w / sum)]).filter(x => x[1] >= 0.5).sort((a, b) => b[1] - a[1]);
    if (!parts.length) continue;
    parts[0][1] = half(parts[0][1] + hours - parts.reduce((a, x) => a + x[1], 0));
    for (const [pid, h] of parts) if (h > 0) add(date, t.name, pid, h, NOTES[t.team][Math.floor(rnd() * NOTES[t.team].length)], 'timesheet');
  }
}
for (const [pid, person, off, h] of OLD_TIME) add(d(off), person, pid, h, 'Monthly total (imported)', 'import');
time.sort((a, b) => a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));

// Budgets from hours logged (ratio = hours used / budget), fixed for finished projects
for (const p of Object.values(projects)) {
  const used = time.filter(e => e.project_id === p.project_id).reduce((a, e) => a + e.hours, 0);
  p.budget_hours = FIXED_BUDGETS[p.project_id] || (p.ratio ? Math.max(10, Math.round(used / p.ratio / 5) * 5) : '');
  if (p.billing === 'fixed' && (p.fee === null || p.fee === undefined)) p.fee = Math.round(p.budget_hours * 105 / 500) * 500;
}
// Invoices, and which time they billed: hourly work before last month, and the retainer months invoiced
const amountOf = i => DEPOSIT_PCT[i[0]] ? Math.round(projects[i[2]].fee * DEPOSIT_PCT[i[0]]) : i[6];
const invoices = INVOICES.map(i => ({ invoice_id: i[0], client_id: i[1], project_id: i[2], period: i[3], issue_date: d(i[4]), due_date: d(i[5]), amount: amountOf(i), vat: Math.round(amountOf(i) * 20) / 100, status: i[7], paid_date: i[8] === null ? '' : d(i[8]), lines_json: '' }));
const lastMonth = today.minus({ months: 1 }).startOf('month').toISODate();
for (const e of time) {
  const p = projects[e.project_id];
  if (p.billing === 'hourly' && e.date < lastMonth) { const inv = invoices.find(i => i.project_id === e.project_id && i.period === DateTime.fromISO(e.date).toFormat('LLLL') + ' time'); if (inv) e.invoice_id = inv.invoice_id; }
  if (p.billing === 'retainer') { const inv = invoices.find(i => i.project_id === e.project_id && i.period === DateTime.fromISO(e.date).toFormat('LLLL')); if (inv) e.invoice_id = inv.invoice_id; }
}
// Northwind's August invoice matches the August time logged
const aug = invoices.find(i => i.invoice_id === 'INV-2035');
if (aug) { const h = time.filter(e => e.invoice_id === 'INV-2035'); if (h.length) { aug.amount = Math.round(h.reduce((a, e) => a + e.hours * (team.find(t => t.name === e.person).bill_rate || 95), 0) * 100) / 100; aug.vat = Math.round(aug.amount * 20) / 100; aug.period = DateTime.fromISO(h[0].date).toFormat('LLLL') + ' time'; } else aug.period = 'August time'; }

const rows = (tab, objs) => [COLUMNS[tab]].concat(objs.map(o => COLUMNS[tab].map(c => o[c] === undefined || o[c] === null ? '' : o[c])));
const tabs = {
  'Settings': [COLUMNS.Settings].concat(SETTINGS_ROWS),
  'Team': rows('Team', team),
  'Clients': rows('Clients', CLIENTS.map(c => Object.fromEntries(COLUMNS.Clients.map((k, i) => [k, c[i]])))),
  'Projects': rows('Projects', Object.values(projects)),
  'Tasks': rows('Tasks', tasks),
  'Time': rows('Time', time),
  'Invoices': rows('Invoices', invoices),
  'Audit': [COLUMNS.Audit]
};
const q = x => "'" + x.replace(/'/g, "''") + "'";
return [{ json: {
  clear: { ranges: Object.keys(tabs).map(q) },
  write: { valueInputOption: 'RAW', data: Object.entries(tabs).map(([k, v]) => ({ range: q(k) + '!A1', values: v })) },
  summary: Object.fromEntries(Object.entries(tabs).map(([k, v]) => [k, v.length - 1]))
} }];
