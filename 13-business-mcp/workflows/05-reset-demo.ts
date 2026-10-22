import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Reset the Demo', position: [200, 300] },
  output: [{}]
});

const seed = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Demo Data', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Builds Brindle Studio\'s demo data with dates relative to today: the team, clients, projects, tasks,\n' +
          '// invoices, and eight weeks of timesheets (made with a fixed random seed, so a reset gives the same\n' +
          '// numbers on the same day). Project budgets are set from the hours logged, so some projects are on\n' +
          '// track and one is over budget.\n' +
          '// ---- lib-bms.js (included by build.py): Brindle Studio data helpers and every MCP tool ----\n' +
          'const TZ = \'Europe/London\';\n' +
          'const COLUMNS = {"Settings": ["key", "value", "note"], "Team": ["person_id", "name", "role", "team", "email", "is_manager", "weekly_hours", "cost_rate", "bill_rate", "active"], "Clients": ["client_id", "name", "sector", "contact", "contact_email", "account_lead", "retainer_hours", "retainer_fee", "status", "since"], "Projects": ["project_id", "client_id", "name", "type", "billing", "status", "lead", "start", "due", "budget_hours", "fee"], "Tasks": ["task_id", "project_id", "title", "assignee", "status", "priority", "due", "created_at", "updated_at"], "Time": ["entry_id", "date", "person", "project_id", "task_id", "hours", "billable", "note", "logged_at", "source", "invoice_id"], "Invoices": ["invoice_id", "client_id", "project_id", "period", "issue_date", "due_date", "amount", "vat", "status", "paid_date", "lines_json"], "Audit": ["at", "server", "tool", "args_json", "ok", "summary", "ms"]};\n' +
          'const nowDt = () => DateTime.now().setZone(TZ);\n' +
          'const isoOf = dt => dt.set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });\n' +
          'const nowIso = () => isoOf(nowDt());\n' +
          'const r2 = n => Math.round((Number(n) || 0) * 100) / 100;\n' +
          'const r1 = n => Math.round((Number(n) || 0) * 10) / 10;\n' +
          'const gbp = n => \'£\' + r2(n).toLocaleString(\'en-GB\', { minimumFractionDigits: 0, maximumFractionDigits: 2 });\n' +
          'const parseJson = (s, d) => { try { return typeof s === \'string\' ? (s.trim() ? JSON.parse(s) : d) : (s === null || s === undefined ? d : s); } catch (e) { return d; } };\n' +
          'const yes = v => v === true || /^(true|yes|1|y)$/i.test(String(v).trim());\n' +
          'const str = v => String(v === null || v === undefined ? \'\' : v).trim();\n' +
          '\n' +
          'function tablesOf(res) {\n' +
          '  const out = {};\n' +
          '  for (const vr of (res && res.valueRanges) || []) {\n' +
          '    const name = String(vr.range || \'\').split(\'!\')[0].replace(/^\'|\'$/g, \'\').replace(/\'\'/g, "\'");\n' +
          '    const rows = vr.values || [];\n' +
          '    const head = (rows[0] || []).map(h => String(h).trim());\n' +
          '    out[name] = rows.slice(1).map((r, i) => {\n' +
          '      const o = { _row: i + 2 };\n' +
          '      head.forEach((h, j) => { if (h) o[h] = r[j] === undefined || r[j] === null ? \'\' : r[j]; });\n' +
          '      return o;\n' +
          '    }).filter(o => Object.keys(o).some(k => k !== \'_row\' && o[k] !== \'\'));\n' +
          '  }\n' +
          '  return out;\n' +
          '}\n' +
          'const settingsOf = rows => Object.fromEntries((rows || []).filter(r => r.key).map(r => [String(r.key).trim(), r.value === undefined ? \'\' : r.value]));\n' +
          '\n' +
          '// Everything the tools need, with lookups\n' +
          'function studio(T) {\n' +
          '  const s = settingsOf(T.Settings);\n' +
          '  const today = nowDt().startOf(\'day\');\n' +
          '  const team = (T.Team || []).map(p => Object.assign({}, p, { weekly_hours: Number(p.weekly_hours) || 0, cost_rate: Number(p.cost_rate) || 0, bill_rate: Number(p.bill_rate) || 0 }));\n' +
          '  const clients = (T.Clients || []).map(c => Object.assign({}, c, { retainer_hours: Number(c.retainer_hours) || 0, retainer_fee: Number(c.retainer_fee) || 0 }));\n' +
          '  const projects = (T.Projects || []).map(p => Object.assign({}, p, { budget_hours: Number(p.budget_hours) || 0, fee: Number(p.fee) || 0, start: str(p.start).slice(0, 10), due: str(p.due).slice(0, 10) }));\n' +
          '  const time = (T.Time || []).map(e => Object.assign({}, e, { hours: Number(e.hours) || 0, date: str(e.date).slice(0, 10) }));\n' +
          '  const tasks = (T.Tasks || []).map(t => Object.assign({}, t, { due: str(t.due).slice(0, 10) }));\n' +
          '  const invoices = (T.Invoices || []).map(i => Object.assign({}, i, { amount: Number(i.amount) || 0, vat: Number(i.vat) || 0 }));\n' +
          '  const byId = (list, key) => Object.fromEntries(list.map(x => [x[key], x]));\n' +
          '  return { s, today, todayIso: today.toISODate(), team, clients, projects, time, tasks, invoices,\n' +
          '    client: byId(clients, \'client_id\'), project: byId(projects, \'project_id\'), person: Object.fromEntries(team.map(p => [p.name, p])) };\n' +
          '}\n' +
          '\n' +
          '// Finds one thing by ID or name: exact, then starts-with, then all words; says when it\'s ambiguous\n' +
          'function resolve(list, q, label, fields) {\n' +
          '  const want = str(q).toLowerCase();\n' +
          '  if (!want) return { error: \'Say which \' + label + \'.\' };\n' +
          '  const names = x => fields.map(f => str(x[f]).toLowerCase());\n' +
          '  let hit = list.filter(x => names(x).some(n => n === want));\n' +
          '  if (!hit.length) hit = list.filter(x => names(x).some(n => n.startsWith(want)));\n' +
          '  if (!hit.length) { const words = want.split(/\\s+/).filter(w => w.length > 1); hit = list.filter(x => words.every(w => names(x).join(\' \').includes(w))); }\n' +
          '  if (hit.length === 1) return { item: hit[0] };\n' +
          '  if (hit.length > 1) return { error: \'More than one \' + label + \' matches "\' + q + \'": \' + hit.slice(0, 6).map(x => str(x[fields[1] || fields[0]])).join(\', \') + \'. Say which one.\' };\n' +
          '  return { error: \'No \' + label + \' matches "\' + q + \'". Try the search tool.\' };\n' +
          '}\n' +
          'const findClient = (S, q) => resolve(S.clients, q, \'client\', [\'client_id\', \'name\']);\n' +
          'const findPerson = (S, q) => resolve(S.team.filter(p => yes(p.active)), q, \'person\', [\'person_id\', \'name\']);\n' +
          'function findProject(S, q) {\n' +
          '  const r = resolve(S.projects.map(p => Object.assign({}, p, { full: (S.client[p.client_id] ? S.client[p.client_id].name + \' \' : \'\') + p.name })), q, \'project\', [\'project_id\', \'name\', \'full\']);\n' +
          '  if (r.error && !/More than one/.test(r.error)) {\n' +
          '    const c = findClient(S, q); // a client with exactly one active project\n' +
          '    if (c.item) { const ps = S.projects.filter(p => p.client_id === c.item.client_id && p.status === \'active\'); if (ps.length === 1) return { item: ps[0] }; if (ps.length > 1) return { error: c.item.name + \' has \' + ps.length + \' active projects: \' + ps.map(p => p.name + \' (\' + p.project_id + \')\').join(\', \') + \'. Say which one.\' }; }\n' +
          '  }\n' +
          '  return r;\n' +
          '}\n' +
          '\n' +
          'const weekStart = (dt, offset) => dt.startOf(\'week\').plus({ weeks: offset || 0 });\n' +
          'const daysBetween = (a, b) => Math.round(DateTime.fromISO(b).diff(DateTime.fromISO(a), \'days\').days);\n' +
          'const isOpen = t => ![\'done\'].includes(str(t.status));\n' +
          'const projectLabel = (S, p) => (S.client[p.client_id] ? S.client[p.client_id].name + \': \' : \'\') + p.name;\n' +
          'function taskView(S, t) {\n' +
          '  const p = S.project[t.project_id] || {};\n' +
          '  const o = { task_id: t.task_id, title: t.title, project: projectLabel(S, p), assignee: t.assignee || \'unassigned\', status: t.status, priority: t.priority, due: t.due || null };\n' +
          '  if (t.due && isOpen(t) && t.due < S.todayIso) o.overdue_days = daysBetween(t.due, S.todayIso);\n' +
          '  return o;\n' +
          '}\n' +
          'const byDue = (a, b) => (a.due || \'9999\') < (b.due || \'9999\') ? -1 : 1;\n' +
          'function hoursOn(S, project_id, from, to) { return r2(S.time.filter(e => e.project_id === project_id && (!from || e.date >= from) && (!to || e.date <= to)).reduce((a, e) => a + e.hours, 0)); }\n' +
          'const monthRange = (dt) => [dt.startOf(\'month\').toISODate(), dt.endOf(\'month\').toISODate()];\n' +
          'function retainerUse(S, c, monthDt) {\n' +
          '  const [a, b] = monthRange(monthDt || S.today);\n' +
          '  const ps = S.projects.filter(p => p.client_id === c.client_id && p.billing === \'retainer\').map(p => p.project_id);\n' +
          '  const used = r2(S.time.filter(e => ps.includes(e.project_id) && e.date >= a && e.date <= b).reduce((x, e) => x + e.hours, 0));\n' +
          '  return { month: (monthDt || S.today).toFormat(\'LLLL yyyy\'), retainer_hours: c.retainer_hours, used_hours: used, left_hours: r2(c.retainer_hours - used), over: used > c.retainer_hours };\n' +
          '}\n' +
          '\n' +
          '// ---------------- Tools ----------------\n' +
          'const TOOLS = {};\n' +
          '\n' +
          'TOOLS.search = (S, a) => {\n' +
          '  const q = str(a.query).toLowerCase();\n' +
          '  if (q.length < 2) return { error: \'Give at least two letters to search for.\' };\n' +
          '  const words = q.split(/\\s+/).filter(Boolean);\n' +
          '  const hit = text => words.every(w => text.toLowerCase().includes(w));\n' +
          '  return {\n'
        ) +
        (
          '    clients: S.clients.filter(c => hit(c.name + \' \' + c.sector + \' \' + c.contact)).slice(0, 6).map(c => ({ client_id: c.client_id, name: c.name, status: c.status, account_lead: c.account_lead })),\n' +
          '    projects: S.projects.filter(p => hit(projectLabel(S, p) + \' \' + p.type)).slice(0, 8).map(p => ({ project_id: p.project_id, name: p.name, client: (S.client[p.client_id] || {}).name, status: p.status, lead: p.lead, due: p.due || null })),\n' +
          '    people: S.team.filter(p => hit(p.name + \' \' + p.role + \' \' + p.team)).slice(0, 6).map(p => ({ person_id: p.person_id, name: p.name, role: p.role, team: p.team })),\n' +
          '    tasks: S.tasks.filter(t => hit(t.title)).slice(0, 8).map(t => taskView(S, t))\n' +
          '  };\n' +
          '};\n' +
          '\n' +
          'TOOLS.client_overview = (S, a) => {\n' +
          '  const r = findClient(S, a.client); if (r.error) return r;\n' +
          '  const c = r.item;\n' +
          '  const ps = S.projects.filter(p => p.client_id === c.client_id);\n' +
          '  const open = S.tasks.filter(t => isOpen(t) && ps.some(p => p.project_id === t.project_id)).map(t => taskView(S, t)).sort(byDue);\n' +
          '  const overdue = open.filter(t => t.overdue_days);\n' +
          '  const recent = S.time.filter(e => ps.some(p => p.project_id === e.project_id)).sort((x, y) => x.date < y.date ? 1 : -1).slice(0, 6).map(e => ({ date: e.date, person: e.person, hours: e.hours, project: S.project[e.project_id].name, note: e.note }));\n' +
          '  const flags = [];\n' +
          '  const ret = c.retainer_hours ? retainerUse(S, c) : null;\n' +
          '  if (ret && ret.over) flags.push(\'Retainer is over by \' + r1(ret.used_hours - ret.retainer_hours) + \' hours this month.\');\n' +
          '  if (overdue.length) flags.push(overdue.length + \' overdue task\' + (overdue.length > 1 ? \'s\' : \'\') + \'.\');\n' +
          '  for (const p of ps.filter(p => p.status === \'active\' && p.budget_hours)) { const used = hoursOn(S, p.project_id); if (used >= p.budget_hours * 0.9) flags.push(p.name + \' has used \' + Math.round(used / p.budget_hours * 100) + \'% of its hours.\'); }\n' +
          '  return {\n' +
          '    client: c.name, client_id: c.client_id, sector: c.sector, status: c.status, contact: c.contact, account_lead: c.account_lead, client_since: c.since,\n' +
          '    retainer: ret,\n' +
          '    projects: ps.map(p => ({ project_id: p.project_id, name: p.name, status: p.status, lead: p.lead, due: p.due || null, hours_used: hoursOn(S, p.project_id), budget_hours: p.budget_hours || null, open_tasks: S.tasks.filter(t => t.project_id === p.project_id && isOpen(t)).length })),\n' +
          '    open_tasks: open.slice(0, 12), overdue_count: overdue.length, recent_time: recent, flags\n' +
          '  };\n' +
          '};\n' +
          '\n' +
          'TOOLS.project_status = (S, a) => {\n' +
          '  const r = findProject(S, a.project); if (r.error) return r;\n' +
          '  const p = r.item;\n' +
          '  const used = hoursOn(S, p.project_id);\n' +
          '  const tasks = S.tasks.filter(t => t.project_id === p.project_id);\n' +
          '  const open = tasks.filter(isOpen).map(t => taskView(S, t)).sort(byDue);\n' +
          '  const last14 = S.today.minus({ days: 14 }).toISODate();\n' +
          '  const people = {};\n' +
          '  for (const e of S.time.filter(e => e.project_id === p.project_id && e.date >= last14)) people[e.person] = r2((people[e.person] || 0) + e.hours);\n' +
          '  const lastEntry = S.time.filter(e => e.project_id === p.project_id).map(e => e.date).sort().pop() || null;\n' +
          '  const flags = [];\n' +
          '  const daysLeft = p.due ? daysBetween(S.todayIso, p.due) : null;\n' +
          '  if (p.budget_hours && used > p.budget_hours) flags.push(\'Over budget: \' + r1(used) + \' of \' + p.budget_hours + \' hours (\' + Math.round(used / p.budget_hours * 100) + \'%).\');\n' +
          '  else if (p.budget_hours && used >= p.budget_hours * 0.9) flags.push(\'Nearly out of hours: \' + Math.round(used / p.budget_hours * 100) + \'% used.\');\n' +
          '  const od = open.filter(t => t.overdue_days);\n' +
          '  if (od.length) flags.push(od.length + \' overdue task\' + (od.length > 1 ? \'s\' : \'\') + \'.\');\n' +
          '  if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && open.length) flags.push(\'Due in \' + daysLeft + \' days with \' + open.length + \' tasks still open.\');\n' +
          '  if (daysLeft !== null && daysLeft < 0 && p.status === \'active\') flags.push(\'Past its due date by \' + -daysLeft + \' days.\');\n' +
          '  if (p.status === \'active\' && lastEntry && daysBetween(lastEntry, S.todayIso) > 10) flags.push(\'No time logged for \' + daysBetween(lastEntry, S.todayIso) + \' days.\');\n' +
          '  return {\n' +
          '    project_id: p.project_id, project: p.name, client: (S.client[p.client_id] || {}).name, type: p.type, billing: p.billing, status: p.status, lead: p.lead,\n' +
          '    start: p.start || null, due: p.due || null, days_left: daysLeft,\n' +
          '    hours: { used: r1(used), budget: p.budget_hours || null, used_pct: p.budget_hours ? Math.round(used / p.budget_hours * 100) : null, last_14_days: r1(Object.values(people).reduce((x, y) => x + y, 0)) },\n' +
          '    tasks: { open: open.length, done: tasks.length - open.length, overdue: od.length },\n' +
          '    open_tasks: open.slice(0, 15),\n' +
          '    who_worked_last_14_days: Object.entries(people).sort((x, y) => y[1] - x[1]).map(([person, hours]) => ({ person, hours })),\n' +
          '    last_time_logged: lastEntry, flags, health: flags.length >= 2 ? \'at risk\' : (flags.length ? \'watch\' : \'on track\')\n' +
          '  };\n' +
          '};\n' +
          '\n' +
          'TOOLS.list_tasks = (S, a) => {\n' +
          '  let list = S.tasks.slice(), filters = [];\n' +
          '  if (str(a.assignee)) { const r = findPerson(S, a.assignee); if (r.error) return r; list = list.filter(t => t.assignee === r.item.name); filters.push(\'assignee \' + r.item.name); }\n' +
          '  if (str(a.project)) {\n' +
          '    const r = findProject(S, a.project);\n' +
          '    if (r.error) { const c = findClient(S, a.project); if (c.error) return r; const ids = S.projects.filter(p => p.client_id === c.item.client_id).map(p => p.project_id); list = list.filter(t => ids.includes(t.project_id)); filters.push(\'client \' + c.item.name); }\n' +
          '    else { list = list.filter(t => t.project_id === r.item.project_id); filters.push(\'project \' + r.item.name); }\n' +
          '  }\n' +
          '  const st = str(a.status || \'open\').toLowerCase();\n' +
          '  if (st === \'open\') list = list.filter(isOpen);\n' +
          '  else if (st === \'overdue\') list = list.filter(t => isOpen(t) && t.due && t.due < S.todayIso);\n' +
          '  else if (st !== \'all\') list = list.filter(t => t.status === st);\n' +
          '  filters.push(\'status \' + st);\n' +
          '  const within = Number(a.due_within_days) || 0;\n' +
          '  if (within > 0) { const until = S.today.plus({ days: within }).toISODate(); list = list.filter(t => t.due && t.due <= until); filters.push(\'due within \' + within + \' days\'); }\n' +
          '  const out = list.map(t => taskView(S, t)).sort((x, y) => (y.overdue_days || 0) - (x.overdue_days || 0) || byDue(x, y));\n' +
          '  return { filters, count: out.length, overdue: out.filter(t => t.overdue_days).length, tasks: out.slice(0, 40), more: out.length > 40 ? out.length - 40 : 0 };\n' +
          '};\n' +
          '\n' +
          'TOOLS.my_week = (S, a) => {\n' +
          '  const r = findPerson(S, a.person); if (r.error) return r;\n' +
          '  const p = r.item;\n' +
          '  const offset = /last|prev/i.test(str(a.week)) ? -1 : 0;\n' +
          '  const ws = weekStart(S.today, offset), we = ws.plus({ days: 6 });\n' +
          '  const entries = S.time.filter(e => e.person === p.name && e.date >= ws.toISODate() && e.date <= we.toISODate());\n' +
          '  const days = [];\n' +
          '  for (let d = ws; d <= we; d = d.plus({ days: 1 })) { const h = r2(entries.filter(e => e.date === d.toISODate()).reduce((x, e) => x + e.hours, 0)); if (d.weekday <= 5 || h) days.push({ date: d.toISODate(), day: d.toFormat(\'ccc\'), hours: h }); }\n' +
          '  const byProject = {};\n' +
          '  for (const e of entries) { const k = projectLabel(S, S.project[e.project_id] || {}); byProject[k] = r2((byProject[k] || 0) + e.hours); }\n' +
          '  const total = r2(entries.reduce((x, e) => x + e.hours, 0));\n' +
          '  const billable = r2(entries.filter(e => yes(e.billable)).reduce((x, e) => x + e.hours, 0));\n' +
          '  const workdaysSoFar = offset ? 5 : Math.min(5, Math.max(0, S.today.weekday - 1));\n' +
          '  const mine = S.tasks.filter(t => t.assignee === p.name && isOpen(t)).map(t => taskView(S, t)).sort(byDue);\n' +
          '  return {\n' +
          '    person: p.name, role: p.role, week: (offset ? \'last week\' : \'this week\') + \' (\' + ws.toFormat(\'d LLL\') + \' to \' + ws.plus({ days: 4 }).toFormat(\'d LLL\') + \')\',\n' +
          '    hours_logged: total, billable_hours: billable, capacity: p.weekly_hours,\n' +
          '    expected_by_now: offset ? p.weekly_hours : r1(p.weekly_hours / 5 * workdaysSoFar),\n' +
          '    note: offset ? \'\' : \'Today isn\\\'t counted until it\\\'s logged.\',\n' +
          '    days, by_project: Object.entries(byProject).sort((x, y) => y[1] - x[1]).map(([project, hours]) => ({ project, hours })),\n' +
          '    overdue_tasks: mine.filter(t => t.overdue_days),\n' +
          '    due_this_week: mine.filter(t => !t.overdue_days && t.due && t.due <= we.toISODate())\n' +
          '  };\n' +
          '};\n'
        ) +
        (
          '\n' +
          'TOOLS.team_capacity = (S, a) => {\n' +
          '  const ws = weekStart(S.today, 0).toISODate();\n' +
          '  const workdaysSoFar = Math.min(5, Math.max(0, S.today.weekday - 1));\n' +
          '  const next7 = S.today.plus({ days: 7 }).toISODate();\n' +
          '  let people = S.team.filter(p => yes(p.active));\n' +
          '  if (str(a.team)) { people = people.filter(p => p.team.toLowerCase().startsWith(str(a.team).toLowerCase())); if (!people.length) return { error: \'No team called "\' + a.team + \'". Teams: \' + [...new Set(S.team.map(p => p.team))].join(\', \') + \'.\' }; }\n' +
          '  const rows = people.map(p => {\n' +
          '    const logged = r2(S.time.filter(e => e.person === p.name && e.date >= ws).reduce((x, e) => x + e.hours, 0));\n' +
          '    const expected = r1(p.weekly_hours / 5 * workdaysSoFar);\n' +
          '    const due = S.tasks.filter(t => t.assignee === p.name && isOpen(t) && t.due && t.due <= next7).length;\n' +
          '    const overdue = S.tasks.filter(t => t.assignee === p.name && isOpen(t) && t.due && t.due < S.todayIso).length;\n' +
          '    const pace = expected ? logged / expected : 0;\n' +
          '    const status = pace > 1.15 || due >= 6 ? \'overloaded\' : (pace < 0.75 && due <= 2 ? \'has room\' : \'busy\');\n' +
          '    return { person: p.name, role: p.role, team: p.team, logged_this_week: logged, expected_by_now: expected, weekly_hours: p.weekly_hours, tasks_due_next_7_days: due, overdue_tasks: overdue, status };\n' +
          '  });\n' +
          '  const order = { \'has room\': 0, busy: 1, overloaded: 2 };\n' +
          '  return { week_of: S.today.startOf(\'week\').toFormat(\'d LLLL\'), workdays_counted: workdaysSoFar, how_status_works: \'has room = logged under 75% of expected hours and at most 2 tasks due in 7 days; overloaded = over 115% of expected hours or 6+ tasks due\', people: rows.sort((x, y) => order[x.status] - order[y.status] || x.logged_this_week - y.logged_this_week) };\n' +
          '};\n' +
          '\n' +
          'TOOLS.log_time = (S, a, server) => {\n' +
          '  const pr = findPerson(S, a.person); if (pr.error) return pr;\n' +
          '  const pj = findProject(S, a.project); if (pj.error) return pj;\n' +
          '  const p = pr.item, proj = pj.item;\n' +
          '  const hours = Number(a.hours);\n' +
          '  const date = str(a.date) ? DateTime.fromISO(str(a.date).slice(0, 10), { zone: TZ }) : S.today;\n' +
          '  if (!date.isValid) return { error: \'The date must look like 2026-10-21.\' };\n' +
          '  if (proj.status !== \'active\') return { error: proj.name + \' is \' + proj.status.replace(\'_\', \' \') + \', so time can\\\'t be logged to it. Ask \' + (proj.lead || \'the project lead\') + \' if it should be reopened.\' };\n' +
          '  if (!(hours > 0) || hours > 12 || Math.round(hours * 4) !== hours * 4) return { error: \'Hours must be between 0.25 and 12, in quarter hours.\' };\n' +
          '  if (date > S.today) return { error: \'You can\\\'t log time for a future date.\' };\n' +
          '  if (date < S.today.minus({ days: Number(S.s.lock_days) || 30 })) return { error: \'Timesheets older than \' + (Number(S.s.lock_days) || 30) + \' days are locked. Ask Ruth Adams.\' };\n' +
          '  const already = r2(S.time.filter(e => e.person === p.name && e.date === date.toISODate()).reduce((x, e) => x + e.hours, 0));\n' +
          '  const max = Number(S.s.max_day_hours) || 12;\n' +
          '  if (already + hours > max) return { error: p.name + \' already has \' + already + \' hours on \' + date.toISODate() + \'; adding \' + hours + \' would go over \' + max + \' in a day.\' };\n' +
          '  let task = null;\n' +
          '  if (str(a.task_id)) { task = S.tasks.find(t => t.task_id === str(a.task_id).toUpperCase()); if (!task || task.project_id !== proj.project_id) return { error: \'Task \' + a.task_id + \' isn\\\'t part of \' + proj.name + \'.\' }; }\n' +
          '  const billable = proj.billing === \'internal\' ? false : (a.billable === undefined || a.billable === \'\' ? true : yes(a.billable));\n' +
          '  const entry = { entry_id: \'E-\' + nowDt().toFormat(\'yyMMddHHmmss\') + Math.floor(Math.random() * 90 + 10), date: date.toISODate(), person: p.name, project_id: proj.project_id, task_id: task ? task.task_id : \'\', hours, billable: billable ? \'yes\' : \'no\', note: str(a.note).slice(0, 300), logged_at: nowIso(), source: \'mcp:\' + server, invoice_id: \'\' };\n' +
          '  const used = hoursOn(S, proj.project_id) + hours;\n' +
          '  return { write: { kind: \'time\', rows: [entry] }, answer: {\n' +
          '    saved: true, entry_id: entry.entry_id, person: p.name, date: entry.date, hours, project: projectLabel(S, proj), task: task ? task.title : null, billable,\n' +
          '    day_total: r2(already + hours), project_hours_used: r1(used), project_budget: proj.budget_hours || null,\n' +
          '    warning: proj.budget_hours && used > proj.budget_hours ? \'This project is now over budget (\' + Math.round(used / proj.budget_hours * 100) + \'%).\' : null } };\n' +
          '};\n' +
          '\n' +
          'TOOLS.create_task = (S, a) => {\n' +
          '  const pj = findProject(S, a.project); if (pj.error) return pj;\n' +
          '  const proj = pj.item;\n' +
          '  if (proj.status === \'done\') return { error: proj.name + \' is finished; tasks can\\\'t be added.\' };\n' +
          '  const title = str(a.title);\n' +
          '  if (title.length < 3 || title.length > 140) return { error: \'The task title must be 3 to 140 characters.\' };\n' +
          '  let assignee = \'\';\n' +
          '  if (str(a.assignee)) { const r = findPerson(S, a.assignee); if (r.error) return r; assignee = r.item.name; }\n' +
          '  let due = \'\';\n' +
          '  if (str(a.due)) { const d = DateTime.fromISO(str(a.due).slice(0, 10), { zone: TZ }); if (!d.isValid) return { error: \'The due date must look like 2026-11-03.\' }; if (d < S.today) return { error: \'The due date is in the past.\' }; due = d.toISODate(); }\n' +
          '  const priority = [\'low\', \'normal\', \'high\'].includes(str(a.priority).toLowerCase()) ? str(a.priority).toLowerCase() : \'normal\';\n' +
          '  const next = Math.max(1000, ...S.tasks.map(t => Number(String(t.task_id).replace(/\\D/g, \'\')) || 0)) + 1;\n' +
          '  const row = { task_id: \'T-\' + next, project_id: proj.project_id, title, assignee, status: \'todo\', priority, due, created_at: nowIso(), updated_at: nowIso() };\n' +
          '  return { write: { kind: \'task_new\', rows: [row] }, answer: { created: true, task_id: row.task_id, title, project: projectLabel(S, proj), assignee: assignee || \'unassigned\', due: due || null, priority, warning: proj.status === \'on_hold\' ? \'Note: this project is on hold.\' : null } };\n' +
          '};\n' +
          '\n' +
          'TOOLS.update_task = (S, a) => {\n' +
          '  const t = S.tasks.find(x => x.task_id === str(a.task_id).toUpperCase());\n' +
          '  if (!t) return { error: \'No task \' + a.task_id + \'. Use list_tasks or search to find the ID.\' };\n' +
          '  const ch = { task_id: t.task_id }, said = [];\n' +
          '  if (str(a.status)) { const st = str(a.status).toLowerCase().replace(/^in progress$/, \'doing\').replace(/^complete(d)?$/, \'done\'); if (![\'todo\', \'doing\', \'review\', \'done\'].includes(st)) return { error: \'Status must be todo, doing, review or done.\' }; ch.status = st; said.push(\'status \' + t.status + \' → \' + st); }\n' +
          '  if (str(a.assignee)) { const r = findPerson(S, a.assignee); if (r.error) return r; ch.assignee = r.item.name; said.push(\'assignee \' + (t.assignee || \'none\') + \' → \' + r.item.name); }\n' +
          '  if (str(a.due)) { const d = DateTime.fromISO(str(a.due).slice(0, 10), { zone: TZ }); if (!d.isValid) return { error: \'The due date must look like 2026-11-03.\' }; ch.due = d.toISODate(); said.push(\'due \' + (t.due || \'none\') + \' → \' + ch.due); }\n' +
          '  if (!said.length) return { error: \'Nothing to change: give a status, assignee or due date.\' };\n' +
          '  ch.updated_at = nowIso();\n' +
          '  return { write: { kind: \'task_update\', rows: [ch] }, answer: { updated: true, task_id: t.task_id, title: t.title, project: projectLabel(S, S.project[t.project_id] || {}), changes: said } };\n' +
          '};\n' +
          '\n' +
          '// ---------------- Finance tools ----------------\n' +
          'const rateOf = (S, name) => (S.person[name] || {}).bill_rate || Number(S.s.default_rate) || 95;\n' +
          'function unbilled(S, c, from, to) {\n' +
          '  const ps = S.projects.filter(p => p.client_id === c.client_id && p.billing === \'hourly\').map(p => p.project_id);\n' +
          '  return S.time.filter(e => ps.includes(e.project_id) && yes(e.billable) && !str(e.invoice_id) && (!from || e.date >= from) && (!to || e.date <= to));\n' +
          '}\n' +
          'function invoiceView(S, i) {\n' +
          '  let status = i.status;\n' +
          '  const overdueDays = i.status === \'sent\' && i.due_date && str(i.due_date).slice(0, 10) < S.todayIso ? daysBetween(str(i.due_date).slice(0, 10), S.todayIso) : 0;\n' +
          '  if (overdueDays) status = \'overdue\';\n' +
          '  return { invoice_id: i.invoice_id, client: (S.client[i.client_id] || {}).name, project: (S.project[i.project_id] || {}).name || null, period: i.period, issued: str(i.issue_date).slice(0, 10), due: str(i.due_date).slice(0, 10), amount_ex_vat: i.amount, total_inc_vat: r2(i.amount + i.vat), status, days_overdue: overdueDays || null, paid: str(i.paid_date).slice(0, 10) || null };\n' +
          '}\n' +
          '\n' +
          'TOOLS.client_finances = (S, a) => {\n' +
          '  const r = findClient(S, a.client); if (r.error) return r;\n' +
          '  const c = r.item;\n' +
          '  const ret = c.retainer_hours ? retainerUse(S, c) : null;\n' +
          '  if (ret) { ret.fee = c.retainer_fee; ret.overage_value = ret.over ? r2((ret.used_hours - ret.retainer_hours) * (Number(S.s.default_rate) || 95)) : 0; }\n' +
          '  const ub = unbilled(S, c);\n' +
          '  const invs = S.invoices.filter(i => i.client_id === c.client_id).map(i => invoiceView(S, i));\n' +
          '  const outstanding = invs.filter(i => i.status === \'sent\' || i.status === \'overdue\');\n' +
          '  return {\n' +
          '    client: c.name, currency: \'GBP\', retainer: ret,\n' +
          '    unbilled_hourly_work: { hours: r2(ub.reduce((x, e) => x + e.hours, 0)), value: r2(ub.reduce((x, e) => x + e.hours * rateOf(S, e.person), 0)), from: ub.map(e => e.date).sort()[0] || null },\n' +
          '    outstanding: { count: outstanding.length, total_inc_vat: r2(outstanding.reduce((x, i) => x + i.total_inc_vat, 0)), invoices: outstanding },\n' +
          '    billed_last_12_months_ex_vat: r2(S.invoices.filter(i => i.client_id === c.client_id && str(i.issue_date) >= S.today.minus({ months: 12 }).toISODate()).reduce((x, i) => x + i.amount, 0)),\n' +
          '    fixed_fee_projects: S.projects.filter(p => p.client_id === c.client_id && p.billing === \'fixed\').map(p => ({ project: p.name, fee: p.fee, invoiced_ex_vat: r2(S.invoices.filter(i => i.project_id === p.project_id).reduce((x, i) => x + i.amount, 0)), status: p.status }))\n'
        ) +
        (
          '  };\n' +
          '};\n' +
          '\n' +
          'TOOLS.invoices = (S, a) => {\n' +
          '  let list = S.invoices.map(i => invoiceView(S, i));\n' +
          '  const st = str(a.status || \'unpaid\').toLowerCase();\n' +
          '  if (st === \'unpaid\') list = list.filter(i => i.status === \'sent\' || i.status === \'overdue\');\n' +
          '  else if (st !== \'all\') list = list.filter(i => i.status === st);\n' +
          '  if (str(a.client)) { const r = findClient(S, a.client); if (r.error) return r; list = list.filter(i => i.client === r.item.name); }\n' +
          '  list.sort((x, y) => (y.days_overdue || 0) - (x.days_overdue || 0) || (x.due < y.due ? -1 : 1));\n' +
          '  return { status: st, count: list.length, total_inc_vat: r2(list.reduce((x, i) => x + i.total_inc_vat, 0)), overdue_total_inc_vat: r2(list.filter(i => i.status === \'overdue\').reduce((x, i) => x + i.total_inc_vat, 0)), currency: \'GBP\', invoices: list.slice(0, 40) };\n' +
          '};\n' +
          '\n' +
          'TOOLS.profitability = (S, a) => {\n' +
          '  let projects;\n' +
          '  let label;\n' +
          '  if (str(a.project)) { const r = findProject(S, a.project); if (r.error) return r; projects = [r.item]; label = projectLabel(S, r.item); }\n' +
          '  else if (str(a.client)) { const r = findClient(S, a.client); if (r.error) return r; projects = S.projects.filter(p => p.client_id === r.item.client_id); label = r.item.name; }\n' +
          '  else return { error: \'Say which project or client.\' };\n' +
          '  const rows = projects.filter(p => p.billing !== \'internal\').map(p => {\n' +
          '    const es = S.time.filter(e => e.project_id === p.project_id);\n' +
          '    const hours = r2(es.reduce((x, e) => x + e.hours, 0));\n' +
          '    const cost = r2(es.reduce((x, e) => x + e.hours * ((S.person[e.person] || {}).cost_rate || 0), 0));\n' +
          '    let value, basis;\n' +
          '    if (p.billing === \'fixed\') { value = p.fee; basis = \'fixed fee\'; }\n' +
          '    else if (p.billing === \'hourly\') { value = r2(es.filter(e => yes(e.billable)).reduce((x, e) => x + e.hours * rateOf(S, e.person), 0)); basis = \'billable hours × rates\'; }\n' +
          '    else { const months = new Set(S.invoices.filter(i => i.project_id === p.project_id).map(i => i.period)).size; value = r2(S.invoices.filter(i => i.project_id === p.project_id).reduce((x, i) => x + i.amount, 0)); basis = \'retainer invoices (\' + months + \' months)\'; }\n' +
          '    const margin = r2(value - cost);\n' +
          '    return { project: p.name, status: p.status, billing: p.billing, value, value_basis: basis, hours, cost_of_time: cost, margin, margin_pct: value ? Math.round(margin / value * 100) : null, effective_hourly_rate: hours ? r2(value / hours) : null, budget_hours: p.budget_hours || null, budget_used_pct: p.budget_hours ? Math.round(hours / p.budget_hours * 100) : null };\n' +
          '  });\n' +
          '  const tv = r2(rows.reduce((x, y) => x + y.value, 0)), tc = r2(rows.reduce((x, y) => x + y.cost_of_time, 0)), th = r2(rows.reduce((x, y) => x + y.hours, 0));\n' +
          '  return { for: label, currency: \'GBP\', note: \'Cost of time = hours × each person\\\'s internal cost rate. Fixed-fee value is the whole fee, even if not all invoiced yet.\', total: { value: tv, cost_of_time: tc, margin: r2(tv - tc), margin_pct: tv ? Math.round((tv - tc) / tv * 100) : null, hours: th, effective_hourly_rate: th ? r2(tv / th) : null }, projects: rows };\n' +
          '};\n' +
          '\n' +
          'TOOLS.draft_invoice = (S, a) => {\n' +
          '  const r = findClient(S, a.client); if (r.error) return r;\n' +
          '  const c = r.item;\n' +
          '  const m = str(a.month) ? DateTime.fromISO(str(a.month).slice(0, 7) + \'-01\', { zone: TZ }) : S.today.minus({ months: 1 });\n' +
          '  if (!m.isValid) return { error: \'The month must look like 2026-09.\' };\n' +
          '  if (m.startOf(\'month\') > S.today) return { error: \'That month hasn\\\'t started yet.\' };\n' +
          '  const [from, to] = monthRange(m);\n' +
          '  const entries = unbilled(S, c, from, to);\n' +
          '  const lines = [];\n' +
          '  const groups = {};\n' +
          '  for (const e of entries) { const k = e.project_id + \'|\' + e.person; groups[k] = groups[k] || { project: S.project[e.project_id].name, person: e.person, role: (S.person[e.person] || {}).role, hours: 0, rate: rateOf(S, e.person), ids: [] }; groups[k].hours = r2(groups[k].hours + e.hours); groups[k].ids.push(e.entry_id); }\n' +
          '  for (const g of Object.values(groups)) lines.push({ description: g.project + \': \' + g.role + \' (\' + g.person + \')\', hours: g.hours, rate: g.rate, amount: r2(g.hours * g.rate) });\n' +
          '  if (c.retainer_hours) {\n' +
          '    const ret = retainerUse(S, c, m);\n' +
          '    const already = S.invoices.some(i => i.client_id === c.client_id && i.project_id && S.project[i.project_id] && S.project[i.project_id].billing === \'retainer\' && str(i.period).toLowerCase() === m.toFormat(\'LLLL\').toLowerCase());\n' +
          '    if (!already) lines.push({ description: \'Retainer, \' + m.toFormat(\'LLLL yyyy\') + \' (\' + c.retainer_hours + \' hours)\', hours: null, rate: null, amount: c.retainer_fee });\n' +
          '    if (ret.over && m.endOf(\'month\') < S.today) lines.push({ description: \'Retainer overage, \' + r1(ret.used_hours - ret.retainer_hours) + \' hours\', hours: r1(ret.used_hours - ret.retainer_hours), rate: Number(S.s.default_rate) || 95, amount: r2((ret.used_hours - ret.retainer_hours) * (Number(S.s.default_rate) || 95)) });\n' +
          '  }\n' +
          '  if (!lines.length) return { error: \'Nothing to invoice for \' + c.name + \' in \' + m.toFormat(\'LLLL yyyy\') + \': no unbilled hourly time\' + (c.retainer_hours ? \' and the retainer is already invoiced\' : \'\') + \'. Fixed-fee projects are invoiced by milestone.\' };\n' +
          '  const net = r2(lines.reduce((x, l) => x + l.amount, 0)), vat = r2(net * (Number(S.s.vat_rate === \'\' ? 0.2 : S.s.vat_rate)));\n' +
          '  const next = Math.max(2000, ...S.invoices.map(i => Number(String(i.invoice_id).replace(/\\D/g, \'\')) || 0)) + 1;\n' +
          '  const preview = { client: c.name, period: m.toFormat(\'LLLL yyyy\'), currency: \'GBP\', lines, net, vat, total: r2(net + vat), time_entries: entries.length };\n' +
          '  if (!yes(a.confirm)) return { answer: Object.assign({ preview: true, next_step: \'Nothing has been saved. Check the lines with the user, then call draft_invoice again with confirm=true to create draft \' + \'INV-\' + next + \'.\' }, preview) };\n' +
          '  const id = \'INV-\' + next;\n' +
          '  const row = { invoice_id: id, client_id: c.client_id, project_id: entries[0] ? entries[0].project_id : \'\', period: m.toFormat(\'LLLL\') + \' (draft)\', issue_date: S.todayIso, due_date: S.today.plus({ days: Number(S.s.payment_days) || 30 }).toISODate(), amount: net, vat, status: \'draft\', paid_date: \'\', lines_json: JSON.stringify(lines) };\n' +
          '  return { write: { kind: \'invoice\', rows: [row], time_updates: entries.map(e => ({ entry_id: e.entry_id, invoice_id: id })) }, answer: Object.assign({ created: true, invoice_id: id, status: \'draft\', note: \'Saved as a draft in the Invoices tab; \' + entries.length + \' time entries are now marked as billed. Ruth sends invoices after checking them.\' }, preview) };\n' +
          '};\n' +
          '\n' +
          'const FINANCE_TOOLS = [\'client_finances\', \'invoices\', \'profitability\', \'draft_invoice\'];\n' +
          'const WRITE_TOOLS = [\'log_time\', \'create_task\', \'update_task\', \'draft_invoice\'];\n' +
          '// ---- end lib-bms.js ----\n' +
          '// ---- seed-bms.js (included by build.py): demo data for Brindle 5: Reset Demo ----\n' +
          '// An invented 14-person design and web studio in Manchester. Emails use example domains.\n' +
          'const SETTINGS_ROWS = [\n' +
          '  [\'company\', \'Brindle Studio\', \'\'],\n' +
          '  [\'location\', \'Manchester\', \'\'],\n' +
          '  [\'default_rate\', 95, \'Hourly rate for retainer overage, £\'],\n' +
          '  [\'vat_rate\', 0.2, \'\'],\n' +
          '  [\'payment_days\', 30, \'Invoice terms\'],\n' +
          '  [\'max_day_hours\', 12, \'log_time refuses more than this per person per day\'],\n' +
          '  [\'lock_days\', 30, \'Timesheets older than this are locked\'],\n' +
          '  [\'week_hours\', 37.5, \'Full-time week\']\n' +
          '];\n' +
          'const TEAM = [\n' +
          '  [\'P01\', \'Hannah Cole\', \'Managing Director\', \'Strategy\', \'yes\', 30, 62, 140],\n' +
          '  [\'P02\', \'Marcus Reid\', \'Head of Design\', \'Design\', \'yes\', 37.5, 48, 115],\n' +
          '  [\'P03\', \'Nadia Shah\', \'Senior Designer\', \'Design\', \'no\', 37.5, 38, 95],\n' +
          '  [\'P04\', \'Leo Martins\', \'Designer\', \'Design\', \'no\', 37.5, 30, 85],\n' +
          '  [\'P05\', \'Amira Haddad\', \'Junior Designer\', \'Design\', \'no\', 37.5, 22, 70],\n' +
          '  [\'P06\', \'Tom Ellis\', \'Head of Development\', \'Development\', \'yes\', 37.5, 50, 120],\n' +
          '  [\'P07\', \'Sofia Russo\', \'Senior Developer\', \'Development\', \'no\', 37.5, 42, 105],\n' +
          '  [\'P08\', \'Ben Okafor\', \'Developer\', \'Development\', \'no\', 37.5, 32, 90],\n' +
          '  [\'P09\', \'Grace Liu\', \'Developer\', \'Development\', \'no\', 30, 32, 90],\n' +
          '  [\'P10\', \'Dan Fletcher\', \'Project Manager\', \'Delivery\', \'yes\', 37.5, 36, 85],\n' +
          '  [\'P11\', \'Chloe Bennett\', \'Account Manager\', \'Delivery\', \'no\', 37.5, 30, 80],\n' +
          '  [\'P12\', \'Sam Patel\', \'Copywriter\', \'Strategy\', \'no\', 30, 30, 85],\n' +
          '  [\'P13\', \'Ruth Adams\', \'Operations and Finance\', \'Operations\', \'yes\', 30, 34, 0],\n' +
          '  [\'P14\', \'Kai Morgan\', \'Motion Designer\', \'Design\', \'no\', 22.5, 34, 95]\n' +
          '];\n' +
          'const CLIENTS = [\n' +
          '  [\'C00\', \'Brindle Studio (internal)\', \'Internal\', \'\', \'\', \'Hannah Cole\', 0, 0, \'active\', \'2019-04\'],\n' +
          '  [\'C01\', \'Brightwater Dental\', \'Healthcare\', \'Dr Ellen Price\', \'ellen.price@brightwater.example\', \'Chloe Bennett\', 20, 1900, \'active\', \'2024-03\'],\n' +
          '  [\'C02\', \'Harbour & Co\', \'Hospitality\', \'James Harbour\', \'james@harbourandco.example\', \'Dan Fletcher\', 0, 0, \'active\', \'2026-06\'],\n' +
          '  [\'C03\', \'Kettleby Foods\', \'Food and drink\', \'Maya Kettleby\', \'maya@kettleby.example\', \'Chloe Bennett\', 0, 0, \'active\', \'2025-01\'],\n' +
          '  [\'C04\', \'Northwind Cycles\', \'Retail\', \'Owen Pryce\', \'owen@northwindcycles.example\', \'Dan Fletcher\', 0, 0, \'active\', \'2025-09\'],\n' +
          '  [\'C05\', \'Ashgrove Housing Trust\', \'Charity\', \'Linda Moss\', \'linda.moss@ashgrove.example\', \'Chloe Bennett\', 0, 0, \'active\', \'2023-11\'],\n'
        ) +
        (
          '  [\'C06\', \'Pennant Law\', \'Legal\', \'Richard Pennant\', \'r.pennant@pennantlaw.example\', \'Dan Fletcher\', 0, 0, \'active\', \'2026-07\'],\n' +
          '  [\'C07\', \'Lumen Physio\', \'Healthcare\', \'Jo Whitaker\', \'jo@lumenphysio.example\', \'Chloe Bennett\', 12, 1150, \'active\', \'2025-05\'],\n' +
          '  [\'C08\', \'Rowan Gin\', \'Drinks\', \'Isla Rowan\', \'isla@rowangin.example\', \'Chloe Bennett\', 0, 0, \'active\', \'2026-02\'],\n' +
          '  [\'C09\', \'Corvid Analytics\', \'Software\', \'Arjun Mehta\', \'arjun@corvid.example\', \'Dan Fletcher\', 0, 0, \'active\', \'2026-08\'],\n' +
          '  [\'C10\', \'Millbrook School\', \'Education\', \'Helen Ward\', \'h.ward@millbrook.example\', \'Chloe Bennett\', 0, 0, \'past\', \'2025-10\']\n' +
          '];\n' +
          '// project, client, name, type, billing, status, lead, start (days from today), due (days), budget ratio (budget = hours logged / ratio), fee\n' +
          'const PROJECTS = [\n' +
          '  [\'PR-101\', \'C01\', \'Website care retainer\', \'Retainer\', \'retainer\', \'active\', \'Sofia Russo\', -400, null, null, 1900],\n' +
          '  [\'PR-102\', \'C01\', \'Patient booking redesign\', \'Website\', \'fixed\', \'active\', \'Nadia Shah\', -45, 12, 0.72, null],\n' +
          '  [\'PR-103\', \'C02\', \'Harbour & Co rebrand\', \'Brand\', \'fixed\', \'active\', \'Marcus Reid\', -60, 5, 1.18, null],\n' +
          '  [\'PR-104\', \'C02\', \'Harbour & Co website\', \'Website\', \'fixed\', \'active\', \'Tom Ellis\', -20, 55, 0.22, null],\n' +
          '  [\'PR-105\', \'C03\', \'Snack range packaging\', \'Packaging\', \'fixed\', \'done\', \'Leo Martins\', -120, -40, 0.94, 9800],\n' +
          '  [\'PR-106\', \'C04\', \'Shopify store rebuild\', \'E-commerce\', \'hourly\', \'active\', \'Tom Ellis\', -70, 20, 0.81, 0],\n' +
          '  [\'PR-107\', \'C05\', \'Annual report 2026\', \'Print\', \'fixed\', \'active\', \'Nadia Shah\', -30, 25, 0.55, null],\n' +
          '  [\'PR-108\', \'C06\', \'Pennant Law website\', \'Website\', \'fixed\', \'on_hold\', \'Ben Okafor\', -50, 40, null, 15500],\n' +
          '  [\'PR-109\', \'C07\', \'Social content retainer\', \'Retainer\', \'retainer\', \'active\', \'Kai Morgan\', -200, null, null, 1150],\n' +
          '  [\'PR-110\', \'C08\', \'Christmas campaign\', \'Campaign\', \'fixed\', \'active\', \'Leo Martins\', -25, 18, 0.88, null],\n' +
          '  [\'PR-111\', \'C09\', \'Dashboard UI design\', \'Product design\', \'hourly\', \'active\', \'Nadia Shah\', -40, 35, 0.6, 0],\n' +
          '  [\'PR-112\', \'C10\', \'Prospectus 2026\', \'Print\', \'fixed\', \'done\', \'Amira Haddad\', -150, -90, 0.97, 5400],\n' +
          '  [\'PR-113\', \'C00\', \'New business and pitches\', \'Internal\', \'internal\', \'active\', \'Hannah Cole\', -400, null, null, 0]\n' +
          '];\n' +
          '// Who works on what: person → [project, share of their billable day] (weights; recent 8 weeks)\n' +
          'const ALLOC = {\n' +
          '  \'Hannah Cole\': [[\'PR-113\', 5], [\'PR-103\', 1], [\'PR-104\', 1]],\n' +
          '  \'Marcus Reid\': [[\'PR-103\', 5], [\'PR-110\', 2], [\'PR-107\', 1], [\'PR-113\', 1.5]],\n' +
          '  \'Nadia Shah\': [[\'PR-102\', 4], [\'PR-111\', 3], [\'PR-107\', 2], [\'PR-113\', 1]],\n' +
          '  \'Leo Martins\': [[\'PR-103\', 4], [\'PR-110\', 4], [\'PR-105\', 1], [\'PR-113\', 1]],\n' +
          '  \'Amira Haddad\': [[\'PR-107\', 3], [\'PR-110\', 2], [\'PR-103\', 1], [\'PR-113\', 1]],\n' +
          '  \'Tom Ellis\': [[\'PR-104\', 3], [\'PR-106\', 2], [\'PR-113\', 1.5]],\n' +
          '  \'Sofia Russo\': [[\'PR-106\', 2.5], [\'PR-101\', 0.7], [\'PR-102\', 3], [\'PR-113\', 0.8]],\n' +
          '  \'Ben Okafor\': [[\'PR-104\', 4], [\'PR-101\', 0.4], [\'PR-106\', 2], [\'PR-108\', 0.6], [\'PR-113\', 0.8]],\n' +
          '  \'Grace Liu\': [[\'PR-102\', 4], [\'PR-104\', 3], [\'PR-111\', 1], [\'PR-113\', 1]],\n' +
          '  \'Dan Fletcher\': [[\'PR-103\', 2], [\'PR-104\', 2], [\'PR-106\', 1], [\'PR-111\', 1], [\'PR-113\', 2]],\n' +
          '  \'Chloe Bennett\': [[\'PR-101\', 0.2], [\'PR-109\', 0.2], [\'PR-110\', 2], [\'PR-107\', 1], [\'PR-113\', 2.5]],\n' +
          '  \'Sam Patel\': [[\'PR-110\', 3], [\'PR-103\', 2], [\'PR-107\', 2], [\'PR-109\', 0.3], [\'PR-113\', 1]],\n' +
          '  \'Ruth Adams\': [[\'PR-113\', 1]],\n' +
          '  \'Kai Morgan\': [[\'PR-109\', 0.8], [\'PR-110\', 3], [\'PR-103\', 1], [\'PR-113\', 0.5]]\n' +
          '};\n' +
          '// Utilisation this week (share of capacity) where it differs from the usual 0.9, so capacity questions have answers\n' +
          'const THIS_WEEK = { \'Leo Martins\': 1.3, \'Amira Haddad\': 0.45, \'Grace Liu\': 0.55, \'Marcus Reid\': 1.1 };\n' +
          '// Tasks: project, title, assignee, status, priority, due (days from today; null = none)\n' +
          'const TASKS = [\n' +
          '  [\'PR-101\', \'Monthly plugin and security updates\', \'Sofia Russo\', \'doing\', \'normal\', 2],\n' +
          '  [\'PR-101\', \'Fix contact form spam\', \'Ben Okafor\', \'todo\', \'high\', -3],\n' +
          '  [\'PR-101\', \'Add new hygienist profiles\', \'Sofia Russo\', \'todo\', \'normal\', -1],\n' +
          '  [\'PR-101\', \'Update opening hours for Christmas\', \'Ben Okafor\', \'todo\', \'low\', 30],\n' +
          '  [\'PR-101\', \'Speed up the home page (Core Web Vitals)\', \'Sofia Russo\', \'review\', \'normal\', 4],\n' +
          '  [\'PR-102\', \'Booking flow wireframes\', \'Nadia Shah\', \'done\', \'high\', -30],\n' +
          '  [\'PR-102\', \'Booking flow high-fidelity designs\', \'Nadia Shah\', \'done\', \'high\', -16],\n' +
          '  [\'PR-102\', \'Build appointment picker component\', \'Grace Liu\', \'doing\', \'high\', 3],\n' +
          '  [\'PR-102\', \'Connect to the practice management API\', \'Sofia Russo\', \'doing\', \'high\', 6],\n' +
          '  [\'PR-102\', \'Patient reminder emails\', \'Grace Liu\', \'todo\', \'normal\', 9],\n' +
          '  [\'PR-102\', \'Accessibility review of the booking flow\', \'Nadia Shah\', \'todo\', \'normal\', 10],\n' +
          '  [\'PR-102\', \'User testing with five patients\', \'Nadia Shah\', \'todo\', \'normal\', -2],\n' +
          '  [\'PR-103\', \'Brand strategy workshop\', \'Hannah Cole\', \'done\', \'high\', -50],\n' +
          '  [\'PR-103\', \'Logo concepts round 1\', \'Marcus Reid\', \'done\', \'high\', -35],\n' +
          '  [\'PR-103\', \'Logo concepts round 2\', \'Leo Martins\', \'done\', \'high\', -21],\n' +
          '  [\'PR-103\', \'Colour and type system\', \'Leo Martins\', \'review\', \'high\', -4],\n' +
          '  [\'PR-103\', \'Menu templates\', \'Amira Haddad\', \'doing\', \'high\', -2],\n' +
          '  [\'PR-103\', \'Signage designs for the Ancoats site\', \'Leo Martins\', \'todo\', \'high\', -1],\n' +
          '  [\'PR-103\', \'Brand guidelines document\', \'Marcus Reid\', \'todo\', \'high\', 3],\n' +
          '  [\'PR-103\', \'Tone of voice guide\', \'Sam Patel\', \'doing\', \'normal\', -3],\n' +
          '  [\'PR-103\', \'Social media launch assets\', \'Kai Morgan\', \'todo\', \'normal\', 5],\n' +
          '  [\'PR-104\', \'Sitemap and content plan\', \'Dan Fletcher\', \'done\', \'normal\', -12],\n' +
          '  [\'PR-104\', \'Homepage design\', \'Leo Martins\', \'todo\', \'high\', 14],\n' +
          '  [\'PR-104\', \'Booking widget integration research\', \'Ben Okafor\', \'doing\', \'normal\', 6],\n' +
          '  [\'PR-104\', \'Set up the CMS and hosting\', \'Tom Ellis\', \'doing\', \'normal\', 8],\n' +
          '  [\'PR-104\', \'Menu page component\', \'Ben Okafor\', \'todo\', \'normal\', 21],\n' +
          '  [\'PR-105\', \'Final print-ready artwork\', \'Leo Martins\', \'done\', \'high\', -45],\n' +
          '  [\'PR-105\', \'Printer proof sign-off\', \'Leo Martins\', \'done\', \'normal\', -41],\n' +
          '  [\'PR-106\', \'Product data import\', \'Sofia Russo\', \'done\', \'high\', -30],\n' +
          '  [\'PR-106\', \'Bike size guide tool\', \'Tom Ellis\', \'doing\', \'normal\', 7],\n' +
          '  [\'PR-106\', \'Checkout and payments testing\', \'Ben Okafor\', \'todo\', \'high\', 10],\n' +
          '  [\'PR-106\', \'Click and collect for the Salford shop\', \'Sofia Russo\', \'doing\', \'high\', 4],\n' +
          '  [\'PR-106\', \'Migrate customer accounts\', \'Tom Ellis\', \'todo\', \'high\', 14],\n' +
          '  [\'PR-106\', \'Redirect map from the old site\', \'Ben Okafor\', \'todo\', \'normal\', 16],\n' +
          '  [\'PR-107\', \'Annual report layout\', \'Amira Haddad\', \'doing\', \'normal\', 8],\n' +
          '  [\'PR-107\', \'Infographics for the impact section\', \'Amira Haddad\', \'todo\', \'normal\', 12],\n' +
          '  [\'PR-107\', \'Copy edit of the chair\\\'s statement\', \'Sam Patel\', \'review\', \'normal\', 2],\n' +
          '  [\'PR-107\', \'Photography selection\', \'Nadia Shah\', \'todo\', \'low\', 15],\n' +
          '  [\'PR-108\', \'Practice area page designs\', \'Ben Okafor\', \'todo\', \'normal\', 30],\n' +
          '  [\'PR-108\', \'Waiting for client content\', \'Dan Fletcher\', \'todo\', \'normal\', -10],\n' +
          '  [\'PR-109\', \'November content calendar\', \'Kai Morgan\', \'doing\', \'normal\', 3],\n' +
          '  [\'PR-109\', \'Stretching tips video series (3 reels)\', \'Kai Morgan\', \'todo\', \'normal\', 9],\n' +
          '  [\'PR-109\', \'Monthly report for Lumen\', \'Chloe Bennett\', \'todo\', \'normal\', 9],\n' +
          '  [\'PR-110\', \'Campaign concept\', \'Leo Martins\', \'done\', \'high\', -14],\n' +
          '  [\'PR-110\', \'Bottle neck tag design\', \'Leo Martins\', \'doing\', \'high\', 1],\n' +
          '  [\'PR-110\', \'Instagram ads (6 sizes)\', \'Kai Morgan\', \'doing\', \'high\', 4],\n' +
          '  [\'PR-110\', \'Gift box print artwork\', \'Amira Haddad\', \'todo\', \'high\', 6],\n' +
          '  [\'PR-110\', \'Campaign copy and taglines\', \'Sam Patel\', \'done\', \'normal\', -8],\n' +
          '  [\'PR-110\', \'Retailer sell-in deck\', \'Chloe Bennett\', \'todo\', \'normal\', 8],\n' +
          '  [\'PR-111\', \'Dashboard user interviews\', \'Nadia Shah\', \'done\', \'normal\', -20],\n' +
          '  [\'PR-111\', \'Dashboard wireframes\', \'Nadia Shah\', \'review\', \'normal\', -1],\n' +
          '  [\'PR-111\', \'Design system tokens\', \'Grace Liu\', \'todo\', \'normal\', 12],\n' +
          '  [\'PR-111\', \'Charts component specs\', \'Nadia Shah\', \'todo\', \'normal\', 18],\n' +
          '  [\'PR-113\', \'Pitch for Ardwick Brewing\', \'Hannah Cole\', \'doing\', \'high\', 2],\n' +
          '  [\'PR-113\', \'Case study: Northwind Cycles\', \'Sam Patel\', \'todo\', \'low\', 20],\n' +
          '  [\'PR-113\', \'Update the studio website portfolio\', \'Amira Haddad\', \'todo\', \'low\', 25]\n' +
          '];\n'
        ) +
        (
          '// Invoices: id, client, project, period, issued (days), due (days), amount (ex VAT), status, paid (days)\n' +
          'const INVOICES = [\n' +
          '  [\'INV-2031\', \'C01\', \'PR-101\', \'July\', -82, -52, 1900, \'paid\', -55],\n' +
          '  [\'INV-2032\', \'C07\', \'PR-109\', \'July\', -82, -52, 1150, \'paid\', -60],\n' +
          '  [\'INV-2033\', \'C03\', \'PR-105\', \'Deposit 50%\', -118, -88, 4900, \'paid\', -100],\n' +
          '  [\'INV-2034\', \'C10\', \'PR-112\', \'Final 50%\', -88, -58, 2700, \'paid\', -62],\n' +
          '  [\'INV-2035\', \'C04\', \'PR-106\', \'August time\', -51, -21, 6235, \'paid\', -24],\n' +
          '  [\'INV-2036\', \'C01\', \'PR-101\', \'August\', -51, -21, 1900, \'paid\', -30],\n' +
          '  [\'INV-2037\', \'C07\', \'PR-109\', \'August\', -51, -21, 1150, \'paid\', -25],\n' +
          '  [\'INV-2038\', \'C02\', \'PR-103\', \'Deposit 50%\', -58, -28, 9000, \'paid\', -40],\n' +
          '  [\'INV-2039\', \'C01\', \'PR-102\', \'Deposit 40%\', -44, -14, 5800, \'paid\', -20],\n' +
          '  [\'INV-2040\', \'C08\', \'PR-110\', \'Deposit 50%\', -24, 6, 4950, \'sent\', null],\n' +
          '  [\'INV-2041\', \'C03\', \'PR-105\', \'Final 50%\', -53, -23, 4900, \'sent\', null],\n' +
          '  [\'INV-2042\', \'C01\', \'PR-101\', \'September\', -21, 9, 1900, \'sent\', null],\n' +
          '  [\'INV-2043\', \'C07\', \'PR-109\', \'September\', -21, 9, 1150, \'paid\', -6],\n' +
          '  [\'INV-2044\', \'C05\', \'PR-107\', \'Deposit 50%\', -28, 2, 3600, \'paid\', -15],\n' +
          '  [\'INV-2045\', \'C02\', \'PR-104\', \'Deposit 30%\', -18, 12, 7800, \'sent\', null],\n' +
          '  [\'INV-2046\', \'C06\', \'PR-108\', \'Deposit 30%\', -48, -18, 4650, \'sent\', null]\n' +
          '];\n' +
          '// Time logged before the 8 weeks of generated timesheets, for the finished projects (imported monthly totals)\n' +
          'const OLD_TIME = [\n' +
          '  [\'PR-105\', \'Leo Martins\', -100, 30], [\'PR-105\', \'Marcus Reid\', -95, 10], [\'PR-105\', \'Amira Haddad\', -80, 12], [\'PR-105\', \'Leo Martins\', -70, 26], [\'PR-105\', \'Sam Patel\', -60, 4],\n' +
          '  [\'PR-112\', \'Amira Haddad\', -140, 30], [\'PR-112\', \'Marcus Reid\', -120, 6], [\'PR-112\', \'Amira Haddad\', -110, 22]\n' +
          '];\n' +
          'const FIXED_BUDGETS = { \'PR-105\': 90, \'PR-112\': 60, \'PR-108\': 140 };\n' +
          '// Deposit invoices are a share of the project fee (fees for active fixed-price projects = budget × £105)\n' +
          'const DEPOSIT_PCT = { \'INV-2038\': 0.5, \'INV-2039\': 0.4, \'INV-2040\': 0.5, \'INV-2044\': 0.5, \'INV-2045\': 0.3, \'INV-2046\': 0.3 };\n' +
          '// ---- end seed-bms.js ----\n' +
          'let seed = 20261022;\n' +
          'const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };\n' +
          'const today = nowDt().startOf(\'day\');\n' +
          'const d = n => today.plus({ days: n }).toISODate();\n' +
          'const half = n => Math.round(n * 2) / 2;\n' +
          'const projects = Object.fromEntries(PROJECTS.map(p => [p[0], { project_id: p[0], client_id: p[1], name: p[2], type: p[3], billing: p[4], status: p[5], lead: p[6], start: d(p[7]), due: p[8] === null ? \'\' : d(p[8]), ratio: p[9], fee: p[10] }]));\n' +
          'const team = TEAM.map(t => ({ person_id: t[0], name: t[1], role: t[2], team: t[3], email: t[1].split(\' \')[0].toLowerCase() + \'@brindle.example\', is_manager: t[4], weekly_hours: t[5], cost_rate: t[6], bill_rate: t[7], active: \'yes\' }));\n' +
          'const tasksByProject = {};\n' +
          'const tasks = TASKS.map((t, i) => {\n' +
          '  const row = { task_id: \'T-\' + (1001 + i), project_id: t[0], title: t[1], assignee: t[2], status: t[3], priority: t[4], due: t[5] === null ? \'\' : d(t[5]), created_at: isoOf(today.plus({ days: (t[5] === null ? -10 : t[5]) - 18 }).set({ hour: 9 })), updated_at: isoOf(today.plus({ days: t[3] === \'done\' ? (t[5] || 0) : -1 }).set({ hour: 16 })) };\n' +
          '  (tasksByProject[t[0]] = tasksByProject[t[0]] || []).push(row);\n' +
          '  return row;\n' +
          '});\n' +
          'const NOTES = { Strategy: [\'Client call\', \'Workshop prep\', \'Strategy notes\'], Design: [\'Design work\', \'Revisions after feedback\', \'Design review\'], Development: [\'Development\', \'Bug fixes\', \'Code review\'], Delivery: [\'Project management\', \'Client call\', \'Planning and scheduling\'], Operations: [\'Admin\'] };\n' +
          'const time = [];\n' +
          'let n = 0;\n' +
          'const weekStartIso = today.startOf(\'week\').toISODate();\n' +
          'const add = (date, person, pid, hours, note, source) => {\n' +
          '  const p = projects[pid];\n' +
          '  const mine = (tasksByProject[pid] || []).filter(t => t.assignee === person);\n' +
          '  const task = mine.length && rnd() < 0.7 ? mine[Math.floor(rnd() * mine.length)] : null;\n' +
          '  time.push({ entry_id: \'E-\' + String(++n).padStart(5, \'0\'), date, person, project_id: pid, task_id: task ? task.task_id : \'\', hours, billable: p.billing === \'internal\' ? \'no\' : \'yes\', note: note || (task ? task.title : \'\'), logged_at: isoOf(DateTime.fromISO(date, { zone: TZ }).set({ hour: 17, minute: 30 })), source: source || \'timesheet\', invoice_id: \'\' });\n' +
          '};\n' +
          'for (let off = -56; off <= -1; off++) {\n' +
          '  const day = today.plus({ days: off });\n' +
          '  if (day.weekday > 5) continue;\n' +
          '  const date = day.toISODate();\n' +
          '  for (const t of team) {\n' +
          '    const util = date >= weekStartIso ? (THIS_WEEK[t.name] || 0.9) : 0.82 + rnd() * 0.16;\n' +
          '    let hours = half(t.weekly_hours / 5 * util * (0.9 + rnd() * 0.2));\n' +
          '    if (rnd() < 0.04 && date < weekStartIso) continue; // the odd day off\n' +
          '    const live = (ALLOC[t.name] || []).filter(([pid]) => { const p = projects[pid]; return p.start <= date && (p.status !== \'done\' || !p.due || date <= p.due); });\n' +
          '    if (!live.length) continue;\n' +
          '    // Split the day across every live project by weight (with some day-to-day wobble); slivers under half\n' +
          '    // an hour go to the biggest share\n' +
          '    const shares = live.map(([pid, w]) => [pid, w * (0.7 + rnd() * 0.6)]);\n' +
          '    const sum = shares.reduce((a, x) => a + x[1], 0);\n' +
          '    const parts = shares.map(([pid, w]) => [pid, half(hours * w / sum)]).filter(x => x[1] >= 0.5).sort((a, b) => b[1] - a[1]);\n' +
          '    if (!parts.length) continue;\n' +
          '    parts[0][1] = half(parts[0][1] + hours - parts.reduce((a, x) => a + x[1], 0));\n' +
          '    for (const [pid, h] of parts) if (h > 0) add(date, t.name, pid, h, NOTES[t.team][Math.floor(rnd() * NOTES[t.team].length)], \'timesheet\');\n' +
          '  }\n' +
          '}\n' +
          'for (const [pid, person, off, h] of OLD_TIME) add(d(off), person, pid, h, \'Monthly total (imported)\', \'import\');\n' +
          'time.sort((a, b) => a.date < b.date ? -1 : (a.date > b.date ? 1 : 0));\n' +
          '\n' +
          '// Budgets from hours logged (ratio = hours used / budget), fixed for finished projects\n' +
          'for (const p of Object.values(projects)) {\n' +
          '  const used = time.filter(e => e.project_id === p.project_id).reduce((a, e) => a + e.hours, 0);\n' +
          '  p.budget_hours = FIXED_BUDGETS[p.project_id] || (p.ratio ? Math.max(10, Math.round(used / p.ratio / 5) * 5) : \'\');\n' +
          '  if (p.billing === \'fixed\' && (p.fee === null || p.fee === undefined)) p.fee = Math.round(p.budget_hours * 105 / 500) * 500;\n' +
          '}\n' +
          '// Invoices, and which time they billed: hourly work before last month, and the retainer months invoiced\n' +
          'const amountOf = i => DEPOSIT_PCT[i[0]] ? Math.round(projects[i[2]].fee * DEPOSIT_PCT[i[0]]) : i[6];\n' +
          'const invoices = INVOICES.map(i => ({ invoice_id: i[0], client_id: i[1], project_id: i[2], period: i[3], issue_date: d(i[4]), due_date: d(i[5]), amount: amountOf(i), vat: Math.round(amountOf(i) * 20) / 100, status: i[7], paid_date: i[8] === null ? \'\' : d(i[8]), lines_json: \'\' }));\n' +
          'const lastMonth = today.minus({ months: 1 }).startOf(\'month\').toISODate();\n' +
          'for (const e of time) {\n' +
          '  const p = projects[e.project_id];\n' +
          '  if (p.billing === \'hourly\' && e.date < lastMonth) { const inv = invoices.find(i => i.project_id === e.project_id && i.period === DateTime.fromISO(e.date).toFormat(\'LLLL\') + \' time\'); if (inv) e.invoice_id = inv.invoice_id; }\n' +
          '  if (p.billing === \'retainer\') { const inv = invoices.find(i => i.project_id === e.project_id && i.period === DateTime.fromISO(e.date).toFormat(\'LLLL\')); if (inv) e.invoice_id = inv.invoice_id; }\n' +
          '}\n' +
          '// Northwind\'s August invoice matches the August time logged\n' +
          'const aug = invoices.find(i => i.invoice_id === \'INV-2035\');\n' +
          'if (aug) { const h = time.filter(e => e.invoice_id === \'INV-2035\'); if (h.length) { aug.amount = Math.round(h.reduce((a, e) => a + e.hours * (team.find(t => t.name === e.person).bill_rate || 95), 0) * 100) / 100; aug.vat = Math.round(aug.amount * 20) / 100; aug.period = DateTime.fromISO(h[0].date).toFormat(\'LLLL\') + \' time\'; } else aug.period = \'August time\'; }\n' +
          '\n' +
          'const rows = (tab, objs) => [COLUMNS[tab]].concat(objs.map(o => COLUMNS[tab].map(c => o[c] === undefined || o[c] === null ? \'\' : o[c])));\n' +
          'const tabs = {\n' +
          '  \'Settings\': [COLUMNS.Settings].concat(SETTINGS_ROWS),\n' +
          '  \'Team\': rows(\'Team\', team),\n' +
          '  \'Clients\': rows(\'Clients\', CLIENTS.map(c => Object.fromEntries(COLUMNS.Clients.map((k, i) => [k, c[i]])))),\n' +
          '  \'Projects\': rows(\'Projects\', Object.values(projects)),\n' +
          '  \'Tasks\': rows(\'Tasks\', tasks),\n'
        ) +
        (
          '  \'Time\': rows(\'Time\', time),\n' +
          '  \'Invoices\': rows(\'Invoices\', invoices),\n' +
          '  \'Audit\': [COLUMNS.Audit]\n' +
          '};\n' +
          'const q = x => "\'" + x.replace(/\'/g, "\'\'") + "\'";\n' +
          'return [{ json: {\n' +
          '  clear: { ranges: Object.keys(tabs).map(q) },\n' +
          '  write: { valueInputOption: \'RAW\', data: Object.entries(tabs).map(([k, v]) => ({ range: q(k) + \'!A1\', values: v })) },\n' +
          '  summary: Object.fromEntries(Object.entries(tabs).map(([k, v]) => [k, v.length - 1]))\n' +
          '} }];\n'
        )
  } },
  output: [{ clear: { ranges: [] }, write: { valueInputOption: 'RAW', data: [] }, summary: {} }]
});

