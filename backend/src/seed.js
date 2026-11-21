/* Initial data based on the PRC asset-code sheet (Company / Department / Account code / Type) */
const bcrypt = require('bcryptjs');

const COMPANIES = [
  ['P', 'PRC - Poipet Resort'],
  ['G', 'Grand Diamond'],
];

// Department Code sheet — [dept code used inside the asset code, department name]
const DEPARTMENTS = [
  ['101', 'ROOM'],
  ['102', 'HOUSEKEEPING'],
  ['201', 'FB - 24HRS KITCHEN'],
  ['202', 'FB - PIZZA&GRILLED'],
  ['203', 'FB - FB'],
  ['204', 'FB - KIOSK'],
  ['205', 'FB - NOODLE ZONE 2'],
  ['206', 'FB - BEER CITY'],
  ['207', 'FB - GRAND CHINA'],
  ['208', 'FB - BANQUET/EVENT'],
  ['209', 'FB - ADMIN'],
  ['210', 'FB - MAIN KITCHEN'],
  ['211', 'FB - SAIKOU SHABU'],
  ['212', 'FB - FERIED CHICKEN'],
  ['213', 'FB - BEER CITY DELIVERY'],
  ['214', 'FB - SAIKOU PREMIUM'],
  ['301', 'MOD - RENTAL AND OTHERS'],
  ['302', 'MOD - 2'],
  ['303', 'MOD - LAUNDRY'],
  ['304', 'MOD - 4'],
  ['305', 'MOD - 5'],
  ['306', 'MOD - 6'],
  ['307', 'MOD - TRANSPORATION'],
  ['308', 'MOD - DWO'],
  ['309', 'MOD - GRAND RESIDENCE'],
  ['310', 'MOD - GRAND SPORT COMPLEX'],
  ['311', 'MOD - KM.3'],
  ['312', 'MOD - STEIN BREW'],
  ['401', 'CASINO - GAMING'],
  ['402', 'CASINO - TREASURY'],
  ['403', 'CASINO - ROLLING'],
  ['404', 'CASINO - SLOT'],
  ['405', 'CASINO - CCTV'],
  ['406', 'CASINO - SECURITY'],
  ['407', 'CASINO - VIP'],
  ['490', 'OOD'],
  ['501', 'AG - FINANCE & ACCOUNTING'],
  ['502', 'AG - EXECUTIVE'],
  ['503', 'AG - HUMAN RESOURCE'],
  ['504', 'AG - INFORMATION TECHNOLOGY'],
  ['505', 'SECURITY'],
  ['601', 'SALE & MARKETING'],
  ['701', 'POMEC'],
  ['702', 'UTILITY & ENERY'],
  ['801', 'SERVICE/COMMISSION/DISTRIBUTE'],
  ['808', 'OWNER'],
  ['809', 'BELOW GOP'],
];

/**
 * Make department_codes match the Department Code sheet:
 * rows with a matching Dept Code get the sheet name (short name / head / email are kept),
 * missing codes are added, and every other row is removed — or only deactivated when assets still use it.
 */
async function syncDepartmentCodes(db) {
  const keep = [];
  for (const [deptNo, name] of DEPARTMENTS) {
    const { rows } = await db.query('SELECT id FROM department_codes WHERE dept_no=$1 ORDER BY id LIMIT 1', [deptNo]);
    if (rows[0]) {
      await db.query('UPDATE department_codes SET name=$2, active=TRUE WHERE id=$1', [rows[0].id, name]);
      keep.push(rows[0].id);
    } else {
      const ins = await db.query('INSERT INTO department_codes (dept_no, name) VALUES ($1,$2) RETURNING id', [deptNo, name]);
      keep.push(ins.rows[0].id);
    }
  }
  // not in the sheet: deactivate if assets reference it, otherwise delete (users / custodians fall back to "no department")
  await db.query(`UPDATE department_codes SET active=FALSE WHERE NOT (id = ANY($1)) AND id IN (SELECT department_id FROM assets WHERE department_id IS NOT NULL)`, [keep]);
  const del = await db.query(`DELETE FROM department_codes WHERE NOT (id = ANY($1)) AND id NOT IN (SELECT department_id FROM assets WHERE department_id IS NOT NULL)`, [keep]);
  return { departments: keep.length, removed: del.rowCount };
}

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

