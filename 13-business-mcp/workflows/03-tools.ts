import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const AUDIT_WF = { __rl: true, mode: 'id', value: 'bmsAuditLog00004', cachedResultName: 'Brindle 4: Audit Log' };
const DOC = { __rl: true, mode: 'id', value: '13IFBgri_0mBqjU5JZSvFjfmk4jVpqzGulaEWBLjJQks', cachedResultName: 'Brindle Studio: business data' };

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'When Called', position: [200, 400], parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [ { name: 'tool', type: 'string' }, { name: 'server', type: 'string' }, { name: 'query', type: 'string' }, { name: 'client', type: 'string' }, { name: 'project', type: 'string' }, { name: 'person', type: 'string' }, { name: 'assignee', type: 'string' }, { name: 'task_id', type: 'string' }, { name: 'title', type: 'string' }, { name: 'status', type: 'string' }, { name: 'due', type: 'string' }, { name: 'priority', type: 'string' }, { name: 'hours', type: 'number' }, { name: 'date', type: 'string' }, { name: 'note', type: 'string' }, { name: 'billable', type: 'boolean' }, { name: 'week', type: 'string' }, { name: 'team', type: 'string' }, { name: 'due_within_days', type: 'number' }, { name: 'month', type: 'string' }, { name: 'confirm', type: 'boolean' } ] } } },
  output: [{ tool: 'project_status', server: 'team', project: 'Harbour & Co rebrand' }]
});

const loadData = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Load Data',
    position: [420, 400],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: { method: 'GET', url: 'https://sheets.googleapis.com/v4/spreadsheets/13IFBgri_0mBqjU5JZSvFjfmk4jVpqzGulaEWBLjJQks/values:batchGet?ranges=Settings&ranges=Team&ranges=Clients&ranges=Projects&ranges=Tasks&ranges=Time&ranges=Invoices&valueRenderOption=UNFORMATTED_VALUE', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} },
    credentials: SHEETS_CRED
  },
  output: [{ valueRanges: [] }]
});

const runTool = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Run Tool', position: [640, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        (
          '// Runs one tool call from Claude (or any MCP client). Finance tools only work when called through the\n' +
          '// finance server. Reads are answered here; writes are checked here and handed to the nodes after the\n' +
          '// switch. Every call, allowed or not, goes to the Audit tab.\n' +
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
          '  return {\n' +
          '    clients: S.clients.filter(c => hit(c.name + \' \' + c.sector + \' \' + c.contact)).slice(0, 6).map(c => ({ client_id: c.client_id, name: c.name, status: c.status, account_lead: c.account_lead })),\n'
        ) +
        (
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
          '};\n' +
          '\n'
        ) +
        (
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
          '    fixed_fee_projects: S.projects.filter(p => p.client_id === c.client_id && p.billing === \'fixed\').map(p => ({ project: p.name, fee: p.fee, invoiced_ex_vat: r2(S.invoices.filter(i => i.project_id === p.project_id).reduce((x, i) => x + i.amount, 0)), status: p.status }))\n' +
          '  };\n'
        ) +
        (
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
          'const input = $(\'When Called\').first().json;\n' +
          'const started = Date.now();\n' +
          'const tool = str(input.tool), server = str(input.server) || \'team\';\n' +
          'const args = {};\n' +
          'for (const [k, v] of Object.entries(input)) if (![\'tool\', \'server\'].includes(k) && v !== null && v !== undefined && v !== \'\') args[k] = v;\n' +
          'let out;\n' +
          'if (!TOOLS[tool]) out = { error: \'Unknown tool: \' + tool };\n' +
          'else if (FINANCE_TOOLS.includes(tool) && server !== \'finance\') out = { error: \'That tool is only available on the finance server.\' };\n' +
          'else {\n' +
          '  try { out = TOOLS[tool](studio(tablesOf($(\'Load Data\').first().json)), args, server); }\n' +
          '  catch (e) { out = { error: \'Something went wrong: \' + e.message }; }\n' +
          '}\n' +
          'const answer = out.error ? { ok: false, error: out.error } : (out.answer || out);\n' +
          'const write = out.error ? null : (out.write || null);\n' +
          'const summary = out.error ? \'Refused: \' + out.error\n' +
          '  : (tool === \'log_time\' ? \'Logged \' + answer.hours + \' h for \' + answer.person + \' on \' + answer.project + \' (\' + answer.date + \')\'\n' +
          '  : tool === \'create_task\' ? \'Created \' + answer.task_id + \': \' + answer.title\n' +
          '  : tool === \'update_task\' ? \'Updated \' + answer.task_id + \': \' + answer.changes.join(\'; \')\n' +
          '  : tool === \'draft_invoice\' ? (answer.created ? \'Created draft \' + answer.invoice_id : \'Previewed\') + \' for \' + answer.client + \' \' + answer.period + \', \' + gbp(answer.net) + \' + VAT\'\n' +
          '  : \'Answered\');\n' +
          'return [{ json: { answer, write_kind: write ? write.kind : \'none\', write, audit: { at: nowIso(), server, tool, args_json: JSON.stringify(args), ok: out.error ? \'no\' : \'yes\', summary: summary.slice(0, 300), ms: Date.now() - started } } }];\n'
        )
  } },
  output: [{ answer: {}, write_kind: 'none', write: null, audit: {} }]
});

const audit = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'Log to Audit', position: [860, 400], parameters: { source: 'database', workflowId: AUDIT_WF, mode: 'once', options: { waitForSubWorkflow: false } } }
});

