// What the setup made.
const r = $input.all().map(i => i.json).find(x => x && x.members !== undefined) || {};
return [{ json: { schema: 'ironleaf', members: Number(r.members), active_members: Number(r.active_members), payments: Number(r.payments), visits: Number(r.visits), classes: Number(r.classes), bookings: Number(r.bookings) } }];
