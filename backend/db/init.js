/**
 * db/init.js — Create PostGIS schema
 * Run: node db/init.js
 */
const pool = require('./pool');

const SQL = `
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Provinces ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provinces (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) UNIQUE NOT NULL,
  name_th     VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100),
  region      VARCHAR(50),
  geom        GEOMETRY(MULTIPOLYGON, 4326)
);
CREATE INDEX IF NOT EXISTS idx_provinces_geom ON provinces USING GIST(geom);

-- ── Districts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS districts (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(10) UNIQUE NOT NULL,
  name_th       VARCHAR(100) NOT NULL,
  name_en       VARCHAR(100),
  province_code VARCHAR(10) REFERENCES provinces(code),
  geom          GEOMETRY(MULTIPOLYGON, 4326)
);
CREATE INDEX IF NOT EXISTS idx_districts_geom     ON districts USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_districts_province ON districts(province_code);

-- ── Subdistricts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subdistricts (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(10) UNIQUE NOT NULL,
  name_th         VARCHAR(100) NOT NULL,
  name_en         VARCHAR(100),
  district_code   VARCHAR(10) REFERENCES districts(code),
  province_code   VARCHAR(10) REFERENCES provinces(code),
  geom            GEOMETRY(MULTIPOLYGON, 4326)
);
CREATE INDEX IF NOT EXISTS idx_subdistricts_geom ON subdistricts USING GIST(geom);

-- ── Hotspots ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotspots (
  id              SERIAL PRIMARY KEY,
  acq_date        DATE NOT NULL,
  acq_time        VARCHAR(6),
  year_be         SMALLINT NOT NULL,          -- Buddhist Era year (2564–2568)
  province_name   VARCHAR(100),
  district_name   VARCHAR(100),
  subdistrict_name VARCHAR(100),
  province_code   VARCHAR(10),
  district_code   VARCHAR(10),
  crop_type       VARCHAR(50),
  brightness      NUMERIC(6,2),
  confidence      VARCHAR(10),               -- high / nominal / low
  satellite       VARCHAR(20),
  frp             NUMERIC(8,2),              -- Fire Radiative Power
  geom            GEOMETRY(POINT, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hotspots_geom     ON hotspots USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_hotspots_year     ON hotspots(year_be);
CREATE INDEX IF NOT EXISTS idx_hotspots_province ON hotspots(province_name);
CREATE INDEX IF NOT EXISTS idx_hotspots_district ON hotspots(district_name);
CREATE INDEX IF NOT EXISTS idx_hotspots_date     ON hotspots(acq_date);

-- ── Risk Scores ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_scores (
  id                  SERIAL PRIMARY KEY,
  district_code       VARCHAR(10),
  district_name       VARCHAR(100) NOT NULL,
  province_name       VARCHAR(100),
  hotspot_count       INTEGER DEFAULT 0,
  repeat_burn_years   SMALLINT DEFAULT 0,
  dominant_crop       VARCHAR(50),
  fire_weather_index  NUMERIC(4,3) DEFAULT 0.5,
  risk_score          NUMERIC(5,1) NOT NULL,
  risk_level          VARCHAR(20) NOT NULL,    -- ต่ำ / ปานกลาง / สูง / สูงมาก
  computed_at         TIMESTAMP DEFAULT NOW(),
  geom                GEOMETRY(MULTIPOLYGON, 4326)
);
CREATE INDEX IF NOT EXISTS idx_risk_geom  ON risk_scores USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_risk_level ON risk_scores(risk_level);

-- ── Summary Stats (pre-aggregated for dashboard) ──────────
CREATE TABLE IF NOT EXISTS hotspot_summary (
  id            SERIAL PRIMARY KEY,
  year_be       SMALLINT NOT NULL,
  province_name VARCHAR(100),
  district_name VARCHAR(100),
  crop_type     VARCHAR(50),
  count         INTEGER DEFAULT 0,
  UNIQUE(year_be, province_name, district_name, crop_type)
);
CREATE INDEX IF NOT EXISTS idx_summary_year ON hotspot_summary(year_be);
`;

async function init() {
  const client = await pool.connect();
  try {
    console.log('[DB] Running schema initialization...');
    await client.query(SQL);
    console.log('[DB] ✅ Schema ready.');
  } catch (err) {
    console.error('[DB] ❌ Init failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
