/**
 * api.js — Frontend API client
 * Tries backend API first; falls back to local GeoJSON files.
 */
const API = (() => {
  const BASE = 'http://localhost:3001/api';
  let _useAPI = false; // detected at init

  // ── Detect backend ────────────────────────────────────
  async function detectBackend() {
    try {
      const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
      _useAPI = res.ok;
    } catch {
      _useAPI = false;
    }
    console.log(`[API] Backend: ${_useAPI ? '✅ connected' : '⚠️  offline (using local files)'}`);
    return _useAPI;
  }

  // ── Stats (single call → all dashboard data) ──────────
  async function getStats() {
    if (!_useAPI) return null;
    try {
      const res = await fetch(`${BASE}/stats`);
      return res.ok ? res.json() : null;
    } catch { return null; }
  }

  // ── Hotspot GeoJSON (by year) ─────────────────────────
  async function getHotspotGeoJSON(year, { province, district } = {}) {
    if (_useAPI) {
      const params = new URLSearchParams({ year });
      if (province) params.append('province', province);
      if (district) params.append('district', district);
      try {
        const res = await fetch(`${BASE}/hotspots/geojson?${params}`);
        if (res.ok) return res.json();
      } catch { /* fall through */ }
    }
    // Fallback: local file
    const res = await fetch(`data/hotspot/hotspot_${year}.geojson`);
    return res.ok ? res.json() : { type: 'FeatureCollection', features: [] };
  }

  // ── Trend data ────────────────────────────────────────
  async function getTrend() {
    if (!_useAPI) return null;
    try {
      const res = await fetch(`${BASE}/hotspots/trend`);
      return res.ok ? res.json() : null;
    } catch { return null; }
  }

  // ── Risk GeoJSON ──────────────────────────────────────
  async function getRiskGeoJSON() {
    if (!_useAPI) return null;
    try {
      const res = await fetch(`${BASE}/risk/geojson`);
      return res.ok ? res.json() : null;
    } catch { return null; }
  }

  // ── Trigger risk recompute ────────────────────────────
  async function recomputeRisk() {
    if (!_useAPI) return { error: 'No backend' };
    const res = await fetch(`${BASE}/risk/compute`, { method: 'POST' });
    return res.json();
  }

  // ── Boundary GeoJSON ──────────────────────────────────
  async function getBoundaryGeoJSON(type) {
    if (_useAPI) {
      const map = { province: 'provinces', district: 'districts' };
      const endpoint = map[type];
      if (endpoint) {
        try {
          const res = await fetch(`${BASE}/boundary/${endpoint}/geojson`);
          if (res.ok) return res.json();
        } catch { /* fall through */ }
      }
    }
    const res = await fetch(`data/boundary/${type}.geojson`);
    return res.ok ? res.json() : null;
  }

  return { detectBackend, getStats, getHotspotGeoJSON, getTrend, getRiskGeoJSON, recomputeRisk, getBoundaryGeoJSON, isConnected: () => _useAPI };
})();