const route = switchCase({
  version: 3.2,
  config: {
    name: 'What to Save?',
    position: [1080, 400],
    parameters: {
      rules: { values: [
        { outputKey: 'time', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Run Tool').first().json.write_kind }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'time' }], combinator: 'and' } },
        { outputKey: 'task_new', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Run Tool').first().json.write_kind }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'task_new' }], combinator: 'and' } },
        { outputKey: 'task_update', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Run Tool').first().json.write_kind }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'task_update' }], combinator: 'and' } },
        { outputKey: 'invoice', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr("{{ $('Run Tool').first().json.write_kind }}"), operator: { type: 'string', operation: 'equals' }, rightValue: 'invoice' }], combinator: 'and' } }
      ] },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'Nothing' }
    }
  }
});

const timeRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Time Entry', position: [1320, 160], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The new timesheet entry.\n' +
        'return $(\'Run Tool\').first().json.write.rows.map(r => ({ json: r }));\n'
  } },
  output: [{}]
});

const addTime = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Time Entry',
    position: [1540, 160],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Time' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'entry_id', displayName: 'entry_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'date', displayName: 'date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'person', displayName: 'person', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'project_id', displayName: 'project_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'task_id', displayName: 'task_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'hours', displayName: 'hours', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'billable', displayName: 'billable', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'logged_at', displayName: 'logged_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'invoice_id', displayName: 'invoice_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const taskRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'New Task', position: [1320, 320], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The new task.\n' +
        'return $(\'Run Tool\').first().json.write.rows.map(r => ({ json: r }));\n'
  } },
  output: [{}]
});

const addTask = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Task',
    position: [1540, 320],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Tasks' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'task_id', displayName: 'task_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'project_id', displayName: 'project_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'assignee', displayName: 'assignee', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'priority', displayName: 'priority', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'due', displayName: 'due', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const taskChange = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Task Change', position: [1320, 480], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The task fields that change (matched on task_id).\n' +
        'return $(\'Run Tool\').first().json.write.rows.map(r => ({ json: r }));\n'
  } },
  output: [{}]
});

const updTask = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Update Task',
    position: [1540, 480],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'update', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Tasks' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['task_id'], schema: [
          { id: 'task_id', displayName: 'task_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'project_id', displayName: 'project_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'assignee', displayName: 'assignee', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'priority', displayName: 'priority', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'due', displayName: 'due', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'created_at', displayName: 'created_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'updated_at', displayName: 'updated_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const invRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Draft Invoice', position: [1320, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The draft invoice.\n' +
        'return $(\'Run Tool\').first().json.write.rows.map(r => ({ json: r }));\n'
  } },
  output: [{}]
});

const addInv = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Add Invoice',
    position: [1540, 640],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'append', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Invoices' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: [
          { id: 'invoice_id', displayName: 'invoice_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'client_id', displayName: 'client_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'project_id', displayName: 'project_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'period', displayName: 'period', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'issue_date', displayName: 'issue_date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'due_date', displayName: 'due_date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'amount', displayName: 'amount', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'vat', displayName: 'vat', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'paid_date', displayName: 'paid_date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'lines_json', displayName: 'lines_json', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const billed = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Billed Entries', position: [1760, 640], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// The time entries now on the draft invoice (matched on entry_id).\n' +
        'return $(\'Run Tool\').first().json.write.time_updates.map(r => ({ json: r }));\n'
  } },
  output: [{}]
});

const markBilled = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Mark Time Billed',
    position: [1980, 640],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 1500,
    parameters: {
      resource: 'sheet', operation: 'update', documentId: DOC, sheetName: { __rl: true, mode: 'name', value: 'Time' },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['entry_id'], schema: [
          { id: 'entry_id', displayName: 'entry_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'date', displayName: 'date', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'person', displayName: 'person', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'project_id', displayName: 'project_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'task_id', displayName: 'task_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'hours', displayName: 'hours', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'billable', displayName: 'billable', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'note', displayName: 'note', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'logged_at', displayName: 'logged_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'invoice_id', displayName: 'invoice_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
      ] },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{}]
});

const answer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Answer', position: [2200, 400], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What the MCP client gets back. Runs last on every path, so it is the tool\'s result.\n' +
        'return [{ json: $(\'Run Tool\').first().json.answer }];\n'
  } },
  output: [{}]
});

const note = sticky(
  '## Brindle 3: Tools\nEvery MCP tool call lands here with its name and arguments. **Load Data** reads the whole Google Sheet in one request (Team, Clients, Projects, Tasks, Time, Invoices). **Run Tool** finds the client, project or person (by name or ID, and says when a name is ambiguous), checks access (finance tools only through the finance server), and answers in code from the data, so the numbers are exact. For writes it checks the input first, for example no future dates, at most 12 hours a day, no time on finished projects, and invoices only after a preview. Each call is logged to the **Audit** tab without slowing the answer.',
  [], { position: [160, -120], width: 1240, height: 200, color: 7 }
);

export default workflow('brindle-tools', 'Brindle 3: Tools')
  .add(whenCalled)
  .to(loadData)
  .to(runTool)
  .to(audit)
  .to(route
    .onCase(0, timeRows.to(addTime.to(answer)))
    .onCase(1, taskRows.to(addTask.to(answer)))
    .onCase(2, taskChange.to(updTask.to(answer)))
    .onCase(3, invRows.to(addInv.to(billed.to(markBilled.to(answer)))))
    .onCase(4, answer))
  .add(note);
