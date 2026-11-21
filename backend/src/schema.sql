-- Asset PRC database schema (idempotent)

-- v1.4: tables renamed (departments -> department_codes, categories -> asset_codes).
--       Runs first; data, ids and foreign keys move with the table.
DO $$ BEGIN
  IF to_regclass('public.departments') IS NOT NULL AND to_regclass('public.department_codes') IS NULL THEN
    ALTER TABLE departments RENAME TO department_codes;
  END IF;
  IF to_regclass('public.categories') IS NOT NULL AND to_regclass('public.asset_codes') IS NULL THEN
    ALTER TABLE categories RENAME TO asset_codes;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'staff',  -- admin | manager | staff | viewer
  phone         VARCHAR(40),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(5)   NOT NULL UNIQUE,
  name       VARCHAR(160) NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS department_codes (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(10)  NOT NULL UNIQUE,
  name       VARCHAR(160) NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Category = accounting asset class (e.g. 602 COMPUTER HARDWARE)
CREATE TABLE IF NOT EXISTS asset_codes (
  id                SERIAL PRIMARY KEY,
  code              VARCHAR(10)  NOT NULL UNIQUE,
  name              VARCHAR(160) NOT NULL,
  description       TEXT,
  inspection_months INT NOT NULL DEFAULT 6,
  checklist         JSONB NOT NULL DEFAULT '[]'::jsonb,
  color             VARCHAR(20) NOT NULL DEFAULT '#6366f1',
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Type / catalog under a category (2-digit "Type Number" in the asset code)
CREATE TABLE IF NOT EXISTS asset_types (
  id          SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES asset_codes(id) ON DELETE CASCADE,
  number      VARCHAR(2)   NOT NULL,
  name        VARCHAR(160) NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, number)
);

CREATE TABLE IF NOT EXISTS locations (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30)  NOT NULL UNIQUE,
  name        VARCHAR(160) NOT NULL,
  building    VARCHAR(120),
  floor       VARCHAR(40),
  room        VARCHAR(120),
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custodians (
  id            SERIAL PRIMARY KEY,
  employee_code VARCHAR(40) UNIQUE,
  name          VARCHAR(160) NOT NULL,
  position      VARCHAR(120),
  department_id INT REFERENCES department_codes(id) ON DELETE SET NULL,
  phone         VARCHAR(40),
  email         VARCHAR(160),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id                SERIAL PRIMARY KEY,
  code              VARCHAR(60) NOT NULL UNIQUE,
  code_prefix       VARCHAR(60),
  run_no            INT,
  company_id        INT REFERENCES companies(id),
  department_id     INT REFERENCES department_codes(id),
  category_id       INT NOT NULL REFERENCES asset_codes(id),
  type_id           INT REFERENCES asset_types(id) ON DELETE SET NULL,
  year_code         VARCHAR(2),
  name              VARCHAR(200) NOT NULL,
  brand             VARCHAR(120),
  model             VARCHAR(120),
  serial_number     VARCHAR(120),
  purchase_date     DATE,
  cost              NUMERIC(14,2) NOT NULL DEFAULT 0,
  vendor            VARCHAR(160),
  po_number         VARCHAR(80),
  warranty_expiry   DATE,
  location_id       INT REFERENCES locations(id),
  custodian_id      INT REFERENCES custodians(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'active', -- active | repair | broken | spare | lost | disposed
  inspection_months INT NOT NULL DEFAULT 6,
  last_inspection   DATE,
  next_inspection   DATE,
  images            JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes             TEXT,
  created_by        INT REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assets_prefix   ON assets(code_prefix);
CREATE INDEX IF NOT EXISTS idx_assets_status   ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_next     ON assets(next_inspection);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);

CREATE TABLE IF NOT EXISTS inspections (
  id              SERIAL PRIMARY KEY,
  asset_id        INT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  inspected_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  inspector_id    INT REFERENCES users(id) ON DELETE SET NULL,
  result          VARCHAR(20) NOT NULL DEFAULT 'pass', -- pass | issue | fail
  checklist       JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes           TEXT,
  images          JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_inspection DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inspections_asset ON inspections(asset_id);

CREATE TABLE IF NOT EXISTS repairs (
  id           SERIAL PRIMARY KEY,
  ticket_no    VARCHAR(30) NOT NULL UNIQUE,
  asset_id     INT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  reported_by  INT REFERENCES users(id) ON DELETE SET NULL,
  reported_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  problem      TEXT NOT NULL,
  priority     VARCHAR(20) NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  status       VARCHAR(20) NOT NULL DEFAULT 'open',   -- open | in_progress | waiting_parts | done | cancelled
  technician   VARCHAR(160),
  cost         NUMERIC(14,2) NOT NULL DEFAULT 0,
  resolution   TEXT,
  images       JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_repairs_asset  ON repairs(asset_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);

CREATE TABLE IF NOT EXISTS settings (
  key   VARCHAR(80) PRIMARY KEY,
  value JSONB
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(40) NOT NULL,
  entity     VARCHAR(40) NOT NULL,
  entity_id  INT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity, entity_id);

-- v1.1: user department + forced sign-out support
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INT REFERENCES department_codes(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;

-- v1.2: category display code can be long (e.g. "IT CUMPUTER HARDWARE 170602-01");
--       the 3-digit account code used inside the asset code is stored separately
ALTER TABLE asset_codes ALTER COLUMN code TYPE VARCHAR(80);
ALTER TABLE asset_codes ADD COLUMN IF NOT EXISTS account_code VARCHAR(3);
UPDATE asset_codes SET account_code = code WHERE account_code IS NULL AND code ~ '^\d{3}$';

-- v1.3: department_codes get a head, a shared email, an optional short code,
--       and a separate 3-digit number used inside the asset code (P401-…)
ALTER TABLE department_codes ALTER COLUMN code DROP NOT NULL;
ALTER TABLE department_codes ALTER COLUMN code TYPE VARCHAR(20);
ALTER TABLE department_codes ADD COLUMN IF NOT EXISTS head VARCHAR(160);
ALTER TABLE department_codes ADD COLUMN IF NOT EXISTS email VARCHAR(160);
ALTER TABLE department_codes ADD COLUMN IF NOT EXISTS dept_no VARCHAR(3);
UPDATE department_codes SET dept_no = code WHERE dept_no IS NULL AND code ~ '^\d{3}$';
