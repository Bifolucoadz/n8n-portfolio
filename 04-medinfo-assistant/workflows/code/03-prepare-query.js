// Clean the tool inputs. Access levels are set by the Answer workflow, never by the model.
const i = $input.first().json;
const levels = ['public', 'internal', 'medical'];
const access = String(i.allowed_access || 'public').split(',').map(s => s.trim()).filter(s => levels.includes(s));
const p = String(i.product || '').toLowerCase().trim();
const query = String(i.query || '').replace(/\s+/g, ' ').trim().slice(0, 500);
if (!query) throw new Error('search_knowledge needs a query: say what to search for.');
return [{
  json: {
    query,
    product: ['quenvara', 'lumetra', 'aurivex'].includes(p) ? p : 'any',
    include_superseded: i.include_superseded === true || String(i.include_superseded).toLowerCase() === 'true',
    access: access.length ? access : ['public'],
  },
}];
