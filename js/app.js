/**
 * app.js — Application bootstrap & event coordination
 */

const App = (() => {

  // Hotspot store for risk computation
  const _hotspotStore = {};

  // ── Bootstrap ─────────────────────────────────────────
  async function init() {
    // Parallel backend detection
    await Promise.all([
      API.detectBackend(),
      GeoServerModule.detect(),
    ]);

    MapModule.init();
    Dashboard.init();
    _bindFilters();
    _bindDetailPanel();

    // Wire GeoServer WMS layers to map after map is ready
    if (GeoServerModule.isAvailable()) {
      GeoServerModule.addProjectLayers(MapModule.map());
    }

    // Load dashboard stats from API if available
    const stats = await API.getStats();
    if (stats) Dashboard.applyStats(stats);

    console.log('[App] Agri-Risk Map Burning Dashboard initialized');
  }

  // ── Hotspot loaded callback (from MapModule) ──────────
  function onHotspotLoaded(year, geojson) {
    _hotspotStore[year] = geojson.features || [];
    Dashboard.onHotspotLoaded(year, geojson);
  }

  // ── Boundary click callback ───────────────────────────
  function onBoundaryClick(feature) {
    const p = feature.properties || {};
    const name = p.NAME_1 || p.NAME_2 || p.NAME_3 || p.name || 'Unknown';
    _showDetail({
      title: name,
      rows: [
        ['รหัส', p.HASC_1 || p.HASC_2 || p.code || '-'],
        ['ประเภท', p.ENGTYPE_1 || p.ENGTYPE_2 || '-'],
        ['ประชากร', p.population ? p.population.toLocaleString('th-TH') : '-'],
      ],
    });
  }

  // ── Hotspot click callback ────────────────────────────
  function onHotspotClick(feature, year) {
    const p = feature.properties || {};
    const score = p.risk_score ?? RiskModule.computeScore({
      hotspot_count: 1,
      crop_type: p.crop_type || p.crop || 'อื่นๆ',
    });
    const level = RiskModule.getLevelFromScore(score);

    _showDetail({
      title: `Hotspot ปี ${year}`,
      rows: [
        ['วันที่',         p.acq_date || p.date || '-'],
        ['เวลา',           p.acq_time || '-'],
        ['จังหวัด',        p.province || p.PROV_NAM_T || '-'],
        ['อำเภอ',          p.district || p.AMP_NAM_T || '-'],
        ['ประเภทพืช',      p.crop_type || '-'],
        ['ความสว่าง',      p.brightness || '-'],
        ['ความเชื่อมั่น',  p.confidence || '-'],
        ['ความเสี่ยง',     `<span class="risk-badge ${level.class}">${level.label} (${score})</span>`],
      ],
    });
  }

  // ── Filter Binding ────────────────────────────────────
  function _bindFilters() {
    const provSel = document.getElementById('filter-province');
    const distSel = document.getElementById('filter-district');

    provSel.addEventListener('change', () => {
      const prov = provSel.value;
      if (prov) MapModule.zoomToProvince(prov);
      distSel.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    });

    document.getElementById('btn-reset-filter').addEventListener('click', () => {
      provSel.value = '';
      distSel.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    });
  }

  // ── Detail Panel ──────────────────────────────────────
  function _showDetail({ title, rows }) {
    document.getElementById('detail-title').textContent = title;
    document.getElementById('detail-content').innerHTML = rows
      .map(([label, val]) => `
        <div class="detail-row">
          <span class="detail-label">${label}</span>
          <span>${val}</span>
        </div>`)
      .join('');
    document.getElementById('detail-panel').classList.remove('hidden');
  }

  function _bindDetailPanel() {
    document.getElementById('detail-close').addEventListener('click', () => {
      document.getElementById('detail-panel').classList.add('hidden');
    });
  }

  function onRiskKptLoaded(geojson) {
    const features = geojson.features || [];
    const counts   = { low: 0, medium: 0, high: 0, very_high: 0 };
    features.forEach(f => {
      const s = f.properties.risk_score || 0;
      if      (s < 25) counts.low++;
      else if (s < 50) counts.medium++;
      else if (s < 75) counts.high++;
      else             counts.very_high++;
    });
    Dashboard.updateRiskChart(counts);

    // Update top district table from risk data
    const sorted = [...features].sort((a, b) => b.properties.risk_score - a.properties.risk_score).slice(0, 10);
    const tbody  = document.querySelector('#tbl-top-district tbody');
    tbody.innerHTML = '';
    sorted.forEach(f => {
      const p     = f.properties;
      const level = MapModule.getRiskLevel(p.risk_score);
      const tr    = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.subdistrict || '-'}</td>
        <td>${p.district || '-'}</td>
        <td>${(p.hotspot_total || 0).toLocaleString('th-TH')}</td>
        <td><span class="risk-badge ${level.class}">${level.label}</span></td>`;
      tbody.appendChild(tr);
    });

    // Total hotspot card
    const total = features.reduce((s, f) => s + (f.properties.hotspot_total || 0), 0);
    document.getElementById('card-total').textContent = total.toLocaleString('th-TH');
    document.getElementById('card-provinces').textContent = new Set(features.map(f => f.properties.district)).size;
    document.getElementById('card-high-risk').textContent =
      features.filter(f => f.properties.risk_score >= 50).length;
  }

  return { init, onHotspotLoaded, onBoundaryClick, onHotspotClick, onRiskKptLoaded };
})();

// ── Start ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
