// The question for Ironleaf 1, with this chat's last questions and their SQL (for follow-ups).
const b = $('Ask Request').first().json.body || {};
const question = String(b.question || '').trim().slice(0, 500);
const session = String(b.session_id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'anon';
const history = $('Read History').all().map(i => i.json).filter(h => h && h.question).sort((a, c) => String(a.at).localeCompare(String(c.at))).slice(-3).map(h => ({ question: h.question, sql: h.sql }));
return [{ json: { ok: question.length >= 3, question, session_id: session, history: JSON.stringify(history) } }];
