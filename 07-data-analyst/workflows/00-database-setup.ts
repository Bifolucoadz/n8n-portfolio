import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const PG_CRED = { postgres: { id: 'ilfPostgresLocal', name: 'Ironleaf Postgres (local)' } };

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Setup', position: [200, 300] },
  output: [{}]
});

const setup = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Build Database',
    position: [440, 300],
    parameters: { operation: 'executeQuery', query:
        '-- Ironleaf Fitness demo database (schema ironleaf), dated relative to today. Run by Ironleaf 0.\n' +
        '-- Everything is invented. setseed makes the same data every time it is run on the same day.\n' +
        '-- Stories in the data:\n' +
        '--   * a rival gym ("PulseFit") opened near Salford Quays about 4 months ago: cancellations jump there\n' +
        '--     with reason \'moved to a competitor\', and new joins drop;\n' +
        '--   * Altrincham opened about 8 months ago and is growing fast;\n' +
        '--   * the Standard plan went up from £32.99 to £34.99 about 7 months ago: a small wave of \'price increase\' cancellations;\n' +
        '--   * January is the busiest month for new members;\n' +
        '--   * last full week: Stockport check-ins fell (showers closed for repairs) and Didsbury had a spike in failed payments;\n' +
        '--   * members visit less in the weeks before they cancel.\n' +
        '\n' +
        'SET statement_timeout = 0;  -- n8n\'s database role stops queries after 10 s; setup needs longer\n' +
        'DROP SCHEMA IF EXISTS ironleaf CASCADE;\n' +
        'CREATE SCHEMA ironleaf;\n' +
        'SET search_path = ironleaf;\n' +
        'SET max_parallel_workers_per_gather = 0;\n' +
        'SELECT setseed(0.42);\n' +
        '\n' +
        'CREATE TABLE branches (\n' +
        '  id smallint PRIMARY KEY,\n' +
        '  name text NOT NULL,\n' +
        '  area text NOT NULL,\n' +
        '  opened_on date NOT NULL,\n' +
        '  capacity int NOT NULL\n' +
        ');\n' +
        'INSERT INTO branches VALUES\n' +
        '  (1, \'Ancoats\', \'Manchester city centre\', current_date - 2400, 180),\n' +
        '  (2, \'Didsbury\', \'South Manchester\', current_date - 1900, 140),\n' +
        '  (3, \'Salford Quays\', \'Salford\', current_date - 1500, 160),\n' +
        '  (4, \'Stockport\', \'Stockport\', current_date - 1200, 130),\n' +
        '  (5, \'Altrincham\', \'Trafford\', current_date - 240, 120);\n' +
        '\n' +
        'CREATE TABLE plans (\n' +
        '  id smallint PRIMARY KEY,\n' +
        '  name text NOT NULL,\n' +
        '  monthly_price numeric(6,2) NOT NULL,\n' +
        '  description text NOT NULL\n' +
        ');\n' +
        'INSERT INTO plans VALUES\n' +
        '  (1, \'Off-Peak\', 24.99, \'Weekdays before 4 pm and all weekend, one branch\'),\n' +
        '  (2, \'Standard\', 34.99, \'Any time, one branch (was 32.99 until the price rise)\'),\n' +
        '  (3, \'Premium\', 49.99, \'Any time, all branches, classes included\'),\n' +
        '  (4, \'Student\', 19.99, \'Any time, one branch, with a student card\');\n' +
        '\n' +
        'CREATE TABLE members (\n' +
        '  id int PRIMARY KEY,\n' +
        '  first_name text NOT NULL,\n' +
        '  last_name text NOT NULL,\n' +
        '  birth_year int NOT NULL,\n' +
        '  branch_id smallint NOT NULL REFERENCES branches,\n' +
        '  plan_id smallint NOT NULL REFERENCES plans,\n' +
        '  source text NOT NULL,          -- walk-in, online, referral, corporate\n' +
        '  joined_on date NOT NULL,\n' +
        '  cancelled_on date,             -- null while the membership is active\n' +
        '  cancel_reason text             -- moving away, cost, not using it, injury or health, price increase, moved to a competitor, other\n' +
        ');\n' +
        '\n' +
        '-- New members per branch per day: base rate x month seasonality, Altrincham opening promo, Salford slowdown.\n' +
        'INSERT INTO members (id, first_name, last_name, birth_year, branch_id, plan_id, source, joined_on)\n' +
        'SELECT row_number() OVER (ORDER BY g.d, b.id, k),\n' +
        '  (ARRAY[\'Aisha\',\'Ben\',\'Chloe\',\'Dan\',\'Ella\',\'Finn\',\'Grace\',\'Harry\',\'Isla\',\'Jack\',\'Kemi\',\'Liam\',\'Maya\',\'Noah\',\'Olivia\',\'Priya\',\'Ravi\',\'Sophie\',\'Tom\',\'Zara\',\'Amir\',\'Beth\',\'Callum\',\'Dev\',\'Erin\',\'Faisal\',\'Hannah\',\'Imran\',\'Jess\',\'Kieran\'])[1 + floor(random() * 30)::int],\n' +
        '  (ARRAY[\'Ahmed\',\'Baker\',\'Clarke\',\'Davies\',\'Evans\',\'Fisher\',\'Green\',\'Hughes\',\'Iqbal\',\'Jones\',\'Khan\',\'Lewis\',\'Morris\',\'Nowak\',\'Okafor\',\'Patel\',\'Quinn\',\'Roberts\',\'Shaw\',\'Taylor\',\'Walsh\',\'Young\'])[1 + floor(random() * 22)::int],\n' +
        '  1960 + floor(power(random(), 0.7) * 46)::int,\n' +
        '  b.id,\n' +
        '  2,  -- plan set below, one random draw per member\n' +
        '  (ARRAY[\'walk-in\',\'walk-in\',\'walk-in\',\'online\',\'online\',\'online\',\'online\',\'referral\',\'referral\',\'corporate\'])[1 + floor(random() * 10)::int],\n' +
        '  g.d::date\n' +
        'FROM generate_series(current_date - 900, current_date - 1, interval \'1 day\') AS g(d)\n' +
        'CROSS JOIN branches b\n' +
        'CROSS JOIN LATERAL generate_series(1, floor(\n' +
        '    (CASE b.id WHEN 1 THEN 1.0 WHEN 2 THEN 0.75 WHEN 3 THEN 0.85 WHEN 4 THEN 0.6 ELSE 0.9 END)\n' +
        '  * (ARRAY[2.0,1.2,1.0,0.95,0.95,0.8,0.75,0.75,1.25,1.05,0.9,0.55])[extract(month FROM g.d)::int]\n' +
        '  * CASE WHEN b.id = 5 AND g.d < b.opened_on + 30 THEN 2.5 ELSE 1 END\n' +
        '  * CASE WHEN b.id = 3 AND g.d >= current_date - 120 THEN 0.55 ELSE 1 END\n' +
        '  + random())::int) AS k\n' +
        'WHERE g.d >= b.opened_on;\n' +
        '\n' +
        '-- Plans: Ancoats (city centre) has more students.\n' +
        'UPDATE members SET plan_id = CASE WHEN r.p < (CASE WHEN members.branch_id = 1 THEN 0.20 ELSE 0.08 END) THEN 4\n' +
        '  WHEN r.p < 0.33 THEN 1 WHEN r.p < 0.80 THEN 2 ELSE 3 END\n' +
        'FROM (SELECT id, random() AS p FROM members) r WHERE r.id = members.id;\n' +
        '\n' +
        '-- Natural cancellations: tenure ~ exponential, mean about 14 months.\n' +
        'UPDATE members SET\n' +
        '  cancelled_on = c.d,\n' +
        '  cancel_reason = (ARRAY[\'moving away\',\'moving away\',\'cost\',\'cost\',\'cost\',\'not using it\',\'not using it\',\'not using it\',\'not using it\',\'injury or health\',\'other\'])[1 + floor(random() * 11)::int]\n' +
        'FROM (SELECT id, joined_on + 20 + floor(-ln(1 - random()) * 420)::int AS d FROM members) c\n' +
        'WHERE c.id = members.id AND c.d < current_date;\n' +
        '\n' +
        '-- Price rise on Standard about 7 months ago: some Standard members leave within a month.\n' +
        'UPDATE members SET cancelled_on = current_date - 210 + floor(random() * 30)::int, cancel_reason = \'price increase\'\n' +
        'WHERE plan_id = 2 AND joined_on < current_date - 210 AND (cancelled_on IS NULL OR cancelled_on > current_date - 180) AND random() < 0.07;\n' +
        '\n' +
        '-- The rival gym near Salford Quays (opened about 120 days ago).\n' +
        'UPDATE members SET cancelled_on = current_date - 118 + floor(random() * 112)::int, cancel_reason = \'moved to a competitor\'\n' +
        'WHERE branch_id = 3 AND joined_on < current_date - 120 AND (cancelled_on IS NULL OR cancelled_on > current_date - 118) AND random() < 0.22;\n' +
        '\n' +
        'CREATE TABLE payments (\n' +
        '  id bigserial PRIMARY KEY,\n' +
        '  member_id int NOT NULL REFERENCES members,\n' +
        '  paid_on date NOT NULL,\n' +
        '  amount numeric(7,2) NOT NULL,\n' +
        '  status text NOT NULL            -- paid, failed, refunded\n' +
        ');\n' +
        '-- Monthly direct debits from 18 months ago (members are charged on their joining day each month).\n' +
        'INSERT INTO payments (member_id, paid_on, amount, status)\n' +
        'SELECT m.id, s.d::date,\n' +
        '  CASE WHEN m.plan_id = 2 AND s.d < current_date - 210 THEN 32.99 ELSE p.monthly_price END,\n' +
        '  CASE WHEN random() < (CASE WHEN m.branch_id = 2 AND s.d >= date_trunc(\'week\', current_date) - interval \'7 days\' AND s.d < date_trunc(\'week\', current_date) THEN 0.22 ELSE 0.03 END) THEN \'failed\'\n' +
        '       WHEN random() < 0.005 THEN \'refunded\' ELSE \'paid\' END\n' +
        'FROM members m\n' +
        'JOIN plans p ON p.id = m.plan_id\n' +
        'CROSS JOIN LATERAL generate_series(m.joined_on, coalesce(m.cancelled_on, current_date) - 1, interval \'1 month\') AS s(d)\n' +
        'WHERE s.d >= current_date - 540;\n' +
        '\n' +
        'CREATE TABLE visits (\n' +
        '  member_id int NOT NULL REFERENCES members,\n' +
        '  branch_id smallint NOT NULL REFERENCES branches,\n' +
        '  checked_in_at timestamp NOT NULL\n' +
        ');\n' +
        '-- Gym check-ins for the last 18 months. Each member has their own habit; visits drop in the 6 weeks\n' +
        '-- before cancelling; weekends are quieter; Stockport was down last full week.\n' +
        'WITH m AS (SELECT id, branch_id, plan_id, joined_on, cancelled_on, 0.08 + random() * 0.42 AS habit FROM members)\n' +
        'INSERT INTO visits (member_id, branch_id, checked_in_at)\n' +
        'SELECT m.id,\n' +
        '  CASE WHEN m.plan_id = 3 AND random() < 0.15 THEN 1 + floor(random() * 4)::int ELSE m.branch_id END,\n' +
        '  g.d + make_interval(hours => (ARRAY[6,6,7,7,7,8,8,9,10,11,12,12,13,14,15,16,17,17,18,18,18,19,19,20,21])[1 + floor(random() * 25)::int], mins => floor(random() * 60)::int)\n' +
        'FROM m\n' +
        'CROSS JOIN LATERAL generate_series(greatest(m.joined_on, current_date - 540), coalesce(m.cancelled_on, current_date) - 1, interval \'1 day\') AS g(d)\n' +
        'WHERE random() < m.habit\n' +
        '  * (ARRAY[1.2,1.1,1.1,1.0,0.8,0.7,0.6])[extract(isodow FROM g.d)::int]\n' +
        '  * CASE WHEN m.cancelled_on IS NOT NULL AND g.d > m.cancelled_on - 42 THEN 0.35 ELSE 1 END\n' +
        '  * CASE WHEN m.branch_id = 4 AND g.d >= date_trunc(\'week\', current_date) - interval \'7 days\' AND g.d < date_trunc(\'week\', current_date) THEN 0.55 ELSE 1 END;\n' +
        '\n' +
        'CREATE TABLE classes (\n' +
        '  id int PRIMARY KEY,\n' +
        '  branch_id smallint NOT NULL REFERENCES branches,\n' +
        '  class_type text NOT NULL,       -- HIIT, Spin, Yoga, Pilates, Strength, Boxfit\n' +
        '  instructor text NOT NULL,\n' +
        '  starts_at timestamp NOT NULL,\n' +
        '  capacity int NOT NULL\n' +
        ');\n' +
        '-- Five classes a day per branch for the last 6 months.\n' +
        'INSERT INTO classes (id, branch_id, class_type, instructor, starts_at, capacity)\n' +
        'SELECT row_number() OVER (ORDER BY g.d, b.id, s.n), b.id,\n' +
        '  (ARRAY[\'HIIT\',\'Spin\',\'Yoga\',\'Strength\',\'Spin\',\'Pilates\',\'Boxfit\',\'Yoga\',\'HIIT\',\'Strength\'])[1 + ((s.n * 3 + extract(isodow FROM g.d)::int) % 10)],\n' +
        '  (ARRAY[\'Jade\',\'Marcus\',\'Leah\',\'Tariq\',\'Sam\',\'Nina\',\'Owen\',\'Bea\'])[1 + ((b.id * 3 + s.n) % 8)],\n' +
        '  g.d + (ARRAY[interval \'7 hours\', interval \'12 hours 30 minutes\', interval \'17 hours 30 minutes\', interval \'18 hours 30 minutes\', interval \'19 hours 30 minutes\'])[s.n],\n' +
        '  CASE WHEN (ARRAY[\'HIIT\',\'Spin\',\'Yoga\',\'Strength\',\'Spin\',\'Pilates\',\'Boxfit\',\'Yoga\',\'HIIT\',\'Strength\'])[1 + ((s.n * 3 + extract(isodow FROM g.d)::int) % 10)] = \'Spin\' THEN 24 ELSE 20 END\n' +
        'FROM generate_series(current_date - 180, current_date - 1, interval \'1 day\') AS g(d)\n' +
        'CROSS JOIN branches b\n' +
        'CROSS JOIN generate_series(1, 5) AS s(n)\n' +
        'WHERE g.d >= b.opened_on;\n' +
        '\n' +
        'CREATE TABLE bookings (\n' +
        '  class_id int NOT NULL REFERENCES classes,\n' +
        '  member_id int NOT NULL REFERENCES members,\n' +
        '  status text NOT NULL            -- attended, no_show, cancelled\n' +
        ');\n' +
        '-- Bookings: Spin and HIIT fill up, Pilates less so; Sunday classes have more no-shows.\n' +
        'WITH active AS (\n' +
        '  SELECT branch_id, array_agg(id ORDER BY id) AS ids FROM members WHERE cancelled_on IS NULL OR cancelled_on > current_date - 180 GROUP BY branch_id\n' +
        ')\n' +
        'INSERT INTO bookings (class_id, member_id, status)\n' +
        'SELECT c.id, a.ids[1 + floor(random() * array_length(a.ids, 1))::int],\n' +
        '  CASE WHEN random() < (CASE WHEN extract(isodow FROM c.starts_at) = 7 THEN 0.24 ELSE 0.09 END) THEN \'no_show\'\n' +
        '       WHEN random() < 0.08 THEN \'cancelled\' ELSE \'attended\' END\n' +
        'FROM classes c\n' +
        'JOIN active a ON a.branch_id = c.branch_id\n' +
        'CROSS JOIN LATERAL generate_series(1, least(c.capacity, floor(c.capacity * (CASE c.class_type WHEN \'Spin\' THEN 0.95 WHEN \'HIIT\' THEN 0.9 WHEN \'Boxfit\' THEN 0.8 WHEN \'Strength\' THEN 0.7 WHEN \'Yoga\' THEN 0.75 ELSE 0.55 END) * (0.7 + random() * 0.4))::int)) AS k;\n' +
        '\n' +
        'CREATE INDEX ON members (branch_id);\n' +
        'CREATE INDEX ON payments (member_id);\n' +
        'CREATE INDEX ON payments (paid_on);\n' +
        'CREATE INDEX ON visits (checked_in_at);\n' +
        'CREATE INDEX ON visits (branch_id, checked_in_at);\n' +
        'CREATE INDEX ON bookings (class_id);\n' +
        'ANALYZE;\n' +
        '\n' +
        '-- The only way the assistant\'s SQL reaches the data: one SELECT, run as a role that can only read this\n' +
        '-- schema, inside a STABLE function (Postgres refuses writes there), at most 500 rows back. Queries from\n' +
        '-- n8n\'s role (ironleaf_app) are stopped after 10 seconds (ALTER ROLE ... SET statement_timeout).\n' +
        'GRANT USAGE, CREATE ON SCHEMA ironleaf TO ironleaf_reader;\n' +
        'GRANT SELECT ON ALL TABLES IN SCHEMA ironleaf TO ironleaf_reader;\n' +
        'CREATE FUNCTION ironleaf.run_readonly(q text) RETURNS json\n' +
        'LANGUAGE plpgsql STABLE SECURITY DEFINER\n' +
        'SET search_path = ironleaf, pg_catalog\n' +
        'AS $$\n' +
        'DECLARE result json;\n' +
        'BEGIN\n' +
        '  EXECUTE format(\'SELECT coalesce(json_agg(t), \'\'[]\'\'::json) FROM (SELECT * FROM (%s) AS q LIMIT 500) AS t\', q) INTO result;\n' +
        '  RETURN result;\n' +
        'END\n' +
        '$$;\n' +
        'ALTER FUNCTION ironleaf.run_readonly(text) OWNER TO ironleaf_reader;\n' +
        'REVOKE CREATE ON SCHEMA ironleaf FROM ironleaf_reader;\n' +
        'REVOKE ALL ON FUNCTION ironleaf.run_readonly(text) FROM PUBLIC;\n' +
        'GRANT EXECUTE ON FUNCTION ironleaf.run_readonly(text) TO ironleaf_app;\n' +
        '\n' +
        'SELECT\n' +
        '  (SELECT count(*) FROM members) AS members,\n' +
        '  (SELECT count(*) FROM members WHERE cancelled_on IS NULL) AS active_members,\n' +
        '  (SELECT count(*) FROM payments) AS payments,\n' +
        '  (SELECT count(*) FROM visits) AS visits,\n' +
        '  (SELECT count(*) FROM classes) AS classes,\n' +
        '  (SELECT count(*) FROM bookings) AS bookings;\n'
      , options: { queryBatching: 'single', largeNumbersOutput: 'numbers' } },
    credentials: PG_CRED
  },
  output: [{ members: 3079, active_members: 1272, payments: 20290, visits: 146071, classes: 4500, bookings: 65340 }]
});

