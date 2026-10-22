// Paystack's authorization_url (or a mock link before the Paystack key exists) goes on the order.
const v = $("Validate Checkout").first().json;
const res = $input.first().json;
const url = v.mode === "paystack" ? res?.data?.authorization_url : "https://checkout.paystack.com/mock-" + v.row.paystack_ref.toLowerCase();
const ok = Boolean(url);
return [{ json: { ...v.row, status: ok ? "awaiting_payment" : "cart", pay_url: url || "", paystack_ref: ok ? (res?.data?.reference || v.row.paystack_ref) : "", _ok: ok, _error: ok ? "" : String(res?.message || res?.error?.message || "no link returned").slice(0, 200) } }];