// Asset Code sheet — [account code used inside the asset code, description type]
const CATEGORIES = [
  ['170', 'FIXED ASSETS'],
  ['100', 'LAND'],
  ['110', 'LAND IMPROVEMENT'],
  ['200', 'BUILDING'],
  ['210', 'BUILDING IMPROVEMENT'],
  ['300', 'FUNITURE & FIXTURE'],
  ['400', 'MACHINERY & EQUIPMENT'],
  ['500', 'VEHICLE'],
  ['600', 'OFFICE EQUIPMENT'],
  ['601', 'ELECTRICITY SYSTEM & EQUIPMENT'],
  ['602', 'COMPUTER HARDWARE'],
  ['603', 'COMPUTER SOFTWARE'],
  ['604', 'TELECOMMUNICATION SYSTEM & EQUIPMENT'],
  ['605', 'FURNITURE - RESTAURANT'],
  ['606', 'HOUSEKEEPING EQUIPMENT'],
  ['607', 'KITCHEN EQUIPMENT'],
  ['608', 'F&B OTHER EQUIPMENT'],
  ['609', 'TV & AUDIO & SOUND SYSTEM & EQUIPMENT'],
  ['610', 'AIR CONDITION SYSTEM & EQUIPMENT'],
  ['611', 'BOILER & PLUMPING SYSTEM & EQUIPMENT'],
  ['612', 'LAUNDRY EQUIPMENT'],
  ['613', 'SPA EQUIPMENT'],
  ['614', 'ROOM EQUIPMENT'],
  ['615', 'FF&E OTHER'],
  ['616', 'ELEVATORS/ LIFTS/ESCALATOR R&M'],
  ['620', 'CASINO EQUIPMENT'],
  ['800', 'BREWERY EQUIPMENT'],
  ['900', 'LEASHOLD RIGHT'],
  ['910', 'LEASHOLD IMPROVEMENT'],
];

// Type numbers per account code (from the DropDown sheet)
const OWNER_TYPES = ['PRC', 'Grand', 'Other'];
const TYPES = {
  '100': OWNER_TYPES, '110': OWNER_TYPES, '200': OWNER_TYPES, '210': OWNER_TYPES,
  '300': ['Table', 'Chair', 'Other'],
  '400': ['Generator'],
  '500': ['Sedan', 'Pickup', 'Truck'],
  '600': ['Table', 'Chair', 'Other'],
  '601': ['Lamp', 'Wire'],
  '602': ['All in One', 'Notebook', 'PC Desktop', 'Monitor', 'UPS', 'Network Tools'],
  '603': ['Accounting', 'POS', 'HR'],
  '604': ['Rack', 'Server'],
};

// [building, floor, room] — same records as the original Asset PRC system
const LOCATIONS = [
  ['HOD', 'Floor-1', 'IT Server Room'],
  ['HOD', 'Floor-2', 'IT Dept.'],
  ['HOD', 'Floor-1', 'Construction Dept.'],
  ['HOD', 'Floor-1', 'Security Dept.'],
  ['HOD', 'Floor-1', 'Digital Marketing Dept.'],
  ['HOD', 'Floor-1', 'HOD Meting Room'],
  ['HOD', 'Floor-1', 'Payment Room'],
  ['HOD', 'Floor-2', 'COB. Room'],
  ['HOD', 'Floor-2', 'CFO. Room'],
  ['HOD', 'Floor-2', 'Accounting Dept.'],
  ['HOD', 'Floor-2', 'GM. Room'],
  ['HOD', 'Floor-2', 'Coordinator Gov. Room'],
  ['TRANSPORT', 'TRANSPORT', 'TRANSPORT'],
];

const DEFAULT_CHECKLIST = [
  'สภาพภายนอกสมบูรณ์ / Physical condition OK',
  'ใช้งานได้ปกติ / Working normally',
  'ป้าย QR ติดอยู่และอ่านได้ / QR label attached & readable',
  'อยู่ในสถานที่ที่ลงทะเบียน / At registered location',
];
const COMPUTER_CHECKLIST = [
  ...DEFAULT_CHECKLIST,
  'เปิดเครื่อง/บูตได้ปกติ / Powers on & boots',
  'อัปเดตระบบ/แอนตี้ไวรัส / OS & antivirus updated',
];

/**
 * Make asset_codes match the Asset Code sheet:
 * rows with a matching code get the sheet name (checklist, colour, cycle and types are kept),
 * missing codes are added with their type numbers, and every other row is removed —
 * or only deactivated when assets still use it.
 */
