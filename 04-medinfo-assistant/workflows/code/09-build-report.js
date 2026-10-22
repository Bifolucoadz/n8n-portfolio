// The weekly report as Telegram HTML (and plain JSON for the execution log).
const s = $('Weekly Numbers').first().json.stats ?? {};
let themes = [];
if ($('Group Knowledge Gaps').isExecuted) {
  for (const o of $('Group Knowledge Gaps').first().json.output ?? []) {
    for (const c of o.content ?? []) {
      let d = c.text;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
      if (d?.themes) themes = d.themes;
    }
  }
}
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const list = obj => Object.entries(obj ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(k.replace(/_/g, ' '))}: ${n}`).join(', ') || 'none';
const sec = ms => (ms ? (ms / 1000).toFixed(1) + ' s' : 'n/a');
const lines = [
  '<b>Larkmoor Medical Information assistant: last 7 days</b>',
  `${s.questions ?? 0} questions in ${s.sessions ?? 0} conversations`,
  `By role: ${list(s.by_role)}`,
  `Outcomes: ${list(s.by_route)}`,
  `Feedback: ${s.thumbs_up ?? 0} up, ${s.thumbs_down ?? 0} down`,
  `Speed: median ${sec(s.median_latency_ms)}, 90th percentile ${sec(s.p90_latency_ms)}`,
  '',
  '<b>Cases opened</b>',
  list(s.cases_opened),
];
if ((s.cases_overdue ?? []).length) {
  lines.push(`<b>Overdue (${s.cases_overdue.length})</b>: ` + s.cases_overdue.map(c => esc(c.ref)).join(', '));
}
lines.push('', '<b>Most cited documents</b>');
lines.push(...((s.top_documents ?? []).map(d => `${esc(d.doc_code)} (${d.n}): ${esc(d.title)}`)), ...(s.top_documents?.length ? [] : ['none']));
lines.push('', `<b>Knowledge gaps</b> (${(s.gap_questions ?? []).length} unanswered or thumbs-down questions)`);
if (themes.length) {
  for (const t of themes) {
    lines.push(`- <b>${esc(t.title)}</b> (${t.count}): ${esc(t.suggestion)} <i>Fix in: ${esc(t.document)}</i>`);
    for (const e of (t.examples ?? []).slice(0, 2)) lines.push(`    "${esc(e)}"`);
  }
} else {
  lines.push('None this week.');
}
const chat = String($('Config').first().json.REPORT_CHAT_ID || '').trim();
return [{ json: { chat_id: chat, send: !!chat, text: lines.join('\n').slice(0, 4000), stats: s, themes } }];
