// @include lib-shop.js
const c = $("Config").first().json;
const zones = $input.all().map(i => i.json).filter(z => z.area);
const covered = zones.filter(z => z.covered).map(z => z.area + " " + naira(z.fee_ngn)).join("; ");
const z = matchZone(zones, c.area || c.address);
if (!z) return [{ json: { result: 'Area "' + c.area + '" not recognised. We deliver to: ' + covered + ". Ask for the nearest of these, or offer pickup at " + SHOP.PICKUP + "." } }];
if (!z.covered) return [{ json: { result: "We don't deliver to " + z.area + " yet. Offer pickup at " + SHOP.PICKUP + "." } }];
return [{ json: { result: "Delivery to " + z.area + ": " + naira(z.fee_ngn) + ", usually " + z.eta + " within the chosen window. Windows: 10am-1pm, 1pm-4pm, 4pm-6pm, Monday to Saturday." } }];
