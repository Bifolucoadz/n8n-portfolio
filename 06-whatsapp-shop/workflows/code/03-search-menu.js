// @include lib-shop.js
// Menu lines for the agent: by words and/or category, or a category overview when nothing is asked.
const c = $("Config").first().json;
const products = $input.all().map(i => i.json).filter(p => p.sku);
const line = p => p.name + " [" + p.sku + "]: " + naira(p.price_ngn) + ", serves " + p.serves + ", " +
  (p.lead_hours >= 24 ? p.lead_hours + " hours' notice" : "same day") + ", contains " + p.allergens +
  (p.available ? "" : " (SOLD OUT today)") + ". " + p.description;
const words = clean(c.query).split(" ").filter(w => w.length > 1 && !["the", "and", "for", "you", "have", "any", "do", "of", "a"].includes(w));
let list = products.filter(p => !c.category || p.category === c.category || p.category.startsWith(c.category));
if (words.length) {
  list = list
    .map(p => ({ p, score: words.filter(w => clean([p.name, p.category, p.description, p.allergens, p.sku].join(" ")).includes(w.replace(/s$/, ""))).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.p);
}
if (!words.length && !c.category) {
  const cats = [...new Set(products.map(p => p.category))];
  return [{ json: { result: "Menu categories: " + cats.map(cat => {
    const ps = products.filter(p => p.category === cat && p.available);
    return cat + " (" + ps.length + " items, from " + naira(Math.min(...ps.map(p => p.price_ngn))) + ")";
  }).join("; ") + ". Search a category or words for details." } }];
}
if (!list.length) return [{ json: { result: "Nothing on the menu matches \"" + (c.query || c.category) + "\". Categories: " + [...new Set(products.map(p => p.category))].join(", ") + "." } }];
return [{ json: { result: list.slice(0, 8).map(line).join("\n") + "\nEverything is made in a kitchen that also handles nuts, gluten, dairy and eggs." } }];
