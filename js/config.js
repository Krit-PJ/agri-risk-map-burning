/**
 * config.js — Global configuration for Agri-Risk Map Burning Dashboard
 */
const CONFIG = {
  // Map center: กำแพงเพชร
  MAP_CENTER: [16.47, 99.52],
  MAP_ZOOM: 10,
  MAP_MIN_ZOOM: 7,
  MAP_MAX_ZOOM: 18,

  // GeoJSON data paths
  DATA: {
    province:    'data/boundary/province.geojson',
    district:    'data/boundary/district.geojson',
    subdistrict: 'data/boundary/subdistrict.geojson',
    // กำแพงเพชร-specific
    district_kpt:    'data/boundary/district_kpt.geojson',
    subdistrict_kpt: 'data/boundary/subdistrict_kpt.geojson',
    burnscar_kpt:    'data/burnscar/burnscar_kpt.geojson',
    crop_kpt:        'data/crop/crop_kpt.geojson',
    risk_kpt:        'data/risk/risk_kpt.geojson',
    hotspot: {
      2564: 'data/hotspot/hotspot_2564.geojson',
      2565: 'data/hotspot/hotspot_2565.geojson',
      2566: 'data/hotspot/hotspot_2566.geojson',
      2567: 'data/hotspot/hotspot_2567.geojson',
      2568: 'data/hotspot/hotspot_2568.geojson',
    },
  },

  // Basemap tile URLs
  BASEMAPS: {
    osm:       'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    topo:      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  },

  // Hotspot year colors
  YEAR_COLORS: {
    2564: '#9b59b6',
    2565: '#e67e22',
    2566: '#e74c3c',
    2567: '#f1c40f',
    2568: '#2ecc71',
  },

  // Risk thresholds (score 0–100)
  RISK_LEVELS: [
    { label: 'ต่ำ',      class: 'risk-low',       color: '#2ecc71', min: 0,  max: 25 },
    { label: 'ปานกลาง', class: 'risk-medium',     color: '#f1c40f', min: 25, max: 50 },
    { label: 'สูง',      class: 'risk-high',       color: '#e67e22', min: 50, max: 75 },
    { label: 'สูงมาก',  class: 'risk-very-high',  color: '#e74c3c', min: 75, max: 101 },
  ],

  // Risk weight factors (must sum to 1.0)
  RISK_WEIGHTS: {
    hotspot_frequency: 0.35,
    repeat_burn:       0.25,
    crop_type:         0.20,
    weather:           0.20,
  },

  // Crop type risk multipliers
  CROP_RISK: {
    'ข้าว':        0.7,
    'ข้าวโพด':     0.9,
    'อ้อย':        0.8,
    'ยางพารา':     0.6,
    'มันสำปะหลัง': 0.75,
    'อื่นๆ':       0.5,
  },
};
