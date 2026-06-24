const MapModule = (() => {
  let map, currentBasemap = 'satellite';
  const base = {};
  const raw = { district:null, subdistrict:null, hotspot:{}, crop:null, burnscar:null, risk:null };
  const shown = { province:null, district:null, subdistrict:null, hotspot:{}, crop:null, burnscar:null, risk:null };
  let state = { district:'', subdistrict:'', crop:'' };

  const clean = v => String(v || '').replace(/^(อ\.|อำเภอ|ต\.|ตำบล|จ\.|จังหวัด)\s*/, '').trim();
  const districtOf = p => clean(p?.__district || p?.district || p?.Amphoe || p?.AmphoeN || p?.AMP_NAMT || p?.AMP_NAM_T || p?.AMPHOE_T || p?.AMPHOE || p?.NAME_2);
  const subdistrictOf = p => clean(p?.__subdistrict || p?.subdistrict || p?.Tambon || p?.TambonN || p?.TAM_NAMT || p?.TAM_NAM_T || p?.TAMBON_T || p?.NAME_3);
  const normalizeCrop = v => {
    const s = String(v || '').trim();
    if (['นาข้าว','ข้าว'].includes(s)) return 'ข้าว';
    if (s.includes('ข้าวโพด')) return 'ข้าวโพด';
    if (s.includes('อ้อย')) return 'อ้อย';
    if (s.includes('มันสำปะหลัง')) return 'มันสำปะหลัง';
    if (['เกษตรอื่น ๆ','อื่น ๆ','อื่น',''].includes(s)) return 'อื่นๆ';
    return s;
  };
  const cropOf = p => normalizeCrop(p?.__crop || p?.crop_type || p?.PlantType || p?.crop || p?.LU_HP_Name);
  const provinceOf = p => clean(p?.__province || p?.province || p?.Province || p?.ProvinceN || p?.PROV_NAMT || p?.PROV_NAM_T || p?.Prov || p?.NAME_1);
  async function fetchJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); }
  function remove(layer){ if(layer && map.hasLayer(layer)) map.removeLayer(layer); }
  function activeYears(){
    return [...document.querySelectorAll('.hs-layer:checked')]
      .map(el => Number(el.dataset.year)).filter(Number.isFinite).sort((a,b)=>a-b);
  }

  async function init(){
    map = L.map('map',{ center:CONFIG.MAP_CENTER, zoom:CONFIG.MAP_ZOOM, minZoom:CONFIG.MAP_MIN_ZOOM, maxZoom:CONFIG.MAP_MAX_ZOOM, zoomControl:false });
    L.control.zoom({position:'bottomright'}).addTo(map);
    Object.entries(CONFIG.BASEMAPS).forEach(([k,u]) => base[k] = L.tileLayer(u,{ maxZoom:19, attribution:k==='satellite'?'Tiles © Esri':k==='topo'?'© OpenTopoMap':'© OpenStreetMap contributors' }));
    base.satellite.addTo(map);

    document.querySelectorAll('input[name="basemap"]').forEach(el => el.addEventListener('change',()=>{ remove(base[currentBasemap]); currentBasemap=el.value; base[currentBasemap].addTo(map); }));
    ['lyr-district','lyr-subdistrict','lyr-province'].forEach(id => document.getElementById(id)?.addEventListener('change',renderBoundaries));
    document.getElementById('lyr-crop')?.addEventListener('change',renderCrop);
    document.getElementById('lyr-burnscar')?.addEventListener('change',()=>renderAux('burnscar'));
    document.getElementById('lyr-risk')?.addEventListener('change',()=>renderAux('risk'));
    document.addEventListener('change',e=>{
      if(!e.target?.classList?.contains('hs-layer')) return;
      computeDynamicRisk();
      renderHotspots();
      renderAux('risk');
      document.dispatchEvent(new CustomEvent('agri-risk:years-changed',{detail:{years:activeYears()}}));
    });

    [raw.district,raw.subdistrict] = await Promise.all([fetchJSON(CONFIG.DATA.district_kpt),fetchJSON(CONFIG.DATA.subdistrict_kpt)]);
    await Promise.all(Object.entries(CONFIG.DATA.hotspot).map(async([y,u])=>{
      try { raw.hotspot[y]=await fetchJSON(u); }
      catch(err){ console.warn(err.message); raw.hotspot[y]={type:'FeatureCollection',features:[]}; }
    }));
    enrichHotspots();
    computeDynamicRisk();
    renderBoundaries(); renderHotspots(); renderAux('risk'); zoomToKPT();
    return { district:raw.district, subdistrict:raw.subdistrict, hotspot:raw.hotspot, risk:raw.risk };
  }

  function enrichFeature(f){
    const p=f.properties||(f.properties={});
    let d=districtOf(p), t=subdistrictOf(p), prov=provinceOf(p);
    if((!d || !t || prov!=='กำแพงเพชร') && window.turf && f.geometry){
      const hit=(raw.subdistrict?.features||[]).find(poly=>{ try{return turf.booleanPointInPolygon(f,poly);}catch{return false;} });
      if(hit){ d=districtOf(hit.properties); t=subdistrictOf(hit.properties); prov='กำแพงเพชร'; }
    }
    p.__district=d; p.__subdistrict=t; p.__crop=cropOf(p); p.__province=prov;
    return f;
  }
  function enrichHotspots(){ Object.values(raw.hotspot).forEach(fc=>(fc.features||[]).forEach(enrichFeature)); }

  function selectedYearWeights(years){
    if(!years.length) return {};
    const configured=CONFIG.RISK_MODEL.yearWeights||{};
    let vals=years.map((y,i)=>Number(configured[y] ?? (i+1)));
    let total=vals.reduce((a,b)=>a+b,0)||1;
    return Object.fromEntries(years.map((y,i)=>[y,vals[i]/total]));
  }

  function computeDynamicRisk(){
    const years=activeYears();
    const yw=selectedYearWeights(years);
    const factors=CONFIG.RISK_MODEL.weights;
    const rows=(raw.subdistrict?.features||[]).map(f=>{
      const p=f.properties||{}, d=districtOf(p), t=subdistrictOf(p), counts={};
      let cropSum=0,cropN=0;
      years.forEach(y=>{
        const fs=(raw.hotspot[y]?.features||[]).filter(h=>h.properties?.__province==='กำแพงเพชร'&&h.properties?.__district===d&&h.properties?.__subdistrict===t);
        counts[y]=fs.length;
        fs.forEach(h=>{ cropSum+=CONFIG.CROP_RISK[h.properties.__crop]??50; cropN++; });
      });
      const weighted=years.reduce((s,y)=>s+(counts[y]||0)*(yw[y]||0),0);
      let trend=0;
      if(years.length>=2){
        const prev=counts[years[years.length-2]]||0, cur=counts[years[years.length-1]]||0;
        trend=prev===0?(cur>0?100:0):Math.max(0,Math.min(100,50+((cur-prev)/prev)*100));
      }
      const area=Number(p.AREA_RAI||p.area_rai||0);
      return {feature:f,d,t,counts,weighted,trend,crop:cropN?cropSum/cropN:0,area};
    });
    const maxW=Math.max(...rows.map(r=>r.weighted),1), logs=rows.map(r=>Math.log1p(r.area)), minL=Math.min(...logs), maxL=Math.max(...logs);
    raw.risk={
      type:'FeatureCollection', name:`risk_kpt_dynamic_${years.join('_')||'none'}`,
      features:rows.map((r,i)=>{
        const hs=r.weighted/maxW*100;
        const area=maxL===minL?0:(logs[i]-minL)/(maxL-minL)*100;
        const score=hs*factors.hotspot+r.trend*factors.trend+r.crop*factors.crop+area*factors.area;
        const hsFields=Object.fromEntries(years.map(y=>[`hs_${y}`,r.counts[y]||0]));
        return { type:'Feature', geometry:r.feature.geometry, properties:{...r.feature.properties,district:r.d,subdistrict:r.t,risk_score:+score.toFixed(2),hotspot_score:+hs.toFixed(2),trend_score:+r.trend.toFixed(2),crop_score:+r.crop.toFixed(2),area_score:+area.toFixed(2),risk_years:years.join(','),...hsFields} };
      })
    };
    return raw.risk;
  }

  function matchesFeature(f){ const p=f.properties||{}; return p.__province==='กำแพงเพชร'&&(!state.district||p.__district===state.district)&&(!state.subdistrict||p.__subdistrict===state.subdistrict)&&(!state.crop||p.__crop===state.crop); }
  function matchesBoundary(f,level){ const d=districtOf(f.properties),t=subdistrictOf(f.properties); return(!state.district||d===state.district)&&(!state.subdistrict||level!=='subdistrict'||t===state.subdistrict); }

  function renderBoundaries(){
    remove(shown.province); remove(shown.district); remove(shown.subdistrict);
    const showProv=document.getElementById('lyr-province')?.checked, showDist=document.getElementById('lyr-district')?.checked||!!state.district, showSub=document.getElementById('lyr-subdistrict')?.checked||!!state.subdistrict;
    if(showProv&&raw.district){ let fc=raw.district; try{if(window.turf?.dissolve)fc=turf.dissolve(raw.district);}catch{} shown.province=L.geoJSON(fc,{style:{color:'#f8fafc',weight:3,fillOpacity:0,opacity:1},interactive:false}).addTo(map); }
    if(showDist&&raw.district) shown.district=L.geoJSON({type:'FeatureCollection',features:raw.district.features.filter(f=>matchesBoundary(f,'district'))},{style:{color:'#22d3ee',weight:2.2,fillOpacity:.03},onEachFeature:(f,l)=>l.bindTooltip(`อ.${districtOf(f.properties)}`)}).addTo(map);
    if(showSub&&raw.subdistrict) shown.subdistrict=L.geoJSON({type:'FeatureCollection',features:raw.subdistrict.features.filter(f=>matchesBoundary(f,'subdistrict'))},{style:{color:'#e2e8f0',weight:1.1,fillOpacity:.02},onEachFeature:(f,l)=>l.bindTooltip(`ต.${subdistrictOf(f.properties)}`)}).addTo(map);
  }

  function renderHotspots(){
    Object.values(shown.hotspot).forEach(remove); shown.hotspot={};
    Object.entries(raw.hotspot).forEach(([year,fc])=>{
      const cb=document.querySelector(`.hs-layer[data-year="${year}"]`); if(cb&&!cb.checked)return;
      const filtered=(fc.features||[]).filter(matchesFeature), group=L.markerClusterGroup({disableClusteringAtZoom:11});
      L.geoJSON({type:'FeatureCollection',features:filtered},{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:5,fillColor:CONFIG.YEAR_COLORS[year]||'#ef4444',color:'#fff',weight:.7,fillOpacity:.95}),onEachFeature:(f,l)=>l.bindPopup(`<b>Hotspot ปี ${year}</b><br>อ.${f.properties.__district||'-'} ต.${f.properties.__subdistrict||'-'}<br>พืช: ${f.properties.__crop||'-'}`)}).addTo(group);
      group.addTo(map); shown.hotspot[year]=group;
    });
  }

  async function ensureAux(type){ if(raw[type])return; const url=type==='crop'?CONFIG.DATA.crop_kpt:CONFIG.DATA.burnscar_kpt; try{raw[type]=await fetchJSON(url);}catch(err){console.warn(err.message);raw[type]={type:'FeatureCollection',features:[]};} }
  async function renderCrop(){ remove(shown.crop); if(!document.getElementById('lyr-crop')?.checked)return; await ensureAux('crop'); const fs=(raw.crop.features||[]).filter(f=>{const p=f.properties||{};return(!state.district||districtOf(p)===state.district)&&(!state.subdistrict||subdistrictOf(p)===state.subdistrict)&&(!state.crop||cropOf(p)===state.crop);}); shown.crop=L.geoJSON({type:'FeatureCollection',features:fs},{style:{color:'#16a34a',fillColor:'#22c55e',weight:.6,fillOpacity:.35},onEachFeature:(f,l)=>l.bindTooltip(cropOf(f.properties))}).addTo(map); }
  async function renderAux(type){
    remove(shown[type]);
    const checked=document.getElementById(type==='burnscar'?'lyr-burnscar':'lyr-risk')?.checked; if(!checked)return;
    if(type==='burnscar')await ensureAux(type);
    const fs=(raw[type]?.features||[]).filter(f=>matchesBoundary(f,'subdistrict'));
    shown[type]=L.geoJSON({type:'FeatureCollection',features:fs},{style:type==='burnscar'?{color:'#dc2626',fillColor:'#ef4444',weight:.8,fillOpacity:.4}:f=>{const l=getRiskLevel(Number(f.properties?.risk_score||0));return{color:l.color,fillColor:l.color,weight:1,fillOpacity:.56};},onEachFeature:type==='risk'?(f,l)=>l.bindTooltip(`ต.${subdistrictOf(f.properties)}<br>คะแนน ${Number(f.properties.risk_score).toFixed(1)} (${getRiskLevel(Number(f.properties.risk_score)).label})`):undefined}).addTo(map);
  }

  function applyFilter(next){ state={district:clean(next.district),subdistrict:clean(next.subdistrict),crop:next.crop||''}; renderBoundaries();renderHotspots();renderCrop();renderAux('burnscar');renderAux('risk');focusSelection(); }
  function focusSelection(){ let src=null; if(state.subdistrict)src=raw.subdistrict.features.filter(f=>districtOf(f.properties)===state.district&&subdistrictOf(f.properties)===state.subdistrict); else if(state.district)src=raw.district.features.filter(f=>districtOf(f.properties)===state.district); if(src?.length)map.fitBounds(L.geoJSON({type:'FeatureCollection',features:src}).getBounds(),{padding:[20,20]}); else zoomToKPT(); }
  function zoomToKPT(){ if(raw.district?.features?.length)map.fitBounds(L.geoJSON(raw.district).getBounds(),{padding:[20,20]}); else map.setView(CONFIG.MAP_CENTER,CONFIG.MAP_ZOOM); }
  function getRiskLevel(score){ return CONFIG.RISK_LEVELS.find(x=>score>=x.min&&score<x.max)||CONFIG.RISK_LEVELS[0]; }

  function importHotspots(year,fc){
    const y=String(year);
    raw.hotspot[y]={type:'FeatureCollection',features:(fc?.features||[]).map(enrichFeature)};
    computeDynamicRisk(); renderHotspots(); renderAux('risk');
    return raw.hotspot[y];
  }

  return { init,applyFilter,zoomToKPT,getRiskLevel,getData:()=>raw,map:()=>map,activeYears,computeDynamicRisk,importHotspots,helpers:{districtOf,subdistrictOf,cropOf,provinceOf,clean,normalizeCrop} };
})();
