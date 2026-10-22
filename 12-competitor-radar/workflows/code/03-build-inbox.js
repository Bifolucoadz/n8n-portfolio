// Test mode keeps emails in the Outbox tab instead of sending them; this page shows them like an inbox
// (newest first). Same key as the dashboard.
// @include lib-cs.js
const PAGE =
__HTML_INBOX__
;
const query = $('Inbox Request').first().json.query || {};
const T = tablesOf($('Load Outbox').first().json);
const s = settingsOf(T.Settings);
if (!s.dashboard_key || String(query.key || '') !== String(s.dashboard_key)) return [{ json: { code: 403, html: pageHtml('Wrong link', '<p>This link is not valid.</p>') } }];
const mails = (T.Outbox || []).slice().reverse().map(m => ({ at: m.at, to: m.to, subject: m.subject, kind: m.kind, html: String(m.html || '') }));
const data = { company: s.company, from: 'Competitor Radar <radar@cobblespoke.example>', selected: Number(query.i) || 0, mails };
return [{ json: { code: 200, html: PAGE.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c')) } }];
