const App=(()=>{
  let subdistrictFeatures=[];
  async function init(){
    // Initialize the map first so a Chart.js failure cannot blank the whole application.
    const loaded=await MapModule.init();
    subdistrictFeatures=loaded.subdistrict?.features||[];
    populateDistricts();

    try {
      Dashboard.init();
      Dashboard.setData(loaded.hotspot);
    } catch (err) {
      console.error('[Dashboard] initialization failed:', err);
      showRuntimeWarning('กราฟโหลดไม่สำเร็จ แต่แผนที่และตัวกรองยังใช้งานได้ กรุณารีเฟรชหน้าเว็บหรือตรวจสอบการเข้าถึง Chart.js CDN');
    }

    bindFilters(); bindPrint(); bindImport();
    applyCurrent();
    console.log('[App] Agri-Risk Map Burning initialized with linked filters');
  }
  function showRuntimeWarning(message){
    let el=document.getElementById('runtime-warning');
    if(!el){el=document.createElement('div');el.id='runtime-warning';el.style.cssText='position:fixed;left:50%;top:86px;transform:translateX(-50%);z-index:9999;background:#7f1d1d;color:white;padding:8px 14px;border-radius:6px;font-size:13px;box-shadow:0 4px 15px rgba(0,0,0,.35)';document.body.appendChild(el);}
    el.textContent=message;
  }
  function populateDistricts(){const sel=document.getElementById('filter-district'),current=sel.value;const districts=[...new Set(subdistrictFeatures.map(f=>MapModule.helpers.districtOf(f.properties)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));sel.innerHTML='<option value="">-- ทั้งหมด --</option>'+districts.map(x=>`<option value="${x}">${x}</option>`).join('');sel.value=current;}
  function populateSubdistricts(){const d=document.getElementById('filter-district').value,sel=document.getElementById('filter-subdistrict');const names=[...new Set(subdistrictFeatures.filter(f=>MapModule.helpers.districtOf(f.properties)===d).map(f=>MapModule.helpers.subdistrictOf(f.properties)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));sel.innerHTML=d?'<option value="">-- ทุกตำบล --</option>'+names.map(x=>`<option value="${x}">${x}</option>`).join(''):'<option value="">-- เลือกอำเภอก่อน --</option>';sel.disabled=!d;}
  function current(){return{province:'กำแพงเพชร',district:document.getElementById('filter-district').value,subdistrict:document.getElementById('filter-subdistrict').value,crop:document.getElementById('filter-crop').value};}
  function applyCurrent(){const s=current();MapModule.applyFilter(s);try{Dashboard.applyFilter(s);}catch(err){console.warn('[Dashboard] filter skipped:',err.message);}}
  function bindFilters(){const d=document.getElementById('filter-district'),t=document.getElementById('filter-subdistrict'),c=document.getElementById('filter-crop'),cropLayer=document.getElementById('lyr-crop');d.addEventListener('change',()=>{populateSubdistricts();applyCurrent();});t.addEventListener('change',applyCurrent);c.addEventListener('change',applyCurrent);cropLayer.addEventListener('change',()=>{c.disabled=!cropLayer.checked;if(!cropLayer.checked)c.value='';applyCurrent();});document.getElementById('btn-apply-filter').addEventListener('click',applyCurrent);document.getElementById('btn-reset-filter').addEventListener('click',()=>{d.value='';populateSubdistricts();t.value='';c.value='';applyCurrent();});}
  function bindPrint(){document.getElementById('btn-print')?.addEventListener('click',()=>{MapModule.map()?.invalidateSize();setTimeout(()=>window.print(),250);});}
  function bindImport(){document.getElementById('btn-import-year')?.addEventListener('click',async()=>{const year=Number(document.getElementById('import-year').value),file=document.getElementById('import-hotspot').files?.[0],status=document.getElementById('import-status');if(!file||!year){status.textContent='กรุณาระบุปีและเลือกไฟล์';return;}try{const gj=JSON.parse(await file.text());if(gj.type!=='FeatureCollection')throw new Error('ต้องเป็น GeoJSON FeatureCollection');CONFIG.DATA.hotspot[year]=URL.createObjectURL(new Blob([JSON.stringify(gj)],{type:'application/json'}));status.textContent=`อ่านข้อมูลปี ${year} แล้ว ${gj.features.length.toLocaleString('th-TH')} รายการ — สำหรับเผยแพร่ถาวร ให้วางไฟล์ใน data/hotspot และเพิ่มปีใน config.js`; }catch(e){status.textContent='นำเข้าไม่สำเร็จ: '+e.message;}});}
  function onBoundaryClick(){} function onHotspotClick(){} function onRiskKptLoaded(){} function onHotspotLoaded(){}
  return{init,onBoundaryClick,onHotspotClick,onRiskKptLoaded,onHotspotLoaded};
})();
document.addEventListener('DOMContentLoaded',()=>App.init().catch(err=>{console.error('[App] fatal error:',err);const msg='โหลดระบบไม่สำเร็จ: '+err.message;const el=document.createElement('div');el.style.cssText='position:fixed;inset:auto 20px 20px 20px;z-index:10000;background:#991b1b;color:#fff;padding:12px;border-radius:8px;font:14px sans-serif';el.textContent=msg;document.body.appendChild(el);}));
