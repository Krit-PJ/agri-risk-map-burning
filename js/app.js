const App=(()=>{
  let subdistrictFeatures=[];
  let lastImported=null;
  const ADMIN_SESSION_KEY='agri-risk-admin-session';
  const ADMIN_CREDENTIAL_HASH='c8e1f70c7abe021cf605303463b617d548d63e251f3fb1d9ae566470086b7603';
  const ADMIN_SESSION_MINUTES=30;

  async function init(){
    const loaded=await MapModule.init();
    subdistrictFeatures=loaded.subdistrict?.features||[];
    populateDistricts();
    try{Dashboard.init();Dashboard.setData(loaded.hotspot);}catch(err){console.error('[Dashboard] initialization failed:',err);showRuntimeWarning('กราฟโหลดไม่สำเร็จ แต่แผนที่และตัวกรองยังใช้งานได้');}
    bindFilters();bindPrint();initAdminAccess();bindExcelImport();initVisitorCounter();initMobilePanels();initTimeline();syncYearSelector();populateDayOptions();syncTimelineUI();applyCurrent();
  }
  function showRuntimeWarning(message){let el=document.getElementById('runtime-warning');if(!el){el=document.createElement('div');el.id='runtime-warning';el.style.cssText='position:fixed;left:50%;top:86px;transform:translateX(-50%);z-index:9999;background:#7f1d1d;color:white;padding:8px 14px;border-radius:6px;font-size:14px;box-shadow:0 4px 15px rgba(0,0,0,.35)';document.body.appendChild(el);}el.textContent=message;}
  function populateDistricts(){const sel=document.getElementById('filter-district'),current=sel.value;const districts=[...new Set(subdistrictFeatures.map(f=>MapModule.helpers.districtOf(f.properties)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));sel.innerHTML='<option value="">-- ทั้งหมด --</option>'+districts.map(x=>`<option value="${x}">${x}</option>`).join('');sel.value=current;}
  function populateSubdistricts(){const d=document.getElementById('filter-district').value,sel=document.getElementById('filter-subdistrict');const names=[...new Set(subdistrictFeatures.filter(f=>MapModule.helpers.districtOf(f.properties)===d).map(f=>MapModule.helpers.subdistrictOf(f.properties)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));sel.innerHTML=d?'<option value="">-- ทุกตำบล --</option>'+names.map(x=>`<option value="${x}">${x}</option>`).join(''):'<option value="">-- เลือกอำเภอก่อน --</option>';sel.disabled=!d;}
  function selectedMonths(){
    return [...document.querySelectorAll('#hotspot-timeline .timeline-track [data-month].active')]
      .map(btn=>Number(btn.dataset.month)).filter(Number.isFinite).sort((a,b)=>a-b);
  }
  function setSelectedMonths(months){
    const wanted=new Set((months||[]).map(Number).filter(Number.isFinite));
    document.querySelectorAll('#hotspot-timeline .timeline-track [data-month]').forEach(btn=>{
      const active=wanted.has(Number(btn.dataset.month));
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    document.querySelector('#hotspot-timeline .timeline-all')?.classList.toggle('active',wanted.size===0);
    document.querySelector('#hotspot-timeline .timeline-all')?.setAttribute('aria-pressed',String(wanted.size===0));
    const monthSelect=document.getElementById('filter-month');
    if(monthSelect){[...monthSelect.options].forEach(opt=>{opt.selected=wanted.has(Number(opt.value));});}
  }
  function current(){return{
    district:document.getElementById('filter-district').value,
    subdistrict:document.getElementById('filter-subdistrict').value,
    crop:document.getElementById('filter-crop').value,
    months:selectedMonths(),
    day:document.getElementById('filter-day')?.value||''
  };}
  function selectedYear(){return document.getElementById('timeline-year')?.value||document.getElementById('filter-year')?.value||String(CONFIG.CURRENT_YEAR_BE||2569);}
  function ensureYearDropdown(){
    const sel=document.getElementById('timeline-year');if(!sel)return;
    if(sel.options && sel.options.length>0)return;
    const years=(sel.dataset.years||'2566,2567,2568,2569').split(',').map(x=>x.trim()).filter(Boolean);
    const current=String(CONFIG.CURRENT_YEAR_BE||2569);
    sel.innerHTML=years.map(y=>`<option value="${y}"${String(y)===current?' selected':''}>${y}</option>`).join('');
  }
  function syncYearSelector(){
    ensureYearDropdown();
    const year=selectedYear();
    const hidden=document.getElementById('filter-year');if(hidden)hidden.value=year;
    document.querySelectorAll('.hs-layer').forEach(cb=>{cb.checked=String(cb.dataset.year)===String(year);});
    const chip=document.getElementById('selected-year-display');if(chip)chip.textContent=`ชุดข้อมูลปี ${year}`;
    syncTimelineUI();
  }
  function applyYearSelector(){
    syncYearSelector();
    populateDayOptions();
    applyCurrent();
    document.dispatchEvent(new CustomEvent('agri-risk:years-changed',{detail:{years:MapModule.activeYears(),source:'timeline-year'}}));
  }
  function populateDayOptions(){
    const daySel=document.getElementById('filter-day');if(!daySel)return;
    const months=selectedMonths(),currentDay=daySel.value;
    if(!months.length){daySel.innerHTML='<option value="">-- ไม่ใช้ตัวกรองวันที่ --</option>';daySel.disabled=true;return;}
    const days=MapModule.availableDays(MapModule.activeYears(),months);
    daySel.innerHTML='<option value="">-- ทุกวันที่ --</option>'+days.map(d=>`<option value="${d}">${d}</option>`).join('');
    daySel.disabled=false;if(days.includes(Number(currentDay)))daySel.value=currentDay;
  }
  function initTimeline(){
    ensureYearDropdown();
    const year=document.getElementById('timeline-year');
    year?.addEventListener('change',applyYearSelector);
    document.querySelector('#hotspot-timeline .timeline-all')?.addEventListener('click',()=>{
      setSelectedMonths([]);const day=document.getElementById('filter-day');if(day)day.value='';populateDayOptions();syncTimelineUI();applyCurrent();
    });
    document.querySelectorAll('#hotspot-timeline .timeline-track [data-month]').forEach(btn=>btn.addEventListener('click',()=>{
      btn.classList.toggle('active');
      btn.setAttribute('aria-pressed',String(btn.classList.contains('active')));
      document.querySelector('#hotspot-timeline .timeline-all')?.classList.toggle('active',selectedMonths().length===0);
      document.querySelector('#hotspot-timeline .timeline-all')?.setAttribute('aria-pressed',String(selectedMonths().length===0));
      const day=document.getElementById('filter-day');if(day)day.value='';populateDayOptions();syncTimelineUI();applyCurrent();
    }));
    document.querySelectorAll('#hotspot-timeline [data-preset]').forEach(btn=>btn.addEventListener('click',()=>{
      const preset=btn.dataset.preset;
      setSelectedMonths([]);
      const day=document.getElementById('filter-day');if(day)day.value='';populateDayOptions();syncTimelineUI();applyCurrent();
    }));
  }
  function monthText(months){
    const names=['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    if(!months.length)return'สะสมทุกเดือน';
    const sorted=[...months].sort((a,b)=>a-b);
    const isJanMay=sorted.length===5&&sorted.every((m,i)=>m===i+1);
        if(sorted.length===1)return names[sorted[0]];
    return sorted.map(m=>names[m].replace('มกราคม','ม.ค.').replace('กุมภาพันธ์','ก.พ.').replace('มีนาคม','มี.ค.').replace('เมษายน','เม.ย.').replace('พฤษภาคม','พ.ค.').replace('มิถุนายน','มิ.ย.').replace('กรกฎาคม','ก.ค.').replace('สิงหาคม','ส.ค.').replace('กันยายน','ก.ย.').replace('ตุลาคม','ต.ค.').replace('พฤศจิกายน','พ.ย.').replace('ธันวาคม','ธ.ค.')).join(', ');
  }
  function syncTimelineUI(){
    const year=selectedYear();
    const timelineYear=document.getElementById('timeline-year');if(timelineYear&&year)timelineYear.value=year;
    const months=selectedMonths();
    document.querySelector('#hotspot-timeline .timeline-all')?.classList.toggle('active',months.length===0);
    document.querySelector('#hotspot-timeline .timeline-all')?.setAttribute('aria-pressed',String(months.length===0));
    const day=document.getElementById('filter-day')?.value||'';
    const status=document.getElementById('timeline-status');if(status)status.textContent=`จุดความร้อนสะสมรายเดือน ปี ${year||'-'}: ${monthText(months)}${day?' · วันที่ '+day:''}`;
    const chip=document.getElementById('selected-year-display');if(chip)chip.textContent=`ชุดข้อมูลปี ${year}`;
    updatePrintMeta();
  }
  function scopeText(){
    const d=document.getElementById('filter-district')?.value||'';
    const t=document.getElementById('filter-subdistrict')?.value||'';
    if(t&&d)return `ตำบล${t} อำเภอ${d}`;
    if(d)return `อำเภอ${d}`;
    return 'จังหวัดกำแพงเพชร';
  }
  function updatePrintMeta(){
    const year=selectedYear();
    const months=selectedMonths();
    const day=document.getElementById('filter-day')?.value||'';
    const period=`ชุดข้อมูลปี ${year} · จุดความร้อนสะสมรายเดือน: ${monthText(months)}${day?' · วันที่ '+day:''}`;
    const printSummary=document.getElementById('print-filter-summary');if(printSummary)printSummary.textContent=period;
    const printScope=document.getElementById('print-scope');if(printScope)printScope.textContent=`ขอบเขต: ${scopeText()}`;
    const printDate=document.getElementById('print-date');if(printDate)printDate.textContent='วันที่พิมพ์รายงาน: '+new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
    const updated=document.getElementById('last-updated')?.textContent||'';
    const printUpdated=document.getElementById('print-data-updated');if(printUpdated)printUpdated.textContent=updated||'ข้อมูลล่าสุด: -';
  }
  function applyCurrent(){const s=current();syncTimelineUI();MapModule.applyFilter(s);try{Dashboard.applyFilter(s);}catch(err){console.warn('[Dashboard] filter skipped:',err.message);}}
  function bindFilters(){
    const d=document.getElementById('filter-district'),t=document.getElementById('filter-subdistrict'),c=document.getElementById('filter-crop'),cropLayer=document.getElementById('lyr-crop');
    const day=document.getElementById('filter-day');
    d.addEventListener('change',()=>{populateSubdistricts();applyCurrent();});t.addEventListener('change',applyCurrent);c.addEventListener('change',applyCurrent);
    day?.addEventListener('change',()=>{syncTimelineUI();applyCurrent();});
    document.addEventListener('change',e=>{if(e.target?.classList?.contains('hs-layer')){syncYearSelector();populateDayOptions();}});
    cropLayer.addEventListener('change',()=>{c.disabled=!cropLayer.checked;if(!cropLayer.checked)c.value='';applyCurrent();});
    document.getElementById('btn-apply-filter').addEventListener('click',applyCurrent);
    document.getElementById('btn-reset-filter')?.addEventListener('click',()=>resetFilters());
  }
  function resetFilters(){
    const d=document.getElementById('filter-district'),t=document.getElementById('filter-subdistrict'),c=document.getElementById('filter-crop');
    if(d)d.value='';populateSubdistricts();
    if(t){t.value='';t.disabled=true;t.innerHTML='<option value="">-- เลือกอำเภอก่อน --</option>';}
    if(c)c.value='';
    const cropLayer=document.getElementById('lyr-crop');
    if(cropLayer&&!cropLayer.checked&&c)c.disabled=true;
    const year=String(CONFIG.CURRENT_YEAR_BE||2569);
    const timelineYear=document.getElementById('timeline-year');if(timelineYear)timelineYear.value=year;
    const hiddenYear=document.getElementById('filter-year');if(hiddenYear)hiddenYear.value=year;
    setSelectedMonths([]);
    const day=document.getElementById('filter-day');
    if(day){day.value='';day.disabled=true;day.innerHTML='<option value="">-- ไม่ใช้ตัวกรองวันที่ --</option>';}
    syncYearSelector();syncTimelineUI();applyCurrent();
    document.dispatchEvent(new CustomEvent('agri-risk:years-changed',{detail:{years:MapModule.activeYears(),source:'reset'}}));
    document.dispatchEvent(new CustomEvent('agri-risk:filter-change',{detail:{source:'reset'}}));
  }

  function bindPrint(){
    const prepare=()=>{
      updatePrintMeta();
      document.body.classList.add('print-preparing');
      try{Dashboard.setPrintMode?.(true);}catch(err){console.warn('[Print] chart contrast:',err.message);}
      const refit=()=>{
        const map=MapModule.map?.();
        if(!map)return;
        map.invalidateSize({pan:false});
        MapModule.focusSelection?.({padding:[10,10],maxZoom:12});
      };
      refit();
      [120,320,650].forEach(ms=>setTimeout(refit,ms));
    };
    const restore=()=>{
      document.body.classList.remove('print-preparing');
      try{Dashboard.setPrintMode?.(false);}catch(err){console.warn('[Print] chart restore:',err.message);}
      setTimeout(()=>{MapModule.map()?.invalidateSize({pan:false});MapModule.focusSelection?.({padding:[20,20]});},180);
    };
    window.addEventListener('beforeprint',prepare);
    window.addEventListener('afterprint',restore);
    document.getElementById('btn-print')?.addEventListener('click',()=>{prepare();setTimeout(()=>window.print(),850);});
  }

  function initAdminAccess(){
    const loginBtn=document.getElementById('btn-admin-login');
    const logoutBtn=document.getElementById('btn-admin-logout');
    const modal=document.getElementById('admin-modal');
    const closeBtn=document.getElementById('admin-modal-close');
    const cancelBtn=document.getElementById('admin-cancel');
    const form=document.getElementById('admin-login-form');
    loginBtn?.addEventListener('click',()=>openAdminModal());
    logoutBtn?.addEventListener('click',adminLogout);
    closeBtn?.addEventListener('click',closeAdminModal);
    cancelBtn?.addEventListener('click',closeAdminModal);
    modal?.addEventListener('click',event=>{if(event.target===modal)closeAdminModal();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAdminModal();});
    form?.addEventListener('submit',adminLogin);
    updateAdminUI();
  }
  function isAdminAuthenticated(){
    try{
      const raw=sessionStorage.getItem(ADMIN_SESSION_KEY);if(!raw)return false;
      const session=JSON.parse(raw);if(!session?.expiresAt||Date.now()>session.expiresAt){sessionStorage.removeItem(ADMIN_SESSION_KEY);return false;}
      return session.role==='admin';
    }catch{return false;}
  }
  function touchAdminSession(){
    if(!isAdminAuthenticated())return;
    sessionStorage.setItem(ADMIN_SESSION_KEY,JSON.stringify({role:'admin',expiresAt:Date.now()+ADMIN_SESSION_MINUTES*60*1000}));
  }
  async function adminLogin(event){
    event.preventDefault();
    const username=String(document.getElementById('admin-username')?.value||'').trim().toLowerCase();
    const password=String(document.getElementById('admin-password')?.value||'');
    const status=document.getElementById('admin-login-status');
    if(status){status.textContent='กำลังตรวจสอบ…';status.className='admin-login-status working';}
    const hash=await sha256(`${username}:${password}`);
    if(hash!==ADMIN_CREDENTIAL_HASH){
      if(status){status.textContent='ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';status.className='admin-login-status error';}
      return;
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY,JSON.stringify({role:'admin',expiresAt:Date.now()+ADMIN_SESSION_MINUTES*60*1000}));
    if(status){status.textContent='เข้าสู่ระบบสำเร็จ';status.className='admin-login-status success';}
    document.getElementById('admin-login-form')?.reset();
    updateAdminUI();
    setTimeout(closeAdminModal,350);
  }
  function adminLogout(){
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    lastImported=null;
    const dl=document.getElementById('btn-download-import');if(dl)dl.disabled=true;
    updateAdminUI();
  }
  function updateAdminUI(){
    const authenticated=isAdminAuthenticated();
    const section=document.getElementById('excel-import-section');
    const loginBtn=document.getElementById('btn-admin-login');
    const logoutBtn=document.getElementById('btn-admin-logout');
    section?.classList.toggle('hidden',!authenticated);
    section?.setAttribute('aria-hidden',String(!authenticated));
    loginBtn?.classList.toggle('hidden',authenticated);
    logoutBtn?.classList.toggle('hidden',!authenticated);
    if(authenticated)touchAdminSession();
  }
  function openAdminModal(message=''){
    const modal=document.getElementById('admin-modal');
    const status=document.getElementById('admin-login-status');
    if(status){status.textContent=message;status.className='admin-login-status';}
    modal?.classList.remove('hidden');
    setTimeout(()=>document.getElementById('admin-username')?.focus(),0);
  }
  function closeAdminModal(){document.getElementById('admin-modal')?.classList.add('hidden');}
  async function sha256(text){
    const data=new TextEncoder().encode(text);
    const digest=await crypto.subtle.digest('SHA-256',data);
    return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }

  function bindExcelImport(){
    const btn=document.getElementById('btn-import-excel'), dl=document.getElementById('btn-download-import');
    btn?.addEventListener('click',importExcel);
    dl?.addEventListener('click',downloadImportedGeoJSON);
  }
  async function importExcel(){
    if(!isAdminAuthenticated()){openAdminModal('กรุณาเข้าสู่ระบบผู้ดูแลก่อนนำเข้าข้อมูล');return;}
    touchAdminSession();
    const file=document.getElementById('import-excel')?.files?.[0], yearBE=Number(document.getElementById('import-year')?.value), status=document.getElementById('import-status');
    if(!file){setStatus('กรุณาเลือกไฟล์ Excel','error');return;}
    if(!Number.isInteger(yearBE)||yearBE<2566){setStatus('กรุณาระบุปี พ.ศ. ให้ถูกต้อง','error');return;}
    if(!window.XLSX){setStatus('ไม่สามารถโหลดไลบรารีอ่าน Excel ได้','error');return;}
    setStatus('กำลังอ่านและตรวจสอบข้อมูล…','working');
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const detail=findDetailTable(wb);
      if(!detail)throw new Error('ไม่พบตารางรายละเอียดที่มีคอลัมน์ hsID, Date, Province และ LandType');
      const result=rowsToGeoJSON(detail.rows,detail.headers,yearBE);
      if(!result.features.length)throw new Error(`ไม่พบข้อมูลจังหวัดกำแพงเพชร พื้นที่เกษตร ปี ${yearBE}`);
      const checkbox=ensureYearCheckbox(yearBE);
      checkbox.checked=true;
      MapModule.importHotspots(yearBE,result);
      Dashboard.setYearData(yearBE,result);
      document.dispatchEvent(new CustomEvent('agri-risk:years-changed',{detail:{years:MapModule.activeYears()}}));
      lastImported={year:yearBE,geojson:result,fileName:`hotspot_${yearBE}.geojson`};
      document.getElementById('btn-download-import').disabled=false;
      const qa=result.metadata?.qa||{};
      setStatus(`นำเข้าสำเร็จ ${result.features.length.toLocaleString('th-TH')} จุด | ซ้ำที่ตัดออก ${qa.duplicates||0} | ไม่มีพิกัด ${qa.noCoordinates||0}`,'success');
    }catch(err){console.error(err);setStatus(`นำเข้าไม่สำเร็จ: ${err.message}`,'error');}
  }
  function findDetailTable(wb){
    for(const name of wb.SheetNames){
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:false,dateNF:'yyyy-mm-dd'});
      for(let i=0;i<rows.length;i++){
        const headers=(rows[i]||[]).map(v=>String(v??'').trim());
        const required=['hsID','Date','Province','LandType'];
        if(required.every(k=>headers.includes(k)))return{sheet:name,headers,rows:rows.slice(i+1)};
      }
    }
    return null;
  }
  function rowsToGeoJSON(rows,headers,yearBE){
    const idx=Object.fromEntries(headers.map((h,i)=>[h,i])), yearAD=yearBE-543, seen=new Set();
    let duplicates=0,noCoordinates=0,wrongProvince=0,wrongLand=0,wrongDate=0;
    const features=[];
    for(const row of rows){
      if(!row||row.every(v=>v===null||v===''))continue;
      const get=k=>row[idx[k]];
      const province=String(get('Province')??get('ProvinceN')??'').trim();
      if(province!=='กำแพงเพชร'){wrongProvince++;continue;}
      if(String(get('LandType')??'').trim()!=='พื้นที่เกษตร'){wrongLand++;continue;}
      const dt=parseExcelDate(get('Date'));
      if(!dt||dt.getFullYear()!==yearAD||dt.getMonth()<0||dt.getMonth()>4){wrongDate++;continue;}
      const hsId=String(get('hsID')??'').trim();
      if(hsId&&seen.has(hsId)){duplicates++;continue;} if(hsId)seen.add(hsId);
      const coord=extractCoordinates(get('Maps'),get('X'),get('Y'),get('Q'));
      if(!coord){noCoordinates++;continue;}
      const point={type:'Feature',geometry:{type:'Point',coordinates:coord},properties:{hs_id:hsId,year_be:yearBE,date:dt.toISOString().slice(0,10),time:String(get('Time')??''),province:'กำแพงเพชร',district:String(get('Amphoe')??get('AmphoeN')??'').trim(),subdistrict:String(get('Tambon')??get('TambonN')??'').trim(),land_type:'พื้นที่เกษตร',crop_type:MapModule.helpers.normalizeCrop(get('PlantType')),confidence:Number(get('Q'))||null,source:'NASA FIRMS VIIRS / Excel import'}};
      const hit=(MapModule.getData().subdistrict?.features||[]).find(poly=>{try{return turf.booleanPointInPolygon(point,poly);}catch{return false;}});
      if(hit){point.properties.district=MapModule.helpers.districtOf(hit.properties);point.properties.subdistrict=MapModule.helpers.subdistrictOf(hit.properties);}
      features.push(point);
    }
    return{type:'FeatureCollection',name:`hotspot_${yearBE}_imported`,metadata:{province:'กำแพงเพชร',scope:'พื้นที่เกษตร',period:`${yearAD}-01-01/${yearAD}-05-31`,qa:{inputRows:rows.length,accepted:features.length,duplicates,noCoordinates,wrongProvince,wrongLand,wrongDate}},features};
  }
  function parseExcelDate(v){
    if(v instanceof Date&&!Number.isNaN(v))return v;
    if(typeof v==='number'&&window.XLSX?.SSF){const p=XLSX.SSF.parse_date_code(v);if(p)return new Date(p.y,p.m-1,p.d);}
    if(typeof v==='string'){
      const s=v.trim(); let d=new Date(s); if(!Number.isNaN(d))return d;
      const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m){let y=Number(m[3]);if(y>2400)y-=543;return new Date(y,Number(m[2])-1,Number(m[1]));}
    }
    return null;
  }
  function extractCoordinates(maps,x,y,zone){
    const m=String(maps||'').match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
    if(m)return[Number(m[2]),Number(m[1])];
    const east=Number(x),north=Number(y),z=Number(zone)||47;
    if(Number.isFinite(east)&&Number.isFinite(north)&&window.proj4){try{return proj4(`+proj=utm +zone=${z} +datum=WGS84 +units=m +no_defs`,'EPSG:4326',[east,north]);}catch{}}
    return null;
  }
  function ensureYearCheckbox(year){
    let cb=document.querySelector(`.hs-layer[data-year="${year}"]`);if(cb)return cb;
    const yearSelect=document.getElementById('filter-year');if(yearSelect&&!yearSelect.querySelector(`option[value="${year}"]`)){const opt=document.createElement('option');opt.value=String(year);opt.textContent=`${year} (${year-543})`;yearSelect.appendChild(opt);}
    const group=document.querySelector('.hs-layer')?.closest('.layer-group');
    const label=document.createElement('label');label.className=`toggle-row hs-${year}`;label.style.borderLeft=`3px solid ${CONFIG.YEAR_COLORS[year]||'#14b8a6'}`;
    label.innerHTML=`<input type="checkbox" class="hs-layer" data-year="${year}"> ปี ${year} (${year-543})`;
    group?.appendChild(label);cb=label.querySelector('input');
    if(!CONFIG.YEAR_COLORS[year]){const d=Math.max(0,(CONFIG.CURRENT_YEAR_BE||year)-year);CONFIG.YEAR_COLORS[year]=(CONFIG.YEAR_COLOR_FALLBACK||[])[d]||'#14b8a6';label.style.borderLeft=`3px solid ${CONFIG.YEAR_COLORS[year]}`;}
    return cb;
  }
  function downloadImportedGeoJSON(){if(!lastImported)return;const blob=new Blob([JSON.stringify(lastImported.geojson,null,2)],{type:'application/geo+json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=lastImported.fileName;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function setStatus(text,type){const el=document.getElementById('import-status');if(!el)return;el.textContent=text;el.className=`import-status ${type||''}`;}



  function initMobilePanels(){
    const left=document.getElementById('left-panel');
    const right=document.getElementById('right-panel');
    const overlay=document.getElementById('mobile-overlay');
    const btnLeft=document.getElementById('mobile-toggle-layers');
    const btnRight=document.getElementById('mobile-toggle-dashboard');
    if(!left||!right||!overlay||!btnLeft||!btnRight)return;
    const closeAll=()=>{
      left.classList.remove('mobile-open');right.classList.remove('mobile-open');overlay.hidden=true;
      btnLeft.setAttribute('aria-expanded','false');btnRight.setAttribute('aria-expanded','false');
      setTimeout(()=>MapModule.map()?.invalidateSize?.(),260);
    };
    const openPanel=(panel,button)=>{
      const wasOpen=panel.classList.contains('mobile-open');closeAll();
      if(!wasOpen){panel.classList.add('mobile-open');overlay.hidden=false;button.setAttribute('aria-expanded','true');}
    };
    btnLeft.addEventListener('click',()=>openPanel(left,btnLeft));
    btnRight.addEventListener('click',()=>openPanel(right,btnRight));
    overlay.addEventListener('click',closeAll);
    window.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();});
    window.addEventListener('resize',()=>{if(window.innerWidth>768)closeAll();setTimeout(()=>MapModule.map()?.invalidateSize?.(),120);});
    document.addEventListener('agri-risk:filter-change',()=>{if(window.innerWidth<=768)closeAll();});
  }

  async function initVisitorCounter(){
    const fallback=document.getElementById('visitor-counter-fallback');
    const box=document.getElementById('external-counter-box');
    if(!fallback)return;
    const key='agri-risk-pageviews-fallback';
    const local=Number(localStorage.getItem(key)||0)+1;
    localStorage.setItem(key,String(local));
    const fallbackText=local.toLocaleString('th-TH');
    fallback.textContent=fallbackText;
    fallback.classList.add('is-fallback');
    const checkExternal=()=>{
      const raw=String(box?.textContent||'').replace(String(fallback.textContent||''),'').trim();
      const hasExternal=!!(box?.querySelector('img')) || /\d/.test(raw);
      /* Keep the local fallback visible even when the external script is blocked or renders as an image.
         This avoids an empty counter card in privacy-restricted browsers. */
      if(!hasExternal){fallback.textContent=fallbackText;fallback.classList.add('is-fallback');}
    };
    setTimeout(checkExternal,1200);
    setTimeout(checkExternal,3500);
  }
  return{init};
})();
document.addEventListener('DOMContentLoaded',()=>App.init().catch(err=>{console.error('[App] fatal error:',err);const el=document.createElement('div');el.style.cssText='position:fixed;inset:auto 20px 20px 20px;z-index:10000;background:#991b1b;color:#fff;padding:12px;border-radius:8px;font:14px sans-serif';el.textContent='โหลดระบบไม่สำเร็จ: '+err.message;document.body.appendChild(el);}));
