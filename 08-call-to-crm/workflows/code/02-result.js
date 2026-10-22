// What the upload form shows when processing ends.
// @include lib-tdw.js
const r = $('Call Row').first().json;
const d = $('Decide').first().json;
const p = $('Prepare').first().json;
const link = (p.settings.base_url || 'http://localhost:5678') + '/webhook/tidewater/review?call=' + r.call_id + '&t=' + r.token;
const li = a => a.map(x => '<li style="margin:3px 0">' + x + '</li>').join('');
const applied = d.applied.map(c => esc(c.label) + ': ' + esc(c.from) + ' → <b>' + esc(c.to) + '</b>');
applied.unshift('Call note with summary, BANT and objections');
for (const t of d.tasks) applied.push('Task: ' + esc(t.title) + ' (due ' + esc(day(t.due)) + ')');
const pend = d.pending.map(c => esc(c.label) + (c.to && c.field !== 'email' ? ': ' + esc(c.from) + ' → <b>' + esc(c.to) + '</b>' : '') + ' <span style="color:#98a2b3">(' + esc(c.why) + ')</span>');
const html = '<div style="text-align:left">'
  + '<h2 style="margin:0 0 6px;font-size:21px;color:#101828">' + esc(p.crm.deal.name) + '</h2>'
  + '<p style="margin:0 0 14px;color:#667085;font-size:14px">' + mmss($('Transcript').first().json.duration_s) + ' call · processed in ' + (r.process_ms / 1000).toFixed(0) + ' s' + (d.talk_us !== null ? ' · rep talked ' + d.talk_us + '% of the time' : '') + '</p>'
  + '<p style="margin:0 0 14px;color:#344054;font-size:15px">' + esc(d.analysis.summary) + '</p>'
  + '<p style="margin:0 0 4px;font-weight:600;color:#067647">Done in the CRM</p><ul style="margin:0 0 14px;padding-left:18px;color:#344054;font-size:14px">' + li(applied) + '</ul>'
  + '<p style="margin:0 0 4px;font-weight:600;color:#b54708">Waiting for you</p><ul style="margin:0 0 18px;padding-left:18px;color:#344054;font-size:14px">' + li(pend) + '</ul>'
  + '<a href="' + esc(link) + '" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:10px;font-weight:600;text-decoration:none">Review and send the follow-up</a></div>';
return [{ json: { call_id: r.call_id, review_url: link, applied: d.applied.length, pending: d.pending.length, tasks: d.tasks.length, process_ms: r.process_ms, html: formPage('Call processed', html) } }];
