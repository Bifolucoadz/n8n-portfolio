// Larkmoor Medical Information chat page. Talks to n8n (MedInfo 6: Chat API) directly when served
// from this Mac, and through the same-origin /api proxy when hosted.
(() => {
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = LOCAL ? 'http://localhost:5678/webhook/medinfo' : '/api';

  const ROLES = {
    hcp: {
      label: 'Healthcare professional',
      chips: [
        ['Dosing', 'What dose of Quenvara for atrial fibrillation with a creatinine clearance of 22 mL/min?'],
        ['Reconstitution', 'How much water do I add to a 100 mL bottle of Aurivex 250 mg/5 mL?'],
        ['Side effect', 'My patient on Lumetra 1 mg was admitted with acute pancreatitis last night.'],
        ['Off-label', 'Can Quenvara be used in a patient with a mechanical heart valve?'],
        ['Not in the label', 'Does grapefruit juice interact with Quenvara?'],
        ['Label history', 'What changed in the Quenvara renal dosing in the latest label?'],
      ],
    },
    field: {
      label: 'Field sales representative',
      chips: [
        ['Supply', 'Is NDC 99107-425-10 in stock, and what is the list price?'],
        ['Procedure', 'How quickly do I have to report an adverse event a doctor tells me about?'],
        ['Off-label', 'A doctor asked if Quenvara tablets can be crushed for an NG tube. What do I tell her?'],
        ['Complaint', 'A pharmacist says a Lumetra 2 mg pen from lot LM24081 won\'t click and no dose comes out.'],
      ],
    },
    medinfo: {
      label: 'Medical Information specialist',
      chips: [
        ['Standard response', 'What data do we have on Quenvara in patients with mechanical heart valves?'],
        ['Stability', 'An unopened Lumetra pen was left at 35 °C for a day. Can it still be used?'],
        ['Pediatrics', 'Is there any data on Aurivex in infants younger than 3 months?'],
        ['Feeding tubes', 'Can Quenvara tablets be crushed and given through a nasogastric tube?'],
      ],
    },
  };
  const STEPS = ['Screening for safety reports', 'Searching approved documents', 'Ranking passages', 'Writing a cited answer'];

  const $ = s => document.querySelector(s);
  const app = $('.app'), thread = $('#thread'), hello = $('#hello'), input = $('#input'), send = $('#send');
  let role = 'hcp', session = newSession(), busy = false;

  function newSession() { return 'web-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Small Markdown renderer for what the assistant writes: paragraphs, lists, tables, bold,
  // italics, code and [n] citation chips. Everything is escaped first.
  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[(\d{1,2})\]/g, '<button type="button" class="cite" data-n="$1" aria-label="Source $1">$1</button>');
  }
  function md(src) {
    const lines = String(src ?? '').replace(/\r/g, '').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(line)) {
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
        const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const body = rows.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
        const [head, ...rest] = body;
        out.push('<table><thead><tr>' + cells(head).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
          rest.map(r => '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
        continue;
      }
      if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
        const ordered = /^\s*\d+[.)]/.test(line);
        const items = [];
        while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
          let item = lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, '');
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
          items.push(`<li>${inline(item)}</li>`);
        }
        out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^\s*\|/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) para.push(lines[i++].replace(/^#+\s*/, ''));
      const text = para.join(' ');
      const cls = /^off-label information/i.test(text) ? ' class="offlabel"' : '';
      out.push(`<p${cls}>${inline(text)}</p>`);
    }
    return out.join('');
  }

  const ICON = {
    alert: '<svg class="i" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/></svg>',
    box: '<svg class="i" viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>',
    send: '<svg class="i" viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z"/></svg>',
    lock: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  };
  function flagsFor(d) {
    const f = [], refs = d.case_refs ?? [], ref = p => refs.filter(r => r.startsWith(p));
    if (d.route === 'emergency') f.push(['danger', ICON.alert, 'Emergency: call 911']);
    for (const r of ref('AE-')) f.push(['danger', ICON.alert, `Adverse event sent to Pharmacovigilance <code>${esc(r)}</code>`]);
    for (const r of ref('PC-')) f.push(['warn', ICON.box, `Product complaint sent to Quality Assurance <code>${esc(r)}</code>`]);
    for (const r of ref('MIR-')) f.push(['info', ICON.send, `Medical Information request <code>${esc(r)}</code>`]);
    if (d.route === 'off_label_declined') f.push(['warn', ICON.lock, 'Off-label question: not discussed for this role']);
    if (d.route === 'off_label_answered') f.push(['warn', ICON.lock, 'Off-label information (unsolicited request)']);
    if (d.route === 'not_in_documents') f.push(['info', ICON.search, 'Not covered by the approved documents']);
    return f.map(([c, ic, t]) => `<span class="flag ${c}">${ic}${t}</span>`).join('');
  }
  function sourceHtml(s) {
    const where = [s.section, s.page ? `page ${s.page}` : ''].filter(Boolean).join(' · ');
    const badges = `<span class="badge ${s.status === 'superseded' ? 'superseded' : 'current'}">${s.status === 'superseded' ? 'superseded' : 'current'}</span>` +
      (s.access_level && s.access_level !== 'public' ? `<span class="badge access">${esc(s.access_level)}</span>` : '') +
      ((s.flags ?? []).includes('ocr_unverified') ? '<span class="badge ocr">scanned</span>' : '');
    const title = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title);
    return `<li class="src" data-n="${s.n}"><span class="n">[${s.n}]</span><div><div class="t">${title}${badges}</div>` +
      `<div class="d"><span class="code">${esc(s.doc_code)} v${esc(s.version)}</span>${s.effective_date ? ' · effective ' + esc(s.effective_date) : ''}${where ? ' · ' + esc(where) : ''}</div></div></li>`;
  }
  function traceHtml(d) {
    const fl = d.flags ?? {};
    const screen = ['adverse_event', 'product_complaint', 'off_label', 'emergency'].filter(k => fl[k]).map(k => k.replace('_', ' '));
    const rows = [
      ['role', ROLES[d.role]?.label ?? d.role],
      ['compliance screen', screen.length ? screen.join(', ') + (fl.off_label_topic ? ` (${fl.off_label_topic})` : '') : 'nothing flagged'],
      ['retrieval', (d.tools ?? []).map(t => t === 'pre_search' ? 'hybrid search + rerank' : t.replace(/_/g, ' ')).join(' → ') || 'none'],
      ['sources cited', String((d.sources ?? []).length)],
      ['unverified citations', String(fl.invalid_citations_removed ?? 0) + ' removed'],
      ['outcome', String(d.route ?? '').replace(/_/g, ' ')],
      ['time', d.latency_ms ? (d.latency_ms / 1000).toFixed(1) + ' s' : 'n/a'],
      ['audit id', d.turn_id ?? ''],
    ];
    return '<dl>' + rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') + '</dl>';
  }

  function scrollDown() { thread.scrollTop = thread.scrollHeight; }
  function setEmpty(empty) { app.dataset.empty = String(empty); hello.hidden = !empty; }

  function addUser(text) {
    const n = $('#tpl-user').content.cloneNode(true);
    n.querySelector('.bubble').textContent = text;
    thread.appendChild(n);
  }
  function addPending() {
    const el = document.createElement('article');
    el.className = 'msg bot pending';
    el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span><span class="steps"></span>';
    thread.appendChild(el);
    let k = 0;
    const tick = () => { el.querySelector('.steps').textContent = STEPS[Math.min(k++, STEPS.length - 1)] + '…'; };
    tick();
    el._timer = setInterval(tick, 2200);
    return el;
  }
  function addBot(d, pending) {
    clearInterval(pending._timer);
    const n = $('#tpl-bot').content.cloneNode(true);
    const el = n.querySelector('.msg');
    el.querySelector('.flags').innerHTML = flagsFor(d);
    el.querySelector('.answer').innerHTML = md(d.answer);
    el.querySelector('.sources').innerHTML = (d.sources ?? []).map(sourceHtml).join('');
    el.querySelector('.trace').innerHTML = traceHtml(d);
    el.dataset.turn = d.turn_id ?? '';
    if (!d.turn_id) el.querySelectorAll('.fb').forEach(b => b.hidden = true);
    pending.replaceWith(el);
  }

  async function ask(text) {
    if (busy || !text.trim()) return;
    busy = true; send.disabled = true; setEmpty(false);
    addUser(text);
    const pending = addPending();
    scrollDown();
    try {
      const r = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session, role, message: text }),
        signal: AbortSignal.timeout(90000),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.answer) throw new Error(d.error || `HTTP ${r.status}`);
      addBot(d, pending);
    } catch (e) {
      clearInterval(pending._timer);
      pending.classList.remove('pending');
      pending.innerHTML = '<p class="error">The assistant is offline right now. Please call Larkmoor Medical Information on 1-800-555-0199. To report a side effect, call 1-800-555-0177.</p>';
    }
    busy = false; updateSend(); scrollDown(); input.focus();
  }

  function reset() {
    session = newSession();
    thread.querySelectorAll('.msg').forEach(m => m.remove());
    setEmpty(true);
    renderChips();
    input.value = ''; updateSend();
  }
  function renderChips() {
    $('#chips').innerHTML = ROLES[role].chips.map(([k, q]) => `<button type="button" class="chip" data-q="${esc(q)}"><small>${esc(k)}</small>${esc(q)}</button>`).join('');
    $('#role-label').textContent = ROLES[role].label;
  }
  function updateSend() { send.disabled = busy || !input.value.trim(); }

  // Events
  $('#composer').addEventListener('submit', e => { e.preventDefault(); const t = input.value; input.value = ''; autosize(); ask(t); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#composer').requestSubmit(); } });
  const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; updateSend(); };
  input.addEventListener('input', autosize);
  document.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) return ask(chip.dataset.q);
    const cite = e.target.closest('.cite');
    if (cite) {
      const src = cite.closest('.msg').querySelector(`.src[data-n="${cite.dataset.n}"]`);
      if (src) { src.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); src.classList.add('hl'); setTimeout(() => src.classList.remove('hl'), 1600); }
      return;
    }
    const how = e.target.closest('.how');
    if (how) { const tr = how.closest('.msg').querySelector('.trace'); tr.hidden = !tr.hidden; how.setAttribute('aria-expanded', String(!tr.hidden)); return; }
    const fb = e.target.closest('.fb');
    if (fb) {
      const msg = fb.closest('.msg');
      msg.querySelectorAll('.fb').forEach(b => b.setAttribute('aria-pressed', String(b === fb)));
      fetch(`${API}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turn_id: msg.dataset.turn, rating: Number(fb.dataset.rating) }) }).catch(() => {});
      return;
    }
    if (e.target.closest('[data-new-chat]')) { reset(); app.classList.remove('drawer'); return; }
    if (e.target.closest('[data-close-drawer]')) { app.classList.remove('drawer'); $('#menu').setAttribute('aria-expanded', 'false'); }
  });
  $('#menu').addEventListener('click', () => { const open = !app.classList.contains('drawer'); app.classList.toggle('drawer', open); $('#menu').setAttribute('aria-expanded', String(open)); });
  document.querySelectorAll('input[name="role"]').forEach(r => r.addEventListener('change', () => {
    role = r.value;
    try { localStorage.setItem('larkmoor-role', role); } catch {}
    reset();
    app.classList.remove('drawer');
  }));

  // Theme toggle
  const themeBtn = $('#theme');
  const sun = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  const moon = '<svg class="i" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const paintTheme = () => { themeBtn.innerHTML = isDark() ? sun : moon; themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme'); };
  themeBtn.addEventListener('click', () => { const t = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('larkmoor-theme', t); } catch {} paintTheme(); });
  paintTheme();

  // Start
  try { const saved = localStorage.getItem('larkmoor-role'); if (ROLES[saved]) { role = saved; document.querySelector(`input[name="role"][value="${saved}"]`).checked = true; } } catch {}
  const q = new URLSearchParams(location.search).get('role');
  if (ROLES[q]) { role = q; document.querySelector(`input[name="role"][value="${q}"]`).checked = true; }
  renderChips();
  setEmpty(true);
})();
