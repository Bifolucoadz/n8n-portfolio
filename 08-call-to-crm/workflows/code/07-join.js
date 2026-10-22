// Joins each call's lines into one WAV file: the 24 kHz 16-bit mono audio from OpenAI, with a short,
// slightly varied pause between speakers (like a real call), plus a WAV header.
// @include lib-calls.js
const RATE = 24000;
const lines = $('Lines').all().map(i => i.json);
const parts = {};
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  const pcm = await this.helpers.getBinaryDataBuffer(i, 'data');
  const l = lines[i];
  const gapMs = 350 + ((l.line * 137) % 450);
  (parts[l.call] = parts[l.call] || []).push(Buffer.alloc(Math.round(RATE * gapMs / 1000) * 2), pcm);
}
const wav = pcm => {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};
const out = [];
for (const [ci, bufs] of Object.entries(parts)) {
  const c = CALLS[Number(ci)];
  const file = wav(Buffer.concat(bufs));
  const data = await this.helpers.prepareBinaryData(file, c.file, 'audio/wav');
  out.push({ json: { file: c.file, deal_id: c.deal_id, title: c.title, lines: c.lines.length, seconds: Math.round((file.length - 44) / 2 / RATE), path: '/Users/mac/.n8n-files/tidewater/' + c.file }, binary: { data } });
}
return out;
