// Prices the AI draft from the price book (quantities × unit prices, VAT, deposit, days of work) and adds
// checks for the owner. Builds the plan that Mossgrove 7: Save Changes writes, and the estimator's page.
// @include lib-mgv.js
const v = $('Check Visit').first().json;
const req = $('Build Request').first().json;
const T = tablesOf($('Load Price Book').first().json);
const s = settingsOf(T.Settings);
const res = $('Draft Quote (GPT-5.4)').first().json;
const draft = aiJson(res);
const priced = priceQuote(draft || { lines: [] }, bookOf(T['Price Book']), s);
if (!draft) priced.flags.unshift({ level: 'warn', text: 'The AI could not draft this quote (' + (res && res.error ? String(res.error.message || res.error).slice(0, 120) : 'no answer') + '). Add the lines by hand.' });
else if (draft.confidence === 'low') priced.flags.unshift({ level: 'warn', text: 'Low confidence: key measurements are missing. Check the questions below.' });
if (v.photos_skipped) priced.flags.push({ level: 'info', text: v.photos_skipped + ' photo(s) skipped (only 3 JPEG, PNG or WebP photos under 8 MB are read).' });
const at = nowIso();
const buildMs = Date.now() - v.started_ms;
// The quote number is taken from a fresh read of the Quotes tab just before saving, so two estimators
// sending forms at the same time don't get the same number
const ids = ((($('Read Quote Numbers').first().json.values) || []).slice(1)).map(r => Number(String(r[0] || '').replace(/\D/g, '')) || 0);
const quoteId = 'Q-' + (Math.max(1000, ...ids) + 1);
const row = {
  quote_id: quoteId, token: newToken(24), status: 'draft',
  client_name: v.client_name, client_email: v.client_email, client_phone: v.client_phone, site_address: v.site_address, postcode: v.postcode,
  job_title: draft ? draft.job_title : 'Site visit ' + day(at), summary: draft ? draft.client_summary : '',
  visit_notes: v.notes, transcript: req.transcript,
  lines_json: priced.lines, extras_json: priced.extras, custom_json: priced.custom,
  assumptions_json: draft ? draft.assumptions : [], questions_json: draft ? draft.questions : [], flags_json: priced.flags,
  subtotal: priced.subtotal, vat: priced.vat, total: priced.total, deposit: priced.deposit, labour_days: priced.labour_days,
  version: 1, estimator: v.estimator, created_at: at, build_ms: buildMs, view_count: 0, reminders_sent: 0, messages_json: [], updated_at: at
};
const plan = emptyPlan(s);
plan.quote_inserts.push(sheetRow(row));
plan.events.push(eventRow(row.quote_id, 'drafted', 'AI draft in ' + (buildMs / 1000).toFixed(1) + ' s: ' + priced.lines.length + ' lines, ' + money(priced.total) + (v.has_voice ? ', from a voice memo' : '') + (v.photo_count ? ', ' + v.photo_count + ' photo(s)' : ''), v.estimator));
const review = dashboardUrl(s) + '&q=' + row.quote_id;
plan.emails.push(emailItem(s.owner_email, 'Draft quote ready: ' + row.quote_id + ' ' + row.client_name + ' (' + money(priced.total) + ')', emailHtml(s, [
  esc(v.estimator) + ' visited <b>' + esc(row.client_name) + '</b> at ' + esc(row.site_address) + '. The draft is ready for you to check:',
  '<b>' + esc(row.job_title) + '</b>, ' + priced.lines.length + ' lines, ' + money(priced.total) + ' including VAT.' + (priced.flags.some(f => f.level === 'warn') ? ' It needs your attention before it can go out.' : '')
], button(review, 'Review and send')), 'owner_draft', row.quote_id, [review]));
plan.result = { ok: true, quote_id: row.quote_id };

const rowsHtml = priced.lines.map(l => '<tr><td>' + esc(l.item) + '<div class="lbl">' + esc(l.label) + '</div></td><td class="r">' + money(l.amount) + '</td></tr>').join('')
  + priced.custom.map(c => '<tr><td>' + esc(c.description) + '<div class="lbl">Not in the price book</div></td><td class="r">' + (c.amount === null ? 'to price' : money(c.amount)) + '</td></tr>').join('');
const flagsHtml = priced.flags.map(f => '<div class="flag ' + f.level + '">' + esc(f.text) + '</div>').join('');
const qs = row.questions_json.length ? '<p style="margin:16px 0 4px"><b>Check before sending</b></p><ul>' + row.questions_json.map(q => '<li>' + esc(q) + '</li>').join('') + '</ul>' : '';
const page = formPage('Draft ' + row.quote_id + ' is ready',
  '<p class="sub">' + esc(row.client_name) + ' · ' + esc(row.job_title) + ' · drafted in ' + (buildMs / 1000).toFixed(0) + ' seconds</p>'
  + (row.summary ? '<p>' + esc(row.summary) + '</p>' : '') + flagsHtml
  + '<table>' + rowsHtml + '<tr class="tot"><td>Total with VAT</td><td class="r">' + money(priced.total) + '</td></tr></table>'
  + (priced.extras.length ? '<p class="lbl">Optional extras offered: ' + priced.extras.map(x => esc(x.item) + ' (' + money(x.amount) + ')').join(', ') + '</p>' : '')
  + qs
  + '<a class="btn" href="' + esc(review) + '">Review and send</a><a class="btn ghost" href="' + esc(pdfUrl(s, row.token, 'quote')) + '">Preview PDF</a>');
return [{ json: { plan, page } }];
