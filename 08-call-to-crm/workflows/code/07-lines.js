// One item per spoken line, with the voice for that speaker.
// @include lib-calls.js
const out = [];
CALLS.forEach((c, ci) => c.lines.forEach(([speaker, text], li) => {
  const [voice, instructions] = VOICES[speaker];
  out.push({ json: { call: ci, line: li, file: c.file, speaker, voice, instructions, text } });
}));
return out;
