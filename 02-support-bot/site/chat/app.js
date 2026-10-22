// Copperline service desk: full-page chat front end for the n8n Chat Trigger. No dependencies.
// Sends { action: 'sendMessage', sessionId, chatInput } to cfg.webhookUrl and reads `output` from the reply.
(() => {
  const cfg = window.COPPERLINE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');

  const ICON = {
    copy: '<rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    react: '<path d="M22 11v1a10 10 0 1 1-9-10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01M16 5h6M19 2v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
  };
  const svg = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
  const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙏', '🔥', '🤯'];
  const STAGES = [[0, 'Reading your message'], [2500, 'Checking Copperline’s info'], [6500, 'Putting the answer together'], [12000, 'Almost there']];

  // ---------- state ----------
  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: the chat still works for this visit */ } }
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const fresh = () => ({ sessionId: cfg.sessionPrefix + uid(), messages: [] });
  let state = (() => { const s = store.get(cfg.storageKey); return s && s.sessionId && Array.isArray(s.messages) ? s : fresh(); })();
  const save = () => store.set(cfg.storageKey, state);
  let busy = false;
  let stageTimers = [];

  const el = {
    app: $('.app'),
    thread: $('#thread'),
    scroller: $('#scroller'),
    form: $('#composer'),
    input: $('#input'),
    send: $('#send'),
    count: $('#count'),
    emojiBtn: $('#emoji-btn'),
    ac: $('#ac'),
    jump: $('#jump'),
    toast: $('#toast'),
    refs: $('#refs'),
    refsCard: $('#refs-card'),
    theme: $('#theme'),
    menu: $('#menu')
  };

  // ---------- text ----------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const digits = s => String(s).replace(/\D/g, '');
  const SLOT = /^((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+[a-z]{3,9}\.?\s+\d{1,2}),?\s+(\d{1,2}(?::\d{2})?\s*[ap]m)$/i;

  function inline(raw) {
    const keep = [];
    const hold = html => `\u0001${keep.push(html) - 1}\u0002`;
    let s = esc(raw);
    s = s.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${c}</code>`));
    s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^\s)]+)\)/g, (_, t, u) => hold(`<a href="${u}" target="_blank" rel="noopener">${t}</a>`));
    s = s.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, u => hold(`<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\//, '')}</a>`));
    s = s.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]*\w/g, m => hold(`<a href="mailto:${m}">${m}</a>`));
    s = s.replace(/\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-](\d{4})\b/g, (m, a, b, c) => hold(`<a class="tel" href="tel:+1${a}${b}${c}">${m}</a>`));
    s = s.replace(/\b(?:CA|T)-[A-Z0-9]{5}\b/g, m => hold(`<span class="ref">${m}</span>`));
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\w])_(?!\s)([^_]+?)_(?!\w)/g, '$1<em>$2</em>');
    return s.replace(/\u0001(\d+)\u0002/g, (_, i) => keep[i]);
  }

  // A list of drop-off times from check_availability becomes a card of tappable times, grouped by day.
  function slotsCard(items, live) {
    const days = new Map();
    items.forEach(t => {
      const [, day, time] = t.match(SLOT);
      if (!days.has(day)) days.set(day, []);
      days.get(day).push({ time, full: `${day}, ${time}` });
    });
    return `<div class="slots" role="group" aria-label="Open drop-off times">
      <p class="slots-h">${svg('calendar')}<span>Open drop-off times</span><small>${live ? 'Tap one to book it' : 'Offered earlier'}</small></p>
      ${[...days].map(([day, times]) => `<div class="slots-day"><p class="slots-label">${esc(day)}</p><div class="slots-grid">${times.map(s =>
        `<button type="button" class="slot" data-say="${esc(s.full)}"${live ? '' : ' disabled'}>${esc(s.time)}</button>`).join('')}</div></div>`).join('')}
    </div>`;
  }

  function markdown(text, live) {
    const out = [];
    let para = [];
    let list = null;
    const flushPara = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
    const flushList = () => {
      if (!list) return;
      const plain = list.items.map(i => i.replace(/\*\*/g, '').trim());
      if (list.tag === 'ul' && plain.every(i => SLOT.test(i))) out.push(slotsCard(plain, live));
      else out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
      list = null;
    };
    for (const line of String(text).replace(/\r\n?/g, '\n').split('\n')) {
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (bullet || numbered) {
        flushPara();
        const tag = bullet ? 'ul' : 'ol';
        if (list && list.tag !== tag) flushList();
        if (!list) list = { tag, items: [] };
        list.items.push((bullet || numbered)[1]);
      } else if (!line.trim()) {
        flushPara();
        flushList();
      } else {
        flushList();
        para.push(line.replace(/^#+\s*/, ''));
      }
    }
    flushPara();
    flushList();
    return out.join('');
  }

  // Cards built from what the reply says: a booking reference, a hand-off ticket, the tow line.
  function cards(text) {
    let html = '';
    const booking = text.match(/\bCA-[A-Z0-9]{5}\b/);
    if (booking && /book|confirm|see you/i.test(text)) {
      html += `<div class="ticket">
        <div class="ticket-main">
          <p class="ticket-eyebrow">${svg('check')}Booking confirmed</p>
          <p class="ticket-ref">${booking[0]}</p>
          <p class="ticket-note">A confirmation email is on its way. Quote this reference if anything changes.</p>
        </div>
        <div class="ticket-stub" aria-hidden="true"><span class="barcode"></span><span class="stub-label">Copperline</span></div>
      </div>`;
    }
    const ticket = text.match(/\bT-[A-Z0-9]{5}\b/);
    if (ticket) {
      html += `<div class="handoff">
        <span class="handoff-icon">${svg('team')}</span>
        <div><p class="handoff-title">Passed to our team · <span class="ref">${ticket[0]}</span></p>
        <p class="handoff-note">A person will reply by phone or email, usually the same working day.</p></div>
      </div>`;
    }
    if (digits(text).includes(digits(cfg.towLine))) {
      html += `<a class="sos" href="tel:+1${digits(cfg.towLine)}">
        <span class="sos-icon">${svg('phone')}</span>
        <span><strong>Call the 24/7 tow line</strong><small>${esc(cfg.towLine)} · or 911 if anyone is in danger</small></span>
      </a>`;
    }
    return html;
  }

  const segmenter = 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  function isJumbo(text) {
    const t = text.trim();
    if (!/^[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}\s]+$/u.test(t)) return false;
    const count = segmenter ? [...segmenter.segment(t.replace(/\s/g, ''))].length : (t.match(/\p{Extended_Pictographic}/gu) || []).length;
    return count > 0 && count <= 3;
  }

  // ---------- time and hours ----------
  const timeLabel = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(/\s/g, ' ');
  function dayLabel(ts) {
    const d = new Date(ts);
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }
  const clock = hhmm => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

  function shopNow() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: cfg.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map(p => [p.type, p.value]));
    const day = days.indexOf(parts.weekday);
    const now = Number(parts.hour) * 60 + Number(parts.minute);
    const mins = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const today = cfg.hours[day];
    if (today && now >= mins(today[0]) && now < mins(today[1])) return { day, open: true, text: `Open now · until ${clock(today[1])}` };
    if (today && now < mins(today[0])) return { day, open: false, text: `Closed · opens at ${clock(today[0])}` };
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      if (cfg.hours[d]) return { day, open: false, text: `Closed · opens ${i === 1 ? 'tomorrow' : days[d]} ${clock(cfg.hours[d][0])}` };
    }
    return { day, open: false, text: 'Closed' };
  }

  function paintHours() {
    const s = shopNow();
    $$('[data-status]').forEach(n => { n.dataset.open = String(s.open); n.querySelector('span').textContent = s.text; });
    $$('.hours [data-days]').forEach(row => row.classList.toggle('today', row.dataset.days.split(',').map(Number).includes(s.day)));
    const h = new Date().getHours();
    $('[data-greeting]').textContent = h < 5 ? 'Up late?' : h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
  }

  // ---------- rev-counter emblem ----------
  function gauge(kind) {
    const big = kind === 'emblem';
    const n = big ? 24 : 8;
    let ticks = '';
    for (let k = 0; k <= n; k++) {
      const a = (-120 + (240 * k) / n) * Math.PI / 180;
      const major = !big || k % 4 === 0;
      const r2 = big ? (major ? 37 : 41) : 34;
      const cls = k >= n - (big ? 3 : 1) ? 'tk red' : major ? 'tk major' : 'tk';
      const p = r => `${(50 + r * Math.sin(a)).toFixed(2)}`;
      const q = r => `${(50 - r * Math.cos(a)).toFixed(2)}`;
      ticks += `<line class="${cls}" x1="${p(46)}" y1="${q(46)}" x2="${p(r2)}" y2="${q(r2)}"/>`;
    }
    const hub = big
      ? '<circle class="hub" cx="50" cy="50" r="19"/><text class="hub-c" x="50" y="51">C</text>'
      : '<circle class="hub" cx="50" cy="50" r="11"/>';
    return `<svg class="gauge gauge-${kind}" viewBox="0 0 100 100" aria-hidden="true">${ticks}<line class="needle" x1="50" y1="50" x2="50" y2="${big ? 13 : 14}"/>${hub}</svg>`;
  }

  // ---------- rendering ----------
  function messageHtml(i, isNew) {
    const m = state.messages[i];
    const prev = state.messages[i - 1];
    const day = !prev || dayLabel(prev.ts) !== dayLabel(m.ts) ? `<p class="day"><span>${dayLabel(m.ts)}</span></p>` : '';
    const anim = isNew ? ' is-new' : '';
    if (m.role === 'user') {
      const jumbo = isJumbo(m.text);
      return `${day}<article class="msg user${m.failed ? ' failed' : ''}${anim}" data-i="${i}">
        <div class="bubble${jumbo ? ' jumbo' : ''}">${esc(m.text).replace(/\n/g, '<br>')}</div>
        ${m.failed
          ? `<p class="fail">${svg('alert')}<span>${m.failed === 'offline' ? 'Not sent: the assistant is offline right now.' : 'Not sent.'}</span><button type="button" class="link-btn" data-retry="${i}">Try again</button><span>or call <a class="tel" href="tel:+1${digits(cfg.phone)}">${esc(cfg.phone)}</a></span></p>`
          : `<time class="stamp" datetime="${new Date(m.ts).toISOString()}">${timeLabel(m.ts)}</time>`}
      </article>`;
    }
    const cont = prev && prev.role === 'bot' && !day ? ' cont' : '';
    const live = i === state.messages.length - 1 && !busy;
    return `${day}<article class="msg bot${cont}${anim}" data-i="${i}">
      <span class="avatar" aria-hidden="true">C</span>
      <div class="msg-body">
        <header class="msg-head"><strong>${esc(cfg.botName)}</strong><time datetime="${new Date(m.ts).toISOString()}">${timeLabel(m.ts)}</time></header>
        <div class="md">${markdown(m.text, live)}</div>
        ${cards(m.text)}
        <div class="rx">${reactionChips(m, i)}</div>
        <div class="actions">
          <button type="button" class="act" data-copy="${i}" aria-label="Copy reply" title="Copy">${svg('copy')}</button>
          <button type="button" class="act" data-react="${i}" aria-label="Add a reaction" aria-expanded="false" title="React">${svg('react')}</button>
        </div>
      </div>
    </article>`;
  }

  const reactionChips = (m, i) => (m.reactions || []).map(e =>
    `<button type="button" class="rx-chip" data-unreact="${i}" data-e="${e}" aria-label="Remove ${e} reaction">${e}</button>`).join('');

  function render() {
    el.app.dataset.empty = state.messages.length ? 'false' : 'true';
    el.thread.innerHTML = state.messages.map((_, i) => messageHtml(i, false)).join('');
    paintRefs();
  }

  function append(i) {
    el.app.dataset.empty = 'false';
    el.thread.insertAdjacentHTML('beforeend', messageHtml(i, true));
    const node = el.thread.querySelector(`.msg[data-i="${i}"]`);
    if (state.messages[i].role === 'bot') reveal(node);
    paintRefs();
    return node;
  }

  function replaceMessage(i) {
    const node = el.thread.querySelector(`.msg[data-i="${i}"]`);
    if (!node) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = messageHtml(i, false);
    node.replaceWith(tmp.querySelector('.msg'));
  }

  // Words fade in one after another, like a streamed reply. The full text is in the DOM from the start.
  function reveal(node) {
    if (reducedMotion.matches) return;
    const md = node.querySelector('.md');
    const walker = document.createTreeWalker(md, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim() && !walker.currentNode.parentElement.closest('.slots')) texts.push(walker.currentNode);
    const total = texts.reduce((n, t) => n + t.nodeValue.split(/\s+/).filter(Boolean).length, 0);
    const step = Math.min(32, 900 / Math.max(total, 1));
    let k = 0;
    texts.forEach(t => {
      const frag = document.createDocumentFragment();
      t.nodeValue.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(part); return; }
        const w = document.createElement('span');
        w.className = 'w';
        w.style.animationDelay = `${Math.round(k++ * step)}ms`;
        w.textContent = part;
        frag.append(w);
      });
      t.replaceWith(frag);
    });
    node.style.setProperty('--after', `${Math.round(k * step)}ms`);
  }

  function paintRefs() {
    const items = [];
    state.messages.forEach((m, i) => {
      if (m.role !== 'bot') return;
      (m.text.match(/\b(?:CA|T)-[A-Z0-9]{5}\b/g) || []).forEach(ref => {
        if (!items.some(x => x.ref === ref)) items.push({ ref, i, kind: ref.startsWith('CA') ? 'Booking' : 'Hand-off ticket' });
      });
    });
    el.refsCard.hidden = !items.length;
    el.refs.innerHTML = items.map(x => `<li><button type="button" class="ref-row" data-goto="${x.i}">
      <span class="ref-icon">${svg(x.kind === 'Booking' ? 'ticket' : 'team')}</span>
      <span><small>${x.kind}</small><span class="ref">${x.ref}</span></span></button></li>`).join('');
  }

  // ---------- scrolling ----------
  const nearBottom = () => el.scroller.scrollHeight - el.scroller.scrollTop - el.scroller.clientHeight < 120;
  const toBottom = (smooth = true) => el.scroller.scrollTo({ top: el.scroller.scrollHeight, behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto' });
  el.scroller.addEventListener('scroll', () => { if (nearBottom()) el.jump.hidden = true; }, { passive: true });
  el.jump.addEventListener('click', () => { el.jump.hidden = true; toBottom(); });

  // ---------- conversation ----------
  function showThinking() {
    el.thread.insertAdjacentHTML('beforeend', `<article class="msg bot thinking is-new" id="thinking" aria-label="${esc(cfg.botName)} is working on a reply">
      <span class="avatar gauge-tile">${gauge('mini')}</span>
      <div class="msg-body"><header class="msg-head"><strong>${esc(cfg.botName)}</strong></header><ol class="steps" id="steps">${stepHtml(STAGES[0][1])}</ol></div>
    </article>`);
    // Each stage that passes gets a tick; the current one shimmers.
    stageTimers = STAGES.slice(1).map(([ms, text]) => setTimeout(() => {
      const steps = $('#steps');
      if (!steps) return;
      const now = steps.querySelector('.step:last-child');
      now.querySelector('.step-dot').outerHTML = svg('check');
      now.querySelector('.stage').classList.remove('stage');
      steps.insertAdjacentHTML('beforeend', stepHtml(text));
      if (nearBottom()) toBottom();
    }, ms));
  }
  const stepHtml = text => `<li class="step"><span class="step-dot"></span><span class="stage">${esc(text)}</span></li>`;
  function hideThinking() {
    stageTimers.forEach(clearTimeout);
    $('#thinking')?.remove();
  }

  async function ask(i) {
    const text = state.messages[i].text;
    busy = true;
    syncComposer();
    $$('.slot').forEach(b => { b.disabled = true; });
    showThinking();
    toBottom();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.requestTimeoutMs);
    let reply = '';
    let offline = false;
    try {
      const res = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', sessionId: state.sessionId, chatInput: text }),
        signal: ctrl.signal
      });
      if (!res.ok) { offline = res.status >= 502; throw new Error(`HTTP ${res.status}`); }
      const data = await res.json();
      const item = Array.isArray(data) ? data[0] : data;
      reply = String(item?.output ?? item?.text ?? item?.message ?? '');
      if (!reply) throw new Error('Empty reply');
    } catch (err) {
      reply = '';
      if (err instanceof TypeError) offline = true;
    } finally {
      clearTimeout(timer);
    }
    hideThinking();
    busy = false;
    const stick = nearBottom();
    if (reply) {
      state.messages.push({ role: 'bot', text: reply, ts: Date.now(), reactions: [] });
      save();
      append(state.messages.length - 1);
    } else {
      state.messages[i].failed = offline ? 'offline' : true;
      save();
      replaceMessage(i);
    }
    syncComposer();
    if (stick) toBottom(); else el.jump.hidden = false;
  }

  function send(raw) {
    const text = String(raw || '').trim().slice(0, 1000);
    if (!text || busy) return;
    closeDrawer();
    state.messages.push({ role: 'user', text, ts: Date.now() });
    save();
    const i = state.messages.length - 1;
    append(i);
    el.input.value = '';
    syncComposer();
    toBottom();
    ask(i);
  }

  function retry(i) {
    if (busy || !state.messages[i]) return;
    delete state.messages[i].failed;
    save();
    replaceMessage(i);
    ask(i);
  }

  function newChat() {
    if (busy) return;
    state = fresh();
    save();
    render();
    closeDrawer();
    el.scroller.scrollTop = 0;
    toast('Started a new conversation');
    if (finePointer.matches) el.input.focus();
  }

  // ---------- reactions and copy ----------
  function toggleReaction(i, emoji) {
    const m = state.messages[i];
    if (!m) return;
    m.reactions = m.reactions || [];
    m.reactions = m.reactions.includes(emoji) ? m.reactions.filter(e => e !== emoji) : [...m.reactions, emoji];
    save();
    const rx = el.thread.querySelector(`.msg[data-i="${i}"] .rx`);
    if (rx) {
      rx.innerHTML = reactionChips(m, i);
      rx.querySelector(`[data-e="${emoji}"]`)?.classList.add('pop');
    }
  }

  function closeReactBar() {
    const bar = $('.rx-bar');
    if (!bar) return;
    bar.closest('.actions')?.querySelector('[data-react]')?.setAttribute('aria-expanded', 'false');
    bar.remove();
  }

  function openReactBar(btn, i) {
    const wasOpen = btn.getAttribute('aria-expanded') === 'true';
    closeReactBar();
    if (wasOpen) return;
    btn.setAttribute('aria-expanded', 'true');
    const bar = document.createElement('div');
    bar.className = 'rx-bar';
    bar.setAttribute('role', 'menu');
    bar.innerHTML = QUICK_REACTIONS.map(e => `<button type="button" role="menuitem" data-pick="${e}" aria-label="React with ${e}">${e}</button>`).join('')
      + `<button type="button" role="menuitem" class="rx-more" aria-label="More emoji">${svg('plus')}</button>`;
    btn.parentElement.appendChild(bar);
    bar.addEventListener('click', e => {
      const pick = e.target.closest('[data-pick]');
      if (pick) { toggleReaction(i, pick.dataset.pick); EmojiKit.remember(pick.dataset.pick); closeReactBar(); return; }
      const more = e.target.closest('.rx-more');
      if (more) EmojiKit.open({ anchor: more, onPick: emoji => { toggleReaction(i, emoji); closeReactBar(); } });
    });
    bar.querySelector('button').focus();
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); }
    catch { toast('Couldn’t copy. Select the text instead.'); }
  }

  let toastTimer;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }

  // ---------- composer ----------
  function syncComposer() {
    el.input.style.height = 'auto';
    el.input.style.height = `${Math.min(el.input.scrollHeight, 200)}px`;
    const n = el.input.value.length;
    el.count.hidden = n < 800;
    el.count.textContent = `${n} / 1000`;
    el.count.classList.toggle('over', n >= 1000);
    el.send.disabled = busy || !el.input.value.trim();
    el.form.classList.toggle('is-busy', busy);
  }

  function insertAtCaret(text) {
    const { selectionStart: a, selectionEnd: b, value } = el.input;
    el.input.value = value.slice(0, a) + text + value.slice(b);
    const caret = a + text.length;
    el.input.focus({ preventScroll: true });
    el.input.setSelectionRange(caret, caret);
    syncComposer();
  }

  // :shortcode autocomplete
  let acItems = [];
  let acIndex = 0;
  function acQuery() {
    const before = el.input.value.slice(0, el.input.selectionStart);
    const m = before.match(/(?:^|\s):([a-z0-9_+-]{2,})$/i);
    return m ? m[1] : null;
  }
  function acUpdate() {
    const q = acQuery();
    acItems = q ? EmojiKit.search(q, 6) : [];
    acIndex = 0;
    el.ac.hidden = !acItems.length;
    if (acItems.length) paintAc();
  }
  function paintAc() {
    el.ac.innerHTML = acItems.map((x, k) => `<button type="button" role="option" class="ac-item" data-k="${k}" aria-selected="${k === acIndex}">
      <span class="ac-e">${x.e}</span><span class="ac-name">:${x.name}:</span></button>`).join('');
  }
  function acPick(k) {
    const x = acItems[k];
    if (!x) return;
    const q = acQuery();
    const a = el.input.selectionStart - q.length - 1;
    el.input.setSelectionRange(a, el.input.selectionStart);
    insertAtCaret(`${x.e} `);
    EmojiKit.remember(x.e);
    el.ac.hidden = true;
    acItems = [];
  }

  el.input.addEventListener('input', () => { syncComposer(); acUpdate(); });
  el.input.addEventListener('click', acUpdate);
  el.input.addEventListener('blur', () => setTimeout(() => { el.ac.hidden = true; }, 120));
  el.input.addEventListener('keydown', e => {
    if (!el.ac.hidden && acItems.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        acIndex = (acIndex + (e.key === 'ArrowDown' ? 1 : -1) + acItems.length) % acItems.length;
        paintAc();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acPick(acIndex); return; }
      if (e.key === 'Escape') { e.preventDefault(); el.ac.hidden = true; return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(el.input.value); }
  });
  el.ac.addEventListener('pointerdown', e => {
    const item = e.target.closest('.ac-item');
    if (item) { e.preventDefault(); acPick(Number(item.dataset.k)); }
  });
  el.form.addEventListener('submit', e => { e.preventDefault(); send(el.input.value); });
  el.emojiBtn.addEventListener('click', () => EmojiKit.toggle({ anchor: el.emojiBtn, around: el.form, onPick: insertAtCaret }));

  // ---------- clicks in the conversation ----------
  document.addEventListener('click', e => {
    const say = e.target.closest('[data-say]');
    if (say && !say.disabled) { send(say.classList.contains('slot') ? `I'll take ${say.dataset.say}` : say.dataset.say); return; }
    const retryBtn = e.target.closest('[data-retry]');
    if (retryBtn) { retry(Number(retryBtn.dataset.retry)); return; }
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) { copy(state.messages[Number(copyBtn.dataset.copy)].text); return; }
    const reactBtn = e.target.closest('[data-react]');
    if (reactBtn) { openReactBar(reactBtn, Number(reactBtn.dataset.react)); return; }
    const chip = e.target.closest('[data-unreact]');
    if (chip) { toggleReaction(Number(chip.dataset.unreact), chip.dataset.e); return; }
    const go = e.target.closest('[data-goto]');
    if (go) {
      closeDrawer();
      const node = el.thread.querySelector(`.msg[data-i="${go.dataset.goto}"]`);
      if (node) { node.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' }); node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash'); }
      return;
    }
    if (e.target.closest('[data-new-chat]')) { newChat(); return; }
    if (e.target.closest('[data-close-drawer]')) { closeDrawer(); return; }
    if (!e.target.closest('.rx-bar, [data-react], .ep')) closeReactBar();
  });

  // ---------- drawer, theme, keys ----------
  function closeDrawer() {
    el.app.dataset.drawer = 'closed';
    el.menu.setAttribute('aria-expanded', 'false');
  }
  el.menu.addEventListener('click', () => {
    const open = el.app.dataset.drawer !== 'open';
    el.app.dataset.drawer = open ? 'open' : 'closed';
    el.menu.setAttribute('aria-expanded', String(open));
    if (open) $('#side .btn-new').focus();
  });

  const effectiveTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function paintThemeButton() {
    const dark = effectiveTheme() === 'dark';
    el.theme.innerHTML = svg(dark ? 'sun' : 'moon');
    el.theme.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  el.theme.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('copperline-theme', next); } catch { /* storage blocked */ }
    paintThemeButton();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintThemeButton);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeReactBar(); closeDrawer(); }
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); el.input.focus(); }
  });

  // ---------- start ----------
  $('#emblem').innerHTML = gauge('emblem');
  paintHours();
  setInterval(paintHours, 60000);
  paintThemeButton();
  render();
  syncComposer();
  if (state.messages.length) requestAnimationFrame(() => toBottom(false));
  if (finePointer.matches) el.input.focus({ preventScroll: true });
})();
