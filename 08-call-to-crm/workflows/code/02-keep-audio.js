// Copies the recording into this run (the form's own run ends first and its files go with it) and
// works out its length from the file header: exact for WAV, from the bitrate for MP3.
const item = $input.first();
const [key, meta] = Object.entries(item.binary || {})[0] || [];
if (!meta) throw new Error('No recording attached.');
const buf = await this.helpers.getBinaryDataBuffer(0, key);
let seconds = 0;
if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
  let o = 12, byteRate = 0, dataSize = 0;
  while (o + 8 <= buf.length) {
    const id = buf.toString('ascii', o, o + 4), size = buf.readUInt32LE(o + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(o + 16);
    if (id === 'data') { dataSize = Math.min(size, buf.length - o - 8); break; }
    o += 8 + size + (size % 2);
  }
  if (byteRate) seconds = dataSize / byteRate;
} else {
  let o = 0;
  if (buf.toString('ascii', 0, 3) === 'ID3') o = 10 + ((buf[6] & 127) << 21 | (buf[7] & 127) << 14 | (buf[8] & 127) << 7 | (buf[9] & 127));
  while (o + 4 < buf.length && !(buf[o] === 0xff && (buf[o + 1] & 0xe0) === 0xe0)) o++;
  if (o + 4 < buf.length) {
    const v1 = (buf[o + 1] & 0x18) === 0x18, idx = buf[o + 2] >> 4;
    const kbps = (v1 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[idx] || 0;
    if (kbps) seconds = (buf.length - o) * 8 / (kbps * 1000);
  }
}
const data = await this.helpers.prepareBinaryData(buf, meta.fileName || 'call.mp3', meta.mimeType || 'audio/mpeg');
return [{ json: { ...item.json, bytes: buf.length, seconds: Math.round(seconds), filename: meta.fileName || 'call.mp3', started_ms: Date.now() }, binary: { data } }];
