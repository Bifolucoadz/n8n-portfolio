// Speaker turns from the split, checked against the plain transcript: the turns must contain the same
// words in the same order (at least 95% of them), otherwise the plain text is used without names.
// Talk time is measured in words per side. Builds the analysis prompt.
// @include lib-tdw.js
const p = $('Prepare').first().json;
const plain = $('Split Input').first().json.text;
const split = aiJson($input.first().json);
const words = s => norm(s).split(' ').filter(Boolean);
const plainWords = words(plain);
let turns = (split && split.turns) || [];
const turnWords = words(turns.map(t => t.text).join(' '));
// Share of the plain transcript's words that appear in the turns in order.
let i = 0, matched = 0;
for (const w of plainWords) { let j = i; while (j < turnWords.length && j < i + 8 && turnWords[j] !== w) j++; if (j < turnWords.length && turnWords[j] === w) { matched++; i = j + 1; } }
const coverage = plainWords.length ? matched / plainWords.length : 0;
const labelled = coverage >= 0.95 && turnWords.length <= plainWords.length * 1.05 && turns.length > 1;
if (!labelled) turns = [];
const rep = p.rep;
let us = 0, them = 0;
for (const t of turns) { const n = words(t.text).length; if (t.speaker === rep) us += n; else them += n; }
const talk = turns.length && us + them ? Math.round(100 * us / (us + them)) : null;
const text = labelled ? turns.map(t => t.speaker + ': ' + t.text).join('\n') : plain;
const duration = $('Keep Audio').first().json.seconds || 0;
const crm = p.crm;
const contacts = (crm.contacts || []).map(c => '- ' + c.name + ', ' + c.title + ' (' + c.email + ')').join('\n');
const stages = STAGES.map(s => '- ' + s[0] + ': ' + s[1] + '. ' + s[2]).join('\n');
const recent = (crm.activity || []).slice(0, 5).map(a => '- ' + String(a.created_at).slice(0, 10) + ' ' + a.kind + ': ' + a.title).join('\n');
const prompt = 'Call date: ' + p.call_date + ' (' + DateTime.fromISO(p.call_date).toFormat('cccc') + ')\n'
  + 'Rep: ' + rep + ' (Tidewater Software)\n\n'
  + 'Deal in the CRM:\n- Name: ' + crm.deal.name + '\n- Company: ' + ((crm.company || {}).name || '') + '\n- Stage: ' + crm.deal.stage
  + '\n- Amount: ' + (crm.deal.amount ? dollars(crm.deal.amount) : 'not set') + '\n- Close date: ' + (crm.deal.close_date || 'not set') + '\n\n'
  + 'Contacts at the company:\n' + (contacts || '- none') + '\n\n'
  + 'Recent activity:\n' + (recent || '- none') + '\n\n'
  + 'Pipeline stages (id: name. meaning):\n' + stages + '\n\n'
  + (p.notes ? 'Rep\'s notes: ' + p.notes + '\n\n' : '')
  + 'Transcript' + (labelled ? ' (one line per speaker turn; the label is the speaker\'s name)' : ' (no speaker labels)') + ':\n' + text;
return [{ json: { turns, labelled, coverage: Math.round(coverage * 1000) / 10, talk_us: talk, transcript: plain, duration_s: duration, prompt } }];
