/**
 * routes/boundary.js
 * GET /api/boundary/provinces          — list of provinces
 * GET /api/boundary/provinces/geojson  — province polygons as GeoJSON
 * GET /api/boundary/districts/geojson  — district polygons as GeoJSON
 */
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// ── Provinces list ────────────────────────────────────────
router.get('/provinces', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT code, name_th, name_en, region FROM provinces ORDER BY name_th
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Province GeoJSON ──────────────────────────────────────
router.get('/provinces/geojson', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT json_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.001))::json,
        'properties', json_build_object(
          'code', code, 'name_th', name_th, 'name_en', name_en, 'region', region
        )
      ) AS feature
      FROM provinces
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

// ── District GeoJSON ──────────────────────────────────────
router.get('/districts/geojson', async (req, res) => {
  try {
    const province = req.query.province; // optional filter
    const values = [];
    let where = '';
    if (province) { where = 'WHERE province_code = $1'; values.push(province); }

    const result = await pool.query(`
      SELECT json_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0005))::json,
        'properties', json_build_object(
          'code', code, 'name_th', name_th,
          'province_code', province_code
        )
      ) AS feature
      FROM districts
      ${where}
    `, values);

    res.json({
      type: 'FeatureCollection',
      features: result.rows.map(r => r.feature),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
