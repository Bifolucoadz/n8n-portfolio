// The deal with its company, contacts and recent activity, from the test tables.
// @include lib-tdw.js
const id = $('Route').first().json.deal_id;
const deal = $('Read Deal').all().map(i => i.json).find(d => d.deal_id === id) || null;
const company = deal ? ($('Read Companies').all().map(i => i.json).find(c => c.company_id === deal.company_id) || null) : null;
const contacts = deal ? $('Read Contacts').all().map(i => i.json).filter(c => c.company_id === deal.company_id).map(c => ({ contact_id: c.contact_id, name: c.name, email: c.email, title: c.title })) : [];
const activity = $('Read Activity').all().map(i => i.json).filter(a => a.deal_id === id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  .map(a => ({ kind: a.kind, title: a.title, body: a.body, due: a.due, status: a.status, created_at: a.created_at }));
if (!deal) return [{ json: { found: false } }];
const { id: _1, createdAt: _2, updatedAt: _3, ...d } = deal;
return [{ json: { found: true, deal: d, company, contacts, activity } }];
