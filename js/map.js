/**
 * map.js — Leaflet map initialization and layer management
 */

const MapModule = (() => {

  let map, currentBasemap;
  const layers = {
    basemaps: {},
    province: null,
    district: null,
    subdistrict: null,
    hotspot: {},    // keyed by year
    risk: null,
    risk_kpt: null,
    burnscar: null,
    crop: null,
  };

  // ── Init ──────────────────────────────────────────────
  function init() {
    map = L.map('map', {
      center: CONFIG.MAP_CENTER,
      zoom:   CONFIG.MAP_ZOOM,
      minZoom: CONFIG.MAP_MIN_ZOOM,
      maxZoom: CONFIG.MAP_MAX_ZOOM,
      zoomControl: true,
    });

    // Basemaps
    Object.entries(CONFIG.BASEMAPS).forEach(([key, url]) => {
      const attrib = key === 'satellite'
        ? 'Tiles &copy; Esri'
        : key === 'topo'
        ? 'Map data: &copy; OpenTopoMap'
        : '&copy; OpenStreetMap contributors';
      layers.basemaps[key] = L.tileLayer(url, { attribution: attrib, maxZoom: 19 });
    });
    layers.basemaps.osm.addTo(map);
    currentBasemap = 'osm';

    // Basemap radio switch
    document.querySelectorAll('input[name="basemap"]').forEach(r => {
      r.addEventListener('change', () => switchBasemap(r.value));
    });

    // Boundary checkboxes
    document.getElementById('lyr-province').addEventListener('change', e => toggleLayer('province', e.target.checked));
    document.getElementById('lyr-district').addEventListener('change', e => toggleLayer('district', e.target.checked));
    document.getElementById('lyr-subdistrict').addEventListener('change', e => toggleLayer('subdistrict', e.target.checked));

    // Hotspot year checkboxes
    document.querySelectorAll('.hs-layer').forEach(cb => {
      cb.addEventListener('change', e => toggleHotspotLayer(parseInt(e.target.dataset.year), e.target.checked));
    });

    // Risk layer
    document.getElementById('lyr-risk').addEventListener('change', e => {
      if (e.target.checked) loadRiskKpt(); else toggleLayer('risk_kpt', false);
    });
    // Burn scar
    document.getElementById('lyr-burnscar').addEventListener('change', e => {
      if (e.target.checked) loadBurnScar(); else toggleLayer('burnscar', false);
    });
    // Crop
    document.getElementById('lyr-crop').addEventListener('change', e => {
      if (e.target.checked) loadCrop(); else toggleLayer('crop', false);
    });

    // Load default layers
    loadBoundary('district_kpt');
    loadBoundary('subdistrict_kpt');
    loadHotspot(2568);
    loadHotspot(2567);
    loadHotspot(2566);
  }

  // ── Basemap ───────────────────────────────────────────
  function switchBasemap(key) {
    if (layers.basemaps[currentBasemap]) map.removeLayer(layers.basemaps[currentBasemap]);
    layers.basemaps[key].addTo(map);
    currentBasemap = key;
  }

  // ── Boundary Layers ───────────────────────────────────
  async function loadBoundary(type) {
    if (layers[type]) return; // already loaded
    try {
      const res  = await fetch(CONFIG.DATA[type]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      layers[type] = L.geoJSON(data, {
        style:       boundaryStyle(type),
        onEachFeature: onEachBoundary,
      });
      const chk = document.getElementById(`lyr-${type}`);
      if (!chk || chk.checked) {
        layers[type].addTo(map);
      }
      // Populate filter dropdowns after province loads
      if (type === 'province') _populateProvinceFilter(data);
    } catch (err) {
      console.warn(`[Map] Could not load ${type}:`, err.message);
    }
  }

  function boundaryStyle(type) {
    const styles = {
      province:         { color: '#5bc0de', weight: 1.5, fillOpacity: 0.04, fillColor: '#5bc0de' },
      district:         { color: '#8aaccc', weight: 0.8, fillOpacity: 0.02, fillColor: '#8aaccc' },
      district_kpt:     { color: '#5bc0de', weight: 1.5, fillOpacity: 0.05, fillColor: '#5bc0de' },
      subdistrict:      { color: '#4a7090', weight: 0.4, fillOpacity: 0.01, fillColor: '#4a7090' },
      subdistrict_kpt:  { color: '#4a7090', weight: 0.6, fillOpacity: 0.02, fillColor: '#4a7090' },
    };
    return styles[type] || {};
  }

  function onEachBoundary(feature, layer) {
    const p = feature.properties || {};
    const name = p.NAME_1 || p.NAME_2 || p.NAME_3 || p.name || 'Unknown';
    layer.bindTooltip(name, { sticky: true, className: 'leaflet-tooltip-dark' });
    layer.on('click', () => {
      App.onBoundaryClick(feature);
    });
  }

  function toggleLayer(type, visible) {
    if (!layers[type]) {
      if (visible) loadBoundary(type);
      return;
    }
    if (visible) { layers[type].addTo(map); }
    else         { map.removeLayer(layers[type]); }
  }

  // ── Hotspot Layers ────────────────────────────────────
  async function loadHotspot(year) {
    if (layers.hotspot[year]) {
      layers.hotspot[year].addTo(map);
      return;
    }
    try {
      const res  = await fetch(CONFIG.DATA.hotspot[year]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const color = CONFIG.YEAR_COLORS[year] || '#ff4444';
      const cluster = L.markerClusterGroup({ disableClusteringAtZoom: 10 });

      L.geoJSON(data, {
        pointToLayer: (feature, latlng) => {
          const marker = L.circleMarker(latlng, {
            radius: 5, fillColor: color, color: '#fff',
            weight: 0.5, opacity: 0.9, fillOpacity: 0.85,
          });
          return marker;
        },
        onEachFeature: (feature, layer) => {
          layer.on('click', () => App.onHotspotClick(feature, year));
        },
      }).addTo(cluster);

      layers.hotspot[year] = cluster;
      cluster.addTo(map);

      // Notify dashboard
      App.onHotspotLoaded(year, data);
    } catch (err) {
      console.warn(`[Map] Could not load hotspot ${year}:`, err.message);
    }
  }

  function toggleHotspotLayer(year, visible) {
    if (visible) { loadHotspot(year); }
    else if (layers.hotspot[year]) { map.removeLayer(layers.hotspot[year]); }
  }

  // ── Risk Layer ────────────────────────────────────────
  function renderRiskLayer(riskData) {
    // riskData: GeoJSON FeatureCollection with property "risk_score" per feature
    if (layers.risk) map.removeLayer(layers.risk);
    layers.risk = L.geoJSON(riskData, {
      style: feature => {
        const score = feature.properties.risk_score || 0;
        const level = getRiskLevel(score);
        return {
          fillColor: level.color, fillOpacity: 0.55,
          color: level.color, weight: 0.5,
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`<b>${p.name}</b><br>คะแนนความเสี่ยง: ${p.risk_score?.toFixed(1)}`);
      },
    });
    if (document.getElementById('lyr-risk').checked) layers.risk.addTo(map);
  }

  // ── Filter ────────────────────────────────────────────
  function _populateProvinceFilter(data) {
    const sel = document.getElementById('filter-province');
    const names = [...new Set(data.features.map(f => f.properties.NAME_1 || f.properties.name).filter(Boolean))].sort();
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      sel.appendChild(opt);
    });
  }

  function zoomToProvince(name) {
    if (!layers.province) return;
    layers.province.eachLayer(layer => {
      const p = layer.feature.properties;
      if ((p.NAME_1 || p.name) === name) {
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      }
    });
  }

  function getRiskLevel(score) {
    return CONFIG.RISK_LEVELS.find(l => score >= l.min && score < l.max) || CONFIG.RISK_LEVELS[0];
  }

  // ── Risk KPT Layer (per ตำบล with risk_score) ─────────
  async function loadRiskKpt() {
    if (layers.risk_kpt) { layers.risk_kpt.addTo(map); return; }
    try {
      const res  = await fetch(CONFIG.DATA.risk_kpt);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      layers.risk_kpt = L.geoJSON(data, {
        style: feature => {
          const color = feature.properties.risk_color || '#888';
          return { fillColor: color, fillOpacity: 0.55, color, weight: 0.6 };
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          layer.bindPopup(`
            <b>${p.subdistrict || ''} / ${p.district || ''}</b><br>
            ความเสี่ยง: <b style="color:${p.risk_color}">${p.risk_level}</b> (${p.risk_score})<br>
            Hotspot รวม: ${p.hotspot_total} จุด<br>
            พืชหลัก: ${p.dominant_crop || '-'}<br>
            Burn Scar: ${p.has_burn_scar ? '✅ พบ' : '—'}
          `);
          layer.on('click', () => App.onBoundaryClick(feature));
        },
      });
      layers.risk_kpt.addTo(map);
      // Zoom to KPT
      map.fitBounds(layers.risk_kpt.getBounds(), { padding: [20, 20] });
      App.onRiskKptLoaded(data);
    } catch (err) {
      console.warn('[Map] risk_kpt failed:', err.message);
    }
  }

  // ── Burn Scar Layer ────────────────────────────────────
  async function loadBurnScar() {
    if (layers.burnscar) { layers.burnscar.addTo(map); return; }
    try {
      const res  = await fetch(CONFIG.DATA.burnscar_kpt);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      layers.burnscar = L.geoJSON(data, {
        style: { fillColor: '#c0392b', fillOpacity: 0.45, color: '#e74c3c', weight: 0.8 },
        onEachFeature: (feature, layer) => {
          layer.bindTooltip('🔥 Burn Scar', { sticky: true });
        },
      });
      layers.burnscar.addTo(map);
    } catch (err) {
      console.warn('[Map] burnscar failed:', err.message);
    }
  }

  // ── Crop Layer ────────────────────────────────────────
  const CROP_COLORS = { 'ข้าว':'#27ae60', 'อ้อย':'#e67e22', 'ข้าวโพด':'#f1c40f', 'มันสำปะหลัง':'#9b59b6', 'อื่นๆ':'#95a5a6' };
  async function loadCrop() {
    if (layers.crop) { layers.crop.addTo(map); return; }
    try {
      const res  = await fetch(CONFIG.DATA.crop_kpt);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      layers.crop = L.geoJSON(data, {
        style: feature => {
          const c = CROP_COLORS[feature.properties.crop_type] || '#888';
          return { fillColor: c, fillOpacity: 0.4, color: c, weight: 0.5 };
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          layer.bindTooltip(`${p.crop_type || 'พืช'}`, { sticky: true });
        },
      });
      layers.crop.addTo(map);
    } catch (err) {
      console.warn('[Map] crop failed:', err.message);
    }
  }

  function toggleLayer(type, visible) {
    if (!layers[type]) return;
    if (visible) layers[type].addTo(map);
    else         map.removeLayer(layers[type]);
  }

  // ── Public API ────────────────────────────────────────
  return { init, loadHotspot, toggleHotspotLayer, renderRiskLayer, loadRiskKpt, loadBurnScar, loadCrop, zoomToProvince, getRiskLevel, map: () => map };
})();
