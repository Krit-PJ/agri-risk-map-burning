const MapModule = (() => {
  let map, currentBasemap='satellite';
  const base={}, raw={district:null,subdistrict:null,hotspot:{},crop:null,burnscar:null,risk:null};
  const shown={province:null,district:null,subdistrict:null,hotspot:{},crop:null,burnscar:null,risk:null};
  let state={district:'',subdistrict:'',crop:''};

  const clean=v=>String(v||'').replace(/^(อ\.|อำเภอ|ต\.|ตำบล|จ\.|จังหวัด)\s*/,'').trim();
  const districtOf=p=>clean(p?.__district||p?.district||p?.Amphoe||p?.AMP_NAMT||p?.AMP_NAM_T||p?.AMPHOE_T||p?.AMPHOE||p?.NAME_2);
  const subdistrictOf=p=>clean(p?.__subdistrict||p?.subdistrict||p?.Tambon||p?.TAM_NAMT||p?.TAM_NAM_T||p?.TAMBON_T||p?.NAME_3);
  const normalizeCrop=v=>{const s=String(v||'').trim();if(['นาข้าว','ข้าว'].includes(s))return'ข้าว';if(s.includes('ข้าวโพด'))return'ข้าวโพด';if(s==='เกษตรอื่น ๆ'||s==='อื่น ๆ'||s==='อื่น')return'อื่นๆ';return s||'อื่นๆ';};
  const cropOf=p=>normalizeCrop(p?.__crop||p?.crop_type||p?.PlantType||p?.crop||p?.LU_HP_Name);
  const provinceOf=p=>clean(p?.__province||p?.province||p?.Province||p?.PROV_NAMT||p?.PROV_NAM_T||p?.Prov||p?.NAME_1);
  async function fetchJSON(url){const r=await fetch(url);if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);return r.json();}

  async function init(){
    map=L.map('map',{center:CONFIG.MAP_CENTER,zoom:CONFIG.MAP_ZOOM,minZoom:CONFIG.MAP_MIN_ZOOM,maxZoom:CONFIG.MAP_MAX_ZOOM,zoomControl:false});
    L.control.zoom({position:'bottomright'}).addTo(map);
    Object.entries(CONFIG.BASEMAPS).forEach(([k,u])=>base[k]=L.tileLayer(u,{maxZoom:19,attribution:k==='satellite'?'Tiles © Esri':k==='topo'?'© OpenTopoMap':'© OpenStreetMap contributors'}));
    base.satellite.addTo(map);
    document.querySelectorAll('input[name="basemap"]').forEach(el=>el.addEventListener('change',()=>{remove(base[currentBasemap]);currentBasemap=el.value;base[currentBasemap].addTo(map);}));
    ['lyr-district','lyr-subdistrict','lyr-province'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderBoundaries));
    document.getElementById('lyr-crop')?.addEventListener('change',renderCrop);
    document.getElementById('lyr-burnscar')?.addEventListener('change',()=>renderAux('burnscar'));
    document.getElementById('lyr-risk')?.addEventListener('change',()=>renderAux('risk'));
    document.addEventListener('change',e=>{if(e.target?.classList?.contains('hs-layer'))renderHotspots();});

    [raw.district,raw.subdistrict]=await Promise.all([fetchJSON(CONFIG.DATA.district_kpt),fetchJSON(CONFIG.DATA.subdistrict_kpt)]);
    await Promise.all(Object.entries(CONFIG.DATA.hotspot).map(async([y,u])=>{try{raw.hotspot[y]=await fetchJSON(u);}catch(err){console.warn(err.message);raw.hotspot[y]={type:'FeatureCollection',features:[]};}}));
    enrichHotspots();computeDynamicRisk();
    renderBoundaries();renderHotspots();renderAux('risk');zoomToKPT();
    return {district:raw.district,subdistrict:raw.subdistrict,hotspot:raw.hotspot,risk:raw.risk};
  }

  function enrichHotspots(){
    const polygons=raw.subdistrict?.features||[];
    Object.values(raw.hotspot).forEach(fc=>(fc.features||[]).forEach(f=>{
      const p=f.properties||(f.properties={});let d=districtOf(p),t=subdistrictOf(p),prov=provinceOf(p);
      if((!d||!t||prov!=='กำแพงเพชร')&&window.turf&&f.geometry){const hit=polygons.find(poly=>{try{return turf.booleanPointInPolygon(f,poly);}catch{return false;}});if(hit){d=districtOf(hit.properties);t=subdistrictOf(hit.properties);prov='กำแพงเพชร';}}
      p.__district=d;p.__subdistrict=t;p.__crop=cropOf(p);p.__province=prov;
    }));
  }

  function computeDynamicRisk(){
    const years=CONFIG.RISK_MODEL.years, yw=CONFIG.RISK_MODEL.yearWeights, factors=CONFIG.RISK_MODEL.weights;
    const rows=(raw.subdistrict?.features||[]).map(f=>{const p=f.properties||{},d=districtOf(p),t=subdistrictOf(p),counts={};let cropSum=0,cropN=0;
      years.forEach(y=>{const fs=(raw.hotspot[y]?.features||[]).filter(h=>h.properties?.__province==='กำแพงเพชร'&&h.properties?.__district===d&&h.properties?.__subdistrict===t);counts[y]=fs.length;fs.forEach(h=>{cropSum+=CONFIG.CROP_RISK[h.properties.__crop]??50;cropN++;});});
      const weighted=years.reduce((s,y)=>s+(counts[y]||0)*(yw[y]||0),0);const prev=counts[years[years.length-2]]||0,cur=counts[years.at(-1)]||0;
      const trend=prev===0?(cur>0?100:0):Math.max(0,Math.min(100,50+((cur-prev)/prev)*100));
      const area=Number(p.AREA_RAI||p.area_rai||0);return{feature:f,d,t,counts,weighted,trend,crop:cropN?cropSum/cropN:0,area};});
    const maxW=Math.max(...rows.map(r=>r.weighted),1),logs=rows.map(r=>Math.log1p(r.area)),minL=Math.min(...logs),maxL=Math.max(...logs);
    raw.risk={type:'FeatureCollection',name:'risk_kpt_dynamic_2569',features:rows.map((r,i)=>{const hs=r.weighted/maxW*100,area=maxL===minL?0:(logs[i]-minL)/(maxL-minL)*100;const score=hs*factors.hotspot+r.trend*factors.trend+r.crop*factors.crop+area*factors.area;return{type:'Feature',geometry:r.feature.geometry,properties:{...r.feature.properties,district:r.d,subdistrict:r.t,risk_score:+score.toFixed(2),hotspot_score:+hs.toFixed(2),trend_score:+r.trend.toFixed(2),crop_score:+r.crop.toFixed(2),area_score:+area.toFixed(2),risk_model:'Rolling 3-year 2567-2569',hs_2567:r.counts[2567]||0,hs_2568:r.counts[2568]||0,hs_2569:r.counts[2569]||0}};})};
  }

  function matchesFeature(f){const p=f.properties||{};return p.__province==='กำแพงเพชร'&&(!state.district||p.__district===state.district)&&(!state.subdistrict||p.__subdistrict===state.subdistrict)&&(!state.crop||p.__crop===state.crop);}
  function matchesBoundary(f,level){const d=districtOf(f.properties),t=subdistrictOf(f.properties);return(!state.district||d===state.district)&&(!state.subdistrict||level!=='subdistrict'||t===state.subdistrict);}
  function remove(layer){if(layer&&map.hasLayer(layer))map.removeLayer(layer);}
  function renderBoundaries(){
    remove(shown.province);remove(shown.district);remove(shown.subdistrict);
    const showProv=document.getElementById('lyr-province')?.checked,showDist=document.getElementById('lyr-district')?.checked||!!state.district,showSub=document.getElementById('lyr-subdistrict')?.checked||!!state.subdistrict;
    if(showProv&&raw.district){let fc=raw.district;try{if(window.turf?.dissolve)fc=turf.dissolve(raw.district);}catch{}shown.province=L.geoJSON(fc,{style:{color:'#ffffff',weight:3,fillOpacity:0,opacity:.9},interactive:false}).addTo(map);}
    if(showDist&&raw.district)shown.district=L.geoJSON({type:'FeatureCollection',features:raw.district.features.filter(f=>matchesBoundary(f,'district'))},{style:{color:'#38bdf8',weight:2,fillOpacity:.03},onEachFeature:(f,l)=>l.bindTooltip(`อ.${districtOf(f.properties)}`)}).addTo(map);
    if(showSub&&raw.subdistrict)shown.subdistrict=L.geoJSON({type:'FeatureCollection',features:raw.subdistrict.features.filter(f=>matchesBoundary(f,'subdistrict'))},{style:{color:'#94a3b8',weight:1,fillOpacity:.02},onEachFeature:(f,l)=>l.bindTooltip(`ต.${subdistrictOf(f.properties)}`)}).addTo(map);
  }
  function renderHotspots(){Object.values(shown.hotspot).forEach(remove);shown.hotspot={};Object.entries(raw.hotspot).forEach(([year,fc])=>{const cb=document.querySelector(`.hs-layer[data-year="${year}"]`);if(cb&&!cb.checked)return;const filtered=(fc.features||[]).filter(matchesFeature),group=L.markerClusterGroup({disableClusteringAtZoom:11});L.geoJSON({type:'FeatureCollection',features:filtered},{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:5,fillColor:CONFIG.YEAR_COLORS[year]||'#ef4444',color:'#fff',weight:.5,fillOpacity:.9}),onEachFeature:(f,l)=>l.bindPopup(`<b>Hotspot ปี ${year}</b><br>อ.${f.properties.__district||'-'} ต.${f.properties.__subdistrict||'-'}<br>พืช: ${f.properties.__crop||'-'}`)}).addTo(group);group.addTo(map);shown.hotspot[year]=group;});}
  async function ensureAux(type){if(raw[type])return;const url=type==='crop'?CONFIG.DATA.crop_kpt:CONFIG.DATA.burnscar_kpt;try{raw[type]=await fetchJSON(url);}catch(err){console.warn(err.message);raw[type]={type:'FeatureCollection',features:[]};}}
  async function renderCrop(){remove(shown.crop);if(!document.getElementById('lyr-crop')?.checked)return;await ensureAux('crop');const fs=(raw.crop.features||[]).filter(f=>{const p=f.properties||{};return(!state.district||districtOf(p)===state.district)&&(!state.subdistrict||subdistrictOf(p)===state.subdistrict)&&(!state.crop||cropOf(p)===state.crop);});shown.crop=L.geoJSON({type:'FeatureCollection',features:fs},{style:{color:'#16a34a',fillColor:'#22c55e',weight:.5,fillOpacity:.32},onEachFeature:(f,l)=>l.bindTooltip(cropOf(f.properties))}).addTo(map);}
  async function renderAux(type){remove(shown[type]);const checked=document.getElementById(type==='burnscar'?'lyr-burnscar':'lyr-risk')?.checked;if(!checked)return;if(type==='burnscar')await ensureAux(type);const fs=(raw[type]?.features||[]).filter(f=>matchesBoundary(f,'subdistrict'));shown[type]=L.geoJSON({type:'FeatureCollection',features:fs},{style:type==='burnscar'?{color:'#dc2626',fillColor:'#ef4444',weight:.8,fillOpacity:.4}:f=>{const l=getRiskLevel(Number(f.properties?.risk_score||0));return{color:l.color,fillColor:l.color,weight:.8,fillOpacity:.48};},onEachFeature:type==='risk'?(f,l)=>l.bindTooltip(`ต.${subdistrictOf(f.properties)}<br>คะแนน ${Number(f.properties.risk_score).toFixed(1)} (${getRiskLevel(Number(f.properties.risk_score)).label})`):undefined}).addTo(map);}
  function applyFilter(next){state={district:clean(next.district),subdistrict:clean(next.subdistrict),crop:next.crop||''};renderBoundaries();renderHotspots();renderCrop();renderAux('burnscar');renderAux('risk');focusSelection();}
  function focusSelection(){let src=null;if(state.subdistrict)src=raw.subdistrict.features.filter(f=>districtOf(f.properties)===state.district&&subdistrictOf(f.properties)===state.subdistrict);else if(state.district)src=raw.district.features.filter(f=>districtOf(f.properties)===state.district);if(src?.length)map.fitBounds(L.geoJSON({type:'FeatureCollection',features:src}).getBounds(),{padding:[20,20]});else zoomToKPT();}
  function zoomToKPT(){if(raw.district?.features?.length)map.fitBounds(L.geoJSON(raw.district).getBounds(),{padding:[20,20]});else map.setView(CONFIG.MAP_CENTER,CONFIG.MAP_ZOOM);}
  function getRiskLevel(score){return CONFIG.RISK_LEVELS.find(x=>score>=x.min&&score<x.max)||CONFIG.RISK_LEVELS[0];}
  return{init,applyFilter,zoomToKPT,getRiskLevel,getData:()=>raw,map:()=>map,helpers:{districtOf,subdistrictOf,cropOf,clean}};
})();
