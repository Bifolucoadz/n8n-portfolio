// Audit trail: what the screening decided and why, in one line.
// @include lib-ngt.js
const c = $('Decide').first().json;
const flags = parseJson(c.flags_json, []);
const detail = 'Score ' + (c.score < 0 ? 'n/a' : c.score) + ', band ' + c.band + (flags.length ? '; flags: ' + flags.map(f => f.code).join(', ') : '') + '; screened in ' + (c.screen_ms / 1000).toFixed(1) + ' s';
return [{ json: { candidate_id: c.candidate_id, event: 'screened', detail, actor: 'system', at: nowIso() } }];