const clear = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Clear All Tabs',
    position: [640, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/13IFBgri_0mBqjU5JZSvFjfmk4jVpqzGulaEWBLjJQks/values:batchClear',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify($('Build Demo Data').first().json.clear) }}"),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ clearedRanges: [] }]
});

const write = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Write All Tabs',
    position: [860, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/13IFBgri_0mBqjU5JZSvFjfmk4jVpqzGulaEWBLjJQks/values:batchUpdate',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify($('Build Demo Data').first().json.write) }}"),
      options: {}
    },
    credentials: SHEETS_CRED
  },
  output: [{ totalUpdatedRows: 60 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [1080, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "return [{ json: { rows: $('Build Demo Data').first().json.summary, cellsWritten: $input.first().json.totalUpdatedCells } }];" } },
  output: [{ rows: {} }]
});

const note = sticky(
  '## Brindle 5: Reset Demo\nPuts the Google Sheet back to the demo state: 14 people, 11 clients, 13 projects, 56 tasks, 17 invoices and eight weeks of timesheets ending yesterday (dates are relative to today; a fixed random seed gives the same numbers each time). Project budgets come from the hours logged, so the Harbour & Co rebrand is over budget and others are on track. The Audit tab is emptied.',
  [], { position: [160, 80], width: 940, height: 200, color: 7 }
);

export default workflow('brindle-reset-demo', 'Brindle 5: Reset Demo')
  .add(start)
  .to(seed)
  .to(clear)
  .to(write)
  .to(summary)
  .add(note);
