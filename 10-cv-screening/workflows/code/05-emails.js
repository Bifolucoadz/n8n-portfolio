// The emails for this decision (an empty item when there are none, which Send Email skips).
const ch = $('Apply Change').first().json;
const list = ch.emails || [];
return (list.length ? list : [{ to: '' }]).map(json => ({ json }));
