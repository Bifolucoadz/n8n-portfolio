// ---- seed-bms.js (included by build.py): demo data for Brindle 5: Reset Demo ----
// An invented 14-person design and web studio in Manchester. Emails use example domains.
const SETTINGS_ROWS = [
  ['company', 'Brindle Studio', ''],
  ['location', 'Manchester', ''],
  ['default_rate', 95, 'Hourly rate for retainer overage, £'],
  ['vat_rate', 0.2, ''],
  ['payment_days', 30, 'Invoice terms'],
  ['max_day_hours', 12, 'log_time refuses more than this per person per day'],
  ['lock_days', 30, 'Timesheets older than this are locked'],
  ['week_hours', 37.5, 'Full-time week']
];
const TEAM = [
  ['P01', 'Hannah Cole', 'Managing Director', 'Strategy', 'yes', 30, 62, 140],
  ['P02', 'Marcus Reid', 'Head of Design', 'Design', 'yes', 37.5, 48, 115],
  ['P03', 'Nadia Shah', 'Senior Designer', 'Design', 'no', 37.5, 38, 95],
  ['P04', 'Leo Martins', 'Designer', 'Design', 'no', 37.5, 30, 85],
  ['P05', 'Amira Haddad', 'Junior Designer', 'Design', 'no', 37.5, 22, 70],
  ['P06', 'Tom Ellis', 'Head of Development', 'Development', 'yes', 37.5, 50, 120],
  ['P07', 'Sofia Russo', 'Senior Developer', 'Development', 'no', 37.5, 42, 105],
  ['P08', 'Ben Okafor', 'Developer', 'Development', 'no', 37.5, 32, 90],
  ['P09', 'Grace Liu', 'Developer', 'Development', 'no', 30, 32, 90],
  ['P10', 'Dan Fletcher', 'Project Manager', 'Delivery', 'yes', 37.5, 36, 85],
  ['P11', 'Chloe Bennett', 'Account Manager', 'Delivery', 'no', 37.5, 30, 80],
  ['P12', 'Sam Patel', 'Copywriter', 'Strategy', 'no', 30, 30, 85],
  ['P13', 'Ruth Adams', 'Operations and Finance', 'Operations', 'yes', 30, 34, 0],
  ['P14', 'Kai Morgan', 'Motion Designer', 'Design', 'no', 22.5, 34, 95]
];
const CLIENTS = [
  ['C00', 'Brindle Studio (internal)', 'Internal', '', '', 'Hannah Cole', 0, 0, 'active', '2019-04'],
  ['C01', 'Brightwater Dental', 'Healthcare', 'Dr Ellen Price', 'ellen.price@brightwater.example', 'Chloe Bennett', 20, 1900, 'active', '2024-03'],
  ['C02', 'Harbour & Co', 'Hospitality', 'James Harbour', 'james@harbourandco.example', 'Dan Fletcher', 0, 0, 'active', '2026-06'],
  ['C03', 'Kettleby Foods', 'Food and drink', 'Maya Kettleby', 'maya@kettleby.example', 'Chloe Bennett', 0, 0, 'active', '2025-01'],
  ['C04', 'Northwind Cycles', 'Retail', 'Owen Pryce', 'owen@northwindcycles.example', 'Dan Fletcher', 0, 0, 'active', '2025-09'],
  ['C05', 'Ashgrove Housing Trust', 'Charity', 'Linda Moss', 'linda.moss@ashgrove.example', 'Chloe Bennett', 0, 0, 'active', '2023-11'],
  ['C06', 'Pennant Law', 'Legal', 'Richard Pennant', 'r.pennant@pennantlaw.example', 'Dan Fletcher', 0, 0, 'active', '2026-07'],
  ['C07', 'Lumen Physio', 'Healthcare', 'Jo Whitaker', 'jo@lumenphysio.example', 'Chloe Bennett', 12, 1150, 'active', '2025-05'],
  ['C08', 'Rowan Gin', 'Drinks', 'Isla Rowan', 'isla@rowangin.example', 'Chloe Bennett', 0, 0, 'active', '2026-02'],
  ['C09', 'Corvid Analytics', 'Software', 'Arjun Mehta', 'arjun@corvid.example', 'Dan Fletcher', 0, 0, 'active', '2026-08'],
  ['C10', 'Millbrook School', 'Education', 'Helen Ward', 'h.ward@millbrook.example', 'Chloe Bennett', 0, 0, 'past', '2025-10']
];
// project, client, name, type, billing, status, lead, start (days from today), due (days), budget ratio (budget = hours logged / ratio), fee
const PROJECTS = [
  ['PR-101', 'C01', 'Website care retainer', 'Retainer', 'retainer', 'active', 'Sofia Russo', -400, null, null, 1900],
  ['PR-102', 'C01', 'Patient booking redesign', 'Website', 'fixed', 'active', 'Nadia Shah', -45, 12, 0.72, null],
  ['PR-103', 'C02', 'Harbour & Co rebrand', 'Brand', 'fixed', 'active', 'Marcus Reid', -60, 5, 1.18, null],
  ['PR-104', 'C02', 'Harbour & Co website', 'Website', 'fixed', 'active', 'Tom Ellis', -20, 55, 0.22, null],
  ['PR-105', 'C03', 'Snack range packaging', 'Packaging', 'fixed', 'done', 'Leo Martins', -120, -40, 0.94, 9800],
  ['PR-106', 'C04', 'Shopify store rebuild', 'E-commerce', 'hourly', 'active', 'Tom Ellis', -70, 20, 0.81, 0],
  ['PR-107', 'C05', 'Annual report 2026', 'Print', 'fixed', 'active', 'Nadia Shah', -30, 25, 0.55, null],
  ['PR-108', 'C06', 'Pennant Law website', 'Website', 'fixed', 'on_hold', 'Ben Okafor', -50, 40, null, 15500],
  ['PR-109', 'C07', 'Social content retainer', 'Retainer', 'retainer', 'active', 'Kai Morgan', -200, null, null, 1150],
  ['PR-110', 'C08', 'Christmas campaign', 'Campaign', 'fixed', 'active', 'Leo Martins', -25, 18, 0.88, null],
  ['PR-111', 'C09', 'Dashboard UI design', 'Product design', 'hourly', 'active', 'Nadia Shah', -40, 35, 0.6, 0],
  ['PR-112', 'C10', 'Prospectus 2026', 'Print', 'fixed', 'done', 'Amira Haddad', -150, -90, 0.97, 5400],
  ['PR-113', 'C00', 'New business and pitches', 'Internal', 'internal', 'active', 'Hannah Cole', -400, null, null, 0]
];
// Who works on what: person → [project, share of their billable day] (weights; recent 8 weeks)
const ALLOC = {
  'Hannah Cole': [['PR-113', 5], ['PR-103', 1], ['PR-104', 1]],
  'Marcus Reid': [['PR-103', 5], ['PR-110', 2], ['PR-107', 1], ['PR-113', 1.5]],
  'Nadia Shah': [['PR-102', 4], ['PR-111', 3], ['PR-107', 2], ['PR-113', 1]],
  'Leo Martins': [['PR-103', 4], ['PR-110', 4], ['PR-105', 1], ['PR-113', 1]],
  'Amira Haddad': [['PR-107', 3], ['PR-110', 2], ['PR-103', 1], ['PR-113', 1]],
  'Tom Ellis': [['PR-104', 3], ['PR-106', 2], ['PR-113', 1.5]],
  'Sofia Russo': [['PR-106', 2.5], ['PR-101', 0.7], ['PR-102', 3], ['PR-113', 0.8]],
  'Ben Okafor': [['PR-104', 4], ['PR-101', 0.4], ['PR-106', 2], ['PR-108', 0.6], ['PR-113', 0.8]],
  'Grace Liu': [['PR-102', 4], ['PR-104', 3], ['PR-111', 1], ['PR-113', 1]],
  'Dan Fletcher': [['PR-103', 2], ['PR-104', 2], ['PR-106', 1], ['PR-111', 1], ['PR-113', 2]],
  'Chloe Bennett': [['PR-101', 0.2], ['PR-109', 0.2], ['PR-110', 2], ['PR-107', 1], ['PR-113', 2.5]],
  'Sam Patel': [['PR-110', 3], ['PR-103', 2], ['PR-107', 2], ['PR-109', 0.3], ['PR-113', 1]],
  'Ruth Adams': [['PR-113', 1]],
  'Kai Morgan': [['PR-109', 0.8], ['PR-110', 3], ['PR-103', 1], ['PR-113', 0.5]]
};
// Utilisation this week (share of capacity) where it differs from the usual 0.9, so capacity questions have answers
const THIS_WEEK = { 'Leo Martins': 1.3, 'Amira Haddad': 0.45, 'Grace Liu': 0.55, 'Marcus Reid': 1.1 };
// Tasks: project, title, assignee, status, priority, due (days from today; null = none)
const TASKS = [
  ['PR-101', 'Monthly plugin and security updates', 'Sofia Russo', 'doing', 'normal', 2],
  ['PR-101', 'Fix contact form spam', 'Ben Okafor', 'todo', 'high', -3],
  ['PR-101', 'Add new hygienist profiles', 'Sofia Russo', 'todo', 'normal', -1],
  ['PR-101', 'Update opening hours for Christmas', 'Ben Okafor', 'todo', 'low', 30],
  ['PR-101', 'Speed up the home page (Core Web Vitals)', 'Sofia Russo', 'review', 'normal', 4],
  ['PR-102', 'Booking flow wireframes', 'Nadia Shah', 'done', 'high', -30],
  ['PR-102', 'Booking flow high-fidelity designs', 'Nadia Shah', 'done', 'high', -16],
  ['PR-102', 'Build appointment picker component', 'Grace Liu', 'doing', 'high', 3],
  ['PR-102', 'Connect to the practice management API', 'Sofia Russo', 'doing', 'high', 6],
  ['PR-102', 'Patient reminder emails', 'Grace Liu', 'todo', 'normal', 9],
  ['PR-102', 'Accessibility review of the booking flow', 'Nadia Shah', 'todo', 'normal', 10],
  ['PR-102', 'User testing with five patients', 'Nadia Shah', 'todo', 'normal', -2],
  ['PR-103', 'Brand strategy workshop', 'Hannah Cole', 'done', 'high', -50],
  ['PR-103', 'Logo concepts round 1', 'Marcus Reid', 'done', 'high', -35],
  ['PR-103', 'Logo concepts round 2', 'Leo Martins', 'done', 'high', -21],
  ['PR-103', 'Colour and type system', 'Leo Martins', 'review', 'high', -4],
  ['PR-103', 'Menu templates', 'Amira Haddad', 'doing', 'high', -2],
  ['PR-103', 'Signage designs for the Ancoats site', 'Leo Martins', 'todo', 'high', -1],
  ['PR-103', 'Brand guidelines document', 'Marcus Reid', 'todo', 'high', 3],
  ['PR-103', 'Tone of voice guide', 'Sam Patel', 'doing', 'normal', -3],
  ['PR-103', 'Social media launch assets', 'Kai Morgan', 'todo', 'normal', 5],
  ['PR-104', 'Sitemap and content plan', 'Dan Fletcher', 'done', 'normal', -12],
  ['PR-104', 'Homepage design', 'Leo Martins', 'todo', 'high', 14],
  ['PR-104', 'Booking widget integration research', 'Ben Okafor', 'doing', 'normal', 6],
  ['PR-104', 'Set up the CMS and hosting', 'Tom Ellis', 'doing', 'normal', 8],
  ['PR-104', 'Menu page component', 'Ben Okafor', 'todo', 'normal', 21],
  ['PR-105', 'Final print-ready artwork', 'Leo Martins', 'done', 'high', -45],
  ['PR-105', 'Printer proof sign-off', 'Leo Martins', 'done', 'normal', -41],
  ['PR-106', 'Product data import', 'Sofia Russo', 'done', 'high', -30],
  ['PR-106', 'Bike size guide tool', 'Tom Ellis', 'doing', 'normal', 7],
  ['PR-106', 'Checkout and payments testing', 'Ben Okafor', 'todo', 'high', 10],
  ['PR-106', 'Click and collect for the Salford shop', 'Sofia Russo', 'doing', 'high', 4],
  ['PR-106', 'Migrate customer accounts', 'Tom Ellis', 'todo', 'high', 14],
  ['PR-106', 'Redirect map from the old site', 'Ben Okafor', 'todo', 'normal', 16],
  ['PR-107', 'Annual report layout', 'Amira Haddad', 'doing', 'normal', 8],
  ['PR-107', 'Infographics for the impact section', 'Amira Haddad', 'todo', 'normal', 12],
  ['PR-107', 'Copy edit of the chair\'s statement', 'Sam Patel', 'review', 'normal', 2],
  ['PR-107', 'Photography selection', 'Nadia Shah', 'todo', 'low', 15],
  ['PR-108', 'Practice area page designs', 'Ben Okafor', 'todo', 'normal', 30],
  ['PR-108', 'Waiting for client content', 'Dan Fletcher', 'todo', 'normal', -10],
  ['PR-109', 'November content calendar', 'Kai Morgan', 'doing', 'normal', 3],
  ['PR-109', 'Stretching tips video series (3 reels)', 'Kai Morgan', 'todo', 'normal', 9],
  ['PR-109', 'Monthly report for Lumen', 'Chloe Bennett', 'todo', 'normal', 9],
  ['PR-110', 'Campaign concept', 'Leo Martins', 'done', 'high', -14],
  ['PR-110', 'Bottle neck tag design', 'Leo Martins', 'doing', 'high', 1],
  ['PR-110', 'Instagram ads (6 sizes)', 'Kai Morgan', 'doing', 'high', 4],
  ['PR-110', 'Gift box print artwork', 'Amira Haddad', 'todo', 'high', 6],
  ['PR-110', 'Campaign copy and taglines', 'Sam Patel', 'done', 'normal', -8],
  ['PR-110', 'Retailer sell-in deck', 'Chloe Bennett', 'todo', 'normal', 8],
  ['PR-111', 'Dashboard user interviews', 'Nadia Shah', 'done', 'normal', -20],
  ['PR-111', 'Dashboard wireframes', 'Nadia Shah', 'review', 'normal', -1],
  ['PR-111', 'Design system tokens', 'Grace Liu', 'todo', 'normal', 12],
  ['PR-111', 'Charts component specs', 'Nadia Shah', 'todo', 'normal', 18],
  ['PR-113', 'Pitch for Ardwick Brewing', 'Hannah Cole', 'doing', 'high', 2],
  ['PR-113', 'Case study: Northwind Cycles', 'Sam Patel', 'todo', 'low', 20],
  ['PR-113', 'Update the studio website portfolio', 'Amira Haddad', 'todo', 'low', 25]
];
// Invoices: id, client, project, period, issued (days), due (days), amount (ex VAT), status, paid (days)
const INVOICES = [
  ['INV-2031', 'C01', 'PR-101', 'July', -82, -52, 1900, 'paid', -55],
  ['INV-2032', 'C07', 'PR-109', 'July', -82, -52, 1150, 'paid', -60],
  ['INV-2033', 'C03', 'PR-105', 'Deposit 50%', -118, -88, 4900, 'paid', -100],
  ['INV-2034', 'C10', 'PR-112', 'Final 50%', -88, -58, 2700, 'paid', -62],
  ['INV-2035', 'C04', 'PR-106', 'August time', -51, -21, 6235, 'paid', -24],
  ['INV-2036', 'C01', 'PR-101', 'August', -51, -21, 1900, 'paid', -30],
  ['INV-2037', 'C07', 'PR-109', 'August', -51, -21, 1150, 'paid', -25],
  ['INV-2038', 'C02', 'PR-103', 'Deposit 50%', -58, -28, 9000, 'paid', -40],
  ['INV-2039', 'C01', 'PR-102', 'Deposit 40%', -44, -14, 5800, 'paid', -20],
  ['INV-2040', 'C08', 'PR-110', 'Deposit 50%', -24, 6, 4950, 'sent', null],
  ['INV-2041', 'C03', 'PR-105', 'Final 50%', -53, -23, 4900, 'sent', null],
  ['INV-2042', 'C01', 'PR-101', 'September', -21, 9, 1900, 'sent', null],
  ['INV-2043', 'C07', 'PR-109', 'September', -21, 9, 1150, 'paid', -6],
  ['INV-2044', 'C05', 'PR-107', 'Deposit 50%', -28, 2, 3600, 'paid', -15],
  ['INV-2045', 'C02', 'PR-104', 'Deposit 30%', -18, 12, 7800, 'sent', null],
  ['INV-2046', 'C06', 'PR-108', 'Deposit 30%', -48, -18, 4650, 'sent', null]
];
// Time logged before the 8 weeks of generated timesheets, for the finished projects (imported monthly totals)
const OLD_TIME = [
  ['PR-105', 'Leo Martins', -100, 30], ['PR-105', 'Marcus Reid', -95, 10], ['PR-105', 'Amira Haddad', -80, 12], ['PR-105', 'Leo Martins', -70, 26], ['PR-105', 'Sam Patel', -60, 4],
  ['PR-112', 'Amira Haddad', -140, 30], ['PR-112', 'Marcus Reid', -120, 6], ['PR-112', 'Amira Haddad', -110, 22]
];
const FIXED_BUDGETS = { 'PR-105': 90, 'PR-112': 60, 'PR-108': 140 };
// Deposit invoices are a share of the project fee (fees for active fixed-price projects = budget × £105)
const DEPOSIT_PCT = { 'INV-2038': 0.5, 'INV-2039': 0.4, 'INV-2040': 0.5, 'INV-2044': 0.5, 'INV-2045': 0.3, 'INV-2046': 0.3 };
// ---- end seed-bms.js ----
