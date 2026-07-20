/**
 * db/seed.js — Import GeoJSON hotspot files into PostgreSQL
 * Run: node db/seed.js
 * Reads from: ../data/hotspot/hotspot_YYYY.geojson
 */
const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

const DATA_DIR = path.join(__dirname, '../../data/hotspot');
const YEARS    = [2564, 2565, 2566, 2567, 2568];

// Thai Buddhist Era → Gregorian offset
const BE_OFFSET = 543;

async function seedHotspots(client, year) {
  const file = path.join(DATA_DIR, `hotspot_${year}.geojson`);
  if (!fs.existsSync(file)) {
    console.warn(`  ⚠️  ${file} not found, skipping year ${year}`);
    return 0;
  }

  const geojson  = JSON.parse(fs.readFileSync(file, 'utf8'));
  const features = geojson.features || [];
  let inserted   = 0;

  for (const f of features) {
    const p    = f.properties || {};
    const geom = f.geometry;
    if (!geom || geom.type !== 'Point') continue;

    const [lng, lat] = geom.coordinates;

    // Parse date — support both BE and CE dates
    let acqDate = p.acq_date || null;
    if (acqDate && acqDate.startsWith('25')) {
      // Convert BE to CE: 2568-03-15 → 2025-03-15
      const parts  = acqDate.split('-');
      parts[0]     = String(parseInt(parts[0]) - BE_OFFSET);
      acqDate      = parts.join('-');
    }

    await client.query(`
      INSERT INTO hotspots
        (acq_date, acq_time, year_be, province_name, district_name,
         crop_type, brightness, confidence, satellite, frp, geom)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              ST_SetSRID(ST_MakePoint($11,$12),4326))
      ON CONFLICT DO NOTHING
    `, [
      acqDate,
      p.acq_time || null,
      year,
      p.province || p.PROV_NAM_T || null,
      p.district || p.AMP_NAM_T  || null,
      p.crop_type || p.crop       || null,
      p.brightness || null,
      p.confidence || null,
      p.satellite  || 'MODIS',
      p.frp        || null,
      lng, lat,
    ]);
    inserted++;
  }
  return inserted;
}

async function buildSummary(client) {
  console.log('  📊 Building hotspot_summary...');
  await client.query(`DELETE FROM hotspot_summary`);
  await client.query(`
    INSERT INTO hotspot_summary (year_be, province_name, district_name, crop_type, count)
    SELECT year_be, province_name, district_name, COALESCE(crop_type,'อื่นๆ'), COUNT(*)
    FROM   hotspots
    GROUP  BY year_be, province_name, district_name, COALESCE(crop_type,'อื่นๆ')
  `);
}

async function run() {
  const client = await pool.connect();
  try {
    for (const year of YEARS) {
      process.stdout.write(`  📥 Seeding year ${year}...`);
      const n = await seedHotspots(client, year);
      console.log(` ${n} rows inserted`);
    }
    await buildSummary(client);
    console.log('[Seed] ✅ Done.');
  } catch (err) {
    console.error('[Seed] ❌', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
