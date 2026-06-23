/**
 * dashboard.js — Charts, cards, and table rendering
 */

const Dashboard = (() => {

  // Chart instances
  const charts = {};

  // Accumulated hotspot data: year → features[]
  const hotspotStore = {};

  // ── Init ──────────────────────────────────────────────
  function init() {
    _initTrendChart();
    _initTopDistrictChart();
    _initCropChart();
    _initRiskChart();
    document.getElementById('last-updated').textContent =
      'อัปเดต: ' + new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ── Called when a hotspot layer is loaded ─────────────
  function onHotspotLoaded(year, geojson) {
    hotspotStore[year] = geojson.features || [];
    _refresh();
  }

  // ── Refresh all dashboard elements ───────────────────
  function _refresh() {
    const allFeatures = Object.values(hotspotStore).flat();
    _updateCards(allFeatures);
    _updateTrend();
    _updateTopDistrict(allFeatures);
    _updateCropChart(allFeatures);
    _updateTopDistrictTable(allFeatures);
  }

  // ── Cards ─────────────────────────────────────────────
  function _updateCards(features) {
    document.getElementById('card-total').textContent = features.length.toLocaleString('th-TH');

    // Count provinces
    const provinces = new Set(features.map(f => f.properties?.province || f.properties?.PROV_NAM_T || f.properties?.prov_name).filter(Boolean));
    document.getElementById('card-provinces').textContent = provinces.size || '-';

    // Count high-risk (score ≥ 50) from RiskModule if available
    if (window.RiskModule) {
      const highRisk = features.filter(f => (f.properties?.risk_score || 0) >= 50).length;
      document.getElementById('card-high-risk').textContent = highRisk.toLocaleString('th-TH');
    }
  }

  // ── Trend Chart (bar) ─────────────────────────────────
  function _initTrendChart() {
    const ctx = document.getElementById('chart-trend').getContext('2d');
    charts.trend = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [2566, 2567, 2568].map(y => `${y}`),
        datasets: [{
          label: 'Hotspot',
          data: [0, 0, 0],
          backgroundColor: [2566, 2567, 2568].map(y => CONFIG.YEAR_COLORS[y]),
          borderRadius: 3,
        }],
      },
      options: _chartOptions({ showLegend: false }),
    });
  }

  function _updateTrend() {
    const data = [2566, 2567, 2568].map(y => (hotspotStore[y] || []).length);
    charts.trend.data.datasets[0].data = data;
    charts.trend.update('none');
  }

  // ── Top District Chart (horizontal bar) ──────────────
  function _initTopDistrictChart() {
    const ctx = document.getElementById('chart-top-district').getContext('2d');
    charts.topDistrict = new Chart(ctx, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Hotspot', data: [], backgroundColor: '#5bc0de', borderRadius: 3 }] },
      options: { ..._chartOptions({ showLegend: false }), indexAxis: 'y' },
    });
  }

  function _updateTopDistrict(features) {
    const counts = {};
    features.forEach(f => {
      const d = f.properties?.district || f.properties?.AMP_NAM_T || f.properties?.amp_name || 'ไม่ระบุ';
      counts[d] = (counts[d] || 0) + 1;
    });
    const top5 = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    charts.topDistrict.data.labels            = top5.map(x => x[0]);
    charts.topDistrict.data.datasets[0].data  = top5.map(x => x[1]);
    charts.topDistrict.update('none');
  }

  // ── Crop Pie Chart ────────────────────────────────────
  function _initCropChart() {
    const ctx = document.getElementById('chart-crop').getContext('2d');
    charts.crop = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(CONFIG.CROP_RISK),
        datasets: [{ data: new Array(Object.keys(CONFIG.CROP_RISK).length).fill(0),
          backgroundColor: ['#9b59b6','#e67e22','#e74c3c','#f1c40f','#2ecc71','#5bc0de'] }],
      },
      options: _chartOptions({ showLegend: true, legendPosition: 'right' }),
    });
  }

  function _updateCropChart(features) {
    const counts = {};
    Object.keys(CONFIG.CROP_RISK).forEach(k => counts[k] = 0);
    features.forEach(f => {
      const c = f.properties?.crop_type || f.properties?.crop || 'อื่นๆ';
      const key = Object.keys(CONFIG.CROP_RISK).includes(c) ? c : 'อื่นๆ';
      counts[key] = (counts[key] || 0) + 1;
    });
    charts.crop.data.datasets[0].data = Object.values(counts);
    charts.crop.update('none');
  }

  // ── Risk Level Pie ────────────────────────────────────
  function _initRiskChart() {
    const ctx = document.getElementById('chart-risk').getContext('2d');
    const labels = CONFIG.RISK_LEVELS.map(l => l.label);
    const colors = CONFIG.RISK_LEVELS.map(l => l.color);
    charts.risk = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: [0, 0, 0, 0], backgroundColor: colors }],
      },
      options: _chartOptions({ showLegend: true, legendPosition: 'right' }),
    });
  }

  function updateRiskChart(riskCounts) {
    // riskCounts: { low, medium, high, very_high }
    charts.risk.data.datasets[0].data = [
      riskCounts.low || 0,
      riskCounts.medium || 0,
      riskCounts.high || 0,
      riskCounts.very_high || 0,
    ];
    charts.risk.update('none');
    // Also update high-risk card
    const highCount = (riskCounts.high || 0) + (riskCounts.very_high || 0);
    document.getElementById('card-high-risk').textContent = highCount.toLocaleString('th-TH');
  }

  // ── Top District Table ────────────────────────────────
  function _updateTopDistrictTable(features) {
    const counts = {};
    features.forEach(f => {
      const district = f.properties?.district || f.properties?.AMP_NAM_T || f.properties?.amp_name || 'ไม่ระบุ';
      const province = f.properties?.province || f.properties?.PROV_NAM_T || 'ไม่ระบุ';
      const key = `${district}||${province}`;
      if (!counts[key]) counts[key] = { district, province, count: 0, score: 0 };
      counts[key].count++;
    });

    const top10 = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
    const tbody = document.querySelector('#tbl-top-district tbody');
    tbody.innerHTML = '';

    top10.forEach(row => {
      const score = RiskModule ? RiskModule.scoreFromCount(row.count) : 0;
      const level = MapModule.getRiskLevel(score);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.district}</td>
        <td>${row.province}</td>
        <td>${row.count.toLocaleString('th-TH')}</td>
        <td><span class="risk-badge ${level.class}">${level.label}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Chart Options Helper ──────────────────────────────
  function _chartOptions({ showLegend = false, legendPosition = 'top' } = {}) {
    return {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: showLegend,
          position: legendPosition,
          labels: { color: '#8aaccc', font: { size: 12 }, boxWidth: 10, padding: 6 },
        },
        tooltip: {
          backgroundColor: '#0d2137',
          titleColor: '#5bc0de',
          bodyColor: '#dce8f0',
          borderColor: '#2a6496',
          borderWidth: 1,
        },
      },
      scales: {
        x: { ticks: { color: '#6a8faa', font: { size: 12 } }, grid: { color: '#1e3a52' } },
        y: { ticks: { color: '#6a8faa', font: { size: 12 } }, grid: { color: '#1e3a52' } },
      },
    };
  }

  // ── Apply stats from API (replaces chart data entirely) ─
  function applyStats(stats) {
    if (!stats) return;

    // Trend
    if (stats.trend) {
      const years = [2564,2565,2566,2567,2568];
      const map   = Object.fromEntries(stats.trend.map(r => [r.year, r.count]));
      charts.trend.data.datasets[0].data = years.map(y => map[y] || 0);
      charts.trend.update('none');
    }

    // Top district
    if (stats.top_province) {
      charts.topDistrict.data.labels            = stats.top_province.map(r => r.name);
      charts.topDistrict.data.datasets[0].data  = stats.top_province.map(r => r.count);
      charts.topDistrict.update('none');
    }

    // Crop distribution
    if (stats.crop_dist) {
      const labels = Object.keys(CONFIG.CROP_RISK);
      const map    = Object.fromEntries(stats.crop_dist.map(r => [r.crop, r.count]));
      charts.crop.data.datasets[0].data = labels.map(l => map[l] || 0);
      charts.crop.update('none');
    }

    // Risk distribution
    if (stats.risk_dist) {
      const map = Object.fromEntries(stats.risk_dist.map(r => [r.level, parseInt(r.count)]));
      updateRiskChart({
        low:       map['ต่ำ']      || 0,
        medium:    map['ปานกลาง'] || 0,
        high:      map['สูง']     || 0,
        very_high: map['สูงมาก'] || 0,
      });
    }

    // Top district table
    if (stats.top_district) {
      const tbody = document.querySelector('#tbl-top-district tbody');
      tbody.innerHTML = '';
      stats.top_district.forEach(row => {
        const score = RiskModule.scoreFromCount(row.count);
        const level = MapModule.getRiskLevel(score);
        const tr    = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.name}</td>
          <td>${row.province || '-'}</td>
          <td>${row.count.toLocaleString('th-TH')}</td>
          <td><span class="risk-badge ${level.class}">${level.label}</span></td>`;
        tbody.appendChild(tr);
      });
    }

    // Total card
    const total = stats.trend?.reduce((s, r) => s + r.count, 0);
    if (total != null) document.getElementById('card-total').textContent = total.toLocaleString('th-TH');
  }

  // Public API
  return { init, onHotspotLoaded, updateRiskChart, applyStats };
})();
