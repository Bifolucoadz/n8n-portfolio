// Normalise the request and decide what this role may see. In production the role comes from
// sign-in; DEMO_ROLE_SWITCH lets the demo page switch roles.
const i = $input.first().json;
const ROLE_ACCESS = { hcp: ['public'], field: ['public', 'internal'], medinfo: ['public', 'internal', 'medical'] };
const DEMO_ROLE_SWITCH = true;
const SAFETY_CHAT_ID = '';
let role = String(i.role || 'hcp').toLowerCase().trim();
if (!DEMO_ROLE_SWITCH || !ROLE_ACCESS[role]) role = 'hcp';
const session = String(i.session_id || '').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80) || 's-' + Math.random().toString(36).slice(2, 10);
return [{
  json: {
    turn_id: 't-' + $now.toFormat('yyMMddHHmmss') + '-' + Math.random().toString(36).slice(2, 8),
    started_at: Date.now(),
    message: String(i.message ?? '').replace(/\u0000/g, '').trim().slice(0, 2000),
    session_id: session,
    // Memory is kept per role, so switching roles in the demo never carries answers across.
    memory_key: session + ':' + role,
    role,
    access: ROLE_ACCESS[role],
    access_csv: ROLE_ACCESS[role].join(','),
    channel: String(i.channel || 'web').slice(0, 20),
    dry_run: i.dry_run === true || String(i.dry_run) === 'true',
    safety_chat_id: SAFETY_CHAT_ID,
  },
}];
