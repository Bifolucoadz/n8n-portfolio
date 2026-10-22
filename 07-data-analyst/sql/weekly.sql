WITH weeks AS (
  SELECT generate_series(date_trunc('week', current_date) - interval '9 weeks', date_trunc('week', current_date) - interval '1 week', interval '1 week')::date AS wk
),
v AS (
  SELECT branch_id, date_trunc('week', checked_in_at)::date AS wk, count(*)::int AS n FROM visits
  WHERE checked_in_at >= date_trunc('week', current_date) - interval '9 weeks' AND checked_in_at < date_trunc('week', current_date) GROUP BY 1, 2
),
j AS (
  SELECT branch_id, date_trunc('week', joined_on)::date AS wk, count(*)::int AS n FROM members
  WHERE joined_on >= date_trunc('week', current_date) - interval '9 weeks' AND joined_on < date_trunc('week', current_date) GROUP BY 1, 2
),
c AS (
  SELECT branch_id, date_trunc('week', cancelled_on)::date AS wk, count(*)::int AS n FROM members
  WHERE cancelled_on >= date_trunc('week', current_date) - interval '9 weeks' AND cancelled_on < date_trunc('week', current_date) GROUP BY 1, 2
),
p AS (
  SELECT m.branch_id, date_trunc('week', p.paid_on)::date AS wk, count(*) FILTER (WHERE p.status = 'failed')::int AS failed,
    coalesce(round(sum(p.amount) FILTER (WHERE p.status = 'paid'), 2), 0) AS revenue
  FROM payments p JOIN members m ON m.id = p.member_id
  WHERE p.paid_on >= date_trunc('week', current_date) - interval '9 weeks' AND p.paid_on < date_trunc('week', current_date) GROUP BY 1, 2
)
SELECT b.name AS branch, w.wk AS week, coalesce(v.n, 0) AS check_ins, coalesce(j.n, 0) AS new_members, coalesce(c.n, 0) AS cancellations,
  coalesce(p.failed, 0) AS failed_payments, coalesce(p.revenue, 0) AS revenue
FROM branches b CROSS JOIN weeks w
LEFT JOIN v ON v.branch_id = b.id AND v.wk = w.wk
LEFT JOIN j ON j.branch_id = b.id AND j.wk = w.wk
LEFT JOIN c ON c.branch_id = b.id AND c.wk = w.wk
LEFT JOIN p ON p.branch_id = b.id AND p.wk = w.wk
WHERE w.wk >= b.opened_on - 7
ORDER BY 1, 2
