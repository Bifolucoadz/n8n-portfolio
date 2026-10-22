// ---- lib-bms.js (included by build.py): Brindle Studio data helpers and every MCP tool ----
const TZ = 'Europe/London';
const COLUMNS = __TABLES__;
const nowDt = () => DateTime.now().setZone(TZ);
const isoOf = dt => dt.set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });
const nowIso = () => isoOf(nowDt());
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const r1 = n => Math.round((Number(n) || 0) * 10) / 10;
const gbp = n => '£' + r2(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const parseJson = (s, d) => { try { return typeof s === 'string' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };
const yes = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());
const str = v => String(v === null || v === undefined ? '' : v).trim();

function tablesOf(res) {
  const out = {};
  for (const vr of (res && res.valueRanges) || []) {
    const name = String(vr.range || '').split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");
    const rows = vr.values || [];
    const head = (rows[0] || []).map(h => String(h).trim());
    out[name] = rows.slice(1).map((r, i) => {
      const o = { _row: i + 2 };
      head.forEach((h, j) => { if (h) o[h] = r[j] === undefined || r[j] === null ? '' : r[j]; });
      return o;
    }).filter(o => Object.keys(o).some(k => k !== '_row' && o[k] !== ''));
  }
  return out;
}
const settingsOf = rows => Object.fromEntries((rows || []).filter(r => r.key).map(r => [String(r.key).trim(), r.value === undefined ? '' : r.value]));

// Everything the tools need, with lookups
function studio(T) {
  const s = settingsOf(T.Settings);
  const today = nowDt().startOf('day');
  const team = (T.Team || []).map(p => Object.assign({}, p, { weekly_hours: Number(p.weekly_hours) || 0, cost_rate: Number(p.cost_rate) || 0, bill_rate: Number(p.bill_rate) || 0 }));
  const clients = (T.Clients || []).map(c => Object.assign({}, c, { retainer_hours: Number(c.retainer_hours) || 0, retainer_fee: Number(c.retainer_fee) || 0 }));
  const projects = (T.Projects || []).map(p => Object.assign({}, p, { budget_hours: Number(p.budget_hours) || 0, fee: Number(p.fee) || 0, start: str(p.start).slice(0, 10), due: str(p.due).slice(0, 10) }));
  const time = (T.Time || []).map(e => Object.assign({}, e, { hours: Number(e.hours) || 0, date: str(e.date).slice(0, 10) }));
  const tasks = (T.Tasks || []).map(t => Object.assign({}, t, { due: str(t.due).slice(0, 10) }));
  const invoices = (T.Invoices || []).map(i => Object.assign({}, i, { amount: Number(i.amount) || 0, vat: Number(i.vat) || 0 }));
  const byId = (list, key) => Object.fromEntries(list.map(x => [x[key], x]));
  return { s, today, todayIso: today.toISODate(), team, clients, projects, time, tasks, invoices,
    client: byId(clients, 'client_id'), project: byId(projects, 'project_id'), person: Object.fromEntries(team.map(p => [p.name, p])) };
}

// Finds one thing by ID or name: exact, then starts-with, then all words; says when it's ambiguous
function resolve(list, q, label, fields) {
  const want = str(q).toLowerCase();
  if (!want) return { error: 'Say which ' + label + '.' };
  const names = x => fields.map(f => str(x[f]).toLowerCase());
  let hit = list.filter(x => names(x).some(n => n === want));
  if (!hit.length) hit = list.filter(x => names(x).some(n => n.startsWith(want)));
  if (!hit.length) { const words = want.split(/\s+/).filter(w => w.length > 1); hit = list.filter(x => words.every(w => names(x).join(' ').includes(w))); }
  if (hit.length === 1) return { item: hit[0] };
  if (hit.length > 1) return { error: 'More than one ' + label + ' matches "' + q + '": ' + hit.slice(0, 6).map(x => str(x[fields[1] || fields[0]])).join(', ') + '. Say which one.' };
  return { error: 'No ' + label + ' matches "' + q + '". Try the search tool.' };
}
const findClient = (S, q) => resolve(S.clients, q, 'client', ['client_id', 'name']);
const findPerson = (S, q) => resolve(S.team.filter(p => yes(p.active)), q, 'person', ['person_id', 'name']);
function findProject(S, q) {
  const r = resolve(S.projects.map(p => Object.assign({}, p, { full: (S.client[p.client_id] ? S.client[p.client_id].name + ' ' : '') + p.name })), q, 'project', ['project_id', 'name', 'full']);
  if (r.error && !/More than one/.test(r.error)) {
    const c = findClient(S, q); // a client with exactly one active project
    if (c.item) { const ps = S.projects.filter(p => p.client_id === c.item.client_id && p.status === 'active'); if (ps.length === 1) return { item: ps[0] }; if (ps.length > 1) return { error: c.item.name + ' has ' + ps.length + ' active projects: ' + ps.map(p => p.name + ' (' + p.project_id + ')').join(', ') + '. Say which one.' }; }
  }
  return r;
}

const weekStart = (dt, offset) => dt.startOf('week').plus({ weeks: offset || 0 });
const daysBetween = (a, b) => Math.round(DateTime.fromISO(b).diff(DateTime.fromISO(a), 'days').days);
const isOpen = t => !['done'].includes(str(t.status));
const projectLabel = (S, p) => (S.client[p.client_id] ? S.client[p.client_id].name + ': ' : '') + p.name;
function taskView(S, t) {
  const p = S.project[t.project_id] || {};
  const o = { task_id: t.task_id, title: t.title, project: projectLabel(S, p), assignee: t.assignee || 'unassigned', status: t.status, priority: t.priority, due: t.due || null };
  if (t.due && isOpen(t) && t.due < S.todayIso) o.overdue_days = daysBetween(t.due, S.todayIso);
  return o;
}
const byDue = (a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1;
function hoursOn(S, project_id, from, to) { return r2(S.time.filter(e => e.project_id === project_id && (!from || e.date >= from) && (!to || e.date <= to)).reduce((a, e) => a + e.hours, 0)); }
const monthRange = (dt) => [dt.startOf('month').toISODate(), dt.endOf('month').toISODate()];
function retainerUse(S, c, monthDt) {
  const [a, b] = monthRange(monthDt || S.today);
  const ps = S.projects.filter(p => p.client_id === c.client_id && p.billing === 'retainer').map(p => p.project_id);
  const used = r2(S.time.filter(e => ps.includes(e.project_id) && e.date >= a && e.date <= b).reduce((x, e) => x + e.hours, 0));
  return { month: (monthDt || S.today).toFormat('LLLL yyyy'), retainer_hours: c.retainer_hours, used_hours: used, left_hours: r2(c.retainer_hours - used), over: used > c.retainer_hours };
}

// ---------------- Tools ----------------
const TOOLS = {};

TOOLS.search = (S, a) => {
  const q = str(a.query).toLowerCase();
  if (q.length < 2) return { error: 'Give at least two letters to search for.' };
  const words = q.split(/\s+/).filter(Boolean);
  const hit = text => words.every(w => text.toLowerCase().includes(w));
  return {
    clients: S.clients.filter(c => hit(c.name + ' ' + c.sector + ' ' + c.contact)).slice(0, 6).map(c => ({ client_id: c.client_id, name: c.name, status: c.status, account_lead: c.account_lead })),
    projects: S.projects.filter(p => hit(projectLabel(S, p) + ' ' + p.type)).slice(0, 8).map(p => ({ project_id: p.project_id, name: p.name, client: (S.client[p.client_id] || {}).name, status: p.status, lead: p.lead, due: p.due || null })),
    people: S.team.filter(p => hit(p.name + ' ' + p.role + ' ' + p.team)).slice(0, 6).map(p => ({ person_id: p.person_id, name: p.name, role: p.role, team: p.team })),
    tasks: S.tasks.filter(t => hit(t.title)).slice(0, 8).map(t => taskView(S, t))
  };
};

TOOLS.client_overview = (S, a) => {
  const r = findClient(S, a.client); if (r.error) return r;
  const c = r.item;
  const ps = S.projects.filter(p => p.client_id === c.client_id);
  const open = S.tasks.filter(t => isOpen(t) && ps.some(p => p.project_id === t.project_id)).map(t => taskView(S, t)).sort(byDue);
  const overdue = open.filter(t => t.overdue_days);
  const recent = S.time.filter(e => ps.some(p => p.project_id === e.project_id)).sort((x, y) => x.date < y.date ? 1 : -1).slice(0, 6).map(e => ({ date: e.date, person: e.person, hours: e.hours, project: S.project[e.project_id].name, note: e.note }));
  const flags = [];
  const ret = c.retainer_hours ? retainerUse(S, c) : null;
  if (ret && ret.over) flags.push('Retainer is over by ' + r1(ret.used_hours - ret.retainer_hours) + ' hours this month.');
  if (overdue.length) flags.push(overdue.length + ' overdue task' + (overdue.length > 1 ? 's' : '') + '.');
  for (const p of ps.filter(p => p.status === 'active' && p.budget_hours)) { const used = hoursOn(S, p.project_id); if (used >= p.budget_hours * 0.9) flags.push(p.name + ' has used ' + Math.round(used / p.budget_hours * 100) + '% of its hours.'); }
  return {
    client: c.name, client_id: c.client_id, sector: c.sector, status: c.status, contact: c.contact, account_lead: c.account_lead, client_since: c.since,
    retainer: ret,
    projects: ps.map(p => ({ project_id: p.project_id, name: p.name, status: p.status, lead: p.lead, due: p.due || null, hours_used: hoursOn(S, p.project_id), budget_hours: p.budget_hours || null, open_tasks: S.tasks.filter(t => t.project_id === p.project_id && isOpen(t)).length })),
    open_tasks: open.slice(0, 12), overdue_count: overdue.length, recent_time: recent, flags
  };
};

TOOLS.project_status = (S, a) => {
  const r = findProject(S, a.project); if (r.error) return r;
  const p = r.item;
  const used = hoursOn(S, p.project_id);
  const tasks = S.tasks.filter(t => t.project_id === p.project_id);
  const open = tasks.filter(isOpen).map(t => taskView(S, t)).sort(byDue);
  const last14 = S.today.minus({ days: 14 }).toISODate();
  const people = {};
  for (const e of S.time.filter(e => e.project_id === p.project_id && e.date >= last14)) people[e.person] = r2((people[e.person] || 0) + e.hours);
  const lastEntry = S.time.filter(e => e.project_id === p.project_id).map(e => e.date).sort().pop() || null;
  const flags = [];
  const daysLeft = p.due ? daysBetween(S.todayIso, p.due) : null;
  if (p.budget_hours && used > p.budget_hours) flags.push('Over budget: ' + r1(used) + ' of ' + p.budget_hours + ' hours (' + Math.round(used / p.budget_hours * 100) + '%).');
  else if (p.budget_hours && used >= p.budget_hours * 0.9) flags.push('Nearly out of hours: ' + Math.round(used / p.budget_hours * 100) + '% used.');
  const od = open.filter(t => t.overdue_days);
  if (od.length) flags.push(od.length + ' overdue task' + (od.length > 1 ? 's' : '') + '.');
  if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && open.length) flags.push('Due in ' + daysLeft + ' days with ' + open.length + ' tasks still open.');
  if (daysLeft !== null && daysLeft < 0 && p.status === 'active') flags.push('Past its due date by ' + -daysLeft + ' days.');
  if (p.status === 'active' && lastEntry && daysBetween(lastEntry, S.todayIso) > 10) flags.push('No time logged for ' + daysBetween(lastEntry, S.todayIso) + ' days.');
  return {
    project_id: p.project_id, project: p.name, client: (S.client[p.client_id] || {}).name, type: p.type, billing: p.billing, status: p.status, lead: p.lead,
    start: p.start || null, due: p.due || null, days_left: daysLeft,
    hours: { used: r1(used), budget: p.budget_hours || null, used_pct: p.budget_hours ? Math.round(used / p.budget_hours * 100) : null, last_14_days: r1(Object.values(people).reduce((x, y) => x + y, 0)) },
    tasks: { open: open.length, done: tasks.length - open.length, overdue: od.length },
    open_tasks: open.slice(0, 15),
    who_worked_last_14_days: Object.entries(people).sort((x, y) => y[1] - x[1]).map(([person, hours]) => ({ person, hours })),
    last_time_logged: lastEntry, flags, health: flags.length >= 2 ? 'at risk' : (flags.length ? 'watch' : 'on track')
  };
};

TOOLS.list_tasks = (S, a) => {
  let list = S.tasks.slice(), filters = [];
  if (str(a.assignee)) { const r = findPerson(S, a.assignee); if (r.error) return r; list = list.filter(t => t.assignee === r.item.name); filters.push('assignee ' + r.item.name); }
  if (str(a.project)) {
    const r = findProject(S, a.project);
    if (r.error) { const c = findClient(S, a.project); if (c.error) return r; const ids = S.projects.filter(p => p.client_id === c.item.client_id).map(p => p.project_id); list = list.filter(t => ids.includes(t.project_id)); filters.push('client ' + c.item.name); }
    else { list = list.filter(t => t.project_id === r.item.project_id); filters.push('project ' + r.item.name); }
  }
  const st = str(a.status || 'open').toLowerCase();
  if (st === 'open') list = list.filter(isOpen);
  else if (st === 'overdue') list = list.filter(t => isOpen(t) && t.due && t.due < S.todayIso);
  else if (st !== 'all') list = list.filter(t => t.status === st);
  filters.push('status ' + st);
  const within = Number(a.due_within_days) || 0;
  if (within > 0) { const until = S.today.plus({ days: within }).toISODate(); list = list.filter(t => t.due && t.due <= until); filters.push('due within ' + within + ' days'); }
  const out = list.map(t => taskView(S, t)).sort((x, y) => (y.overdue_days || 0) - (x.overdue_days || 0) || byDue(x, y));
  return { filters, count: out.length, overdue: out.filter(t => t.overdue_days).length, tasks: out.slice(0, 40), more: out.length > 40 ? out.length - 40 : 0 };
};

TOOLS.my_week = (S, a) => {
  const r = findPerson(S, a.person); if (r.error) return r;
  const p = r.item;
  const offset = /last|prev/i.test(str(a.week)) ? -1 : 0;
  const ws = weekStart(S.today, offset), we = ws.plus({ days: 6 });
  const entries = S.time.filter(e => e.person === p.name && e.date >= ws.toISODate() && e.date <= we.toISODate());
  const days = [];
  for (let d = ws; d <= we; d = d.plus({ days: 1 })) { const h = r2(entries.filter(e => e.date === d.toISODate()).reduce((x, e) => x + e.hours, 0)); if (d.weekday <= 5 || h) days.push({ date: d.toISODate(), day: d.toFormat('ccc'), hours: h }); }
  const byProject = {};
  for (const e of entries) { const k = projectLabel(S, S.project[e.project_id] || {}); byProject[k] = r2((byProject[k] || 0) + e.hours); }
  const total = r2(entries.reduce((x, e) => x + e.hours, 0));
  const billable = r2(entries.filter(e => yes(e.billable)).reduce((x, e) => x + e.hours, 0));
  const workdaysSoFar = offset ? 5 : Math.min(5, Math.max(0, S.today.weekday - 1));
  const mine = S.tasks.filter(t => t.assignee === p.name && isOpen(t)).map(t => taskView(S, t)).sort(byDue);
  return {
    person: p.name, role: p.role, week: (offset ? 'last week' : 'this week') + ' (' + ws.toFormat('d LLL') + ' to ' + ws.plus({ days: 4 }).toFormat('d LLL') + ')',
    hours_logged: total, billable_hours: billable, capacity: p.weekly_hours,
    expected_by_now: offset ? p.weekly_hours : r1(p.weekly_hours / 5 * workdaysSoFar),
    note: offset ? '' : 'Today isn\'t counted until it\'s logged.',
    days, by_project: Object.entries(byProject).sort((x, y) => y[1] - x[1]).map(([project, hours]) => ({ project, hours })),
    overdue_tasks: mine.filter(t => t.overdue_days),
    due_this_week: mine.filter(t => !t.overdue_days && t.due && t.due <= we.toISODate())
  };
};

TOOLS.team_capacity = (S, a) => {
  const ws = weekStart(S.today, 0).toISODate();
  const workdaysSoFar = Math.min(5, Math.max(0, S.today.weekday - 1));
  const next7 = S.today.plus({ days: 7 }).toISODate();
  let people = S.team.filter(p => yes(p.active));
  if (str(a.team)) { people = people.filter(p => p.team.toLowerCase().startsWith(str(a.team).toLowerCase())); if (!people.length) return { error: 'No team called "' + a.team + '". Teams: ' + [...new Set(S.team.map(p => p.team))].join(', ') + '.' }; }
  const rows = people.map(p => {
    const logged = r2(S.time.filter(e => e.person === p.name && e.date >= ws).reduce((x, e) => x + e.hours, 0));
    const expected = r1(p.weekly_hours / 5 * workdaysSoFar);
    const due = S.tasks.filter(t => t.assignee === p.name && isOpen(t) && t.due && t.due <= next7).length;
    const overdue = S.tasks.filter(t => t.assignee === p.name && isOpen(t) && t.due && t.due < S.todayIso).length;
    const pace = expected ? logged / expected : 0;
    const status = pace > 1.15 || due >= 6 ? 'overloaded' : (pace < 0.75 && due <= 2 ? 'has room' : 'busy');
    return { person: p.name, role: p.role, team: p.team, logged_this_week: logged, expected_by_now: expected, weekly_hours: p.weekly_hours, tasks_due_next_7_days: due, overdue_tasks: overdue, status };
  });
  const order = { 'has room': 0, busy: 1, overloaded: 2 };
  return { week_of: S.today.startOf('week').toFormat('d LLLL'), workdays_counted: workdaysSoFar, how_status_works: 'has room = logged under 75% of expected hours and at most 2 tasks due in 7 days; overloaded = over 115% of expected hours or 6+ tasks due', people: rows.sort((x, y) => order[x.status] - order[y.status] || x.logged_this_week - y.logged_this_week) };
};

TOOLS.log_time = (S, a, server) => {
  const pr = findPerson(S, a.person); if (pr.error) return pr;
  const pj = findProject(S, a.project); if (pj.error) return pj;
  const p = pr.item, proj = pj.item;
  const hours = Number(a.hours);
  const date = str(a.date) ? DateTime.fromISO(str(a.date).slice(0, 10), { zone: TZ }) : S.today;
  if (!date.isValid) return { error: 'The date must look like 2026-10-21.' };
  if (proj.status !== 'active') return { error: proj.name + ' is ' + proj.status.replace('_', ' ') + ', so time can\'t be logged to it. Ask ' + (proj.lead || 'the project lead') + ' if it should be reopened.' };
  if (!(hours > 0) || hours > 12 || Math.round(hours * 4) !== hours * 4) return { error: 'Hours must be between 0.25 and 12, in quarter hours.' };
  if (date > S.today) return { error: 'You can\'t log time for a future date.' };
  if (date < S.today.minus({ days: Number(S.s.lock_days) || 30 })) return { error: 'Timesheets older than ' + (Number(S.s.lock_days) || 30) + ' days are locked. Ask Ruth Adams.' };
  const already = r2(S.time.filter(e => e.person === p.name && e.date === date.toISODate()).reduce((x, e) => x + e.hours, 0));
  const max = Number(S.s.max_day_hours) || 12;
  if (already + hours > max) return { error: p.name + ' already has ' + already + ' hours on ' + date.toISODate() + '; adding ' + hours + ' would go over ' + max + ' in a day.' };
  let task = null;
  if (str(a.task_id)) { task = S.tasks.find(t => t.task_id === str(a.task_id).toUpperCase()); if (!task || task.project_id !== proj.project_id) return { error: 'Task ' + a.task_id + ' isn\'t part of ' + proj.name + '.' }; }
  const billable = proj.billing === 'internal' ? false : (a.billable === undefined || a.billable === '' ? true : yes(a.billable));
  const entry = { entry_id: 'E-' + nowDt().toFormat('yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10), date: date.toISODate(), person: p.name, project_id: proj.project_id, task_id: task ? task.task_id : '', hours, billable: billable ? 'yes' : 'no', note: str(a.note).slice(0, 300), logged_at: nowIso(), source: 'mcp:' + server, invoice_id: '' };
  const used = hoursOn(S, proj.project_id) + hours;
  return { write: { kind: 'time', rows: [entry] }, answer: {
    saved: true, entry_id: entry.entry_id, person: p.name, date: entry.date, hours, project: projectLabel(S, proj), task: task ? task.title : null, billable,
    day_total: r2(already + hours), project_hours_used: r1(used), project_budget: proj.budget_hours || null,
    warning: proj.budget_hours && used > proj.budget_hours ? 'This project is now over budget (' + Math.round(used / proj.budget_hours * 100) + '%).' : null } };
};

TOOLS.create_task = (S, a) => {
  const pj = findProject(S, a.project); if (pj.error) return pj;
  const proj = pj.item;
  if (proj.status === 'done') return { error: proj.name + ' is finished; tasks can\'t be added.' };
  const title = str(a.title);
  if (title.length < 3 || title.length > 140) return { error: 'The task title must be 3 to 140 characters.' };
  let assignee = '';
  if (str(a.assignee)) { const r = findPerson(S, a.assignee); if (r.error) return r; assignee = r.item.name; }
  let due = '';
  if (str(a.due)) { const d = DateTime.fromISO(str(a.due).slice(0, 10), { zone: TZ }); if (!d.isValid) return { error: 'The due date must look like 2026-11-03.' }; if (d < S.today) return { error: 'The due date is in the past.' }; due = d.toISODate(); }
  const priority = ['low', 'normal', 'high'].includes(str(a.priority).toLowerCase()) ? str(a.priority).toLowerCase() : 'normal';
  const next = Math.max(1000, ...S.tasks.map(t => Number(String(t.task_id).replace(/\D/g, '')) || 0)) + 1;
  const row = { task_id: 'T-' + next, project_id: proj.project_id, title, assignee, status: 'todo', priority, due, created_at: nowIso(), updated_at: nowIso() };
  return { write: { kind: 'task_new', rows: [row] }, answer: { created: true, task_id: row.task_id, title, project: projectLabel(S, proj), assignee: assignee || 'unassigned', due: due || null, priority, warning: proj.status === 'on_hold' ? 'Note: this project is on hold.' : null } };
};

TOOLS.update_task = (S, a) => {
  const t = S.tasks.find(x => x.task_id === str(a.task_id).toUpperCase());
  if (!t) return { error: 'No task ' + a.task_id + '. Use list_tasks or search to find the ID.' };
  const ch = { task_id: t.task_id }, said = [];
  if (str(a.status)) { const st = str(a.status).toLowerCase().replace(/^in progress$/, 'doing').replace(/^complete(d)?$/, 'done'); if (!['todo', 'doing', 'review', 'done'].includes(st)) return { error: 'Status must be todo, doing, review or done.' }; ch.status = st; said.push('status ' + t.status + ' → ' + st); }
  if (str(a.assignee)) { const r = findPerson(S, a.assignee); if (r.error) return r; ch.assignee = r.item.name; said.push('assignee ' + (t.assignee || 'none') + ' → ' + r.item.name); }
  if (str(a.due)) { const d = DateTime.fromISO(str(a.due).slice(0, 10), { zone: TZ }); if (!d.isValid) return { error: 'The due date must look like 2026-11-03.' }; ch.due = d.toISODate(); said.push('due ' + (t.due || 'none') + ' → ' + ch.due); }
  if (!said.length) return { error: 'Nothing to change: give a status, assignee or due date.' };
  ch.updated_at = nowIso();
  return { write: { kind: 'task_update', rows: [ch] }, answer: { updated: true, task_id: t.task_id, title: t.title, project: projectLabel(S, S.project[t.project_id] || {}), changes: said } };
};

// ---------------- Finance tools ----------------
const rateOf = (S, name) => (S.person[name] || {}).bill_rate || Number(S.s.default_rate) || 95;
function unbilled(S, c, from, to) {
  const ps = S.projects.filter(p => p.client_id === c.client_id && p.billing === 'hourly').map(p => p.project_id);
  return S.time.filter(e => ps.includes(e.project_id) && yes(e.billable) && !str(e.invoice_id) && (!from || e.date >= from) && (!to || e.date <= to));
}
function invoiceView(S, i) {
  let status = i.status;
  const overdueDays = i.status === 'sent' && i.due_date && str(i.due_date).slice(0, 10) < S.todayIso ? daysBetween(str(i.due_date).slice(0, 10), S.todayIso) : 0;
  if (overdueDays) status = 'overdue';
  return { invoice_id: i.invoice_id, client: (S.client[i.client_id] || {}).name, project: (S.project[i.project_id] || {}).name || null, period: i.period, issued: str(i.issue_date).slice(0, 10), due: str(i.due_date).slice(0, 10), amount_ex_vat: i.amount, total_inc_vat: r2(i.amount + i.vat), status, days_overdue: overdueDays || null, paid: str(i.paid_date).slice(0, 10) || null };
}

TOOLS.client_finances = (S, a) => {
  const r = findClient(S, a.client); if (r.error) return r;
  const c = r.item;
  const ret = c.retainer_hours ? retainerUse(S, c) : null;
  if (ret) { ret.fee = c.retainer_fee; ret.overage_value = ret.over ? r2((ret.used_hours - ret.retainer_hours) * (Number(S.s.default_rate) || 95)) : 0; }
  const ub = unbilled(S, c);
  const invs = S.invoices.filter(i => i.client_id === c.client_id).map(i => invoiceView(S, i));
  const outstanding = invs.filter(i => i.status === 'sent' || i.status === 'overdue');
  return {
    client: c.name, currency: 'GBP', retainer: ret,
    unbilled_hourly_work: { hours: r2(ub.reduce((x, e) => x + e.hours, 0)), value: r2(ub.reduce((x, e) => x + e.hours * rateOf(S, e.person), 0)), from: ub.map(e => e.date).sort()[0] || null },
    outstanding: { count: outstanding.length, total_inc_vat: r2(outstanding.reduce((x, i) => x + i.total_inc_vat, 0)), invoices: outstanding },
    billed_last_12_months_ex_vat: r2(S.invoices.filter(i => i.client_id === c.client_id && str(i.issue_date) >= S.today.minus({ months: 12 }).toISODate()).reduce((x, i) => x + i.amount, 0)),
    fixed_fee_projects: S.projects.filter(p => p.client_id === c.client_id && p.billing === 'fixed').map(p => ({ project: p.name, fee: p.fee, invoiced_ex_vat: r2(S.invoices.filter(i => i.project_id === p.project_id).reduce((x, i) => x + i.amount, 0)), status: p.status }))
  };
};

TOOLS.invoices = (S, a) => {
  let list = S.invoices.map(i => invoiceView(S, i));
  const st = str(a.status || 'unpaid').toLowerCase();
  if (st === 'unpaid') list = list.filter(i => i.status === 'sent' || i.status === 'overdue');
  else if (st !== 'all') list = list.filter(i => i.status === st);
  if (str(a.client)) { const r = findClient(S, a.client); if (r.error) return r; list = list.filter(i => i.client === r.item.name); }
  list.sort((x, y) => (y.days_overdue || 0) - (x.days_overdue || 0) || (x.due < y.due ? -1 : 1));
  return { status: st, count: list.length, total_inc_vat: r2(list.reduce((x, i) => x + i.total_inc_vat, 0)), overdue_total_inc_vat: r2(list.filter(i => i.status === 'overdue').reduce((x, i) => x + i.total_inc_vat, 0)), currency: 'GBP', invoices: list.slice(0, 40) };
};

TOOLS.profitability = (S, a) => {
  let projects;
  let label;
  if (str(a.project)) { const r = findProject(S, a.project); if (r.error) return r; projects = [r.item]; label = projectLabel(S, r.item); }
  else if (str(a.client)) { const r = findClient(S, a.client); if (r.error) return r; projects = S.projects.filter(p => p.client_id === r.item.client_id); label = r.item.name; }
  else return { error: 'Say which project or client.' };
  const rows = projects.filter(p => p.billing !== 'internal').map(p => {
    const es = S.time.filter(e => e.project_id === p.project_id);
    const hours = r2(es.reduce((x, e) => x + e.hours, 0));
    const cost = r2(es.reduce((x, e) => x + e.hours * ((S.person[e.person] || {}).cost_rate || 0), 0));
    let value, basis;
    if (p.billing === 'fixed') { value = p.fee; basis = 'fixed fee'; }
    else if (p.billing === 'hourly') { value = r2(es.filter(e => yes(e.billable)).reduce((x, e) => x + e.hours * rateOf(S, e.person), 0)); basis = 'billable hours × rates'; }
    else { const months = new Set(S.invoices.filter(i => i.project_id === p.project_id).map(i => i.period)).size; value = r2(S.invoices.filter(i => i.project_id === p.project_id).reduce((x, i) => x + i.amount, 0)); basis = 'retainer invoices (' + months + ' months)'; }
    const margin = r2(value - cost);
    return { project: p.name, status: p.status, billing: p.billing, value, value_basis: basis, hours, cost_of_time: cost, margin, margin_pct: value ? Math.round(margin / value * 100) : null, effective_hourly_rate: hours ? r2(value / hours) : null, budget_hours: p.budget_hours || null, budget_used_pct: p.budget_hours ? Math.round(hours / p.budget_hours * 100) : null };
  });
  const tv = r2(rows.reduce((x, y) => x + y.value, 0)), tc = r2(rows.reduce((x, y) => x + y.cost_of_time, 0)), th = r2(rows.reduce((x, y) => x + y.hours, 0));
  return { for: label, currency: 'GBP', note: 'Cost of time = hours × each person\'s internal cost rate. Fixed-fee value is the whole fee, even if not all invoiced yet.', total: { value: tv, cost_of_time: tc, margin: r2(tv - tc), margin_pct: tv ? Math.round((tv - tc) / tv * 100) : null, hours: th, effective_hourly_rate: th ? r2(tv / th) : null }, projects: rows };
};

TOOLS.draft_invoice = (S, a) => {
  const r = findClient(S, a.client); if (r.error) return r;
  const c = r.item;
  const m = str(a.month) ? DateTime.fromISO(str(a.month).slice(0, 7) + '-01', { zone: TZ }) : S.today.minus({ months: 1 });
  if (!m.isValid) return { error: 'The month must look like 2026-09.' };
  if (m.startOf('month') > S.today) return { error: 'That month hasn\'t started yet.' };
  const [from, to] = monthRange(m);
  const entries = unbilled(S, c, from, to);
  const lines = [];
  const groups = {};
  for (const e of entries) { const k = e.project_id + '|' + e.person; groups[k] = groups[k] || { project: S.project[e.project_id].name, person: e.person, role: (S.person[e.person] || {}).role, hours: 0, rate: rateOf(S, e.person), ids: [] }; groups[k].hours = r2(groups[k].hours + e.hours); groups[k].ids.push(e.entry_id); }
  for (const g of Object.values(groups)) lines.push({ description: g.project + ': ' + g.role + ' (' + g.person + ')', hours: g.hours, rate: g.rate, amount: r2(g.hours * g.rate) });
  if (c.retainer_hours) {
    const ret = retainerUse(S, c, m);
    const already = S.invoices.some(i => i.client_id === c.client_id && i.project_id && S.project[i.project_id] && S.project[i.project_id].billing === 'retainer' && str(i.period).toLowerCase() === m.toFormat('LLLL').toLowerCase());
    if (!already) lines.push({ description: 'Retainer, ' + m.toFormat('LLLL yyyy') + ' (' + c.retainer_hours + ' hours)', hours: null, rate: null, amount: c.retainer_fee });
    if (ret.over && m.endOf('month') < S.today) lines.push({ description: 'Retainer overage, ' + r1(ret.used_hours - ret.retainer_hours) + ' hours', hours: r1(ret.used_hours - ret.retainer_hours), rate: Number(S.s.default_rate) || 95, amount: r2((ret.used_hours - ret.retainer_hours) * (Number(S.s.default_rate) || 95)) });
  }
  if (!lines.length) return { error: 'Nothing to invoice for ' + c.name + ' in ' + m.toFormat('LLLL yyyy') + ': no unbilled hourly time' + (c.retainer_hours ? ' and the retainer is already invoiced' : '') + '. Fixed-fee projects are invoiced by milestone.' };
  const net = r2(lines.reduce((x, l) => x + l.amount, 0)), vat = r2(net * (Number(S.s.vat_rate === '' ? 0.2 : S.s.vat_rate)));
  const next = Math.max(2000, ...S.invoices.map(i => Number(String(i.invoice_id).replace(/\D/g, '')) || 0)) + 1;
  const preview = { client: c.name, period: m.toFormat('LLLL yyyy'), currency: 'GBP', lines, net, vat, total: r2(net + vat), time_entries: entries.length };
  if (!yes(a.confirm)) return { answer: Object.assign({ preview: true, next_step: 'Nothing has been saved. Check the lines with the user, then call draft_invoice again with confirm=true to create draft ' + 'INV-' + next + '.' }, preview) };
  const id = 'INV-' + next;
  const row = { invoice_id: id, client_id: c.client_id, project_id: entries[0] ? entries[0].project_id : '', period: m.toFormat('LLLL') + ' (draft)', issue_date: S.todayIso, due_date: S.today.plus({ days: Number(S.s.payment_days) || 30 }).toISODate(), amount: net, vat, status: 'draft', paid_date: '', lines_json: JSON.stringify(lines) };
  return { write: { kind: 'invoice', rows: [row], time_updates: entries.map(e => ({ entry_id: e.entry_id, invoice_id: id })) }, answer: Object.assign({ created: true, invoice_id: id, status: 'draft', note: 'Saved as a draft in the Invoices tab; ' + entries.length + ' time entries are now marked as billed. Ruth sends invoices after checking them.' }, preview) };
};

const FINANCE_TOOLS = ['client_finances', 'invoices', 'profitability', 'draft_invoice'];
const WRITE_TOOLS = ['log_time', 'create_task', 'update_task', 'draft_invoice'];
// ---- end lib-bms.js ----
