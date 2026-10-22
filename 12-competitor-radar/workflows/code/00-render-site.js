// Demo only: four invented competitor websites whose prices, products, banners, jobs and news change
// from week 1 to week 4 (the week is set with the admin link). Each site is built differently, like real
// ones: JSON-LD product data, plain product cards, a price table, a bot check, a redesign.
const params = $('Site Request').first().json.query || {};
const week = Math.min(4, Math.max(1, Number(($getWorkflowStaticData('global').week) || 1)));
const w = week - 1;
const site = String(params.site || ''), page = String(params.page || '');
const gbp = n => '£' + Number(n).toLocaleString('en-GB');
const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const P = {
  'torque-street': [
    ['Commuter One', '250 W hub · 500 Wh · up to 110 km', [1849, 1649, 1649, 1749], [null, 1849, 1849, null]],
    ['Commuter One Plus', '250 W hub · 750 Wh · up to 160 km', [null, null, 2099, 2099], [null, null, null, null]],
    ['Fold Mini', '250 W · 360 Wh · 16 kg folding', [1399, 1399, 1399, 1399], [null, null, null, null]],
    ['Ridge 625', '85 Nm mid-drive · 625 Wh hardtail', [2949, 2949, 2499, 2949], [null, null, 2949, null]],
    ['Cargo Duo', 'Longtail cargo · 2 × 500 Wh', [4499, 4499, 4499, 4499], [null, null, null, null]]
  ],
  'glenvolt': [
    ['Clyde City', 'Belt drive commuter, 500 Wh', [1849, 1849, 1849, 1849], [1, 1, 1, 1]],
    ['Highland Trail', 'Full suspension, 750 Wh', [3099, 3099, 3099, 3099], [1, 1, 1, 1]],
    ['Step-Through', 'Low step frame, 400 Wh', [1449, 1449, 1449, 1399], [1, 1, 1, 1]],
    ['Glenvolt Fold', 'Folding, 14 kg, 300 Wh', [1399, 1399, 1399, 1399], [1, 1, 0, 0]],
    ['Gravel GX', 'Drop-bar gravel, 500 Wh', [null, 2399, 2399, 2399], [1, 1, 1, 1]]
  ],
  'pedalpoint': [
    ['Pedalpoint Metro', '500 Wh', 'Hub', [1899, 1899, 1899, 1899]],
    ['Trekker 750', '750 Wh', 'Mid-drive', [2799, 2799, 2599, 2599]],
    ['Pedalpoint Cargo', '2 × 500 Wh', 'Mid-drive', [4399, 4399, 4399, 4399]],
    ['Urban Single', '250 Wh', 'Hub', [1149, 1149, null, null]]
  ],
  'hilltrack': [
    ['Pennine 625', 'Full suspension trail, 625 Wh', [3299, 3299, 3299, 3299]],
    ['Dales Gravel', 'Gravel, 500 Wh, 1 × 11', [2699, 2699, 2699, 2699]],
    ['Moor Hardtail', 'Hardtail, 625 Wh, 140 mm fork', [2599, 2599, 2599, 2449]]
  ]
};

function shell(title, css, body) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>' + e(title) + '</title><style>body{margin:0;font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif}' + css + '</style></head><body>'
    + '<div style="background:#111;color:#ffd84d;font:600 12px sans-serif;text-align:center;padding:5px">DEMO SITE: an invented company for the Competitor Radar portfolio project (week ' + week + ')</div>' + body + '</body></html>';
}
function jsonLd(items) {
  return '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Product', name: p.name, description: p.spec, offers: { '@type': 'Offer', priceCurrency: 'GBP', price: p.price.toFixed(2), availability: 'https://schema.org/' + (p.stock === false ? 'OutOfStock' : 'InStock') } } })) }) + '</script>';
}
function list(arr) { return arr.map(t => '<li>' + e(t) + '</li>').join(''); }

