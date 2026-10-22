// Busy periods from the test calendar table that overlap the window asked for.
const r = $('Route').first().json;
const from = Date.parse(r.from), to = Date.parse(r.to);
const busy = $input.all().map(i => i.json).filter(e => e.start && e.end && Date.parse(e.end) > from && Date.parse(e.start) < to)
  .map(e => ({ start: e.start, end: e.end, title: e.title }));
return [{ json: { busy } }];
