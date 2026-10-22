// Parse the writer's JSON and make every version fit its platform.
const b = $('Prepare Brief').first().json;
const S = b.settings;
const res = $json;

let d = null;
try {
  const msg = (res.output || []).find(o => o.type === 'message') || (res.output || [])[0] || {};
  const c = (msg.content || []).find(x => x.type === 'output_text') || (msg.content || [])[0] || {};
  d = typeof c.text === 'string' ? JSON.parse(c.text) : c.text;
} catch (e) {
  d = null;
}
if (!d || !d.linkedin || !d.telegram) {
  const attempts = b.attempts + 1;
  const why = res.error ? String(res.error.message || res.error) : 'the AI returned no usable draft';
  return [{ json: {
    ok: false,
    give_up: attempts >= 3,
    post_id: b.post_id,
    status: attempts >= 3 ? 'needs_fix' : 'idea',
    attempts: String(attempts),
    error: 'Drafting failed (try ' + attempts + ' of 3): ' + why,
    updated_at: b.now_text
  } }];
}

const seg = new Intl.Segmenter();
const chars = s => s.length;
const clean = s => String(s || '').replace(/\r/g, '').replace(/[ \t]*—[ \t]*/g, ' - ').replace(/\n{3,}/g, '\n\n').trim();

// Over the limit: drop trailing hashtags, then whole sentences from the end (keeping the link), then hard-cut.
function fit(text, max, count) {
  if (count(text) <= max) return { text, cut: false };
  let t = text.replace(/(\s+#[\p{L}\p{N}_]+)+\s*$/u, '').trim();
  if (count(t) <= max) return { text: t, cut: true };
  const link = b.link && t.includes(b.link) ? b.link : '';
  const body = link ? t.replace(link, '').trim() : t;
  const tail = link ? '\n' + link : '';
  const parts = body.match(/[^.!?\n]+[.!?]*\s*/g) || [body];
  while (parts.length > 1 && count(parts.join('').trim() + tail) > max) parts.pop();
  let out = parts.join('').trim() + tail;
  if (count(out) > max) out = [...seg.segment(out)].map(x => x.segment).slice(0, max - 1).join('').trim() + '…';
  return { text: out, cut: true };
}

const notes = [];
const li = fit(clean(d.linkedin), 3000, chars);
const tgMax = b.image.mode === 'none' ? 4096 : 1024;
const tg = fit(clean(d.telegram), tgMax, chars);
if (li.cut) notes.push('LinkedIn text was shortened to 3000 characters.');
if (tg.cut) notes.push('Telegram text was shortened to fit ' + tgMax + ' characters.');

const imagePrompt = (String(d.image_prompt || '').trim() || ('An illustration about: ' + b.topic)) +
  ' Style: ' + (S.image_style || 'clean modern flat illustration') + ' Absolutely no text, letters or numbers in the image.';

return [{ json: {
  ok: true,
  post_id: b.post_id,
  angle: String(d.angle || ''),
  linkedin: li.text,
  telegram: tg.text,
  image_alt: String(d.image_alt || '').trim(),
  notes,
  image_request: {
    model: 'gpt-image-2',
    prompt: imagePrompt.slice(0, 3800),
    size: '1536x1024',
    quality: 'medium',
    output_format: 'jpeg',
    output_compression: 85,
    n: 1
  }
} }];
