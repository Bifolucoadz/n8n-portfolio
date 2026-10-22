// The call record the review page works from.
// @include lib-tdw.js
const d = $('Decide').first().json;
const t = $('Transcript').first().json;
const k = $('Keep Audio').first().json;
return [{ json: {
  call_id: d.call_id, deal_id: d.deal_id, rep: d.rep, filename: k.filename, duration_s: t.duration_s,
  transcript_json: JSON.stringify({ labelled: t.labelled, coverage: t.coverage, turns: t.turns, text: t.labelled ? '' : t.transcript }),
  analysis_json: JSON.stringify({ ...d.analysis, talk_us: d.talk_us, quotes_checked: d.quotes_checked, quotes_verified: d.quotes_verified }),
  applied_json: JSON.stringify({ changes: d.applied, tasks: d.tasks, note: d.note }),
  pending_json: JSON.stringify(d.pending),
  email_to: d.email_to, email_subject: d.email_subject, email_body: d.email_body,
  status: 'pending_review', token: newToken(24), created_at: nowIso(), reviewed_at: '', process_ms: Date.now() - k.started_ms
} }];
