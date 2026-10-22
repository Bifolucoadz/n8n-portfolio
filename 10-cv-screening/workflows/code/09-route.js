// Which calendar to use: Google Calendar in live mode, the Northgate Calendar table in test mode.
// @include lib-ngt.js
const s = settingsOf($('Read Settings').all());
const i = $('When Called').first().json;
return [{ json: { ...i, route: (s.mode === 'live' ? 'live_' : 'test_') + (i.action === 'book' ? 'book' : 'busy'), calendar_id: s.calendar_id || 'primary' } }];
