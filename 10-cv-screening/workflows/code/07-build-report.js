// Monday report for the recruiter: what came in, what's waiting for a decision, and interviews ahead.
// Built in code from the tables (no AI), so every number is exact.
// @include lib-ngt.js
const s = settingsOf($('Read Settings').all());
const jobs = $('Read Jobs').all().map(i => i.json).filter(j => j.job_id);
const cands = $('Read Candidates').all().map(i => i.json).filter(c => c.candidate_id);
const now = DateTime.now().setZone(TZ);
const weekAgo = now.minus({ days: 7 }).toMillis();
const link = (s.base_url || 'http://localhost:5678') + '/webhook/northgate/dashboard?key=' + encodeURIComponent(s.dashboard_key || '');
const cell = 'padding:6px 10px;border-bottom:1px solid #e3e9e5;text-align:left';
let rows = '';
for (const j of jobs) {
  const all = cands.filter(c => c.job_id === j.job_id);
  const week = all.filter(c => Date.parse(c.applied_at) >= weekAgo);
  const n = b => all.filter(c => c.band === b).length;
  rows += '<tr><td style="' + cell + '"><b>' + esc(j.title) + '</b></td><td style="' + cell + '">' + week.length + '</td><td style="' + cell + '">' + all.length + '</td>'
    + '<td style="' + cell + '">' + n('shortlist') + '</td><td style="' + cell + '">' + n('review') + '</td><td style="' + cell + '">' + (n('unlikely') + n('knockout')) + '</td>'
    + '<td style="' + cell + '">' + all.filter(c => c.status === 'interview_booked').length + '</td></tr>';
}
const head = ['Role', 'New this week', 'Total', 'Shortlist', 'Worth a look', 'Unlikely', 'Interviews'].map(h => '<th style="' + cell + ';color:#6b7c72;font-size:12px">' + h + '</th>').join('');
const waiting = cands.filter(c => c.status === 'new' && (c.band === 'shortlist' || c.band === 'review')).sort((a, b) => b.score - a.score);
const waitList = waiting.slice(0, 8).map(c => '<li style="margin:3px 0">' + esc(c.name) + ', ' + esc(c.job_title) + ': ' + esc(BAND_LABEL[c.band]) + ' (' + c.score + '), waiting ' + Math.max(0, Math.round(now.diff(DateTime.fromISO(c.screened_at), 'days').days)) + ' days</li>').join('');
const ahead = cands.filter(c => c.status === 'interview_booked' && Date.parse(c.interview_at) > now.toMillis()).sort((a, b) => Date.parse(a.interview_at) - Date.parse(b.interview_at));
const aheadList = ahead.map(c => '<li style="margin:3px 0">' + esc(whenText(c.interview_at)) + ': ' + esc(c.name) + ', ' + esc(c.job_title) + '</li>').join('');
const timed = cands.filter(c => c.screen_ms > 0);
const avg = timed.length ? (timed.reduce((t, c) => t + c.screen_ms, 0) / timed.length / 1000).toFixed(1) : '0';
const html = emailHtml(s.company || 'Northgate Talent', [
  'Good morning ' + esc(firstName(s.recruiter_name)) + ', here\'s the hiring pipeline for the week of ' + now.toFormat('d LLLL') + '.'
], '<table style="border-collapse:collapse;font-size:14px;margin:0 0 18px">' + '<tr>' + head + '</tr>' + rows + '</table>'
  + '<p style="margin:0 0 6px;text-align:left"><b>Waiting for your decision (' + waiting.length + ')</b></p>' + (waitList ? '<ul style="margin:0 0 16px;padding-left:18px;text-align:left">' + waitList + '</ul>' : '<p style="text-align:left">Nothing waiting.</p>')
  + '<p style="margin:0 0 6px;text-align:left"><b>Interviews ahead (' + ahead.length + ')</b></p>' + (aheadList ? '<ul style="margin:0 0 16px;padding-left:18px;text-align:left">' + aheadList + '</ul>' : '<p style="text-align:left">None booked yet.</p>')
  + '<p style="margin:0 0 6px;color:#6b7c72;font-size:13px;text-align:left">Average screening time: ' + avg + ' seconds per application.</p>'
  + '<p style="text-align:left"><a href="' + esc(link) + '" style="color:#0b6e4f;font-weight:600">Open the dashboard</a></p>');
return [{ json: { to: s.recruiter_email, subject: 'Hiring pipeline: week of ' + now.toFormat('d LLL'), html, kind: 'weekly_report', candidate_id: '' } }];
