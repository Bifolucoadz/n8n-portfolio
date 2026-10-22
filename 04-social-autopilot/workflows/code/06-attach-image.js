// The post plus its image (if it loaded), the link card for link-only posts, and the test-mode message.
const p = $('Prepare Publish').first().json;
const item = $input.first();
const has = !!(item.binary && item.binary.data);
const bytes = has ? Number(item.binary.data.bytes || 0) : 0;
const notes = [];
if (p.image.mode !== 'none' && !has) {
  notes.push('The image could not be loaded (' + String(item.json.error?.message || item.json.error || 'no data') + '), so it went out as text.');
}

// Link-only LinkedIn posts get an article card: read the page's title and description.
let card = null;
if (p.link && !has) {
  card = { title: p.topic, description: '' };
  try {
    const html = String(await this.helpers.httpRequest({ method: 'GET', url: p.link, timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36' } }));
    const meta = names => {
      for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
        const a = {};
        for (const m of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) a[m[1].toLowerCase()] = m[3] ?? m[4];
        if (names.includes((a.property || a.name || '').toLowerCase()) && a.content) return a.content.trim();
      }
      return '';
    };
    const t = meta(['og:title', 'twitter:title']) || ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim();
    if (t) card.title = t.slice(0, 200);
    card.description = meta(['og:description', 'description', 'twitter:description']).slice(0, 300);
  } catch (e) {
    // the card falls back to the topic as its title
  }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
const parts = ['🧪 <b>Test mode</b> · <code>' + p.post_id + '</code> would have been posted now:'];
if (p.need_li) parts.push('<b>LinkedIn</b>' + (has ? ' (with the image above)' : p.link ? ' (with a link card)' : '') + '\n' + esc(cut(p.linkedin_text, 1500)));
if (p.need_tg) parts.push('<b>Telegram ' + esc(p.channel || '(no channel set)') + '</b>\n' + esc(cut(p.telegram_text, 1200)));
if (!p.needs.length) parts.push('Nothing left to post: every platform already has a link.');
for (const n of notes) parts.push('⚠️ ' + esc(n));
parts.push('Set <code>mode</code> to <code>live</code> in the Settings tab to post for real.');

const out = { json: {
  ...p,
  has_image: has,
  image_bytes: bytes,
  tg_photo: has && p.telegram_text.length <= 1024,
  telegram_html: esc(p.telegram_text),
  card,
  notes,
  test_message: parts.join('\n\n').slice(0, 4090)
} };
if (has) out.binary = { data: item.binary.data };
return [out];
