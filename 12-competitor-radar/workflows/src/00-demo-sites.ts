import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const HTML_HEADERS = { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }, { name: 'X-Robots-Tag', value: 'noindex' }] };

const siteHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Site Request', position: [200, 300], parameters: { httpMethod: 'GET', path: 'demo-web/page', responseMode: 'responseNode', options: {} } },
  output: [{ query: { site: 'torque-street', page: 'bikes' } }]
});

const render = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Render Page', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__RENDER_SITE__
  } },
  output: [{ status: 200, html: '<html></html>' }]
});

const send = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Page', position: [640, 300], parameters: { respondWith: 'text', responseBody: expr('{{ $json.html }}'), options: { responseCode: expr('{{ $json.status }}'), responseHeaders: HTML_HEADERS } } }
});

const adminHook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Admin Request', position: [200, 560], parameters: { httpMethod: 'GET', path: 'demo-web/admin', responseMode: 'responseNode', options: {} } },
  output: [{ query: { key: 'k', week: '2' } }]
});

const setWeek = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Set Week', position: [420, 560], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__SET_WEEK__
  } },
  output: [{ code: 200, body: { ok: true, week: 2 } }]
});

const sendWeek = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Week', position: [640, 560], parameters: { respondWith: 'json', responseBody: expr('{{ $json.body }}'), options: { responseCode: expr('{{ $json.code }}') } } }
});

const note = sticky(
  '## Radar 0: Demo Competitor Sites (demo only)\nFour invented competitors\' websites, served by n8n so the demo never scrapes a real business. `/webhook/demo-web/page?site=…&page=…` renders the page for the current demo week; `/webhook/demo-web/admin?key=…&week=1-4` moves the story on. Over four weeks prices change, bikes launch, sell out and disappear, banners and job ads change, one site goes down for maintenance, one shows a bot check, and one is redesigned without structured data. In a real deployment this workflow is deleted and the watchlist points at real URLs.',
  [], { position: [160, 0], width: 760, height: 230, color: 3 }
);

export default workflow('radar-demo-sites', 'Radar 0: Demo Competitor Sites')
  .add(siteHook)
  .to(render)
  .to(send)
  .add(adminHook)
  .to(setWeek)
  .to(sendWeek)
  .add(note);
