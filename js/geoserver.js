/**
 * geoserver.js — GeoServer WMS/WFS layer integration
 * Falls back silently if GeoServer is offline.
 */
const GeoServerModule = (() => {

  const GS_BASE = 'http://localhost:8080/geoserver';
  const WS      = 'agri_risk';
  const WMS_URL = `${GS_BASE}/${WS}/wms`;
  const WFS_URL = `${GS_BASE}/${WS}/wfs`;

  let _available = false;
  const _wmsLayers = {};

  // ── Detect GeoServer ──────────────────────────────────
  async function detect() {
    try {
      const res = await fetch(
        `${GS_BASE}/web/wicket/resource/org.geoserver.web.GeoServerBasePage/img/logo.png`,
        { signal: AbortSignal.timeout(2000), mode: 'no-cors' }
      );
      _available = true;
    } catch {
      _available = false;
    }
    console.log(`[GeoServer] ${_available ? '✅ connected' : '⚠️  offline (WMS layers disabled)'}`);
    return _available;
  }

  // ── Add WMS layer to Leaflet map ──────────────────────
  function addWMSLayer(map, layerName, { opacity = 0.7, zIndex = 400, cql_filter } = {}) {
    if (!_available) return null;

    const params = {
      service:     'WMS',
      version:     '1.1.0',
      request:     'GetMap',
      layers:      `${WS}:${layerName}`,
      format:      'image/png',
      transparent: true,
      styles:      layerName,
    };
    if (cql_filter) params.CQL_FILTER = cql_filter;

    const layer = L.tileLayer.wms(WMS_URL, {
      ...params,
      opacity,
      zIndex,
      attribution: 'GeoServer / DOAE',
    });

    _wmsLayers[layerName] = layer;
    return layer;
  }

  // ── WFS: fetch features as GeoJSON (small datasets) ──
  async function getWFSFeatures(typeName, { maxFeatures = 500, cql_filter } = {}) {
    if (!_available) return null;
    const params = new URLSearchParams({
      service:      'WFS',
      version:      '1.0.0',
      request:      'GetFeature',
      typeName:     `${WS}:${typeName}`,
      outputFormat: 'application/json',
      maxFeatures,
    });
    if (cql_filter) params.append('CQL_FILTER', cql_filter);
    try {
      const res = await fetch(`${WFS_URL}?${params}`);
      return res.ok ? res.json() : null;
    } catch { return null; }
  }

  // ── WMS GetFeatureInfo (click on map) ─────────────────
  function getFeatureInfo(map, latlng, layerName, callback) {
    if (!_available) return;
    const size   = map.getSize();
    const bounds = map.getBounds();
    const sw     = bounds.getSouthWest();
    const ne     = bounds.getNorthEast();

    const params = new URLSearchParams({
      service:      'WMS',
      version:      '1.1.1',
      request:      'GetFeatureInfo',
      layers:       `${WS}:${layerName}`,
      query_layers: `${WS}:${layerName}`,
      info_format:  'application/json',
      feature_count: 5,
      width:        size.x,
      height:       size.y,
      srs:          'EPSG:4326',
      bbox:         `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`,
      x:            Math.round(map.latLngToContainerPoint(latlng).x),
      y:            Math.round(map.latLngToContainerPoint(latlng).y),
    });

    fetch(`${WMS_URL}?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && callback(data))
      .catch(() => {});
  }

  // ── Preset layer configs for this project ─────────────
  function addProjectLayers(map) {
    if (!_available) return;

    // Province outlines via WMS (lighter than loading full GeoJSON at zoom out)
    const provLayer = addWMSLayer(map, 'provinces', { opacity: 0.6, zIndex: 300 });

    // Risk score choropleth (toggled by checkbox in UI)
    const riskLayer = addWMSLayer(map, 'risk_scores', { opacity: 0.65, zIndex: 350 });

    // Hotspot WMS (all years, filtered by CQL in sidebar)
    const hsLayer = addWMSLayer(map, 'hotspots', { opacity: 0.8, zIndex: 400 });

    return { provLayer, riskLayer, hsLayer };
  }

  return {
    detect,
    addWMSLayer,
    getWFSFeatures,
    getFeatureInfo,
    addProjectLayers,
    isAvailable: () => _available,
    WMS_URL,
    WFS_URL,
  };
})();
