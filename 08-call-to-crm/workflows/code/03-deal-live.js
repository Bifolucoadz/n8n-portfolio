// The deal with its company and contacts, from HubSpot (deal properties plus associated contacts).
const d = $('HubSpot Deal').first().json || {};
const p = d.properties || {};
const contacts = $('HubSpot Contacts').all().map(i => i.json).filter(c => c && c.properties).map(c => ({
  contact_id: String(c.id), name: [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' '), email: c.properties.email || '', title: c.properties.jobtitle || ''
}));
const companyId = (((d.associations || {}).companies || {}).results || [])[0];
return [{ json: {
  found: !!d.id,
  deal: { deal_id: String(d.id || ''), name: p.dealname || '', company_id: companyId ? String(companyId.id) : '', stage: p.dealstage || '', amount: Number(p.amount) || 0,
    close_date: (p.closedate || '').slice(0, 10), owner: p.hubspot_owner_id || '', next_step: p.hs_next_step || '' },
  company: { name: p.dealname ? p.dealname.split(':')[0] : '' },
  contacts,
  activity: []
} }];
