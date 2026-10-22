// The AI's tags, as a write request for the Store API.
// @include lib-kettle.js
const x = aiJson($input.first().json);
return [{ json: { action: 'tag_reviews', tags_json: JSON.stringify((x && x.reviews) || []) } }];
