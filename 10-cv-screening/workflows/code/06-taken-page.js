// That time has gone: offer the other times from the invitation (each is checked again when clicked).
// @include lib-ngt.js
const p = $('Check Link').first().json;
const c = p.candidate, s = p.settings;
const base = (s.base_url || 'http://localhost:5678') + '/webhook/northgate/book?c=' + c.candidate_id + '&t=' + c.token + '&s=';
const others = p.slots.map((t, i) => ({ ...t, i })).filter(t => t.i !== p.slot_index && Date.parse(t.start) > Date.now() + 2 * 3600 * 1000);
const list = others.map(t => '<a class="slot" href="' + esc(base + t.i) + '">' + esc(t.label) + '</a>').join('');
const body = '<p>Sorry, <b>' + esc(p.slot.label) + '</b> has just been taken.</p>'
  + (list ? '<p>Please choose another time:</p>' + list : '<p>Please reply to your invitation email and we\'ll find another time.</p>');
return [{ json: { code: 409, html: pageHtml(s.company || 'Northgate Talent', 'That time has gone', body) } }];
