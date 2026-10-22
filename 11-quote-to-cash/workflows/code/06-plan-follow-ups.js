// Every morning: chase sent quotes (twice), expire old ones, remind about unpaid deposits and invoices,
// ask happy clients for a review two days after they pay, and send the owner a short summary.
// @include lib-mgv.js
const T = tablesOf($('Load All').first().json);
const s = settingsOf(T.Settings);
const now = nowDt();
const plan = emptyPlan(s);
const reminderDays = String(s.reminder_days || '3, 7').split(',').map(n => Number(n.trim()) || 0);
const events = T.Events || [];
const had = (id, ev) => events.some(e => e.quote_id === id && e.event === ev);
const daysSince = iso => iso ? now.diff(toDt(iso), 'days').days : 0;
const at = nowIso();
const done = [];
const quotes = (T.Quotes || []).map(quoteOf);
const sign = (q) => '<p style="margin:0;color:#6b7a72;font-size:13px;text-align:left">' + esc(q.estimator || s.owner_name) + ', ' + esc(s.company) + ' · ' + esc(s.company_phone) + '</p>';

for (const q of quotes) {
  const link = quoteUrl(s, q.token);
  const hi = 'Hi ' + esc(firstName(q.client_name)) + ',';
  if (q.status === 'sent' && isExpired(q)) {
    plan.quote_updates.push({ quote_id: q.quote_id, status: 'expired', updated_at: at });
    plan.events.push(eventRow(q.quote_id, 'expired', 'Not accepted by ' + day(q.valid_until), 'system'));
    done.push('Expired ' + q.quote_id + ' ' + q.client_name + ' (' + money(q.total) + ')');
    continue;
  }
  if (q.status === 'sent') {
    const age = daysSince(q.sent_at);
    const n = q.reminders_sent;
    if (n < reminderDays.length && age >= reminderDays[n]) {
      const paras = n === 0
        ? (q.view_count
          ? [hi, 'Just checking in on your quote for <b>' + esc(q.job_title) + '</b>. If anything needs changing, ask us on the quote page or reply to this email; we\'re happy to adjust it.']
          : [hi, 'We sent your quote for <b>' + esc(q.job_title) + '</b> on ' + day(q.sent_at) + '. In case it got lost in your inbox, here it is again.'])
        : [hi, 'A last note about your quote for <b>' + esc(q.job_title) + '</b> (' + money(q.total) + '). It\'s valid until ' + day(q.valid_until) + ' and our diary fills up a few weeks ahead, so if you\'d like to go ahead you can accept online in a minute.'];
      plan.emails.push(emailItem(q.client_email, n === 0 ? 'Your quote for ' + q.job_title : 'Your quote is valid until ' + day(q.valid_until), emailHtml(s, paras, button(link, 'View your quote') + sign(q)), 'reminder_' + (n + 1), q.quote_id, [link]));
      plan.quote_updates.push({ quote_id: q.quote_id, reminders_sent: n + 1, last_reminder_at: at, updated_at: at });
      plan.events.push(eventRow(q.quote_id, 'reminder', 'Reminder ' + (n + 1) + (q.view_count ? ' (opened ' + q.view_count + '×)' : ' (not opened)'), 'system'));
      done.push('Chased ' + q.quote_id + ' ' + q.client_name + ' (reminder ' + (n + 1) + ')');
    }
  }
  if (q.status === 'accepted' && daysSince(q.accepted_at) >= 3 && !had(q.quote_id, 'deposit_reminder')) {
    const pay = payUrl(s, q.token, 'deposit');
    plan.emails.push(emailItem(q.client_email, 'Book your start date: ' + q.job_title, emailHtml(s, [hi, 'Thanks again for accepting our quote for <b>' + esc(q.job_title) + '</b>. We book your start date as soon as the <b>' + money(q.deposit_due) + '</b> deposit is paid, and the earliest dates go quickly.'], button(pay, 'Pay the deposit') + sign(q)), 'deposit_reminder', q.quote_id, [pay]));
    plan.events.push(eventRow(q.quote_id, 'deposit_reminder', money(q.deposit_due) + ' deposit not paid after ' + Math.floor(daysSince(q.accepted_at)) + ' days', 'system'));
    done.push('Reminded ' + q.client_name + ' about the ' + money(q.deposit_due) + ' deposit');
  }
  if (q.status === 'completed' && daysSince(q.completed_at) >= (Number(s.payment_days) || 7) && !had(q.quote_id, 'balance_reminder')) {
    const pay = payUrl(s, q.token, 'balance');
    plan.emails.push(emailItem(q.client_email, 'Reminder: invoice ' + q.invoice_id, emailHtml(s, [hi, 'A friendly reminder that invoice ' + esc(q.invoice_id) + ' for <b>' + money(q.balance_due) + '</b> was due on ' + day(toDt(q.completed_at).plus({ days: Number(s.payment_days) || 7 }).toISO()) + '. If you\'ve already paid, thank you and please ignore this.'], button(pay, 'Pay ' + money(q.balance_due)) + sign(q)), 'balance_reminder', q.quote_id, [pay], 'invoice', q.token));
    plan.events.push(eventRow(q.quote_id, 'balance_reminder', money(q.balance_due) + ' overdue', 'system'));
    done.push('Reminded ' + q.client_name + ' about invoice ' + q.invoice_id);
  }
  if (q.status === 'paid' && !q.review_sent_at && q.balance_paid_at && daysSince(q.balance_paid_at) >= 2) {
    plan.emails.push(emailItem(q.client_email, 'How did we do?', emailHtml(s, [hi, 'We hope you\'re enjoying the new garden! If you have a minute, a short review would mean a lot to a small team like ours.'], button(s.review_url, 'Leave a review') + sign(q)), 'review_request', q.quote_id, [s.review_url]));
    plan.quote_updates.push({ quote_id: q.quote_id, review_sent_at: at, updated_at: at });
    plan.events.push(eventRow(q.quote_id, 'review_requested', 'Two days after paying', 'system'));
    done.push('Asked ' + q.client_name + ' for a review');
  }
}

