// WhatsApp media URLs have no file extension; Whisper needs one to accept the upload.
const item = $input.first();
if (!item.binary || !item.binary.data) throw new Error("Voice note download returned no file");
item.binary.data.fileName = "voice-note.ogg";
item.binary.data.fileExtension = "ogg";
item.binary.data.mimeType = "audio/ogg";
return [item];
