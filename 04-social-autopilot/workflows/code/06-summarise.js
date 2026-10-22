// Combine the two results into the sheet update and the message for the owner.
const p = $('Attach Image').first().json;
const results = $input.all().map(i => i.json).filter(r => r.platform);
const label = { linkedin: 'LinkedIn', telegram: 'Telegram' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const row = { post_id: p.post_id, updated_at: p.now_text };
const ok = results.filter(r => r.status === 'ok');
const failed = results.filter(r => r.status === 'error');
for (const r of ok) row[r.platform + '_url'] = r.url;
const done = ok.length + p.already.length;
row.status = failed.length === 0 ? 'posted' : done > 0 ? 'partial' : 'failed';
if (ok.length) row.posted_at = p.now_text;
const problems = failed.map(f => label[f.platform] + ': ' + f.error);
const notes = [...p.notes, ...ok.filter(r => r.note).map(r => label[r.platform] + ': ' + r.note)];
row.error = [...problems, ...notes].join(' | ');
row.attempts = failed.length ? String(p.attempts + 1) : '0';

const lines = [];
if (!failed.length) lines.push('✅ <b>Posted</b> · <code>' + p.post_id + '</code>');
else lines.push((ok.length ? '⚠️ <b>Partly posted</b>' : '❌ <b>Not posted</b>') + ' · <code>' + p.post_id + '</code>');
lines.push('<i>' + esc(p.topic) + '</i>');
for (const r of ok) lines.push(label[r.platform] + ': ' + (/^https?:/.test(r.url) ? '<a href="' + esc(r.url) + '">open post</a>' : esc(r.url)));
for (const r of failed) lines.push(label[r.platform] + ' failed: ' + esc(r.error.slice(0, 300)));
for (const n of notes) lines.push('⚠️ ' + esc(n));
if (failed.length) lines.push('Fix the problem, then tap Retry. Platforms that already worked are not posted again.');

return [{ json: { ...row, all_ok: failed.length === 0, owner_message: lines.join('\n'), approver: p.approver } }];
