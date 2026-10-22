-- Ironleaf Fitness demo database (schema ironleaf), dated relative to today. Run by Ironleaf 0.
-- Everything is invented. setseed makes the same data every time it is run on the same day.
-- Stories in the data:
--   * a rival gym ("PulseFit") opened near Salford Quays about 4 months ago: cancellations jump there
--     with reason 'moved to a competitor', and new joins drop;
--   * Altrincham opened about 8 months ago and is growing fast;
--   * the Standard plan went up from £32.99 to £34.99 about 7 months ago: a small wave of 'price increase' cancellations;
--   * January is the busiest month for new members;
--   * last full week: Stockport check-ins fell (showers closed for repairs) and Didsbury had a spike in failed payments;
--   * members visit less in the weeks before they cancel.

SET statement_timeout = 0;  -- n8n's database role stops queries after 10 s; setup needs longer
DROP SCHEMA IF EXISTS ironleaf CASCADE;
CREATE SCHEMA ironleaf;
SET search_path = ironleaf;
SET max_parallel_workers_per_gather = 0;
SELECT setseed(0.42);

CREATE TABLE branches (
  id smallint PRIMARY KEY,
  name text NOT NULL,
  area text NOT NULL,
  opened_on date NOT NULL,
  capacity int NOT NULL
);
INSERT INTO branches VALUES
  (1, 'Ancoats', 'Manchester city centre', current_date - 2400, 180),
  (2, 'Didsbury', 'South Manchester', current_date - 1900, 140),
  (3, 'Salford Quays', 'Salford', current_date - 1500, 160),
  (4, 'Stockport', 'Stockport', current_date - 1200, 130),
  (5, 'Altrincham', 'Trafford', current_date - 240, 120);

CREATE TABLE plans (
  id smallint PRIMARY KEY,
  name text NOT NULL,
  monthly_price numeric(6,2) NOT NULL,
  description text NOT NULL
);
INSERT INTO plans VALUES
  (1, 'Off-Peak', 24.99, 'Weekdays before 4 pm and all weekend, one branch'),
  (2, 'Standard', 34.99, 'Any time, one branch (was 32.99 until the price rise)'),
  (3, 'Premium', 49.99, 'Any time, all branches, classes included'),
  (4, 'Student', 19.99, 'Any time, one branch, with a student card');

CREATE TABLE members (
  id int PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_year int NOT NULL,
  branch_id smallint NOT NULL REFERENCES branches,
  plan_id smallint NOT NULL REFERENCES plans,
  source text NOT NULL,          -- walk-in, online, referral, corporate
  joined_on date NOT NULL,
  cancelled_on date,             -- null while the membership is active
  cancel_reason text             -- moving away, cost, not using it, injury or health, price increase, moved to a competitor, other
);

-- New members per branch per day: base rate x month seasonality, Altrincham opening promo, Salford slowdown.
INSERT INTO members (id, first_name, last_name, birth_year, branch_id, plan_id, source, joined_on)
SELECT row_number() OVER (ORDER BY g.d, b.id, k),
  (ARRAY['Aisha','Ben','Chloe','Dan','Ella','Finn','Grace','Harry','Isla','Jack','Kemi','Liam','Maya','Noah','Olivia','Priya','Ravi','Sophie','Tom','Zara','Amir','Beth','Callum','Dev','Erin','Faisal','Hannah','Imran','Jess','Kieran'])[1 + floor(random() * 30)::int],
  (ARRAY['Ahmed','Baker','Clarke','Davies','Evans','Fisher','Green','Hughes','Iqbal','Jones','Khan','Lewis','Morris','Nowak','Okafor','Patel','Quinn','Roberts','Shaw','Taylor','Walsh','Young'])[1 + floor(random() * 22)::int],
  1960 + floor(power(random(), 0.7) * 46)::int,
  b.id,
  2,  -- plan set below, one random draw per member
  (ARRAY['walk-in','walk-in','walk-in','online','online','online','online','referral','referral','corporate'])[1 + floor(random() * 10)::int],
  g.d::date
FROM generate_series(current_date - 900, current_date - 1, interval '1 day') AS g(d)
CROSS JOIN branches b
CROSS JOIN LATERAL generate_series(1, floor(
    (CASE b.id WHEN 1 THEN 1.0 WHEN 2 THEN 0.75 WHEN 3 THEN 0.85 WHEN 4 THEN 0.6 ELSE 0.9 END)
  * (ARRAY[2.0,1.2,1.0,0.95,0.95,0.8,0.75,0.75,1.25,1.05,0.9,0.55])[extract(month FROM g.d)::int]
  * CASE WHEN b.id = 5 AND g.d < b.opened_on + 30 THEN 2.5 ELSE 1 END
  * CASE WHEN b.id = 3 AND g.d >= current_date - 120 THEN 0.55 ELSE 1 END
  + random())::int) AS k
