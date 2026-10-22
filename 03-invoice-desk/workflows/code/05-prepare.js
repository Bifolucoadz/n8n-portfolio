// The downloaded file plus where it came from, so the original can be moved to Inbox/Done afterwards.
const f = $('New File in Inbox').item.json;
const who = (f.lastModifyingUser && (f.lastModifyingUser.emailAddress || f.lastModifyingUser.displayName))
  || (f.owners && f.owners[0] && f.owners[0].emailAddress) || '';
return {
  json: {
    source: 'drive', sender: who, original_filename: f.name,
    received_at: DateTime.fromISO(f.createdTime || new Date().toISOString()).setZone('America/New_York').toISO(),
    drive_file_id: f.id
  },
  binary: $input.item.binary
};
