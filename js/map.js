const MapModule = (() => {
  let map, currentBasemap='osm';
  const base={}, raw={district:null,subdistrict:null,hotspot:{},crop:null,burnscar:null,risk:null};
  const shown={district:null,subdistrict:null,hotspot:{},crop:null,burnscar:null,risk:null};
  let state={district:'',subdistrict:'',crop:''};

  const clean=v=>String(v||'').replace(/^(อ\.|อำเภอ|ต\.|ตำบล|จ\.|จังหวัด)\s*/,'').trim();
  const districtOf=p=>clean(p?.district||p?.AMP_NAMT||p?.AMP_NAM_T||p?.AMPHOE_T||p?.AMPHOE||p?.NAME_2);
  const subdistrictOf=p=>clean(p?.subdistrict||p?.TAM_NAMT||p?.TAM_NAM_T||p?.TAMBON_T||p?.NAME_3);
  const cropOf=p=>String(p?.crop_type||p?.crop||p?.LU_HP_Name||'อื่นๆ').trim();
  const provinceOf=p=>clean(p?.province||p?.PROV_NAMT||p?.PROV_NAM_T||p?.Prov||p?.NAME_1);

  async function fetchJSON(url){const r=await fetch(url); if(!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json();}

  async function init(){
    map=L.map('map',{center:CONFIG.MAP_CENTER,zoom:CONFIG.MAP_ZOOM,minZoom:CONFIG.MAP_MIN_ZOOM,maxZoom:CONFIG.MAP_MAX_ZOOM,zoomControl:false});
    L.control.zoom({position:'bottomright'}).addTo(map);
    Object.entries(CONFIG.BASEMAPS).forEach(([k,u])=>base[k]=L.tileLayer(u,{maxZoom:19,attribution:k==='satellite'?'Tiles © Esri':k==='topo'?'© OpenTopoMap':'© OpenStreetMap contributors'}));
    base.osm.addTo(map);
    document.querySelectorAll('input[name="basemap"]').forEach(el=>el.addEventListener('change',()=>{map.removeLayer(base[currentBasemap]);currentBasemap=el.value;base[currentBasemap].addTo(map);}));
    document.getElementById('lyr-district')?.addEventListener('change',renderBoundaries);
    document.getElementById('lyr-subdistrict')?.addEventListener('change',renderBoundaries);
    document.getElementById('lyr-province')?.addEventListener('change',renderBoundaries);
    document.getElementById('lyr-crop')?.addEventListener('change',()=>renderCrop());
    document.getElementById('lyr-burnscar')?.addEventListener('change',()=>renderAux('burnscar'));
    document.getElementById('lyr-risk')?.addEventListener('change',()=>renderAux('risk'));
    document.addEventListener('change',e=>{if(e.target?.classList?.contains('hs-layer')) renderHotspots();});

    [raw.district,raw.subdistrict,raw.risk]=await Promise.all([fetchJSON(CONFIG.DATA.district_kpt),fetchJSON(CONFIG.DATA.subdistrict_kpt),fetchJSON(CONFIG.DATA.risk_kpt).catch(err=>{console.warn(err.message);return {type:'FeatureCollection',features:[]};})]);
    await Promise.all(Object.entries(CONFIG.DATA.hotspot).map(async([y,u])=>{try{raw.hotspot[y]=await fetchJSON(u);}catch(err){console.warn(err.message);raw.hotspot[y]={type:'FeatureCollection',features:[]};}}));
    enrichHotspots();
    renderBoundaries(); renderHotspots(); zoomToKPT();
    return {district:raw.district,subdistrict:raw.subdistrict,hotspot:raw.hotspot};
  }

  function enrichHotspots(){
    const polygons=raw.subdistrict?.features||[];
    Object.values(raw.hotspot).forEach(fc=>(fc.features||[]).forEach(f=>{
      const p=f.properties||(f.properties={});
      let d=districtOf(p), t=subdistrictOf(p), prov=provinceOf(p);
      if((!d||!t||prov!=='กำแพงเพชร') && window.turf && f.geometry){
        const hit=polygons.find(poly=>{try{return turf.booleanPointInPolygon(f,poly);}catch{return false;}});
        if(hit){d=districtOf(hit.properties);t=subdistrictOf(hit.properties);prov='กำแพงเพชร';}
      }
      p.__district=d; p.__subdistrict=t; p.__crop=cropOf(p); p.__province=prov;
    }));
  }

  function matchesFeature(f){const p=f.properties||{};return p.__province==='กำแพงเพชร'&&(!state.district||p.__district===state.district)&&(!state.subdistrict||p.__subdistrict===state.subdistrict)&&(!state.crop||p.__crop===state.crop);}
  function matchesBoundary(f,level){const d=districtOf(f.properties),t=subdistrictOf(f.properties);return (!state.district||d===state.district)&&(!state.subdistrict||level!=='subdistrict'||t===state.subdistrict);}
  function remove(layer){if(layer&&map.hasLayer(layer)) map.removeLayer(layer);}

  function renderBoundaries(){
    remove(shown.district); remove(shown.subdistrict);
    const showDist=document.getElementById('lyr-district')?.checked || !!state.district;
    const showSub=document.getElementById('lyr-subdistrict')?.checked || !!state.subdistrict;
    if(showDist&&raw.district){shown.district=L.geoJSON({type:'FeatureCollection',features:raw.district.features.filter(f=>matchesBoundary(f,'district'))},{style:{color:'#38bdf8',weight:2,fillOpacity:.04},onEachFeature:(f,l)=>l.bindTooltip(`อ.${districtOf(f.properties)}`)}).addTo(map);}
    if(showSub&&raw.subdistrict){shown.subdistrict=L.geoJSON({type:'FeatureCollection',features:raw.subdistrict.features.filter(f=>matchesBoundary(f,'subdistrict'))},{style:{color:'#94a3b8',weight:1,fillOpacity:.03},onEachFeature:(f,l)=>l.bindTooltip(`ต.${subdistrictOf(f.properties)}`)}).addTo(map);}
  }

  function renderHotspots(){
    Object.values(shown.hotspot).forEach(remove); shown.hotspot={};
    Object.entries(raw.hotspot).forEach(([year,fc])=>{
      const cb=document.querySelector(`.hs-layer[data-year="${year}"]`); if(cb&&!cb.checked)return;
      const filtered=(fc.features||[]).filter(matchesFeature);
      const group=L.markerClusterGroup({disableClusteringAtZoom:11});
      L.geoJSON({type:'FeatureCollection',features:filtered},{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:5,fillColor:CONFIG.YEAR_COLORS[year]||'#ef4444',color:'#fff',weight:.5,fillOpacity:.9}),onEachFeature:(f,l)=>l.bindPopup(`<b>Hotspot ปี ${year}</b><br>อ.${f.properties.__district||'-'} ต.${f.properties.__subdistrict||'-'}<br>พืช: ${f.properties.__crop||'-'}`)}).addTo(group);
      group.addTo(map); shown.hotspot[year]=group;
    });
  }

  async function ensureAux(type){
    if(raw[type]) return;
    const url=type==='crop'?CONFIG.DATA.crop_kpt:type==='burnscar'?CONFIG.DATA.burnscar_kpt:CONFIG.DATA.risk_kpt;
    try{raw[type]=await fetchJSON(url);}catch(err){console.warn(err.message);raw[type]={type:'FeatureCollection',features:[]};}
  }
  async function renderCrop(){remove(shown.crop); if(!document.getElementById('lyr-crop')?.checked)return; await ensureAux('crop');
    const fs=(raw.crop.features||[]).filter(f=>{const p=f.properties||{};return (!state.district||districtOf(p)===state.district)&&(!state.subdistrict||subdistrictOf(p)===state.subdistrict)&&(!state.crop||cropOf(p)===state.crop);});
    shown.crop=L.geoJSON({type:'FeatureCollection',features:fs},{style:f=>({color:'#16a34a',fillColor:'#22c55e',weight:.5,fillOpacity:.32}),onEachFeature:(f,l)=>l.bindTooltip(cropOf(f.properties))}).addTo(map);
  }
  async function renderAux(type){remove(shown[type]); const checked=document.getElementById(type==='burnscar'?'lyr-burnscar':'lyr-risk')?.checked;if(!checked)return;await ensureAux(type);const fs=(raw[type].features||[]).filter(f=>matchesBoundary(f,'subdistrict'));shown[type]=L.geoJSON({type:'FeatureCollection',features:fs},{style:type==='burnscar'?{color:'#dc2626',fillColor:'#ef4444',weight:.8,fillOpacity:.4}:f=>{const s=Number(f.properties?.risk_score||0),l=getRiskLevel(s);return{color:l.color,fillColor:l.color,weight:.6,fillOpacity:.5};}}).addTo(map);}

  function applyFilter(next){state={district:clean(next.district),subdistrict:clean(next.subdistrict),crop:next.crop||''};renderBoundaries();renderHotspots();renderCrop();renderAux('burnscar');renderAux('risk');focusSelection();}
  function focusSelection(){let src=null;if(state.subdistrict&&raw.subdistrict)src=raw.subdistrict.features.filter(f=>districtOf(f.properties)===state.district&&subdistrictOf(f.properties)===state.subdistrict);else if(state.district&&raw.district)src=raw.district.features.filter(f=>districtOf(f.properties)===state.district);if(src?.length){map.fitBounds(L.geoJSON({type:'FeatureCollection',features:src}).getBounds(),{padding:[20,20]});}else zoomToKPT();}
  function zoomToKPT(){if(raw.district?.features?.length)map.fitBounds(L.geoJSON(raw.district).getBounds(),{padding:[20,20]});else map.setView(CONFIG.MAP_CENTER,CONFIG.MAP_ZOOM);}
  function getRiskLevel(score){return CONFIG.RISK_LEVELS.find(x=>score>=x.min&&score<x.max)||CONFIG.RISK_LEVELS[0];}
  function getData(){return raw;}
  return {init,applyFilter,zoomToKPT,getRiskLevel,getData,map:()=>map,helpers:{districtOf,subdistrictOf,cropOf,clean}};
})();
