const CONFIG = {
  MAP_CENTER: [16.47, 99.52], MAP_ZOOM: 9, MAP_MIN_ZOOM: 7, MAP_MAX_ZOOM: 18,
  CURRENT_YEAR_BE: 2569,
  DATA: {
    district_kpt: 'data/boundary/district_kpt.geojson',
    subdistrict_kpt: 'data/boundary/subdistrict_kpt.geojson',
    burnscar_kpt: 'data/burnscar/burnscar_kpt.geojson',
    crop_kpt: 'data/crop/crop_kpt.geojson',
    hotspot: {
      2566: 'data/hotspot/hotspot_2566.geojson',
      2567: 'data/hotspot/hotspot_2567.geojson',
      2568: 'data/hotspot/hotspot_2568.geojson',
      2569: 'data/hotspot/hotspot_2569.geojson'
    }
  },
  BASEMAPS: {
    osm:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    topo:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
  },
  YEAR_COLORS:{2566:'#ef4444',2567:'#facc15',2568:'#22c55e',2569:'#38bdf8'},
  RISK_LEVELS:[
    {label:'ต่ำ',class:'risk-low',color:'#2ecc71',min:0,max:25},
    {label:'ปานกลาง',class:'risk-medium',color:'#f1c40f',min:25,max:50},
    {label:'สูง',class:'risk-high',color:'#e67e22',min:50,max:75},
    {label:'สูงมาก',class:'risk-very-high',color:'#e74c3c',min:75,max:101}
  ],
  RISK_MODEL:{years:[2567,2568,2569],yearWeights:{2567:0.25,2568:0.35,2569:0.40},weights:{hotspot:0.40,trend:0.20,crop:0.20,area:0.20}},
  CROP_RISK:{'ข้าว':70,'ข้าวโพด':90,'อ้อย':80,'มันสำปะหลัง':75,'อื่นๆ':50},
  VISITOR_COUNTER:{endpoint:''}
};
