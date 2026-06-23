/**
 * routes/risk.js
 * GET  /api/risk              — all district risk scores
 * GET  /api/risk/geojson      — as GeoJSON with geometry
 * POST /api/risk/compute      — (re)compute risk scores for all districts
 */
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// Risk weight constants (mirror js/config.js)
const W = {
  hotspot_frequency: 0.35,
  repeat_burn:       0.25,
  crop_type:         0.20,
  weather:           0.20,
};
const CROP_RISK = {
  'ข้าว': 0.7, 'ข้าวโพด': 0.9, 'อ้อย': 0.8,
  'ยางพารา': 0.6, 'มันสำปะหลัง': 0.75, 'อื่นๆ': 0.5,
};

function computeScore({ hotspot_count = 0, repeat_burn_years = 0, dominant_crop = 'อื่นๆ', fire_weather_index = 0.5 }) {
  const freq    = Math.min(hotspot_count / 200, 1.0);
  const repeat  = Math.min(repeat_burn_years / 5, 1.0);
  const crop    = CROP_RISK[dominant_crop] ?? 0.5;
  const weather = Math.min(Math.max(fire_weather_index, 0), 1);
  return parseFloat(((freq * W.hotspot_frequency + repeat * W.repeat_burn + crop * W.crop_type + weather * W.weather) * 100).toFixed(1));
}

function riskLevel(score) {
  if (score < 25) return 'ต่ำ';
  if (score < 50) return 'ปานกลาง';
  if (score < 75) return 'สูง';
  return 'สูงมาก';
}

// ── GET /api/risk ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, district_name, province_name, hotspot_count,
             repeat_burn_years, dominant_crop, risk_score, risk_level, computed_at
      FROM   risk_scores
      ORDER  BY risk_score DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/risk/geojson ─────────────────────────────────
router.get('/geojson', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT json_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(geom)::json,
        'properties', json_build_object(
          'district',     district_name,
          'province',     province_name,
          'hotspot_count', hotspot_count,
          'risk_score',   risk_score,
          'risk_level',   risk_level
        )
      ) AS feature
      FROM risk_scores
      WHERE geom IS NOT NULL
    `);
    res.json({
      type: 'FeatureCollection',
      features: result.rows.map(r => r.feature),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/risk/compute ────────────────────────────────
router.post('/compute', async (req, res) => {
  const client = await pool.connect();
  try {
    // Aggregate hotspot stats per district across all years
    const stats = await client.query(`
      SELECT
        district_name,
        province_name,
        COUNT(*)                             AS hotspot_count,
        COUNT(DISTINCT year_be)              AS repeat_burn_years,
        MODE() WITHIN GROUP (ORDER BY COALESCE(crop_type,'อื่นๆ')) AS dominant_crop
      FROM hotspots
      WHERE district_name IS NOT NULL
      GROUP BY district_name, province_name
    `);

    await client.query('BEGIN');
    await client.query('DELETE FROM risk_scores');

    let inserted = 0;
    for (const row of stats.rows) {
      const score = computeScore({
        hotspot_count:      parseInt(row.hotspot_count),
        repeat_burn_years:  parseInt(row.repeat_burn_years),
        dominant_crop:      row.dominant_crop,
        fire_weather_index: 0.5, // placeholder; replace with real FWI data
      });
      const level = riskLevel(score);

      // Try to join district geometry from districts table
      await client.query(`
        INSERT INTO risk_scores
          (district_name, province_name, hotspot_count, repeat_burn_years,
           dominant_crop, fire_weather_index, risk_score, risk_level, geom)
        VALUES ($1,$2,$3,$4,$5,0.5,$6,$7,
          (SELECT geom FROM districts WHERE name_th = $1 LIMIT 1))
        ON CONFLICT DO NOTHING
      `, [
        row.district_name,
        row.province_name,
        parseInt(row.hotspot_count),
        parseInt(row.repeat_burn_years),
        row.dominant_crop,
        score,
        level,
      ]);
      inserted++;
    }

    await client.query('COMMIT');
    res.json({ message: `✅ Computed risk for ${inserted} districts.` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
