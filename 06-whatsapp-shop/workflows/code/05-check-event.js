// Paystack webhook: only charge.success matters, and only as a hint. The payment is confirmed
// with Paystack's verify API next, so a forged webhook can't mark an order paid.
const b = $("Paystack Event").first().json.body ?? {};
if (b.event !== "charge.success" || !b.data?.reference) return [];
return [{ json: { reference: String(b.data.reference) } }];
