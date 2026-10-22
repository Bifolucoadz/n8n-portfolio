// The question with today's date and the last few questions in this chat (for follow-ups).
// @include lib-ilf.js
const i = $('When Called').first().json;
const now = DateTime.now().setZone(TZ);
const history = parseJson(i.history, []).slice(-3).filter(h => h && h.question);
const prompt = 'Today is ' + now.toFormat('cccc d LLLL yyyy') + ' (current_date in SQL).\n\n'
  + (history.length ? 'Earlier in this chat:\n' + history.map(h => '- Q: ' + h.question + (h.sql ? '\n  SQL: ' + h.sql : '')).join('\n') + '\n\n' : '')
  + 'Question: ' + String(i.question || '').trim();
return [{ json: { question: String(i.question || '').trim(), prompt, started_ms: Date.now() } }];
