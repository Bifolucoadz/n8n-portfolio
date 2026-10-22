// Test mode: mark the row as test_posted. Link columns stay empty so a later live run still posts everywhere.
const p = $('Attach Image').first().json;
return [{ json: { post_id: p.post_id, status: 'test_posted', posted_at: p.now_text, error: p.notes.join(' '), attempts: '0', updated_at: p.now_text } }];