let status = 200, html = '';
if (site === 'torque-street') {
  const css = '.top{background:#0b0c10;color:#fff;padding:22px 40px;display:flex;justify-content:space-between;align-items:center}.top b{font-size:22px;letter-spacing:2px}.hero{background:linear-gradient(120deg,#ff4d2e,#ff9a3c);color:#fff;padding:46px 40px}.hero h1{font-size:40px;margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:22px;padding:34px 40px}.card{border:1px solid #e5e5e5;border-radius:14px;padding:20px}.card h3{margin:0 0 6px}.card .spec{color:#666;font-size:14px}.card .price{font-size:22px;font-weight:700;margin-top:12px}.card s{color:#999;font-weight:400;font-size:15px;margin-left:8px}.jobs{padding:30px 40px}';
  const nav = '<div class="top"><b>TORQUE STREET</b><span>Bikes · Test rides · Careers</span></div>';
  if (page === 'bikes') {
    const items = P[site].filter(p => p[2][w] !== null).map(p => ({ name: p[0], spec: p[1], price: p[2][w], was: p[3][w] }));
    html = shell('E-bikes | Torque Street', css, nav + '<div class="hero"><h1>Our e-bikes</h1><p>Designed in London. Delivered free across the UK.</p></div><div class="grid">'
      + items.map(p => '<div class="card"><h3>' + e(p.name) + '</h3><div class="spec">' + e(p.spec) + '</div><div class="price">' + gbp(p.price) + (p.was ? '<s>' + gbp(p.was) + '</s>' : '') + '</div></div>').join('') + '</div>' + jsonLd(items));
  } else if (page === 'home') {
    const banner = ['Free test rides at our London studio', 'Free test rides at our London studio', 'Black Friday: up to 25% off e-bikes. Ends Monday.', 'Winter service for any e-bike: £49'][w];
    html = shell('Torque Street | Electric bikes made for the city', css, nav + '<div class="hero"><p style="font-weight:700;text-transform:uppercase;letter-spacing:1px">' + e(banner) + '</p><h1>Ride further. Sweat less.</h1><p>Electric bikes made for the city, from £1,399.</p></div><div class="jobs"><h2>Why Torque Street</h2><ul><li>2-year warranty on frame and battery</li><li>Free delivery across the UK</li><li>30-day returns</li></ul></div>');
  } else if (page === 'careers') {
    const jobs = ['Customer Support Advisor (London)', 'Bike Mechanic (London)'].concat(w >= 1 ? ['Country Manager, Germany'] : []).concat(w >= 3 ? ['Store Lead, Edinburgh pop-up'] : []);
    html = shell('Careers | Torque Street', css, nav + '<div class="jobs"><h1>Join the team</h1><p>We\'re growing fast. Open roles:</p><ul>' + list(jobs) + '</ul></div>');
  }
} else if (site === 'glenvolt') {
  const css = 'header{background:#203a43;color:#fff;padding:18px 36px;font-size:20px;font-weight:700}.wrap{max-width:1000px;margin:0 auto;padding:24px}.products{display:flex;flex-wrap:wrap;gap:18px}.product-card{width:220px;background:#f6f8f8;border-radius:8px;padding:16px}.product-card .title{font-weight:700}.product-card .money{color:#203a43;font-size:19px;margin:8px 0}.badge{display:inline-block;background:#c0392b;color:#fff;font-size:12px;padding:2px 8px;border-radius:4px}.post{border-bottom:1px solid #ddd;padding:14px 0}.post time{color:#888;font-size:13px}';
  if (page === 'shop') {
    const items = P[site].filter(p => p[2][w] !== null);
    html = shell('Shop all e-bikes – Glenvolt', css, '<header>Glenvolt · Glasgow</header><div class="wrap"><h1>All e-bikes</h1><div class="products">'
      + items.map(p => '<div class="product-card"><div class="title">' + e(p[0]) + '</div><div>' + e(p[1]) + '</div><div class="money">' + (p[3][w] ? '' : '<span class="badge">Sold out</span> ') + gbp(p[2][w]) + '</div><a href="#">View</a></div>').join('') + '</div></div>');
  } else if (page === 'news') {
    const posts = [['2 Oct', 'Our autumn service menu', 'Book a full service before the winter.']].concat(w >= 1 ? [['14 Oct', 'Meet the Gravel GX', 'Our first drop-bar e-bike is here, from £2,399.']] : []).concat(w >= 2 ? [['21 Oct', 'We\'re opening a showroom in Edinburgh', 'Our second showroom opens in Leith this spring, with test rides and a full workshop.']] : []);
    html = shell('News – Glenvolt', css, '<header>Glenvolt · Glasgow</header><div class="wrap"><h1>News</h1>' + posts.slice().reverse().map(p => '<div class="post"><time>' + e(p[0]) + '</time><h2>' + e(p[1]) + '</h2><p>' + e(p[2]) + '</p></div>').join('') + '</div>');
  }
} else if (site === 'pedalpoint') {
  const css = 'h1{font-family:Georgia,serif}.wrap{max-width:900px;margin:0 auto;padding:30px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:10px;text-align:left}th{background:#f1f1f1}';
  if (page === 'prices' && w === 1) {
    status = 503;
    html = shell('Down for maintenance', css, '<div class="wrap"><h1>We\'ll be back soon</h1><p>Pedalpoint Electric is down for planned maintenance.</p></div>');
  } else if (page === 'prices') {
    const items = P[site].filter(p => p[3][w] !== null);
    html = shell('Price list | Pedalpoint Electric', css, '<div class="wrap"><h1>Pedalpoint Electric: 2026 price list</h1><p>All prices include VAT. Finance available.</p><table><tr><th>Model</th><th>Battery</th><th>Motor</th><th>Price</th></tr>'
      + items.map(p => '<tr><td>' + e(p[0]) + '</td><td>' + e(p[1]) + '</td><td>' + e(p[2]) + '</td><td>' + gbp(p[3][w]) + '</td></tr>').join('') + '</table></div>');
  } else if (page === 'careers') {
    const jobs = ['Workshop Technician (Manchester)'].concat(w >= 2 ? ['Head of Subscriptions'] : []);
    html = shell('Careers | Pedalpoint Electric', css, '<div class="wrap"><h1>Work with us</h1><ul>' + list(jobs) + '</ul></div>');
  }
} else if (site === 'hilltrack') {
  const css = '.nav{padding:20px 40px;border-bottom:3px solid #2e7d32;font-weight:800;font-size:22px;color:#2e7d32}.band{background:#2e7d32;color:#fff;padding:12px 40px;font-weight:600}.range{padding:30px 40px}.bike{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:16px 0}.tile{display:inline-block;width:260px;margin:0 16px 16px 0;padding:18px;background:#f3f7f3;border-radius:10px;vertical-align:top}';
  if (page === 'range' && w === 2) {
    html = shell('Just a moment...', '', '<div style="text-align:center;padding:80px"><h2>Checking your browser before accessing hilltrack-ebikes</h2><p>This process is automatic. Your browser will redirect shortly.</p></div>');
  } else if (page === 'range' && w === 3) {
    html = shell('The range | Hilltrack E-Bikes', css, '<div class="nav">HILLTRACK</div><div class="range"><h1>The 2027 range</h1>'
      + P[site].map(p => '<div class="tile"><h3>' + e(p[0]) + '</h3><p>' + e(p[1]) + '</p><p><strong>Now ' + gbp(p[2][w]) + '</strong></p></div>').join('') + '</div>');
  } else if (page === 'range') {
    const items = P[site].map(p => ({ name: p[0], spec: p[1], price: p[2][w] }));
    html = shell('The range | Hilltrack E-Bikes', css, '<div class="nav">HILLTRACK</div><div class="range"><h1>The range</h1>'
      + items.map(p => '<div class="bike"><div><b>' + e(p.name) + '</b><br>' + e(p.spec) + '</div><div>' + gbp(p.price) + '</div></div>').join('') + jsonLd(items) + '</div>');
  } else if (page === 'home') {
    const band = ['Built for the Pennines', 'Free delivery to Scotland, this month only', 'Free delivery to Scotland, this month only', 'Winter sale: 10% off the Moor Hardtail'][w];
    html = shell('Hilltrack E-Bikes | Leeds', css, '<div class="nav">HILLTRACK</div><div class="band">' + e(band) + '</div><div class="range"><h1>Electric mountain and gravel bikes, made in Yorkshire</h1><p>Hand-built in Leeds. Demo days every Saturday.</p></div>');
  }
}
if (!html) { status = 404; html = shell('Not found', '', '<h1 style="padding:40px">Page not found</h1>'); }
return [{ json: { status, html } }];
