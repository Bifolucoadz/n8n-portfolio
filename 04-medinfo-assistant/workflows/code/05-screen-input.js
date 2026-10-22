// The last few turns, for the compliance screen and for the agent. History is loaded once here
// instead of through a memory node, which saves two database round trips per answer.
const prep = $('Prepare Turn').first().json;
const ctx = $input.first().json.context ?? {};
const lines = (ctx.history ?? []).map(h => `${h.role === 'human' ? 'User' : 'Assistant'}: ${h.text}`);
const history = lines.join('\n');
// The public site is open to anyone: people often say they are healthcare professionals, but some are patients.
const who = {
  hcp: 'public Medical Information website (intended for healthcare professionals, but anyone can type here)',
  field: 'Larkmoor field sales representative (signed in)',
  medinfo: 'Larkmoor Medical Information specialist (signed in)',
}[prep.role];
return [{
  json: {
    prompt:
      `<channel>${who}</channel>\n` +
      `<recent_conversation>\n${history || '(none)'}\n</recent_conversation>\n` +
      `<latest_message>\n${prep.message}\n</latest_message>`,
    agent_input: lines.length
      ? `Conversation so far (oldest first):\n${history}\n\nLatest message:\n${prep.message}`
      : prep.message,
  },
}];