WHERE g.d >= b.opened_on;

-- Plans: Ancoats (city centre) has more students.
UPDATE members SET plan_id = CASE WHEN r.p < (CASE WHEN members.branch_id = 1 THEN 0.20 ELSE 0.08 END) THEN 4
  WHEN r.p < 0.33 THEN 1 WHEN r.p < 0.80 THEN 2 ELSE 3 END
FROM (SELECT id, random() AS p FROM members) r WHERE r.id = members.id;

-- Natural cancellations: tenure ~ exponential, mean about 14 months.
UPDATE members SET
  cancelled_on = c.d,
  cancel_reason = (ARRAY['moving away','moving away','cost','cost','cost','not using it','not using it','not using it','not using it','injury or health','other'])[1 + floor(random() * 11)::int]
FROM (SELECT id, joined_on + 20 + floor(-ln(1 - random()) * 420)::int AS d FROM members) c
WHERE c.id = members.id AND c.d < current_date;

-- Price rise on Standard about 7 months ago: some Standard members leave within a month.
UPDATE members SET cancelled_on = current_date - 210 + floor(random() * 30)::int, cancel_reason = 'price increase'
WHERE plan_id = 2 AND joined_on < current_date - 210 AND (cancelled_on IS NULL OR cancelled_on > current_date - 180) AND random() < 0.07;

-- The rival gym near Salford Quays (opened about 120 days ago).
UPDATE members SET cancelled_on = current_date - 118 + floor(random() * 112)::int, cancel_reason = 'moved to a competitor'
WHERE branch_id = 3 AND joined_on < current_date - 120 AND (cancelled_on IS NULL OR cancelled_on > current_date - 118) AND random() < 0.22;

CREATE TABLE payments (
  id bigserial PRIMARY KEY,
  member_id int NOT NULL REFERENCES members,
  paid_on date NOT NULL,
  amount numeric(7,2) NOT NULL,
  status text NOT NULL            -- paid, failed, refunded
);
-- Monthly direct debits from 18 months ago (members are charged on their joining day each month).
INSERT INTO payments (member_id, paid_on, amount, status)
SELECT m.id, s.d::date,
  CASE WHEN m.plan_id = 2 AND s.d < current_date - 210 THEN 32.99 ELSE p.monthly_price END,
  CASE WHEN random() < (CASE WHEN m.branch_id = 2 AND s.d >= date_trunc('week', current_date) - interval '7 days' AND s.d < date_trunc('week', current_date) THEN 0.22 ELSE 0.03 END) THEN 'failed'
       WHEN random() < 0.005 THEN 'refunded' ELSE 'paid' END
FROM members m
JOIN plans p ON p.id = m.plan_id
CROSS JOIN LATERAL generate_series(m.joined_on, coalesce(m.cancelled_on, current_date) - 1, interval '1 month') AS s(d)
WHERE s.d >= current_date - 540;

CREATE TABLE visits (
  member_id int NOT NULL REFERENCES members,
  branch_id smallint NOT NULL REFERENCES branches,
  checked_in_at timestamp NOT NULL
);
-- Gym check-ins for the last 18 months. Each member has their own habit; visits drop in the 6 weeks
-- before cancelling; weekends are quieter; Stockport was down last full week.
WITH m AS (SELECT id, branch_id, plan_id, joined_on, cancelled_on, 0.08 + random() * 0.42 AS habit FROM members)
INSERT INTO visits (member_id, branch_id, checked_in_at)
SELECT m.id,
  CASE WHEN m.plan_id = 3 AND random() < 0.15 THEN 1 + floor(random() * 4)::int ELSE m.branch_id END,
  g.d + make_interval(hours => (ARRAY[6,6,7,7,7,8,8,9,10,11,12,12,13,14,15,16,17,17,18,18,18,19,19,20,21])[1 + floor(random() * 25)::int], mins => floor(random() * 60)::int)
FROM m
CROSS JOIN LATERAL generate_series(greatest(m.joined_on, current_date - 540), coalesce(m.cancelled_on, current_date) - 1, interval '1 day') AS g(d)
WHERE random() < m.habit
  * (ARRAY[1.2,1.1,1.1,1.0,0.8,0.7,0.6])[extract(isodow FROM g.d)::int]
  * CASE WHEN m.cancelled_on IS NOT NULL AND g.d > m.cancelled_on - 42 THEN 0.35 ELSE 1 END
  * CASE WHEN m.branch_id = 4 AND g.d >= date_trunc('week', current_date) - interval '7 days' AND g.d < date_trunc('week', current_date) THEN 0.55 ELSE 1 END;

