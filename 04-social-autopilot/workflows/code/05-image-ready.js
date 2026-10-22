// The generated image, filed in Drive: keep its binary for the preview and its file ID for publishing.
const file = $('Image To File').first();
const id = $json.id ? String($json.id) : '';
return [{
  json: {
    image_file_id: id,
    image_link: id ? 'https://drive.google.com/file/d/' + id + '/view' : '',
    image_error: id ? '' : 'the image was made but could not be saved to Drive (' + String($json.error?.message || $json.error || 'unknown') + ')'
  },
  binary: file.binary
}];
