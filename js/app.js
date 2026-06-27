(() => {
  'use strict';

  const C = window.CONFIG;
  const TH_MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const TH_MONTHS_FULL = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  const state = {
    year: C.currentYear,
    months: new Set(C.defaultMonths),
    district: '', subdistrict: '', crop: '',
    show: {province:true, district:true, subdistrict:false, hotspot:true, risk:true, crop:false, burnscar:false},
    basemap: 'satellite'
  };

  const data = {district:null, subdistrict:null, crop:null, burnscar:null, hotspots:{}, allHotspots:[]};
  const layers = {base:{}, district:null, subdistrict:null, risk:null, crop:null, burnscar:null, hotspot:null};
  const charts = {trend:null, risk:null, top:null};
  let map;

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n || 0).toLocaleString('th-TH');
  const clean = (v) => String(v ?? '').replace(/^(อ\.|ต\.|จ\.)/,'').trim();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function monthText(months = [...state.months]) {
    const arr = [...months].map(Number).filter(Boolean).sort((a,b)=>a-b);
    if (!arr.length || arr.length === 12) return 'ทุกเดือน';
    const contiguous = arr.every((m,i)=> i===0 || m === arr[i-1]+1);
    if (contiguous && arr.length > 1) return `${TH_MONTHS[arr[0]]}–${TH_MONTHS[arr[arr.length-1]]}`;
    return arr.map(m=>TH_MONTHS[m]).join(', ');
  }

  function parseDateInfo(raw, fallbackYear) {
    if (raw == null || raw === '') return {year: fallbackYear, month:null, day:null, iso:''};
    if (typeof raw === 'number') {
      const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
      return {year: d.getUTCFullYear()+543, month: d.getUTCMonth()+1, day: d.getUTCDate(), iso: d.toISOString().slice(0,10)};
    }
    const s = String(raw).trim();
    let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) {
      let y = Number(m[1]); if (y < 2400) y += 543;
      return {year:y, month:Number(m[2]), day:Number(m[3]), iso:s.slice(0,10)};
    }
    m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) {
      let y = Number(m[3]); if (y < 2400) y += 543;
      return {year:y, month:Number(m[2]), day:Number(m[1]), iso:s};
    }
    return {year: fallbackYear, month:null, day:null, iso:s};
  }

  async function loadJSON(url) {
    const res = await fetch(url, {cache:'no-store'});
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  }

  async function loadAllData() {
    data.district = await loadJSON(C.data.district);
    data.subdistrict = await loadJSON(C.data.subdistrict);
    data.crop = await loadJSON(C.data.crop).catch(() => ({type:'FeatureCollection',features:[]}));
    data.burnscar = await loadJSON(C.data.burnscar).catch(() => ({type:'FeatureCollection',features:[]}));
    for (const y of C.years) {
      const gj = await loadJSON(C.data.hotspot[y]);
      gj.features.forEach((f, idx) => {
        const p = f.properties ||= {};
        const d = parseDateInfo(p.acq_date || p.Date || p.date, y);
        p.__year = Number(p.year_be || p.season_be || d.year || y);
        p.__month = d.month;
        p.__day = d.day;
        p.__date = d.iso || p.acq_date || '';
        p.__district = clean(p.__district || p.district || p.AMPHOE || p.Amphoe || '');
        p.__subdistrict = clean(p.__subdistrict || p.subdistrict || p.TAMBOL || p.Tambon || '');
        p.__crop = clean(p.__crop || p.crop_type || p.crop_type_raw || 'อื่นๆ') || 'อื่นๆ';
        p.__id = p.hs_id || p.hsID || `${y}-${idx}`;
      });
      data.hotspots[y] = gj;
    }
    data.allHotspots = C.years.flatMap(y => data.hotspots[y].features);
  }

  function initMap() {
    map = L.map('map', {zoomControl:true}).setView([16.42, 99.55], 9);
    layers.base.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap'});
    layers.base.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, attribution:'Tiles © Esri'});
    layers.base.topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {maxZoom:17, attribution:'© OpenTopoMap'});
    layers.base[state.basemap].addTo(map);
  }

  function getDistrictName(f) {return clean(f?.properties?.AMP_NAMT || f?.properties?.AMPHOE_T || f?.properties?.district || '');}
  function getSubdistrictName(f) {return clean(f?.properties?.TAM_NAMT || f?.properties?.TAM_NAM_T || f?.properties?.subdistrict || '');}
  function getAreaRai(f) {return Number(f?.properties?.AREA_RAI || f?.properties?.rai || 0) || 0;}

  function fillAreaFilters() {
    const districts = [...new Set(data.subdistrict.features.map(getDistrictName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
    $('filter-district').innerHTML = '<option value="">-- ทั้งจังหวัด --</option>' + districts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
    updateSubdistrictOptions();
  }

  function updateSubdistrictOptions() {
    const sel = $('filter-subdistrict');
    if (!state.district) {
      sel.disabled = true;
      sel.innerHTML = '<option value="">-- เลือกอำเภอก่อน --</option>';
      state.subdistrict = '';
      return;
    }
    const subs = data.subdistrict.features.filter(f => getDistrictName(f) === state.district).map(getSubdistrictName).filter(Boolean).sort((a,b)=>a.localeCompare(b,'th'));
    sel.disabled = false;
    sel.innerHTML = '<option value="">-- ทั้งอำเภอ --</option>' + subs.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if (state.subdistrict && !subs.includes(state.subdistrict)) state.subdistrict = '';
    sel.value = state.subdistrict;
  }

  function selectedMonthsArray() {return [...state.months].map(Number).filter(Boolean).sort((a,b)=>a-b);}
  function hsMatches(f, opts = {}) {
    const p = f.properties || {};
    const year = opts.year ?? state.year;
    const months = opts.months ?? state.months;
    if (Number(p.__year) !== Number(year)) return false;
    if (months && months.size && !months.has(Number(p.__month))) return false;
    if (state.district && p.__district !== state.district) return false;
    if (state.subdistrict && p.__subdistrict !== state.subdistrict) return false;
    if (state.crop && p.__crop !== state.crop) return false;
    return true;
  }
  function getFilteredHotspots(year = state.year, months = state.months) {return data.allHotspots.filter(f => hsMatches(f, {year, months}));}

  function countByArea(features, level, year, months) {
    const counts = new Map();
    for (const f of features) {
      const p = f.properties || {};
      if (Number(p.__year) !== Number(year)) continue;
      if (months && months.size && !months.has(Number(p.__month))) continue;
      if (state.crop && p.__crop !== state.crop) continue;
      if (state.district && p.__district !== state.district) continue;
      if (state.subdistrict && p.__subdistrict !== state.subdistrict) continue;
      const key = level === 'subdistrict' ? p.__subdistrict : p.__district;
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  function countForUnit(name, level, year, months) {
    let n = 0;
    for (const f of data.allHotspots) {
      const p = f.properties || {};
      if (Number(p.__year) !== Number(year)) continue;
      if (months && months.size && !months.has(Number(p.__month))) continue;
      if (state.crop && p.__crop !== state.crop) continue;
      if (level === 'district' && p.__district !== name) continue;
      if (level === 'subdistrict' && p.__subdistrict !== name) continue;
      n++;
    }
    return n;
  }

  function scoreFromEvidence(curr, prev1, prev2, areaRai) {
    const evidence = curr + 0.6*prev1 + 0.4*prev2;
    const density = areaRai ? (curr / areaRai * 10000) : curr;
    const countScore = evidence <= 0 ? 0 : evidence <= 2 ? 20 : evidence <= 5 ? 45 : evidence <= 10 ? 70 : Math.min(100, 75 + (evidence - 10) * 2.2);
    const densityScore = Math.min(100, density * 30);
    const areaScore = areaRai <= 0 ? 0 : Math.min(100, Math.log1p(areaRai) / Math.log1p(250000) * 100);
    let raw = 0.55*countScore + 0.25*densityScore + 0.20*areaScore;
    let cap = evidence <= 0 ? 24.99 : evidence <= 2 ? 24.99 : evidence <= 5 ? 49.99 : evidence <= 10 ? 74.99 : 100;
    return Math.min(raw, cap);
  }
  function riskLevel(score) {
    if (score < 25) return {name:'ต่ำ', cls:'risk-low', color:C.colors.risk.low, key:'low'};
    if (score < 50) return {name:'ปานกลาง', cls:'risk-medium', color:C.colors.risk.medium, key:'medium'};
    if (score < 75) return {name:'สูง', cls:'risk-high', color:C.colors.risk.high, key:'high'};
    return {name:'สูงมาก', cls:'risk-very-high', color:C.colors.risk.veryHigh, key:'veryHigh'};
  }

  function featureIncluded(f, level) {
    const d = getDistrictName(f), s = getSubdistrictName(f);
    if (state.district && d !== state.district) return false;
    if (level === 'subdistrict' && state.subdistrict && s !== state.subdistrict) return false;
    return true;
  }

  function removeLayer(name) { if (layers[name]) { map.removeLayer(layers[name]); layers[name] = null; } }

  function refreshMapLayers() {
    ['district','subdistrict','risk','crop','burnscar','hotspot'].forEach(removeLayer);
    if (state.show.district) {
      layers.district = L.geoJSON(data.district, {
        filter: f => !state.district || getDistrictName(f) === state.district,
        style: {color:'#0f766e', weight:2, fill:false, opacity:.95},
        onEachFeature: (f,l) => l.bindTooltip(`อำเภอ${getDistrictName(f)}`)
      }).addTo(map);
    }
    if (state.show.subdistrict) {
      layers.subdistrict = L.geoJSON(data.subdistrict, {
        filter: f => featureIncluded(f, 'subdistrict'),
        style: {color:'#38bdf8', weight:1, fill:false, opacity:.75},
        onEachFeature: (f,l) => l.bindTooltip(`ต.${getSubdistrictName(f)}`)
      }).addTo(map);
    }
    if (state.show.risk) {
      const prevYear = state.year - 1, prev2Year = state.year - 2;
      layers.risk = L.geoJSON(data.subdistrict, {
        filter: f => featureIncluded(f, 'subdistrict'),
        style: f => {
          const name = getSubdistrictName(f), area = getAreaRai(f);
          const curr = countForUnit(name, 'subdistrict', state.year, state.months);
          const p1 = C.years.includes(prevYear) ? countForUnit(name, 'subdistrict', prevYear, state.months) : 0;
          const p2 = C.years.includes(prev2Year) ? countForUnit(name, 'subdistrict', prev2Year, state.months) : 0;
          const score = scoreFromEvidence(curr, p1, p2, area);
          const lev = riskLevel(score);
          return {color:'#ffffff', weight:1.2, fillColor:lev.color, fillOpacity:.58, opacity:.9};
        },
        onEachFeature: (f,l) => {
          l.on('click', () => showBoundaryDetail(f));
          l.bindTooltip(`ต.${getSubdistrictName(f)}`);
        }
      }).addTo(map);
    }
    if (state.show.crop && data.crop?.features?.length) {
      layers.crop = L.geoJSON(data.crop, {
        filter: f => {
          const p=f.properties||{};
          if (state.district && clean(p.a_name || p.district) !== state.district) return false;
          if (state.subdistrict && clean(p.t_name || p.subdistrict) !== state.subdistrict) return false;
          if (state.crop && clean(p.crop_type) !== state.crop) return false;
          return true;
        },
        style: f => ({color:'#84cc16', weight:.5, fillColor:'#bef264', fillOpacity:.25})
      }).addTo(map);
    }
    if (state.show.burnscar && data.burnscar?.features?.length) {
      layers.burnscar = L.geoJSON(data.burnscar, {style:{color:'#7c2d12', weight:1, fillColor:'#f97316', fillOpacity:.35}}).addTo(map);
    }
    if (state.show.hotspot) {
      layers.hotspot = L.markerClusterGroup({showCoverageOnHover:false, maxClusterRadius:42});
      for (const f of getFilteredHotspots()) {
        const [lng,lat] = f.geometry.coordinates;
        const y = f.properties.__year;
        const icon = L.divIcon({className:'', html:`<div class="marker-hs marker-${y}"></div>`, iconSize:[18,18], iconAnchor:[9,9]});
        L.marker([lat,lng], {icon}).bindPopup(hotspotPopup(f)).addTo(layers.hotspot);
      }
      layers.hotspot.addTo(map);
    }
    fitToScope();
  }

  function hotspotPopup(f) {
    const p=f.properties||{};
    return `<b>Hotspot ${esc(p.__id)}</b><br>วันที่: ${esc(p.__date || '-') }<br>อำเภอ: ${esc(p.__district)}<br>ตำบล: ${esc(p.__subdistrict)}<br>พืช: ${esc(p.__crop)}<br>Confidence: ${esc(p.confidence ?? '-')}`;
  }
  function showBoundaryDetail(f) {
    const sub = getSubdistrictName(f), dist = getDistrictName(f), area=getAreaRai(f);
    const curr = countForUnit(sub, 'subdistrict', state.year, state.months);
    const p1 = C.years.includes(state.year-1) ? countForUnit(sub, 'subdistrict', state.year-1, state.months) : 0;
    const p2 = C.years.includes(state.year-2) ? countForUnit(sub, 'subdistrict', state.year-2, state.months) : 0;
    const score = scoreFromEvidence(curr,p1,p2,area), lev=riskLevel(score);
    $('detail-title').textContent = `ต.${sub}`;
    $('detail-content').innerHTML = `<p><b>อำเภอ:</b> ${esc(dist)}</p><p><b>ช่วงเวลา:</b> ${monthText()} ${state.year}</p><p><b>Hotspot:</b> ${fmt(curr)} จุด</p><p><b>ปีก่อน:</b> ${fmt(p1)} จุด</p><p><b>Risk Score:</b> ${score.toFixed(2)} <span class="risk-badge ${lev.cls}">${lev.name}</span></p>`;
    $('detail-panel').classList.remove('hidden');
  }
  function fitToScope() {
    let layer = layers.risk || layers.subdistrict || layers.district;
    if (layer && layer.getBounds && layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), {padding:[20,20], maxZoom:11});
  }

  function updateComparisonTable() {
    const prevYear = state.year - 1;
    const level = state.district ? 'subdistrict' : 'district';
    const areaHeader = state.district ? 'ตำบล' : 'อำเภอ';
    $('comparison-area-header').textContent = areaHeader;
    $('comparison-prev-header').textContent = C.years.includes(prevYear) ? `ปี ${prevYear}` : `ปี ${prevYear}`;
    $('comparison-current-header').textContent = `ปี ${state.year}`;
    $('title-comparison').textContent = state.district ? 'เปรียบเทียบ Hotspot รายตำบล' : 'เปรียบเทียบ Hotspot รายอำเภอ';
    $('comparison-period').textContent = `${monthText()} · เทียบช่วงเดียวกันของปีก่อน`;

    let names;
    if (state.subdistrict) names = [state.subdistrict];
    else if (state.district) names = [...new Set(data.subdistrict.features.filter(f => getDistrictName(f) === state.district).map(getSubdistrictName))].sort((a,b)=>a.localeCompare(b,'th'));
    else names = [...new Set(data.district.features.map(getDistrictName))].sort((a,b)=>a.localeCompare(b,'th'));

    const rows = names.map(name => {
      const curr = countForUnit(name, level, state.year, state.months);
      const prev = C.years.includes(prevYear) ? countForUnit(name, level, prevYear, state.months) : 0;
      return {name, curr, prev};
    });
    rows.sort((a,b) => b.curr - a.curr || a.name.localeCompare(b.name,'th'));
    const total = rows.reduce((a,r)=>({curr:a.curr+r.curr, prev:a.prev+r.prev}), {curr:0, prev:0});
    const label = state.subdistrict ? `รวมตำบล${state.subdistrict}` : state.district ? `รวมอำเภอ${state.district}` : 'รวมจังหวัดกำแพงเพชร';
    const bodyRows = [renderCompareRow(label,total.curr,total.prev,true), ...rows.map(r => renderCompareRow(r.name,r.curr,r.prev,false))].join('');
    $('tbl-hotspot-comparison').querySelector('tbody').innerHTML = bodyRows;
  }
  function changeText(curr, prev) {
    if (prev === 0 && curr === 0) return `<span class="change-flat">0%</span>`;
    if (prev === 0 && curr > 0) return `<span class="change-up">ใหม่</span>`;
    const pct = ((curr - prev) / prev) * 100;
    const cls = pct > 0 ? 'change-up' : pct < 0 ? 'change-down' : 'change-flat';
    const sign = pct > 0 ? '+' : '';
    return `<span class="${cls}">${sign}${pct.toFixed(1)}%</span>`;
  }
  function renderCompareRow(name,curr,prev,total=false) {
    return `<tr class="${total?'total-row':''}"><td>${esc(name)}</td><td>${fmt(prev)}</td><td>${fmt(curr)}</td><td>${changeText(curr,prev)}</td></tr>`;
  }

  function updateTrendChart() {
    const counts = C.years.map(y => getFilteredHotspots(y, state.months).length);
    $('title-trend').textContent = `Hotspot รายปี (Trend) - ${state.district || 'ทุกอำเภอ'}`;
    $('scope-caption').textContent = `ขอบเขตวิเคราะห์: ${state.subdistrict ? 'ต.'+state.subdistrict : state.district ? 'อ.'+state.district : 'จังหวัดกำแพงเพชร'} · ${monthText()}`;
    const ctx = $('chart-trend');
    if (charts.trend) charts.trend.destroy();
    charts.trend = new Chart(ctx, {type:'bar', data:{labels:C.years.map(String), datasets:[{label:'Hotspot', data:counts, borderRadius:7, backgroundColor:C.years.map(y=>C.colors.years[y])}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}});
  }

  function currentUnitRows() {
    const level = state.district ? 'subdistrict' : 'district';
    let names = state.district ? [...new Set(data.subdistrict.features.filter(f => getDistrictName(f) === state.district).map(getSubdistrictName))] : [...new Set(data.district.features.map(getDistrictName))];
    if (state.subdistrict) names = [state.subdistrict];
    return names.map(name => {
      const curr = countForUnit(name, level, state.year, state.months);
      const prev1 = C.years.includes(state.year-1) ? countForUnit(name, level, state.year-1, state.months) : 0;
      const prev2 = C.years.includes(state.year-2) ? countForUnit(name, level, state.year-2, state.months) : 0;
      const area = level === 'district' ? districtArea(name) : subdistrictArea(name);
      const score = scoreFromEvidence(curr, prev1, prev2, area);
      return {name, curr, score, level:riskLevel(score)};
    }).sort((a,b)=>b.curr-a.curr || b.score-a.score);
  }
  function districtArea(name) {return data.district.features.filter(f=>getDistrictName(f)===name).reduce((s,f)=>s+getAreaRai(f),0);}
  function subdistrictArea(name) {return data.subdistrict.features.filter(f=>getSubdistrictName(f)===name && (!state.district || getDistrictName(f)===state.district)).reduce((s,f)=>s+getAreaRai(f),0);}

  function updateRiskChartAndTop() {
    const rows = currentUnitRows();
    const riskCounts = {ต่ำ:0,ปานกลาง:0,สูง:0,สูงมาก:0};
    rows.forEach(r => riskCounts[r.level.name]++);
    if (charts.risk) charts.risk.destroy();
    charts.risk = new Chart($('chart-risk'), {type:'doughnut', data:{labels:Object.keys(riskCounts), datasets:[{data:Object.values(riskCounts), backgroundColor:[C.colors.risk.low,C.colors.risk.medium,C.colors.risk.high,C.colors.risk.veryHigh]}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}}});
    const top = rows.slice(0,5);
    if (charts.top) charts.top.destroy();
    charts.top = new Chart($('chart-top'), {type:'bar', data:{labels:top.map(r=>r.name), datasets:[{data:top.map(r=>r.curr), label:'Hotspot', backgroundColor:'#38bdf8', borderRadius:7}]}, options:{indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}}}});
    $('title-top5').textContent = `Top 5 ${state.district ? 'ตำบล' : 'อำเภอ'}`;
    $('title-top10').textContent = `Top 10 ${state.district ? 'ตำบล' : 'อำเภอ'} Hotspot สูงสุด`;
    $('tbl-top10').querySelector('tbody').innerHTML = rows.slice(0,10).map(r => `<tr><td>${esc(r.name)}</td><td>${fmt(r.curr)}</td><td><span class="risk-badge ${r.level.cls}">${r.level.name}</span></td></tr>`).join('') || '<tr><td colspan="3">ไม่พบข้อมูล</td></tr>';
  }

  function refreshAll() {
    syncUI();
    refreshMapLayers();
    updateComparisonTable();
    updateTrendChart();
    updateRiskChartAndTop();
  }

  function syncUI() {
    $('filter-year-main').value = state.year;
    document.querySelectorAll('.month').forEach(btn => btn.classList.toggle('active', state.months.has(Number(btn.dataset.month))));
    document.querySelectorAll('.preset').forEach(btn => btn.classList.remove('active'));
    const arr = selectedMonthsArray().join(',');
    const preset = arr === C.defaultMonths.join(',') ? 'janmay' : arr === C.banMonths.join(',') ? 'ban' : arr === C.years.join(',') ? '' : '';
    if (state.months.size === 12) document.querySelector('[data-preset="all"]')?.classList.add('active');
    else if (arr === C.defaultMonths.join(',')) document.querySelector('[data-preset="janmay"]')?.classList.add('active');
    $('timeline-status').textContent = `ปี ${state.year} · ${monthText()}`;
    $('filter-district').value = state.district;
    updateSubdistrictOptions();
    $('filter-subdistrict').value = state.subdistrict;
    $('filter-crop').value = state.crop;
    for (const [k,v] of Object.entries(state.show)) { const el = $(`lyr-${k}`); if (el) el.checked = v; }
  }

  function bindEvents() {
    $('filter-year-main').addEventListener('change', e => { state.year = Number(e.target.value); refreshAll(); });
    document.querySelectorAll('.month').forEach(btn => btn.addEventListener('click', () => {
      const m = Number(btn.dataset.month); state.months.has(m) ? state.months.delete(m) : state.months.add(m); refreshAll();
    }));
    document.querySelectorAll('.preset').forEach(btn => btn.addEventListener('click', () => {
      const p = btn.dataset.preset;
      if (p === 'all') state.months = new Set([1,2,3,4,5,6,7,8,9,10,11,12]);
      if (p === 'janmay') state.months = new Set(C.defaultMonths);
      if (p === 'ban') state.months = new Set(C.banMonths);
      if (p === 'clear') state.months = new Set();
      refreshAll();
    }));
    $('filter-district').addEventListener('change', e => { state.district = e.target.value; state.subdistrict=''; refreshAll(); });
    $('filter-subdistrict').addEventListener('change', e => { state.subdistrict = e.target.value; refreshAll(); });
    $('filter-crop').addEventListener('change', e => { state.crop = e.target.value; refreshAll(); });
    $('btn-reset-filter').addEventListener('click', () => { state.year=C.currentYear; state.months=new Set(C.defaultMonths); state.district=''; state.subdistrict=''; state.crop=''; refreshAll(); });
    ['province','district','subdistrict','hotspot','risk','crop','burnscar'].forEach(k => { const el=$(`lyr-${k}`); if (el) el.addEventListener('change', e => {state.show[k]=e.target.checked; refreshAll();}); });
    document.querySelectorAll('input[name="basemap"]').forEach(r => r.addEventListener('change', e => { if(!e.target.checked) return; map.removeLayer(layers.base[state.basemap]); state.basemap=e.target.value; layers.base[state.basemap].addTo(map); }));
    $('detail-close').addEventListener('click', () => $('detail-panel').classList.add('hidden'));
    $('btn-print').addEventListener('click', () => { setTimeout(()=>map.invalidateSize(),50); window.print(); });
    $('btn-admin-login').addEventListener('click', () => alert('ระบบ Login/นำเข้า Excel สามารถต่อเพิ่มได้จากเวอร์ชัน Admin เดิม โดยไม่กระทบระบบแสดงผลหลัก'));
    bindMobile();
  }

  function bindMobile() {
    const left=$('left-panel'), right=$('right-panel'), overlay=$('mobile-overlay');
    function close(){left.classList.remove('mobile-open');right.classList.remove('mobile-open');overlay.hidden=true;setTimeout(()=>map.invalidateSize(),200)}
    $('mobile-toggle-layers').addEventListener('click',()=>{right.classList.remove('mobile-open');left.classList.toggle('mobile-open');overlay.hidden=!left.classList.contains('mobile-open');});
    $('mobile-toggle-dashboard').addEventListener('click',()=>{left.classList.remove('mobile-open');right.classList.toggle('mobile-open');overlay.hidden=!right.classList.contains('mobile-open');});
    overlay.addEventListener('click',close);
    window.addEventListener('resize',()=>setTimeout(()=>map.invalidateSize(),100));
  }

  function initVisitorCounter() {
    const key='agri-risk-visitor-count';
    const n=(Number(localStorage.getItem(key)||0)+1); localStorage.setItem(key,String(n)); $('visitor-count').textContent=fmt(n);
  }

  async function init() {
    try {
      initVisitorCounter();
      initMap();
      await loadAllData();
      fillAreaFilters();
      bindEvents();
      refreshAll();
    } catch (err) {
      console.error(err);
      alert('โหลดระบบไม่สำเร็จ: ' + err.message);
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
