// One item per knowledge subfolder. The folder a file sits in sets its access level.
const parent = $('Create Root Folder').first().json.id;
return ['Public', 'Internal', 'Medical', 'Data'].map(name => ({ json: { name, parent } }));
