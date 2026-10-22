// Wraps the AI's note in the shop's email: the items, the offer box (from the rules), a button back
// to the cart and the footer. The AI never writes prices, codes or links.
// @include lib-kettle.js
const s = settingsOf($('Read Settings').all());
const picks = $('Pick Carts').all().map(i => i.json);
return $input.all().map((it, k) => {
  const c = picks[k];
  const x = aiJson(it.json) || { subject: 'Your tea is still in your cart', preheader: '', body: 'Hi ' + c.first_name + ',\n\nYou left a few things in your cart. They\'re saved for you whenever you\'re ready.' };
  const rows = c.items.map(i => '<tr><td style="padding:6px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px">' + i.qty + ' × ' + esc(i.title) + '</td><td style="padding:6px 0;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:14px">' + usd(i.qty * i.price) + '</td></tr>').join('');
  const offerBox = c.offer ? '<div style="background:#f1f6ef;border:1px dashed #3f6b4a;border-radius:10px;padding:12px 14px;margin:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#2f4f37">'
    + (c.offer.type === 'code' ? 'Your first-order code: <b style="letter-spacing:1px">' + esc(c.offer.code) + '</b> (10% off)' : 'You\'re ' + usd(Number(s.free_shipping_threshold || 50) - c.subtotal) + ' away from free shipping.') + '</div>' : '';
  const html = '<span style="display:none">' + esc(x.preheader) + '</span>' + emailHtml(s.store_name || 'Kettle & Fern', paragraphsOf(x.body).concat(['Hannah<br>' + esc(s.store_name || 'Kettle & Fern')]),
    '<table style="width:100%;border-top:1px solid #e5e0d6;border-bottom:1px solid #e5e0d6;margin:4px 0 16px;border-collapse:collapse">' + rows + '</table>'
    + offerBox + button(c.recovery_url, 'Return to your cart')
    + '<p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8a857a;text-align:left">You\'re getting this because you started a checkout and agreed to emails from us. One reminder only. <a href="' + esc((s.store_url || '') + '/unsubscribe') + '" style="color:#8a857a">Unsubscribe</a>.</p>');
  return { json: { to: c.email, subject: x.subject, html, kind: 'cart_recovery', ref: c.checkout_id, action: 'mark_contacted', checkout_id: c.checkout_id, offer: c.offer ? (c.offer.code || 'free_shipping') : '' } };
});
