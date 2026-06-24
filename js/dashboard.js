const Dashboard=(()=>{
  const charts={}, store={}; let state={district:'',subdistrict:'',crop:''};
  const H=()=>MapModule.helpers;
  function init(){
    charts.trend=new Chart(document.getElementById('chart-trend'),{type:'bar',data:{labels:[],datasets:[{label:'Hotspot',data:[],backgroundColor:[]}]},options:opts()});
    charts.top=new Chart(document.getElementById('chart-top-district'),{type:'bar',data:{labels:[],datasets:[{label:'Hotspot',data:[],backgroundColor:'#38bdf8'}]},options:{...opts(),indexAxis:'y'}});
    charts.crop=new Chart(document.getElementById('chart-crop'),{type:'doughnut',data:{labels:[],datasets:[{data:[]}]},options:opts(true)});
    charts.risk=new Chart(document.getElementById('chart-risk'),{type:'doughnut',data:{labels:CONFIG.RISK_LEVELS.map(x=>x.label),datasets:[{data:[0,0,0,0],backgroundColor:CONFIG.RISK_LEVELS.map(x=>x.color)}]},options:opts(true)});
    document.getElementById('last-updated').textContent='อัปเดต: '+new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
  }
  function opts(legend=false){return{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:legend,position:'right',labels:{color:'#8aaccc'}},tooltip:{backgroundColor:'#0d2137'}},scales:legend?{}:{x:{ticks:{color:'#6a8faa'},grid:{color:'#1e3a52'}},y:{ticks:{color:'#6a8faa'},grid:{color:'#1e3a52'}}}};}
  function setData(hotspot){Object.assign(store,hotspot);refresh();}
  function applyFilter(s){state={...state,...s};refresh();}
  function selected(){return Object.values(store).flatMap(fc=>fc.features||[]).filter(f=>{const p=f.properties||{};return p.__province==='กำแพงเพชร'&&(!state.district||p.__district===state.district)&&(!state.subdistrict||p.__subdistrict===state.subdistrict)&&(!state.crop||p.__crop===state.crop);});}
  function refresh(){
    const fs=selected(), years=Object.keys(store).sort();
    charts.trend.data.labels=years;charts.trend.data.datasets[0].data=years.map(y=>(store[y].features||[]).filter(f=>fs.includes(f)).length);charts.trend.data.datasets[0].backgroundColor=years.map(y=>CONFIG.YEAR_COLORS[y]||'#38bdf8');charts.trend.update('none');
    const unit=state.district?'__subdistrict':'__district', counts=countBy(fs,unit), ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    charts.top.data.labels=ranked.slice(0,5).map(x=>x[0]);charts.top.data.datasets[0].data=ranked.slice(0,5).map(x=>x[1]);charts.top.update('none');
    const crops=countBy(fs,'__crop');charts.crop.data.labels=Object.keys(crops);charts.crop.data.datasets[0].data=Object.values(crops);charts.crop.update('none');
    const risk=[0,0,0,0];ranked.forEach(([,n])=>{const score=scoreFromCount(n,ranked.map(x=>x[1]));const idx=CONFIG.RISK_LEVELS.findIndex(x=>score>=x.min&&score<x.max);risk[Math.max(idx,0)]++;});charts.risk.data.datasets[0].data=risk;charts.risk.update('none');
    document.getElementById('card-total').textContent=fs.length.toLocaleString('th-TH');document.getElementById('card-provinces').textContent=new Set(fs.map(f=>f.properties.__district).filter(Boolean)).size;document.getElementById('card-high-risk').textContent=(risk[2]+risk[3]).toLocaleString('th-TH');
    const tbody=document.querySelector('#tbl-top-district tbody');tbody.innerHTML='';ranked.slice(0,10).forEach(([name,n])=>{const score=scoreFromCount(n,ranked.map(x=>x[1])),level=MapModule.getRiskLevel(score),tr=document.createElement('tr');tr.innerHTML=`<td>${name||'ไม่ระบุ'}</td><td>${state.district?'อ.'+state.district:'กำแพงเพชร'}</td><td>${n.toLocaleString('th-TH')}</td><td><span class="risk-badge ${level.class}">${level.label}</span></td>`;tbody.appendChild(tr);});
    updateTitles();
  }
  function countBy(fs,key){const o={};fs.forEach(f=>{const k=f.properties?.[key]||'ไม่ระบุ';o[k]=(o[k]||0)+1;});return o;}
  function scoreFromCount(n,all){const max=Math.max(...all,1);return Math.min(100,n/max*100);}
  function updateTitles(){const scope=state.subdistrict?`ตำบล${state.subdistrict} อำเภอ${state.district}`:state.district?`อำเภอ${state.district}`:'จังหวัดกำแพงเพชร';const unit=state.district?'ตำบล':'อำเภอ';document.getElementById('scope-caption').textContent=`ขอบเขตวิเคราะห์: ${scope}${state.crop?' | พืช: '+state.crop:''}`;document.getElementById('title-trend').textContent=`Hotspot รายปี (Trend) - ${scope}`;document.getElementById('title-top5').textContent=`Top 5 ${unit} - ${scope}`;document.getElementById('title-top10').textContent=`Top 10 ${unit} (Hotspot สูงสุด) - ${scope}`;document.getElementById('rank-area-header').textContent=unit;document.getElementById('title-crop').textContent=`ประเภทพืช - ${scope}`;}
  return{init,setData,applyFilter,refresh};
})();
