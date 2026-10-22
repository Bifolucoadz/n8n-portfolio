// Turn [c123] citations into numbered references, drop any citation that was not retrieved this
// turn, build the source list and label the route.
const prep = $('Prepare Turn').first().json;
const route = $('Route').first().json;
const screen = route.screen;
const emergency = $('Emergency Reply').isExecuted;
const out = $input.first().json;
let answer = emergency ? route.fixed_reply : String(out.output ?? '');
const error = emergency ? '' : (out.error ? String(out.error.message ?? out.error) : '');
const steps = emergency ? [] : (out.intermediateSteps ?? []);

const sources = {}, tools = [], miRefs = [];
const walk = v => {
  if (Array.isArray(v)) return v.forEach(walk);
  if (!v || typeof v !== 'object') return;
  if (typeof v.id === 'string' && /^[cp]\d+$/.test(v.id) && v.doc_code) sources[v.id] = sources[v.id] || v;
  Object.values(v).forEach(walk);
};
if (!emergency && $('Pre-Search').isExecuted) { tools.push('pre_search'); walk($('Pre-Search').first().json); }
for (const st of steps) {
  const tool = st.action?.tool;
  if (tool) tools.push(tool);
  let obs = st.observation;
  if (typeof obs === 'string') { try { obs = JSON.parse(obs); } catch (e) { /* plain text */ } }
  walk(obs);
  const flat = JSON.stringify(obs ?? '');
  if (tool === 'request_medical_information') {
    const m = flat.match(/MIR-\d{6}-[A-Z0-9]{4}/);
    if (m && /"success":\s*true/.test(flat)) miRefs.push(m[0]);
  }
}

const order = [];
let invalid = 0;
answer = answer.replace(/\[((?:\s*[cp]\d+\s*[,;]?)+)\]/gi, (m, ids) => {
  const nums = [];
  for (const raw of ids.split(/[,;\s]+/).filter(Boolean)) {
    const id = raw.toLowerCase();
    if (!sources[id]) { invalid++; continue; }
    if (!order.includes(id)) order.push(id);
    nums.push(order.indexOf(id) + 1);
  }
  return nums.map(n => `[${n}]`).join('');
}).replace(/[ \t]+([.,;:])/g, '$1');

const sourceList = order.map((id, i) => {
  const s = sources[id];
  const isRow = id.startsWith('p');
  return {
    n: i + 1, id, doc_code: s.doc_code, title: s.title, version: s.version, effective_date: s.effective_date,
    status: s.status || 'current', access_level: s.access_level || 'public',
    section: isRow ? `${s.product} ${s.strength}, ${s.package}` : s.section, page: s.page ?? null,
    url: s.url, flags: s.parse_flags || [],
  };
});

const searched = tools.includes('search_knowledge') || tools.includes('lookup_product') || tools.includes('pre_search');
let routeLabel;
if (emergency) routeLabel = 'emergency';
else if (error) routeLabel = 'error';
else if (route.case_refs.length) routeLabel = 'safety_captured';
else if (screen.off_label?.detected) routeLabel = prep.role === 'medinfo' && order.length ? 'off_label_answered' : 'off_label_declined';
// "I couldn't find this..." counts as a knowledge gap even when related passages are cited.
else if (/(couldn.t|could not|can.t|cannot) find [^.]{0,160}in Larkmoor/i.test(answer)) routeLabel = 'not_in_documents';
else if (order.length) routeLabel = 'answered';
else if (searched) routeLabel = 'not_in_documents';
else routeLabel = 'conversation';

if (error) {
  answer = 'Sorry, I can\'t answer right now. Please call Larkmoor Medical Information on 1-800-555-0199.' +
    (route.case_refs.length ? ` Your report has been recorded (reference ${route.case_refs.join(', ')}).` : '') +
    ' To report a side effect, call Pharmacovigilance on 1-800-555-0177.';
}
const flags = {
  adverse_event: !!screen.adverse_event?.detected,
  product_complaint: !!screen.product_complaint?.detected,
  off_label: !!screen.off_label?.detected,
  off_label_topic: screen.off_label?.topic || '',
  emergency: !!screen.emergency,
  speaker: screen.speaker,
  screen_failed: route.screen_failed,
  invalid_citations_removed: invalid,
  uncited_answer: routeLabel === 'not_in_documents' && answer.length > 400,
};
const caseRefs = [...route.case_refs, ...miRefs];
const latency = Date.now() - prep.started_at;
return [{
  json: {
    answer,
    sources: sourceList,
    route: routeLabel,
    flags,
    case_refs: caseRefs,
    turn_id: prep.turn_id,
    session_id: prep.session_id,
    role: prep.role,
    latency_ms: latency,
    tools,
    record: JSON.stringify({
      turn: {
        id: prep.turn_id, session_id: prep.session_id, memory_key: prep.memory_key, channel: prep.dry_run ? 'eval' : prep.channel, role: prep.role,
        question: prep.message, standalone_question: screen.standalone_question || prep.message, answer, route: routeLabel,
        flags, sources: sourceList.map(s => ({ id: s.id, doc_code: s.doc_code, version: s.version, title: s.title, section: s.section, page: s.page })),
        case_refs: caseRefs, tools, latency_ms: latency, error,
      },
      cases: route.cases,
      mi_refs: prep.dry_run ? [] : miRefs,
    }),
  },
}];