async function syncAssetCodes(db) {
  const keep = [];
  for (let i = 0; i < CATEGORIES.length; i++) {
    const [code, name] = CATEGORIES[i];
    const { rows } = await db.query('SELECT id FROM asset_codes WHERE code=$1 OR (account_code=$1 AND code !~ $2) ORDER BY (code=$1) DESC, id LIMIT 1', [code, '^[0-9]+$']);
    if (rows[0]) {
      await db.query('UPDATE asset_codes SET code=$2, account_code=$2, name=$3, active=TRUE WHERE id=$1', [rows[0].id, code, name]);
      keep.push(rows[0].id);
      continue;
    }
    const checklist = ['602', '603'].includes(code) ? COMPUTER_CHECKLIST : DEFAULT_CHECKLIST;
    const ins = await db.query(
      `INSERT INTO asset_codes (code, account_code, name, checklist, color) VALUES ($1,$1,$2,$3,$4) RETURNING id`,
      [code, name, JSON.stringify(checklist), PALETTE[i % PALETTE.length]]
    );
    keep.push(ins.rows[0].id);
    const types = TYPES[code] || [];
    for (let j = 0; j < types.length; j++) {
      await db.query('INSERT INTO asset_types (category_id, number, name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [ins.rows[0].id, String(j + 1).padStart(2, '0'), types[j]]);
    }
  }
  await db.query(`UPDATE asset_codes SET active=FALSE WHERE NOT (id = ANY($1)) AND id IN (SELECT category_id FROM assets)`, [keep]);
  const del = await db.query(`DELETE FROM asset_codes WHERE NOT (id = ANY($1)) AND id NOT IN (SELECT category_id FROM assets)`, [keep]);
  return { assetCodes: keep.length, removed: del.rowCount };
}

async function seed(db) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n > 0) return false;

  console.log('[seed] seeding initial data ...');
  const email = (process.env.ADMIN_EMAIL || 'assestsadmin@gmail.com').toLowerCase();
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'password', 10);
  await db.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'admin')`,
    [process.env.ADMIN_NAME || 'Administrator', email, hash]
  );

  for (const [code, name] of COMPANIES) {
    await db.query('INSERT INTO companies (code, name) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING', [code, name]);
  }
  await syncDepartmentCodes(db);
  await syncAssetCodes(db);

  for (let i = 0; i < LOCATIONS.length; i++) {
    const [building, floor, room] = LOCATIONS[i];
    await db.query(
      'INSERT INTO locations (code, name, building, floor, room) VALUES ($1,$2,$3,$4,$2) ON CONFLICT (code) DO NOTHING',
      [`LOC-${String(i + 1).padStart(3, '0')}`, room, building, floor]
    );
  }
  const it = await db.query(`SELECT id FROM department_codes WHERE dept_no='504'`);
  await db.query(
    `INSERT INTO custodians (employee_code, name, position, department_id, phone) VALUES ('20230270','Nitinai Pongsiitthisak','IT Officer',$1,'089-079-5068')
     ON CONFLICT DO NOTHING`,
    [it.rows[0]?.id || null]
  );

  const settings = {
    org_name: 'Asset PRC',
    org_subtitle: 'ระบบทะเบียนครุภัณฑ์',
    due_soon_days: 30,
    default_inspection_months: 6,
    currency: 'THB',
  };
  for (const [k, v] of Object.entries(settings)) {
    await db.query('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING', [k, JSON.stringify(v)]);
  }
  console.log(`[seed] done. Admin login: ${email}`);
  return true;
}

module.exports = { seed, syncAssetCodes, syncDepartmentCodes, LOCATIONS, CATEGORIES, DEPARTMENTS };

// `npm run seed`            → first-time seed (skipped when users exist)
// `npm run seed -- --codes` → re-apply the Department Code + Asset Code sheets to an existing database
if (require.main === module) {
  require('dotenv').config();
  const { pool, tx } = require('./db');
  const job = process.argv.includes('--codes')
    ? tx(async (db) => ({ ...(await syncDepartmentCodes(db)), ...(await syncAssetCodes(db)) })).then((r) => console.log('Codes synced:', r))
    : seed(pool).then((done) => console.log(done ? 'Seeded.' : 'Database already has users, skipped.'));
  job.catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
}
