// One CRM write per item (a placeholder when there is nothing to change).
const p = $('Plan').first().json;
return (p.ops.length ? p.ops : [{ action: 'none' }]).map(json => ({ json }));
