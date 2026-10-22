// Title, description and readable text of the linked page (reference material for the writer).
const html = String($json.data || '');
const decode = s => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));

function meta(names) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attr = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attr[m[1].toLowerCase()] = m[3] ?? m[4];
    const key = (attr.property || attr.name || '').toLowerCase();
    if (names.includes(key) && attr.content) return decode(attr.content).trim();
  }
  return '';
}

const titleTag = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
const text = decode(html
  .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 5000);

return [{ json: { page: {
  title: meta(['og:title', 'twitter:title']) || decode(titleTag).trim(),
  description: meta(['og:description', 'description', 'twitter:description']),
  text,
  fetch_error: $json.error ? String($json.error.message || $json.error) : ''
} } }];
