// Reject empty or oversized requests before they reach the models.
const b = $input.first().json.body ?? {};
const message = String(b.message ?? '').trim();
const errors = [];
if (!message) errors.push('message is required');
if (message.length > 2000) errors.push('message is longer than 2,000 characters');
return [{
  json: {
    valid: errors.length === 0,
    errors,
    message,
    session_id: String(b.session_id ?? ''),
    role: String(b.role ?? 'hcp'),
  },
}];
