// Busy periods from Google Calendar (all-day events block the whole day; "free" events are ignored).
const busy = $input.all().map(i => i.json).filter(e => e && e.start && e.transparency !== 'transparent' && e.status !== 'cancelled').map(e => ({
  start: e.start.dateTime || (e.start.date + 'T00:00:00'),
  end: e.end.dateTime || (e.end.date + 'T00:00:00'),
  title: e.summary || 'Busy'
}));
return [{ json: { busy } }];