const summary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Summary', position: [680, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
        '// What the setup made.\n' +
        'const r = $input.all().map(i => i.json).find(x => x && x.members !== undefined) || {};\n' +
        'return [{ json: { schema: \'ironleaf\', members: Number(r.members), active_members: Number(r.active_members), payments: Number(r.payments), visits: Number(r.visits), classes: Number(r.classes), bookings: Number(r.bookings) } }];\n'
  } },
  output: [{ members: 3079 }]
});

const note = sticky(
  '## Ironleaf 0: Database Setup (manual, destructive)\nRebuilds the **ironleaf** schema in Postgres with 18 months of invented data for a 5-branch gym chain: members, plans, payments, gym check-ins, classes and bookings, dated relative to today. It plants a few stories for the demo (a rival gym hurting Salford Quays, a price rise, a fast-growing new branch, last week\'s Stockport dip and Didsbury payment failures).\nIt also creates **run_readonly()**: the assistant\'s SQL runs inside it as a role that can only read this schema, in a function where Postgres refuses writes, 500 rows at most.',
  [], { position: [160, 40], width: 900, height: 220, color: 3 }
);

export default workflow('ironleaf-setup', 'Ironleaf 0: Database Setup')
  .add(run)
  .to(setup)
  .to(summary)
  .add(note);
