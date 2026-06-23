/**
 * routes/hotspots.js
 * GET /api/hotspots          — all hotspots (filters: year, province, district)
 * GET /api/hotspots/geojson  — as GeoJSON FeatureCollection
 * GET /api/hotspots/summary  — aggregated counts per year/province/district
 * GET /api/hotspots/trend    — yearly totals for trend chart
 * GET /api/hotspots/top      — top N provinces or districts
 */
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// ── Helper: build WHERE clause from query params ──────────
function buildWhere(q) {
  const clauses = [];
  const values  = [];
  let   idx     = 1;

  if (q.year)     { clauses.push(`year_be = $${idx++}`);       values.push(parseInt(q.year)); }
  if (q.province) { clauses.push(`province_name ILIKE $${idx++}`); values.push(`%${q.province}%`); }
  if (q.district) { clauses.push(`district_name ILIKE $${idx++}`); values.push(`%${q.district}%`); }
  if (q.date_from){ clauses.push(`acq_date >= $${idx++}`);     values.push(q.date_from); }
  if (q.date_to)  { clauses.push(`acq_date <= $${idx++}`);     values.push(q.date_to); }

  return { where: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', values };
}

// ── GET /api/hotspots ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 1000, 5000);
    const { where, values } = buildWhere(req.query);
    values.push(limit);

    const result = await pool.query(`
      SELECT id, acq_date, year_be, province_name, district_name,
             crop_type, brightness, confidence,
             ST_X(geom) AS lng, ST_Y(geom) AS lat
      FROM   hotspots
      ${where}
      ORDER  BY acq_date DESC
      LIMIT  $${values.length}
    `, values);

    res.json({ count: result.rowCount, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hotspots/geojson ─────────────────────────────
router.get('/geojson', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5000, 20000);
    const { where, values } = buildWhere(req.query);
    values.push(limit);

    const result = await pool.query(`
      SELECT json_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(geom)::json,
        'properties', json_build_object(
          'id',           id,
          'acq_date',     acq_date,
          'acq_time',     acq_time,
          'year_be',      year_be,
          'province',     province_name,
          'district',     district_name,
          'crop_type',    crop_type,
          'brightness',   brightness,
          'confidence',   confidence
        )
      ) AS feature
      FROM hotspots
      ${where}
      ORDER BY acq_date DESC
      LIMIT $${values.length}
    `, values);

    res.json({
      type: 'FeatureCollection',
      features: result.rows.map(r => r.feature),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hotspots/trend ───────────────────────────────
router.get('/trend', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT year_be, COUNT(*) AS count
      FROM   hotspots
      GROUP  BY year_be
      ORDER  BY year_be
    `);
    res.json(result.rows.map(r => ({ year: r.year_be, count: parseInt(r.count) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hotspots/top ─────────────────────────────────
router.get('/top', async (req, res) => {
  try {
    const by    = req.query.by === 'district' ? 'district_name' : 'province_name';
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const { where, values } = buildWhere(req.query);
    values.push(limit);

    const result = await pool.query(`
      SELECT ${by} AS name, COUNT(*) AS count
      FROM   hotspots
      ${where}
      GROUP  BY ${by}
      ORDER  BY count DESC
      LIMIT  $${values.length}
    `, values);

    res.json(result.rows.map(r => ({ name: r.name, count: parseInt(r.count) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/hotspots/summary ─────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT year_be, province_name, district_name, crop_type, count
      FROM   hotspot_summary
      ORDER  BY year_be, count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
