// The AI returns plain "Theme | count | suggestion" lines; everything is escaped here, so customer text can't inject HTML.
const s = $("Build Stats").first().json;
const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const row = (label, value) => "<tr><td>" + esc(label) + "</td><td><b>" + esc(value) + "</b></td></tr>";
const list = pairs => pairs.length
  ? "<ul>" + pairs.map(([k, n]) => "<li>" + esc(String(k).replaceAll("_", " ")) + ": " + n + "</li>").join("") + "</ul>"
  : "<p>None this week.</p>";

const themes = String($input.first().json.output ?? "")
  .split("\n")
  .map(line => line.split("|").map(part => part.trim()))
  .filter(parts => parts.length >= 3 && parts[0]);
const themesHtml = themes.length
  ? "<ul>" + themes.map(([theme, count, suggestion]) => "<li><b>" + esc(theme) + "</b> (" + esc(count) + "): " + esc(suggestion) + "</li>").join("") + "</ul>"
  : "<p>No unanswered questions this week.</p>";

const html = [
  "<h2>Copperline chat assistant: weekly report</h2>",
  "<p>" + esc(s.week_label) + "</p>",
  "<table cellpadding='6' style='border-collapse:collapse'>",
  row("Chats", s.chats),
  row("Messages", s.messages),
  row("Bookings made", s.bookings),
  row("Passed to the team", s.handoffs + " (" + s.open_tickets + " still open)"),
  row("Questions it couldn't answer", s.unanswered_count),
  row("Errors", s.errors),
  "</table>",
  "<h3>Bookings by service</h3>",
  list(s.bookings_by_service),
  "<h3>Hand-offs by reason</h3>",
  list(s.handoffs_by_reason),
  "<h3>What to add to the shop info</h3>",
  themesHtml,
  "<p style='color:#666'>Edit the shop info Google Doc and the assistant picks up the change within 5 minutes.</p>"
].join("\n");

return [{ json: { subject: "Copperline chat assistant: " + s.week_label, html } }];
