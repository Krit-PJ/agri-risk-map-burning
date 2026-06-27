window.CONFIG = {
  years: [2566,2567,2568,2569],
  currentYear: 2569,
  defaultMonths: [1,2,3,4,5],
  banMonths: [1,2,3,4,5],
  data: {
    district: 'data/boundary/district_kpt.geojson',
    subdistrict: 'data/boundary/subdistrict_kpt.geojson',
    crop: 'data/crop/crop_kpt.geojson',
    burnscar: 'data/burnscar/burnscar_kpt.geojson',
    hotspot: {
      2566: 'data/hotspot/hotspot_2566.geojson',
      2567: 'data/hotspot/hotspot_2567.geojson',
      2568: 'data/hotspot/hotspot_2568.geojson',
      2569: 'data/hotspot/hotspot_2569.geojson'
    }
  },
  colors: {
    years: {2566:'#8b5cf6',2567:'#06b6d4',2568:'#fb923c',2569:'#ef4444'},
    risk: {low:'#22c55e',medium:'#facc15',high:'#fb923c',veryHigh:'#ef4444'}
  }
};