CREATE TABLE classes (
  id int PRIMARY KEY,
  branch_id smallint NOT NULL REFERENCES branches,
  class_type text NOT NULL,       -- HIIT, Spin, Yoga, Pilates, Strength, Boxfit
  instructor text NOT NULL,
  starts_at timestamp NOT NULL,
  capacity int NOT NULL
);
-- Five classes a day per branch for the last 6 months.
INSERT INTO classes (id, branch_id, class_type, instructor, starts_at, capacity)
SELECT row_number() OVER (ORDER BY g.d, b.id, s.n), b.id,
  (ARRAY['HIIT','Spin','Yoga','Strength','Spin','Pilates','Boxfit','Yoga','HIIT','Strength'])[1 + ((s.n * 3 + extract(isodow FROM g.d)::int) % 10)],
  (ARRAY['Jade','Marcus','Leah','Tariq','Sam','Nina','Owen','Bea'])[1 + ((b.id * 3 + s.n) % 8)],
  g.d + (ARRAY[interval '7 hours', interval '12 hours 30 minutes', interval '17 hours 30 minutes', interval '18 hours 30 minutes', interval '19 hours 30 minutes'])[s.n],
  CASE WHEN (ARRAY['HIIT','Spin','Yoga','Strength','Spin','Pilates','Boxfit','Yoga','HIIT','Strength'])[1 + ((s.n * 3 + extract(isodow FROM g.d)::int) % 10)] = 'Spin' THEN 24 ELSE 20 END
FROM generate_series(current_date - 180, current_date - 1, interval '1 day') AS g(d)
CROSS JOIN branches b
CROSS JOIN generate_series(1, 5) AS s(n)
WHERE g.d >= b.opened_on;

CREATE TABLE bookings (
  class_id int NOT NULL REFERENCES classes,
  member_id int NOT NULL REFERENCES members,
  status text NOT NULL            -- attended, no_show, cancelled
);
-- Bookings: Spin and HIIT fill up, Pilates less so; Sunday classes have more no-shows.
WITH active AS (
  SELECT branch_id, array_agg(id ORDER BY id) AS ids FROM members WHERE cancelled_on IS NULL OR cancelled_on > current_date - 180 GROUP BY branch_id
)
INSERT INTO bookings (class_id, member_id, status)
SELECT c.id, a.ids[1 + floor(random() * array_length(a.ids, 1))::int],
  CASE WHEN random() < (CASE WHEN extract(isodow FROM c.starts_at) = 7 THEN 0.24 ELSE 0.09 END) THEN 'no_show'
       WHEN random() < 0.08 THEN 'cancelled' ELSE 'attended' END
FROM classes c
JOIN active a ON a.branch_id = c.branch_id
CROSS JOIN LATERAL generate_series(1, least(c.capacity, floor(c.capacity * (CASE c.class_type WHEN 'Spin' THEN 0.95 WHEN 'HIIT' THEN 0.9 WHEN 'Boxfit' THEN 0.8 WHEN 'Strength' THEN 0.7 WHEN 'Yoga' THEN 0.75 ELSE 0.55 END) * (0.7 + random() * 0.4))::int)) AS k;

CREATE INDEX ON members (branch_id);
CREATE INDEX ON payments (member_id);
CREATE INDEX ON payments (paid_on);
CREATE INDEX ON visits (checked_in_at);
CREATE INDEX ON visits (branch_id, checked_in_at);
CREATE INDEX ON bookings (class_id);
ANALYZE;

-- The only way the assistant's SQL reaches the data: one SELECT, run as a role that can only read this
-- schema, inside a STABLE function (Postgres refuses writes there), at most 500 rows back. Queries from
-- n8n's role (ironleaf_app) are stopped after 10 seconds (ALTER ROLE ... SET statement_timeout).
GRANT USAGE, CREATE ON SCHEMA ironleaf TO ironleaf_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ironleaf TO ironleaf_reader;
CREATE FUNCTION ironleaf.run_readonly(q text) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ironleaf, pg_catalog
AS $$
DECLARE result json;
BEGIN
  EXECUTE format('SELECT coalesce(json_agg(t), ''[]''::json) FROM (SELECT * FROM (%s) AS q LIMIT 500) AS t', q) INTO result;
  RETURN result;
END
$$;
ALTER FUNCTION ironleaf.run_readonly(text) OWNER TO ironleaf_reader;
REVOKE CREATE ON SCHEMA ironleaf FROM ironleaf_reader;
REVOKE ALL ON FUNCTION ironleaf.run_readonly(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ironleaf.run_readonly(text) TO ironleaf_app;

SELECT
  (SELECT count(*) FROM members) AS members,
  (SELECT count(*) FROM members WHERE cancelled_on IS NULL) AS active_members,
  (SELECT count(*) FROM payments) AS payments,
  (SELECT count(*) FROM visits) AS visits,
  (SELECT count(*) FROM classes) AS classes,
  (SELECT count(*) FROM bookings) AS bookings;
