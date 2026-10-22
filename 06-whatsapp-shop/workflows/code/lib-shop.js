// ---- lib-shop.js (included by build.py): prices, carts, zones and delivery rules ----
const SHOP = {
  TZ: "Africa/Lagos",
  OPEN_DAYS: [1, 2, 3, 4, 5, 6], // Monday-Saturday
  CLOSED: ["2026-12-25", "2026-12-26", "2027-01-01"],
  // window label -> start hour
  WINDOWS: {
    delivery: { "10am-1pm": 10, "1pm-4pm": 13, "4pm-6pm": 16 },
    pickup: { "9am-12pm": 9, "12pm-3pm": 12, "3pm-7pm": 15 },
  },
  DAYS_AHEAD: 21,
  MAX_QTY: 50,
  CAKE_MESSAGE_MAX: 30,
  PICKUP: "14 Admiralty Way, Lekki Phase 1, Lagos",
};

const naira = n => "₦" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const clean = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const parseItems = json => {
  try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }
};
const subtotalOf = items => items.reduce((s, i) => s + i.qty * i.unit_ngn, 0);
const itemLine = i => i.qty + " × " + i.name + (i.cake_message ? ' (message: "' + i.cake_message + '")' : "") + " = " + naira(i.qty * i.unit_ngn);
const newId = prefix => prefix + Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

// Product by SKU, else by name words (all words of the query must appear).
function findProduct(products, ref) {
  const r = String(ref ?? "").trim();
  if (!r) return null;
  const bySku = products.find(p => p.sku.toLowerCase() === r.toLowerCase());
  if (bySku) return bySku;
  const words = clean(r).split(" ").filter(w => w.length > 1);
  const hits = products.filter(p => words.every(w => clean(p.name + " " + p.sku).includes(w)));
  return hits.length === 1 ? hits[0] : null;
}

// Delivery zone whose name or alias appears in the customer's text.
function matchZone(zones, text) {
  const t = " " + clean(text) + " ";
  let best = null;
  for (const z of zones) {
    const names = [z.area, ...String(z.aliases ?? "").split(",")].map(clean).filter(Boolean);
    for (const n of names) {
      if (t.includes(" " + n + " ") && (!best || n.length > best.len)) best = { zone: z, len: n.length };
    }
  }
  return best ? best.zone : null;
}

function isOpenDay(d) {
  return SHOP.OPEN_DAYS.includes(d.weekday) && !SHOP.CLOSED.includes(d.toISODate());
}

// Earliest (day, window) that respects the longest lead time in the cart.
function earliestSlot(leadHours, fulfilment, now) {
  const windows = SHOP.WINDOWS[fulfilment] || SHOP.WINDOWS.delivery;
  const ready = now.plus({ hours: leadHours });
  for (let d = now.startOf("day"); d <= now.startOf("day").plus({ days: SHOP.DAYS_AHEAD }); d = d.plus({ days: 1 })) {
    if (!isOpenDay(d)) continue;
    for (const [label, hour] of Object.entries(windows)) {
      if (d.set({ hour }) >= ready) return { date: d, window: label };
    }
  }
  return null;
}

// "Thursday 30 October, 1pm-4pm"
const sayDay = d => d.toFormat("cccc d LLLL");
// ---- end lib-shop.js ----
