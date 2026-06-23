/**
 * server.js — Express API server for Agri-Risk Map Burning Dashboard
 * Default port: 3001
 * Start: node server.js  |  npm start  |  npm run dev
 */
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const pool     = require('./db/pool');

const app  = express();
const PORT = process.env.API_PORT || 3001;

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:8080', 'http://127.0.0.1:8080'] }));
app.use(express.json());

// ── Request logger (dev) ──────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ── Routes ────────────────────────────────────────────────
app.use('/api/hotspots', require('./routes/hotspots'));
app.use('/api/risk',     require('./routes/risk'));
app.use('/api/boundary', require('./routes/boundary'));

// ── Health check ──────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM hotspots');
    res.json({
      status:        'ok',
      hotspot_count: parseInt(result.rows[0].count),
      timestamp:     new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'db_error', error: err.message });
  }
});

// ── Dashboard stats (single call for frontend init) ───────
app.get('/api/stats', async (_req, res) => {
  try {
    const [trend, topProv, topDist, cropDist, riskDist] = await Promise.all([
      pool.query(`SELECT year_be, COUNT(*) AS count FROM hotspots GROUP BY year_be ORDER BY year_be`),
      pool.query(`SELECT province_name AS name, COUNT(*) AS count FROM hotspots WHERE province_name IS NOT NULL GROUP BY province_name ORDER BY count DESC LIMIT 5`),
      pool.query(`SELECT district_name AS name, province_name AS province, COUNT(*) AS count FROM hotspots WHERE district_name IS NOT NULL GROUP BY district_name, province_name ORDER BY count DESC LIMIT 10`),
      pool.query(`SELECT COALESCE(crop_type,'อื่นๆ') AS crop, COUNT(*) AS count FROM hotspots GROUP BY crop`),
      pool.query(`SELECT risk_level, COUNT(*) AS count FROM risk_scores GROUP BY risk_level`),
    ]);

    res.json({
      trend:       trend.rows.map(r => ({ year: r.year_be, count: parseInt(r.count) })),
      top_province: topProv.rows.map(r => ({ name: r.name, count: parseInt(r.count) })),
      top_district: topDist.rows.map(r => ({ name: r.name, province: r.province, count: parseInt(r.count) })),
      crop_dist:   cropDist.rows.map(r => ({ crop: r.crop, count: parseInt(r.count) })),
      risk_dist:   riskDist.rows.map(r => ({ level: r.risk_level, count: parseInt(r.count) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 404 ───────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  API running at http://localhost:${PORT}`);
  console.log(`    Health: http://localhost:${PORT}/api/health`);
  console.log(`    Stats:  http://localhost:${PORT}/api/stats`);
});
