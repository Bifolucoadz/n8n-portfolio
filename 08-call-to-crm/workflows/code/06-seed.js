// The demo CRM as it starts: three open deals at different stages, their companies and contacts,
// and a little earlier activity. Every company, person and email is invented (.example domains).
// @include lib-tdw.js
const now = DateTime.now().setZone(TZ);
const ago = d => now.minus({ days: d }).toISO();
const companies = [
  { company_id: 'C-201', name: 'Calloway Dental Group', domain: 'callowaydental.example', industry: 'Dental clinics (5 locations)', size: '120 staff' },
  { company_id: 'C-202', name: 'Pemberton Freight', domain: 'pembertonfreight.example', industry: 'Freight and logistics', size: '300 staff' },
  { company_id: 'C-203', name: 'Ostara Home Care', domain: 'ostarahomecare.example', industry: 'Home care (8 branches)', size: '450 staff' }
];
const contacts = [
  { contact_id: 'P-301', company_id: 'C-201', name: 'Renee Alvarez', email: 'renee.alvarez@callowaydental.example', title: 'Operations Director' },
  { contact_id: 'P-302', company_id: 'C-201', name: 'Mark Feld', email: 'mark.feld@callowaydental.example', title: 'COO' },
  { contact_id: 'P-303', company_id: 'C-202', name: 'Tom Reyes', email: 'tom.reyes@pembertonfreight.example', title: 'IT Manager' },
  { contact_id: 'P-304', company_id: 'C-202', name: 'Dana Whitcombe', email: 'dana.whitcombe@pembertonfreight.example', title: 'CFO' },
  { contact_id: 'P-305', company_id: 'C-203', name: 'Janelle Brooks', email: 'janelle.brooks@ostarahomecare.example', title: 'CEO' }
];
const deals = [
  { deal_id: 'D-1001', name: 'Calloway Dental: patient reminders', company_id: 'C-201', stage: 'appointmentscheduled', amount: 0, close_date: '', owner: 'Maya Collins', next_step: 'Discovery call with Renee', updated_at: ago(6) },
  { deal_id: 'D-1002', name: 'Pemberton Freight: customer tracking portal', company_id: 'C-202', stage: 'presentationscheduled', amount: 65000, close_date: now.plus({ days: 55 }).toISODate(), owner: 'Maya Collins', next_step: 'Demo follow-up call', updated_at: ago(7) },
  { deal_id: 'D-1003', name: 'Ostara Home Care: caregiver scheduling app', company_id: 'C-203', stage: 'contractsent', amount: 28000, close_date: now.plus({ days: 24 }).toISODate(), owner: 'Maya Collins', next_step: 'Contract call with Janelle', updated_at: ago(3) }
];
const activity = [
  { activity_id: 'N-SEED1', deal_id: 'D-1001', kind: 'note', title: 'Inbound lead: website form', body: 'Asked about automating appointment reminders across 5 clinics.', owner: 'Maya Collins', due: '', status: 'done', source: 'seed', created_at: ago(9) },
  { activity_id: 'N-SEED2', deal_id: 'D-1002', kind: 'meeting', title: 'Portal demo with the dispatch team', body: 'Showed live tracking and the customer portal. Tom Reyes and two dispatchers attended.', owner: 'Maya Collins', due: '', status: 'done', source: 'seed', created_at: ago(7) },
  { activity_id: 'N-SEED3', deal_id: 'D-1003', kind: 'email', title: 'Contract v1 sent', body: 'Annual contract for 8 branches, $28,000.', owner: 'Maya Collins', due: '', status: 'done', source: 'seed', created_at: ago(3) }
];
return [
  ...companies.map(r => ({ json: { table: 'companies', ...r } })),
  ...contacts.map(r => ({ json: { table: 'contacts', ...r } })),
  ...deals.map(r => ({ json: { table: 'deals', ...r } })),
  ...activity.map(r => ({ json: { table: 'activity', ...r } }))
];