// The owner's morning summary
const today = now.toISODate(), week = now.plus({ days: 7 }).toISODate();
const starting = (T.Schedule || []).filter(e => String(e.start).slice(0, 10) >= today && String(e.start).slice(0, 10) <= week).sort((a, b) => a.start < b.start ? -1 : 1);
const drafts = quotes.filter(q => q.status === 'draft');
const warm = quotes.filter(q => q.status === 'sent' && !isExpired(q) && q.viewed_at && daysSince(q.viewed_at) <= 3);
const deposits = quotes.filter(q => q.status === 'accepted');
const owed = quotes.filter(q => q.status === 'completed');
const li = arr => arr.length ? '<ul style="margin:0 0 14px;padding-left:20px;text-align:left">' + arr.map(t => '<li style="margin:3px 0">' + t + '</li>').join('') + '</ul>' : '<p style="margin:0 0 14px;color:#6b7a72;text-align:left">None.</p>';
const h = t => '<p style="margin:18px 0 6px;font-weight:700;text-align:left">' + t + '</p>';
const body = h('Starting in the next 7 days') + li(starting.map(e => esc(dayLong(e.start)) + ': ' + esc(e.title) + ' (' + esc(e.crew) + ')'))
  + h('Drafts to check and send') + li(drafts.map(q => q.quote_id + ' ' + esc(q.client_name) + ': ' + esc(q.job_title) + ' (' + money(q.total) + ')'))
  + h('Warm quotes (opened in the last 3 days)') + li(warm.map(q => q.quote_id + ' ' + esc(q.client_name) + ', opened ' + q.view_count + '×' + (q.client_phone ? ': call ' + esc(q.client_phone) : '')))
  + h('Money coming in') + li(deposits.map(q => 'Deposit ' + money(q.deposit_due) + ' from ' + esc(q.client_name)).concat(owed.map(q => 'Invoice ' + esc(q.invoice_id) + ' ' + money(q.balance_due) + ' from ' + esc(q.client_name))))
  + h('Done for you this morning') + li(done.map(esc));
plan.emails.push(emailItem(s.owner_email, 'Morning summary for ' + now.toFormat('cccc d LLLL'), emailHtml(s, ['Good morning ' + esc(firstName(s.owner_name)) + ', here\'s today.'], body + button(dashboardUrl(s), 'Open the dashboard')), 'owner_summary', '', [dashboardUrl(s)]));
plan.result = { ok: true, done, follow_ups: done.length, emails: plan.emails.length };
return [{ json: { plan } }];
