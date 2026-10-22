// Example busy times for the interviewer over the next three weeks, so the slot finder has
// something to work around in test mode (team meeting, client visits, a training morning).
// @include lib-ngt.js
const pattern = {
  1: [['09:30', '11:00', 'Team meeting']],
  2: [['13:30', '16:30', 'Client visit: Calder Logistics']],
  3: [['10:00', '11:00', 'Hiring manager call'], ['15:00', '16:00', 'Candidate interview (another role)']],
  4: [['09:00', '13:00', 'Training: interviewing skills']],
  5: [['14:00', '17:00', 'Client visit: Fernbrook Home']]
};
const out = [];
let d = DateTime.now().setZone(TZ).startOf('day');
for (let i = 0; i < 21; i++) {
  d = d.plus({ days: 1 });
  for (const [a, b, title] of pattern[d.weekday] || []) {
    const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number);
    out.push({ start: d.set({ hour: ah, minute: am }).toISO(), end: d.set({ hour: bh, minute: bm }).toISO(), title, kind: 'busy', candidate_id: '' });
  }
}
return out.map(json => ({ json }));
