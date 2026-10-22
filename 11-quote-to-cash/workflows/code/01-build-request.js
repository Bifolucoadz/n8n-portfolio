// Builds the OpenAI request. The model gets the price book without prices (codes, items, units, notes),
// the estimator's notes, the voice memo transcript and any photos. It picks items and quantities only.
// @include lib-mgv.js
const PROMPT =
__PROMPT_QUOTE_BUILDER__
;
const SCHEMA = JSON.parse(
__JSON_DRAFT_QUOTE__
);
const v = $('Check Visit').first().json;
const T = tablesOf($('Load Price Book').first().json);
const transcript = $('Transcribe').isExecuted ? String($('Transcribe').first().json.text || '').trim() : '';
const book = (T['Price Book'] || []).filter(r => r.code && (r.active === '' || truthy(r.active)));
const lines = book.map(r => [r.code, r.category, r.item, 'per ' + r.unit, r.notes].filter(Boolean).join(' | '));
const text = 'Price book (code | category | item | unit | notes):\n' + lines.join('\n')
  + '\n\nClient: ' + v.client_name + ', ' + v.site_address + (v.postcode ? ' ' + v.postcode : '')
  + '\nEstimator: ' + v.estimator
  + '\n\nEstimator\'s notes:\n' + (v.notes || '(none, see the voice memo)')
  + (transcript ? '\n\nVoice memo transcript:\n' + transcript : '')
  + (v.images.length ? '\n\n' + v.images.length + ' site photo(s) attached.' : '');
const content = [{ type: 'input_text', text }].concat(v.images.map(u => ({ type: 'input_image', image_url: u, detail: 'low' })));
return [{ json: {
  transcript,
  body: {
    model: 'gpt-5.4', reasoning: { effort: 'low' }, store: false, max_output_tokens: 8000,
    instructions: PROMPT,
    input: [{ role: 'user', content }],
    text: { format: { type: 'json_schema', name: 'draft_quote', strict: true, schema: SCHEMA } }
  }
} }];
