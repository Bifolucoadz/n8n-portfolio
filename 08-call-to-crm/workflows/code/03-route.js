// Which CRM: HubSpot in live mode, the Tidewater tables in test mode.
// @include lib-tdw.js
const s = settingsOf($('Read Settings').all());
const i = $('When Called').first().json;
return [{ json: { ...i, route: (s.mode === 'live' ? 'live_' : 'test_') + i.action, pipeline: s.hubspot_pipeline || 'default' } }];
