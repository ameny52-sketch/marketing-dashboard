// ===== 키워드 매체 =====
let kwData = [];
let kwFilters = { media: 'all', device: 'all', cat: 'all' };
let kwSortCol = 'db', kwSortAsc = false;
let kwPage = 1;
const KW_PAGE_SIZE = 100;
let kwRendered = false; // 탭 재렌더 방지용

function initKwTab(){
  if(!kwData.length){
    setStatus('데이터를 불러오면 결과가 표시됩니다','');
    document.getElementById('kw-no-data').style.display = 'block';
    document.getElementById('kw-metrics').innerHTML = '';
    document.getElementById('kw-tbody').innerHTML = '';
    kwRendered = false;
    return;
  }
  document.getElementById('kw-no-data').style.display = 'none';

  // 이미 렌더된 경우 재렌더 스킵
  if(kwRendered) return;

  renderKwTable();
}

function setKwFilter(type, val, btn){
  kwFilters[type] = val;
  kwPage = 1;
  const barId = type==='media' ? 'kw-media-tabs' : type==='cat' ? 'kw-cat-tabs' : 'kw-device-tabs';
  document.querySelectorAll(`#${barId} .tab-btn`).forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderKwTable();
}

function getKwFiltered(){
  const q = (document.getElementById('kw-search')?.value||'').toLowerCase();
  const rf = document.getElementById('kw-roas-filter')?.value || 'all';
  const cf = document.getElementById('kw-cpd-filter')?.value || 'all';
  return kwData.filter(r=>{
    const mm = kwFilters.media==='all' || r.sub_media===kwFilters.media;
    const dm = kwFilters.device==='all' || r.device===kwFilters.device;
    const cm = kwFilters.cat==='all' || r.cat===kwFilters.cat;
    const qm = !q || (r.keyword||'').toLowerCase().includes(q) || (r.intype||'').toLowerCase().includes(q) || (r.cat||'').toLowerCase().includes(q);
    let mr = true;
    if(rf==='high') mr = r.roas!==null && r.roas<=300;
    else if(rf==='mid') mr = r.roas!==null && r.roas>300 && r.roas<=1000;
    else if(rf==='low') mr = r.roas!==null && r.roas>1000;
    else if(rf==='na') mr = r.roas===null;
    let mcp = true;
    if(cf==='high') mcp = r.cpd!==null && r.cpd<=50000;
    else if(cf==='mid') mcp = r.cpd!==null && r.cpd>50000 && r.cpd<=100000;
    else if(cf==='low') mcp = r.cpd!==null && r.cpd>100000;
    else if(cf==='nodb') mcp = r.db>0;
    else if(cf==='na') mcp = (r.cost||0)>0 && r.db===0;
    return mm&&dm&&cm&&qm&&mr&&mcp;
  });
}

// 계약수/계약률/평가업적/ROAS는 당월/누적 토글에 따라 다른 값을 보여준다 (KPI카드의 당월/누적 개념과 동일)
const KW_CUM_COLS = ['contracts','cvr','perf','roas'];
let _kwTableCumMode = false;

function setKwTableCumMode(cum, btn){
  _kwTableCumMode = cum;
  document.querySelectorAll('#kw-table-cum-toggle .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderKwTable();
}

function _kwCumVal(r, key){
  if(!_kwTableCumMode) return r[key];
  const contracts = r.contracts_cum ?? r.contracts ?? 0;
  const perf = r.perf_cum ?? r.perf ?? 0;
  if(key==='contracts') return contracts;
  if(key==='perf') return perf;
  if(key==='cvr') return r.db>0 ? Math.round(contracts/r.db*1000)/10 : null;
  if(key==='roas') return (r.cost>0 && perf>0) ? Math.round(r.cost/perf*100) : null;
  return r[key];
}

function renderKwTable(){
  const rows = getKwFiltered();
  rows.forEach(r=>{
    r.cpc = (r.clicks>0 && r.cost!=null) ? Math.round(r.cost/r.clicks) : null;
    r.dbcvr = r.clicks>0 ? Math.round(r.db/r.clicks*1000)/10 : null;
  });
  const sorted = [...rows].sort((a,b)=>{
    let va=KW_CUM_COLS.includes(kwSortCol)?_kwCumVal(a,kwSortCol):a[kwSortCol];
    let vb=KW_CUM_COLS.includes(kwSortCol)?_kwCumVal(b,kwSortCol):b[kwSortCol];
    // ROAS / DB단가 / 평균CPC / DB전환율은 값이 없거나 0이면 정렬에서 제외 (항상 맨 뒤)
    if(kwSortCol==='roas' || kwSortCol==='cpd' || kwSortCol==='cpc' || kwSortCol==='dbcvr'){
      const ea = va==null||va===0, eb = vb==null||vb===0;
      if(ea && eb) return 0;
      if(ea) return 1;
      if(eb) return -1;
      return kwSortAsc ? va-vb : vb-va;
    }
    if(va==null) va=-1; if(vb==null) vb=-1;
    if(typeof va==='string') return kwSortAsc?va.localeCompare(vb,'ko'):vb.localeCompare(va,'ko');
    return kwSortAsc?va-vb:vb-va;
  });

  // 정렬된 데이터 저장 (드릴다운용 + 성과 진단용)
  window.kwSortedData = sorted;
  window.kwData = rows;  // 성과 진단에서 사용
  renderKwChart(rows);

  document.getElementById('kw-row-count').textContent = rows.length+'개';

  // 요약 지표
  const totalDb = rows.reduce((s,r)=>s+r.db,0);
  // 총 광고비/DB단가 계산
  const totalCost = rows.reduce((s,r)=>s+(r.cost||0),0);
  const avgCpd = totalDb>0 && totalCost>0 ? Math.round(totalCost/totalDb) : null;
  const mc = _calcMonCum(rows.map(r=>({
    ...r,
    performance: r.performance ?? r.perf ?? 0,
    performance_cum: r.performance_cum ?? r.perf_cum ?? 0,
    cost: r.cost || 0
  })));

  {
    const cid='kw-metrics';
    document.getElementById(cid).innerHTML = [
      _kpiCard(cid,0,'총 광고비', totalCost>0?totalCost:null, {unit:'원', color:'default', sub:'키워드 매체 기준'}),
      _kpiCard(cid,1,'총 DB수', totalDb, {unit:'건', color:'accent', sub:'매칭 DB'}),
      _kpiCard(cid,2,'DB단가', avgCpd, {unit:'원', color:'purple', sub:'광고비 ÷ DB수'}),
      _kpiCard(cid,3,'계약수', mc.mCon, {unit:'건', color:'green', subVal:mc.hasCum?mc.cCon:null, subUnit:'건'}),
      _kpiCard(cid,4,'계약률', mc.mCvr!==null?Number(mc.mCvr):null, {unit:'%', decimals:1, color:'green', subVal:(mc.hasCum&&mc.cCvr!==null)?Number(mc.cCvr):null, subUnit:'%'}),
      _kpiCard(cid,5,'평가업적', mc.mPerf>0?Math.round(mc.mPerf):null, {unit:'원', color:'amber', subVal:(mc.hasCum&&mc.cPerf>0)?Math.round(mc.cPerf):null, subUnit:'원'}),
      _kpiCard(cid,6,'ROAS', mc.mRoas, {unit:'%', color:'amber', subVal:mc.hasCum?mc.cRoas:null, subUnit:'%'}),
      _kpiCard(cid,7,'키워드 수', rows.length, {unit:'개', color:'accent', sub:'운영 키워드'}),
    ].join('');
    _kpiFinish(cid);
  }

  // 헤더 (정렬 변경시만 다시 그림)
  const cols = [
    {key:'keyword',   label:'키워드'},
    {key:'sub_media', label:'매체'},
    {key:'device',    label:'기기'},
    {key:'cost',      label:'광고비(원)', r:true},
    {key:'impressions', label:'노출수', r:true},
    {key:'clicks',    label:'클릭수', r:true},
    {key:'cpc',       label:'평균CPC', r:true},
    {key:'db',        label:'DB수', r:true},
    {key:'cpd',       label:'DB단가(원)', r:true},
    {key:'dbcvr',     label:'DB전환율(%)', r:true},
    {key:'contracts', label:'계약수', r:true},
    {key:'cvr',       label:'계약률(%)', r:true},
    {key:'perf',      label:'평가업적(원)', r:true},
    {key:'roas',      label:'ROAS(%)', r:true},
  ];
  document.getElementById('kw-thead').innerHTML = '<tr>'+cols.map(c=>{
    const arr = c.key===kwSortCol?(kwSortAsc?' ↑':' ↓'):'';
    const label = (_kwTableCumMode && KW_CUM_COLS.includes(c.key)) ? c.label+' ·누적' : c.label;
    return `<th style="padding:7px 10px;background:#fafaf8;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;color:var(--muted);white-space:nowrap;cursor:pointer;text-align:${c.r?'right':'left'}" onclick="kwSort('${c.key}')">${label}${arr}</th>`;
  }).join('')+'</tr>';

  // 페이징
  const totalPages = Math.max(1, Math.ceil(sorted.length / KW_PAGE_SIZE));
  if(kwPage > totalPages) kwPage = 1;
  const pageRows = sorted.slice((kwPage-1)*KW_PAGE_SIZE, kwPage*KW_PAGE_SIZE);

  // 바디 - 현재 페이지만 렌더
  document.getElementById('kw-tbody').innerHTML = pageRows.map((r,i)=>{
    const globalIdx = (kwPage-1)*KW_PAGE_SIZE + i;
    const clickable = 'onclick="openKwDetail(kwSortedData[' + globalIdx + '])" style="cursor:pointer;"';
    const mediaPill = r.sub_media==='네이버'
      ? '<span style="font-size:11px;padding:2px 7px;border-radius:4px;background:#e8f5e9;color:#1b5e20;font-weight:600">네이버</span>'
      : r.sub_media==='구글'
      ? '<span style="font-size:11px;padding:2px 7px;border-radius:4px;background:#e3f2fd;color:#0d47a1;font-weight:600">구글</span>'
      : '<span style="font-size:11px;padding:2px 7px;border-radius:4px;background:#fff3e0;color:#e65100;font-weight:600">다음</span>';
    const devPill = r.device==='PC'
      ? '<span style="font-size:11px;padding:2px 7px;border-radius:4px;background:#E6F1FB;color:#0C447C;font-weight:600">PC</span>'
      : '<span style="font-size:11px;padding:2px 7px;border-radius:4px;background:#EAF3DE;color:#27500A;font-weight:600">모바일</span>';
    const dContracts = _kwCumVal(r,'contracts'), dCvr = _kwCumVal(r,'cvr'), dPerf = _kwCumVal(r,'perf'), dRoas = _kwCumVal(r,'roas');
    const cvrStyle = dCvr!=null&&dCvr>=10?'color:#dc2626;font-weight:600':'';
    return `<tr ${clickable} style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 10px;font-weight:500;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.keyword||'-'}</td>
      <td style="padding:7px 10px">${mediaPill}</td>
      <td style="padding:7px 10px">${devPill}</td>
      <td style="padding:7px 10px;text-align:right">${r.cost!=null?r.cost.toLocaleString():'-'}</td>
      <td style="padding:7px 10px;text-align:right">${r.impressions!=null?r.impressions.toLocaleString():'-'}</td>
      <td style="padding:7px 10px;text-align:right">${r.clicks!=null?r.clicks.toLocaleString():'-'}</td>
      <td style="padding:7px 10px;text-align:right">${r.cpc!=null?r.cpc.toLocaleString():'-'}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:600">${r.db.toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right">${r.cpd!=null?r.cpd.toLocaleString():'-'}</td>
      <td style="padding:7px 10px;text-align:right">${r.dbcvr!=null?r.dbcvr.toFixed(1)+'%':'-'}</td>
      <td style="padding:7px 10px;text-align:right">${dContracts.toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right;${cvrStyle}">${dCvr!=null?dCvr.toFixed(1)+'%':'-'}</td>
      <td style="padding:7px 10px;text-align:right">${dPerf?Math.round(dPerf).toLocaleString():'-'}</td>
      <td style="padding:7px 10px;text-align:right">${roasBadge(dRoas)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="14" style="padding:2rem;text-align:center;color:var(--faint)">데이터 없음</td></tr>';

  // 페이지 네비게이션
  const nav = document.getElementById('kw-page-nav');
  if(nav){
    if(totalPages <= 1){ nav.innerHTML=''; return; }
    const start = (kwPage-1)*KW_PAGE_SIZE+1, end = Math.min(kwPage*KW_PAGE_SIZE, sorted.length);
    nav.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:12px 0;justify-content:center;font-size:12px;color:var(--muted)">
        <button onclick="kwGoPage(1)" ${kwPage===1?'disabled':''} style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;font-size:11px">«</button>
        <button onclick="kwGoPage(${kwPage-1})" ${kwPage===1?'disabled':''} style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;font-size:11px">‹</button>
        <span>${start}–${end} / ${sorted.length}개 (${kwPage}/${totalPages}페이지)</span>
        <button onclick="kwGoPage(${kwPage+1})" ${kwPage===totalPages?'disabled':''} style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;font-size:11px">›</button>
        <button onclick="kwGoPage(${totalPages})" ${kwPage===totalPages?'disabled':''} style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);cursor:pointer;font-size:11px">»</button>
      </div>`;
  }
  kwRendered = true;
}

// 날짜별 daily 객체 → 일별 상세 테이블 HTML (파워컨텐츠 openDetail의 일별 테이블과 같은 지표 구성)
function _kwDailyDetailTableHtml(r){
  const daily = r.daily || {};
  const dates = Object.keys(daily).sort();
  if(!dates.length) return `<div style="padding:1rem;color:var(--faint);font-size:12px">일별 데이터 없음</div>`;
  const fmt = v => v!=null ? v.toLocaleString() : '-';
  const fmtP = v => v!=null ? v+'%' : '-';
  const rows = dates.map(dk=>{
    const d = daily[dk];
    const cost=d.cost||0, clicks=d.clicks||0, imp=d.impressions||0, db=d.db||0, contracts=d.contracts||0, perf=d.perf||0;
    const ctr = imp>0 ? Math.round(clicks/imp*1000)/10 : null;
    const cpc = clicks>0 ? Math.round(cost/clicks) : null;
    const roas = perf>0 && cost>0 ? Math.round(cost/perf*100) : null;
    const cpd = db>0 && cost>0 ? Math.round(cost/db) : null;
    const dbcvr = clicks>0 ? Math.round(db/clicks*1000)/10 : null;
    const cvr = db>0 ? Math.round(contracts/db*1000)/10 : null;
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 10px;font-size:12px">${dk}</td>
      <td style="padding:7px 10px;text-align:right">${cost.toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right">${clicks.toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right">${imp.toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right">${fmtP(ctr)}</td>
      <td style="padding:7px 10px;text-align:right">${fmt(cpc)}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:600">${db.toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right">${contracts.toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right">${Math.round(perf).toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right">${roas!=null?roas.toLocaleString()+'%':'-'}</td>
      <td style="padding:7px 10px;text-align:right">${fmt(cpd)}</td>
      <td style="padding:7px 10px;text-align:right">${fmtP(dbcvr)}</td>
      <td style="padding:7px 10px;text-align:right">${fmtP(cvr)}</td>
    </tr>`;
  }).join('');
  return `
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#fafaf8">
          ${['날짜','광고비(원)','클릭수','노출수','CTR(%)','CPC(원)','DB수','계약수','평가업적(원)','ROAS(%)','DB단가(원)','DB전환율(%)','계약률(%)'].map((h,i)=>
            `<th style="padding:7px 10px;text-align:${i===0?'left':'right'};font-size:11px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap">${h}</th>`
          ).join('')}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    </div>`;
}

function openKwDetail(r){
  const modal = document.getElementById('kw-modal-bg');
  document.getElementById('kw-modal-title').textContent =
    `${r.keyword} · ${r.sub_media} · ${r.device} — 상세`;

  const details = r.intype_detail || [];
  const intypeRows = details.map(d=>{
    const cvrStyle = d.cvr!=null&&d.cvr>=10?'color:#dc2626;font-weight:600':'';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:7px 10px;font-family:monospace;font-size:12px;font-weight:500">${d.intype}</td>
      <td style="padding:7px 10px;font-size:12px;color:var(--muted)">${d.cat||'-'}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:600">${d.db.toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right">${d.contracts.toLocaleString()}</td>
      <td style="padding:7px 10px;text-align:right;${cvrStyle}">${d.cvr!=null?d.cvr.toFixed(1)+'%':'-'}</td>
      <td style="padding:7px 10px;text-align:right">${d.perf?Math.round(d.perf).toLocaleString():'-'}</td>
    </tr>`;
  }).join('');
  const intypeSection = !details.length ? '' : `
    <div style="margin:1rem 0 .5rem;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">인타입별 상세</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#fafaf8">
          <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border)">인타입</th>
          <th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border)">보종</th>
          <th style="padding:7px 10px;text-align:right;font-size:11px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border)">DB수</th>
          <th style="padding:7px 10px;text-align:right;font-size:11px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border)">계약수</th>
          <th style="padding:7px 10px;text-align:right;font-size:11px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border)">계약율</th>
          <th style="padding:7px 10px;text-align:right;font-size:11px;font-weight:600;color:var(--muted);border-bottom:1px solid var(--border)">환산료</th>
        </tr>
      </thead>
      <tbody>${intypeRows}</tbody>
    </table>`;

  document.getElementById('kw-modal-body').innerHTML = `
    <div style="margin-bottom:.5rem;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">일별 상세</div>
    ${_kwDailyDetailTableHtml(r)}
    ${intypeSection}
  `;

  modal.style.display = 'flex';
}

function closeKwModal(e){
  if(e.target === document.getElementById('kw-modal-bg'))
    document.getElementById('kw-modal-bg').style.display = 'none';
}

function kwGoPage(p){
  kwPage = p;
  renderKwTable();
  document.querySelector('.table-card')?.scrollIntoView({behavior:'smooth', block:'start'});
}

function kwSort(col){
  if(kwSortCol===col) kwSortAsc=!kwSortAsc;
  else { kwSortCol=col; kwSortAsc=false; }
  kwPage = 1;
  renderKwTable();
}

function downloadKwCsv(){
  const rows = getKwFiltered();
  const hdr = ['키워드','매체','기기','광고비','클릭수','DB수','계약수','평가업적','ROAS','DB단가','계약율'];
  const body = rows.map(r=>[
    r.keyword||'',r.sub_media,r.device,
    r.cost!=null?r.cost:'',r.clicks!=null?r.clicks:'',
    r.db,r.contracts,r.perf||'',
    r.roas!=null?r.roas+'%':'',r.cpd!=null?r.cpd:'',
    r.cvr!=null?r.cvr.toFixed(1)+'%':''
  ].join(','));
  const csv = [hdr.join(','),...body].join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='키워드별성과.csv'; a.click();
}


function initDailyTab(){
  // 애드온컴퍼니(디스플레이) 일별 광고비는 별도 시트라 백그라운드로 불러온 뒤 준비되면 조용히 다시 그림
  if(!_displayDailyCost){
    _loadDisplayDailyCost().then(d=>{ if(d && Object.keys(d).length) renderDaily(); });
  }
  const needCrm    = Object.keys(CRM_DATA).length === 0;
  const needResult = resultData.length === 0;
  if(needCrm || needResult){
    const monthAll = document.getElementById('month-select-all');
    const month = monthAll?.value || '';
    Promise.all([loadAllSheets(), _ensureIntypeMapLoaded()]).then(([s])=>{
      const crmRes=_apiCrm(month,s);
      CRM_DATA=crmRes.crm_data||{};CRM_MEDIA_LIST=crmRes.media_list||[];KW_DAILY_COST=crmRes.kw_daily_cost||{};
      if(needResult){
        const d=_apiAnalyze(month,s);
        if(d&&!d.error){ resultData=d.result||[]; filteredData=[...resultData]; }
      }
      _initDailyTabCore();
    }).catch(()=>{ _initDailyTabCore(); });
    return;
  }
  _initDailyTabCore();
}

async function _initDailyTabCore(){
  await _ensureDailyAllMonthsLoaded().catch(()=>{});
  const d = _dailyAllData;
  if(!Object.keys(d?.crmData||CRM_DATA).length && !(d?.resultData||resultData).length){
    document.getElementById('daily-no-data').style.display='block';
    document.getElementById('daily-table-card').style.display='none';
    return;
  }
  document.getElementById('daily-no-data').style.display='none';
  document.getElementById('daily-table-card').style.display='block';

  // 월 선택 옵션 항상 새로 채우기 (데이터 재로드 대응)
  const monthSel = document.getElementById('daily-month-sel');
  // 사용자가 이미 골라둔 월이 있으면 그대로 유지 (다른 탭의 월 선택과는 무관하게 독립적으로 동작)
  // "전체 월"(빈 문자열)도 유효한 선택이므로, 값의 존재 여부가 아니라 "한 번이라도 초기화됐는지" 플래그로 최초 진입을 판단한다
  const prevValue = monthSel.value;
  const wasInitialized = _dailyMonthSelInitialized;
  _dailyMonthSelInitialized = true;
  const topMonth = document.getElementById('month-select-all')?.value || '';
  // 기존 옵션 제거 후 재생성
  while(monthSel.options.length > 1) monthSel.remove(1);
  const months = getDailyMonths();
  months.forEach(m=>{
    const o=document.createElement('option'); o.value=m; o.textContent=m; monthSel.appendChild(o);
  });
  // 기존 선택값 우선 유지, 없으면(최초 진입) 상단 월선택 값, 그것도 없으면 최신 월
  if(wasInitialized && [...monthSel.options].some(o=>o.value===prevValue)){
    monthSel.value = prevValue;
  } else if(topMonth && [...monthSel.options].some(o=>o.value===topMonth)){
    monthSel.value = topMonth;
  } else if(months.length){
    monthSel.value = months[0];
  }
  renderDaily();
}

function getDailyMonths(){
  const monthSet = new Set();
  const d = _dailyAllData;
  // 파워컨텐츠 daily_raw에서 추출
  (d?.resultData||resultData).forEach(r=>{
    (r.daily_raw||[]).forEach(d=>{
      if(d.date){
        const parts = d.date.split('.');
        if(parts.length>=3 && parts[0].length===4){
          monthSet.add(parts[0]+'년 '+parseInt(parts[1])+'월');
        }
      }
    });
  });
  // CRM_DATA에서도 추출 (전체 탭 등)
  Object.keys(d?.crmData||CRM_DATA).forEach(dateKey=>{
    const parts = dateKey.split('.');
    if(parts.length>=3 && parts[0].length===4){
      monthSet.add(parts[0]+'년 '+parseInt(parts[1])+'월');
    }
  });
  // KW_DAILY_COST에서도 추출
  Object.keys(d?.kwDailyCost||KW_DAILY_COST).forEach(dateKey=>{
    const parts = dateKey.split('.');
    if(parts.length>=3 && parts[0].length===4){
      monthSet.add(parts[0]+'년 '+parseInt(parts[1])+'월');
    }
  });
  return [...monthSet].sort((a,b)=>{
    const pa=a.match(/(\d+)년 (\d+)월/), pb=b.match(/(\d+)년 (\d+)월/);
    if(!pa||!pb) return 0;
    return (parseInt(pb[1])*100+parseInt(pb[2]))-(parseInt(pa[1])*100+parseInt(pa[2]));
  });
}

function parseDailyDate(dateStr){
  // "2026.06.01." or "2026-06-01" → {year,month,day,key:"2026.06.01."}
  if(!dateStr) return null;
  let y,m,d;
  if(dateStr.includes('.')){
    const p=dateStr.split('.').filter(Boolean);
    if(p.length<3) return null;
    y=p[0]; m=p[1]; d=p[2];
  } else if(dateStr.includes('-')){
    const p=dateStr.split('-');
    y=p[0]; m=p[1]; d=p[2];
  } else return null;
  return {year:parseInt(y),month:parseInt(m),day:parseInt(d),
    key:`${y}.${m.padStart(2,'0')}.${d.toString().padStart(2,'0')}.`,
    monthLabel:`${parseInt(y)}년 ${parseInt(m)}월`};
}

function renderDaily(){
  const _d = _dailyAllData;
  const _resultData = _d?.resultData||resultData, _crmData = _d?.crmData||CRM_DATA,
        _kwDailyCost = _d?.kwDailyCost||KW_DAILY_COST, _crmMediaList = _d?.crmMediaList||CRM_MEDIA_LIST;
  // CRM_DATA 또는 resultData 중 하나라도 있으면 렌더
  if(!_resultData.length && !Object.keys(_crmData).length && !Object.keys(_kwDailyCost).length) return;
  const selMonth = document.getElementById('daily-month-sel').value;
  renderDailyMediaToggle();
  const crmMedias = _crmMediaList.filter(m=>m!=='파워컨텐츠'&&m!=='네이버'&&m!=='구글'&&m!=='다음'&&!_dailyHiddenMedias.has(m));
  const showPc = !_dailyHiddenMedias.has('파워컨텐츠');
  const kwMedias = _dailyHiddenMedias.has('키워드') ? [] : ['네이버','구글','다음'];
  const allMedias = [...kwMedias, ...crmMedias];

  const dayMap = {};
  _resultData.forEach(r=>{
    (r.daily_raw||[]).forEach(d=>{
      const pd = parseDailyDate(d.date);
      if(!pd) return;
      if(selMonth && pd.monthLabel !== selMonth) return;
      if(!dayMap[pd.key]) dayMap[pd.key] = {pd, pc_cost:0, pc_db:0, pc_con:0, pc_perf:0, pc_con_cum:0, pc_perf_cum:0};
      dayMap[pd.key].pc_cost += (d.cost||0);
    });
    Object.entries(r.daily_sales_map||{}).forEach(([dateStr,sv])=>{
      const pd = parseDailyDate(dateStr);
      if(!pd) return;
      if(selMonth && pd.monthLabel !== selMonth) return;
      if(!dayMap[pd.key]) dayMap[pd.key] = {pd, pc_cost:0, pc_db:0, pc_con:0, pc_perf:0, pc_con_cum:0, pc_perf_cum:0};
      dayMap[pd.key].pc_db   += (sv.db||0);
      dayMap[pd.key].pc_con  += (sv.contracts||0);
      dayMap[pd.key].pc_perf += (sv.performance||0);
      dayMap[pd.key].pc_con_cum  += (sv.contracts_cum||0);
      dayMap[pd.key].pc_perf_cum += (sv.performance_cum||0);
    });
  });
  [...Object.keys(_crmData), ...Object.keys(_kwDailyCost)].forEach(key=>{
    const pd = parseDailyDate(key);
    if(!pd) return;
    if(selMonth && pd.monthLabel !== selMonth) return;
    if(!dayMap[key]) dayMap[key] = {pd, pc_cost:0, pc_db:0, pc_con:0, pc_perf:0, pc_con_cum:0, pc_perf_cum:0};
  });

  const days = Object.values(dayMap).sort((a,b)=>
    (a.pd.year*10000+a.pd.month*100+a.pd.day)-(b.pd.year*10000+b.pd.month*100+b.pd.day));
  const allDays = buildFullMonthDays(selMonth, days);

  const COL = 7;
  const cumSuffix = _dailyTableCumMode ? ' ·누적' : '';
  function subCols(){ return `<th class="dth">DB수</th><th class="dth">계약수${cumSuffix}</th><th class="dth">계약율${cumSuffix}</th><th class="dth">환산료${cumSuffix}</th><th class="dth">광고비</th><th class="dth">DB단가</th><th class="dth" style="border-right:1px solid var(--border)">ROAS${cumSuffix}</th>`; }
  function totalSubCols(){ return `<th class="dth" style="background:#fff8ec">DB수</th><th class="dth" style="background:#fff8ec">계약수${cumSuffix}</th><th class="dth" style="background:#fff8ec">계약율${cumSuffix}</th><th class="dth" style="background:#fff8ec">환산료${cumSuffix}</th><th class="dth" style="background:#fff8ec">광고비</th><th class="dth" style="background:#fff8ec">DB단가</th><th class="dth" style="border-right:1px solid var(--border);background:#fff8ec">ROAS${cumSuffix}</th>`; }

  let theadHtml = '<tr style="background:#fafaf8"><th rowspan="2" style="padding:7px 10px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);font-size:11px;font-weight:600;color:var(--muted);text-align:center;min-width:80px;position:sticky;left:0;z-index:4;background:#fafaf8">구분</th>';
  theadHtml += '<th colspan="' + COL + '" style="padding:6px 10px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);font-size:11px;font-weight:600;color:#854F0B;text-align:center;background:#fff8ec">전체합계</th>';
  if(showPc) theadHtml += '<th colspan="' + COL + '" style="padding:6px 10px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);font-size:11px;font-weight:600;color:#ff9b00;text-align:center">파워컨텐츠</th>';
  allMedias.forEach(m=>{
    const color = kwMedias.includes(m) ? '#1a5c2a' : '#444';
    theadHtml += '<th colspan="' + COL + '" style="padding:6px 10px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);font-size:11px;font-weight:600;color:' + color + ';text-align:center">' + m + '</th>';
  });
  theadHtml += '</tr><tr style="background:#fafaf8">' + totalSubCols() + (showPc?subCols():'');
  allMedias.forEach(()=>{ theadHtml += subCols(); });
  theadHtml += '</tr>';
  const theadEl = document.getElementById('daily-thead');
  theadEl.innerHTML = theadHtml;
  // 헤더가 2줄이라 둘째 줄(구분별 소계 컬럼)은 첫째 줄(매체명) 높이만큼 top을 내려줘야 스크롤 시 겹치지 않고 둘 다 고정된다
  const firstRowH = theadEl.rows[0] ? theadEl.rows[0].getBoundingClientRect().height : 0;
  if(theadEl.rows[1]) [...theadEl.rows[1].cells].forEach(c=>{ c.style.top = firstRowH + 'px'; });

  function makeMediaCells(db, con, perf, cost){
    const cvr  = db>0?(con/db*100).toFixed(1)+'%':'';
    const cpd  = db>0&&cost>0?fmtN(Math.round(cost/db)):'';
    const roas = perf>0&&cost>0?Math.round(cost/perf*100).toLocaleString()+'%':'';
    return '<td class="dtd">'+( db||'')+' </td><td class="dtd">'+( con||'')+' </td><td class="dtd">'+cvr+'</td><td class="dtd">'+(perf?fmtN(Math.round(perf)):'')+' </td><td class="dtd">'+(cost?fmtN(cost):'')+' </td><td class="dtd">'+cpd+'</td><td class="dtd" style="border-right:1px solid var(--border)">'+roas+'</td>';
  }
  function makeTotalCells(db, con, perf, cost){
    const cvr  = db>0?(con/db*100).toFixed(1)+'%':'';
    const cpd  = db>0&&cost>0?fmtN(Math.round(cost/db)):'';
    const roas = perf>0&&cost>0?Math.round(cost/perf*100).toLocaleString()+'%':'';
    const s = 'background:#fff8ec';
    return `<td class="dtd" style="${s}">${db||''}</td><td class="dtd" style="${s}">${con||''}</td><td class="dtd" style="${s}">${cvr}</td><td class="dtd" style="${s}">${perf?fmtN(Math.round(perf)):''}</td><td class="dtd" style="${s}">${cost?fmtN(cost):''}</td><td class="dtd" style="${s}">${cpd}</td><td class="dtd" style="border-right:1px solid var(--border);${s}">${roas}</td>`;
  }

  function makeRow(item, isMonthTotal){
    const cum = _dailyTableCumMode;
    const key = item.type==='day' ? item.pd.key : null;
    const pc_cost=item.pc_cost||0, pc_db=item.pc_db||0;
    const pc_con  = cum ? (item.pc_con_cum||0)  : (item.pc_con||0);
    const pc_perf = cum ? (item.pc_perf_cum||0) : (item.pc_perf||0);
    const kwC = key?(_kwDailyCost[key]||{}):(item.kwCost||{});
    const naverCost=kwC.naver||0, googleCost=kwC.google||0, daumCost=kwC.daum||0;
    const crmDay = isMonthTotal?(item.crmTotals||{}):(key?(_crmData[key]||{}):{});
    const conKey = cum?'contracts_cum':'contracts', perfKey = cum?'perf_cum':'perf';
    const naverDb  = isMonthTotal?(item.kwDb?.naver||0) :(crmDay['네이버']||{}).db||0;
    const naverCon = isMonthTotal?((cum?item.kwCon_cum?.naver:item.kwCon?.naver)||0) :(crmDay['네이버']||{})[conKey]||0;
    const naverPerf= isMonthTotal?((cum?item.kwPerf_cum?.naver:item.kwPerf?.naver)||0):(crmDay['네이버']||{})[perfKey]||0;
    const googleDb = isMonthTotal?(item.kwDb?.google||0) :(crmDay['구글']||{}).db||0;
    const googleCon= isMonthTotal?((cum?item.kwCon_cum?.google:item.kwCon?.google)||0):(crmDay['구글']||{})[conKey]||0;
    const googlePerf=isMonthTotal?((cum?item.kwPerf_cum?.google:item.kwPerf?.google)||0):(crmDay['구글']||{})[perfKey]||0;
    const daumDb   = isMonthTotal?(item.kwDb?.daum||0)  :(crmDay['다음']||{}).db||0;
    const daumCon  = isMonthTotal?((cum?item.kwCon_cum?.daum:item.kwCon?.daum)||0) :(crmDay['다음']||{})[conKey]||0;
    const daumPerf = isMonthTotal?((cum?item.kwPerf_cum?.daum:item.kwPerf?.daum)||0):(crmDay['다음']||{})[perfKey]||0;
    // 애드온컴퍼니 = 디스플레이 전체 매체 합산 광고비 (일별 리포트에서 자동 집계)
    const dispCost = isMonthTotal ? (item.crmCost?.['애드온컴퍼니']||0) : (key ? (_displayDailyCost?.[key]||0) : 0);
    const totalDb=isMonthTotal?(item.totalDb||0):(pc_db+Object.values(crmDay).reduce((s,c)=>s+(c.db||0),0));
    const totalCon=isMonthTotal?((cum?item.totalCon_cum:item.totalCon)||0):(pc_con+Object.values(crmDay).reduce((s,c)=>s+(c[conKey]||0),0));
    const totalPerf=isMonthTotal?((cum?item.totalPerf_cum:item.totalPerf)||0):(pc_perf+Object.values(crmDay).reduce((s,c)=>s+(c[perfKey]||0),0));
    const bg = isMonthTotal?'background:#eff4ff;font-weight:700':'';
    const bgSticky = isMonthTotal?'#eff4ff':'var(--surface)';
    const dateColor= isMonthTotal?'color:#ff9b00':
      (item.pd&&(new Date(item.pd.year,item.pd.month-1,item.pd.day).getDay()===0||new Date(item.pd.year,item.pd.month-1,item.pd.day).getDay()===6)?'color:#dc2626':'color:var(--text)');
    let crmCells='', crmCostSum=0;
    crmMedias.forEach(m=>{
      const c=crmDay[m]||{};
      const cost = _crmMediaCost(m, c, dispCost);
      crmCostSum += cost;
      crmCells+=makeMediaCells(c.db||0,c[conKey]||0,c[perfKey]||0,cost);
    });
    const totalCost=isMonthTotal?(item.totalCost||0):(pc_cost+naverCost+googleCost+daumCost+crmCostSum);
    const pcCells = showPc ? makeMediaCells(pc_db,pc_con,pc_perf,pc_cost) : '';
    const kwCells = kwMedias.length ? makeMediaCells(naverDb,naverCon,naverPerf,naverCost)+makeMediaCells(googleDb,googleCon,googlePerf,googleCost)+makeMediaCells(daumDb,daumCon,daumPerf,daumCost) : '';
    return '<tr style="'+bg+'"><td style="padding:7px 10px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);font-size:12px;'+dateColor+';text-align:center;position:sticky;left:0;z-index:1;background:'+bgSticky+'">'+item.label+'</td>'+makeTotalCells(totalDb,totalCon,totalPerf,totalCost)+pcCells+kwCells+crmCells+'</tr>';
  }

  document.getElementById('daily-tbody').innerHTML = allDays.map(item=>makeRow(item, item.type==='month-total')).join('');
}

function buildFullMonthDays(selMonth, days){
  const dataMap = {};
  days.forEach(d=>{ dataMap[d.pd.key]=d; });

  let result = [];
  if(!selMonth){
    const monthGroups = {};
    days.forEach(d=>{
      const ml=d.pd.monthLabel;
      if(!monthGroups[ml]) monthGroups[ml]=[];
      monthGroups[ml].push(d);
    });
    Object.entries(monthGroups).sort((a,b)=>{
      const pa=a[0].match(/(\d+)년 (\d+)월/), pb=b[0].match(/(\d+)년 (\d+)월/);
      return (parseInt(pa[1])*100+parseInt(pa[2]))-(parseInt(pb[1])*100+parseInt(pb[2]));
    }).forEach(([ml,arr])=>{
      arr.sort((a,b)=>(a.pd.year*10000+a.pd.month*100+a.pd.day)-(b.pd.year*10000+b.pd.month*100+b.pd.day));
      arr.forEach(d=>result.push(makeDayRow(d)));
      result.push(makeMonthTotal(ml, arr)); // 월합계 아래
    });
    return result;
  }

  const match = selMonth.match(/(\d+)년 (\d+)월/);
  if(!match) return [];
  const y=parseInt(match[1]), m=parseInt(match[2]);
  const daysInMonth = new Date(y,m,0).getDate();
  const monthRows = [];
  for(let day=1;day<=daysInMonth;day++){
    const key=`${y}.${String(m).padStart(2,'0')}.${String(day).padStart(2,'0')}.`;
    const pd={year:y,month:m,day,key,monthLabel:selMonth};
    const found=dataMap[key];
    monthRows.push(found||{pd,pc_cost:0,pc_db:0,pc_con:0,pc_perf:0,pc_con_cum:0,pc_perf_cum:0});
  }
  monthRows.forEach(d=>result.push(makeDayRow(d)));
  result.push(makeMonthTotal(selMonth, monthRows)); // 월합계 아래
  return result;
}

function makeDayRow(d){
  const pd=d.pd;
  const dateStr=`${pd.year}${String(pd.month).padStart(2,'0')}${String(pd.day).padStart(2,'0')}`;
  return {type:'day',pd,label:dateStr,
    pc_cost:d.pc_cost||0, pc_db:d.pc_db||0, pc_con:d.pc_con||0, pc_perf:d.pc_perf||0,
    pc_con_cum:d.pc_con_cum||0, pc_perf_cum:d.pc_perf_cum||0};
}

function makeMonthTotal(label, rows){
  const _d = _dailyAllData;
  const _crmData = _d?.crmData||CRM_DATA, _kwDailyCost = _d?.kwDailyCost||KW_DAILY_COST, _crmMediaList = _d?.crmMediaList||CRM_MEDIA_LIST;
  let pc_db=0,pc_con=0,pc_perf=0,pc_cost=0,pc_con_cum=0,pc_perf_cum=0;
  const kwCost = {naver:0,google:0,daum:0};
  const kwDb   = {naver:0,google:0,daum:0};
  const kwCon  = {naver:0,google:0,daum:0};
  const kwPerf = {naver:0,google:0,daum:0};
  const kwCon_cum  = {naver:0,google:0,daum:0};
  const kwPerf_cum = {naver:0,google:0,daum:0};
  const crmMedias = _crmMediaList.filter(m=>m!=='파워컨텐츠'&&m!=='네이버'&&m!=='구글'&&m!=='다음');
  const crmTotals = {};
  const crmCost = {};
  crmMedias.forEach(m=>{ crmTotals[m]={db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0}; crmCost[m]=0; });

  rows.forEach(d=>{
    pc_db   +=(d.pc_db||0);
    pc_con  +=(d.pc_con||0);
    pc_perf +=(d.pc_perf||0);
    pc_cost +=(d.pc_cost||0);
    pc_con_cum  +=(d.pc_con_cum||0);
    pc_perf_cum +=(d.pc_perf_cum||0);
    const key = d.pd ? d.pd.key : null;
    if(key && _kwDailyCost[key]){
      kwCost.naver  += _kwDailyCost[key].naver||0;
      kwCost.google += _kwDailyCost[key].google||0;
      kwCost.daum   += _kwDailyCost[key].daum||0;
    }
    if(key && _displayDailyCost && _displayDailyCost[key]) crmCost['애드온컴퍼니'] = (crmCost['애드온컴퍼니']||0) + _displayDailyCost[key];
    const crmDay = key ? (_crmData[key]||{}) : {};
    // 네이버/구글/다음 DB 집계
    kwDb.naver   += (crmDay['네이버']||{}).db||0;
    kwCon.naver  += (crmDay['네이버']||{}).contracts||0;
    kwPerf.naver += (crmDay['네이버']||{}).perf||0;
    kwCon_cum.naver  += (crmDay['네이버']||{}).contracts_cum||0;
    kwPerf_cum.naver += (crmDay['네이버']||{}).perf_cum||0;
    kwDb.google  += (crmDay['구글']||{}).db||0;
    kwCon.google += (crmDay['구글']||{}).contracts||0;
    kwPerf.google+= (crmDay['구글']||{}).perf||0;
    kwCon_cum.google  += (crmDay['구글']||{}).contracts_cum||0;
    kwPerf_cum.google += (crmDay['구글']||{}).perf_cum||0;
    kwDb.daum    += (crmDay['다음']||{}).db||0;
    kwCon.daum   += (crmDay['다음']||{}).contracts||0;
    kwPerf.daum  += (crmDay['다음']||{}).perf||0;
    kwCon_cum.daum  += (crmDay['다음']||{}).contracts_cum||0;
    kwPerf_cum.daum += (crmDay['다음']||{}).perf_cum||0;
    crmMedias.forEach(m=>{
      const c=crmDay[m]||{};
      crmTotals[m].db       += (c.db||0);
      crmTotals[m].contracts+= (c.contracts||0);
      crmTotals[m].perf     += (c.perf||0);
      crmTotals[m].contracts_cum += (c.contracts_cum||0);
      crmTotals[m].perf_cum      += (c.perf_cum||0);
    });
  });
  const allDb  = pc_db + kwDb.naver + kwDb.google + kwDb.daum + crmMedias.reduce((s,m)=>s+(crmTotals[m]?.db||0),0);
  const allCon = pc_con+ kwCon.naver+ kwCon.google+ kwCon.daum+ crmMedias.reduce((s,m)=>s+(crmTotals[m]?.contracts||0),0);
  const allPerf= pc_perf+kwPerf.naver+kwPerf.google+kwPerf.daum+crmMedias.reduce((s,m)=>s+(crmTotals[m]?.perf||0),0);
  const allCon_cum = pc_con_cum+ kwCon_cum.naver+ kwCon_cum.google+ kwCon_cum.daum+ crmMedias.reduce((s,m)=>s+(crmTotals[m]?.contracts_cum||0),0);
  const allPerf_cum= pc_perf_cum+kwPerf_cum.naver+kwPerf_cum.google+kwPerf_cum.daum+crmMedias.reduce((s,m)=>s+(crmTotals[m]?.perf_cum||0),0);
  const crmCostTotal = crmMedias.reduce((s,m)=>s+_crmMediaCost(m, crmTotals[m], crmCost['애드온컴퍼니']||0), 0);
  const allCost= pc_cost+(kwCost.naver||0)+(kwCost.google||0)+(kwCost.daum||0)+crmCostTotal;
  return {type:'month-total',label,pc_db,pc_con,pc_perf,pc_cost,pc_con_cum,pc_perf_cum,
    kwCost,kwDb,kwCon,kwPerf,kwCon_cum,kwPerf_cum,crmTotals,crmCost,
    totalDb:allDb,totalCon:allCon,totalPerf:allPerf,totalCon_cum:allCon_cum,totalPerf_cum:allPerf_cum,totalCost:allCost};
}

function fmtN(v){ return v!=null?Math.round(v).toLocaleString():'-'; }

function downloadDailyCsv(){
  const thead = document.getElementById('daily-thead');
  const groupRow = thead && thead.rows[0], subRow = thead && thead.rows[1];
  const header = ['구분'];
  if(groupRow && subRow){
    const subLabels = [...subRow.cells].map(c=>c.textContent.trim());
    let subIdx = 0;
    [...groupRow.cells].slice(1).forEach(gc=>{
      const groupName = gc.textContent.trim();
      const span = gc.colSpan || 1;
      for(let i=0;i<span;i++){ header.push(`${groupName}_${subLabels[subIdx]||''}`); subIdx++; }
    });
  }
  const rows=[header];
  document.querySelectorAll('#daily-tbody tr').forEach(tr=>{
    const cells=[...tr.querySelectorAll('td')].map(td=>td.innerText.trim());
    rows.push(cells);
  });
  const csv=rows.map(r=>r.map(_csvCell).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='Daily_DB현황.csv'; a.click();
}

let _cpcDevice = '전체';
let _cpcAllData = null; // 90일/전체 기간 멀티월 데이터 (null이면 resultData 사용)
let _cpcPeriod = 'month'; // 'month' | '90d' | 'all'

function cpcPeriod(p){
  _cpcPeriod = p;
  const periodBtnMap = {'month':'cpc-period-month','90d':'cpc-period-90','all':'cpc-period-all'};
  Object.entries(periodBtnMap).forEach(([k,id])=>{
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.classList.remove('act-all','act-pc','act-mo');
    if(k===p) btn.classList.add('act-all');
  });

  // 90일/전체: 모든 월 파일 합산 데이터 로드
  if(p === '90d' || p === 'all'){
    setStatus('멀티월 데이터 로드 중...','');
    Promise.all([loadAllSheets(), _ensureIntypeMapLoaded()]).then(([s])=>{
      const adData = _apiAnalyze('', s);
      if(adData && !adData.error){ _cpcAllData = adData.result; }
      setStatus('로드 완료','ok'); renderCpc();
    }).catch(()=>{ setStatus('로드 실패','err'); renderCpc(); });
  } else {
    // 당월: 현재 resultData 사용
    _cpcAllData = null;
    renderCpc();
  }
}

// daily_raw date를 "YYYY-MM-DD" 정규화
function normDateStr(s){
  if(!s) return '';
  // "2026.05.01." → "2026-05-01"
  const m1 = s.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if(m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  // "2026-05-01" 그대로
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return s;
}

// 기간 필터에 따라 daily_raw에서 cost/clicks/rank를 재집계
function cpcCalcByPeriod(r){
  const daily = r.daily_raw || [];
  if(!daily.length) return { cost: r.cost||0, clicks: r.clicks||0, avg_rank: r.avg_rank||0 };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const curYM = todayStr.substring(0, 7); // "2026-06"

  let cutoffStr = null;
  if(_cpcPeriod === '90d'){
    const d90 = new Date(now); d90.setDate(d90.getDate()-89);
    cutoffStr = `${d90.getFullYear()}-${String(d90.getMonth()+1).padStart(2,'0')}-${String(d90.getDate()).padStart(2,'0')}`;
  }

  // 당월 모드: 현재 달 데이터가 없으면 데이터의 최신 월로 fallback
  let effectiveYM = curYM;
  if(_cpcPeriod === 'month'){
    const hasCurrentMonth = daily.some(d => normDateStr(d.date||'').startsWith(curYM));
    if(!hasCurrentMonth){
      const months = daily.map(d => normDateStr(d.date||'').substring(0,7)).filter(Boolean).sort();
      if(months.length) effectiveYM = months[months.length-1];
    }
  }

  let cost=0, clicks=0, rank_sum=0, rank_imp=0;
  daily.forEach(d=>{
    const ds = normDateStr(d.date || '');
    if(!ds) return;
    if(_cpcPeriod === 'month'){
      if(ds.substring(0,7) !== effectiveYM) return;
    } else if(_cpcPeriod === '90d'){
      if(ds < cutoffStr) return;
    }
    // 'all'은 필터 없음
    cost     += d.cost || 0;
    clicks   += d.clicks || 0;
    rank_sum += (d.rank||0) * (d.impressions||0);
    rank_imp += d.impressions || 0;
  });
  const avg_rank = rank_imp > 0 ? Math.round(rank_sum/rank_imp*10)/10 : (r.avg_rank||0);
  return { cost, clicks, avg_rank };
}
let _cpcRankChart = null;
let _cpcScatterChart = null;
let _cpcChartJsLoaded = false;
let _cpcSortCol = 'rank';
let _cpcSortAsc = true;

function cpcSort(col){
  if(_cpcSortCol === col) _cpcSortAsc = !_cpcSortAsc;
  else { _cpcSortCol = col; _cpcSortAsc = col === 'group' || col === 'media' || col === 'cat'; }
  // 헤더 표시 갱신
  ['group','media','cat','rank','cpc','r1','r2','r3','r4','r5'].forEach(k=>{
    const el = document.getElementById('cpc-sort-'+k);
    if(el) el.textContent = k === _cpcSortCol ? (_cpcSortAsc ? '▲' : '▼') : '';
  });
  renderCpc();
}

function cpcDevice(d){
  _cpcDevice = d;
  ['pc','mo','all'].forEach(k=>{
    const el = document.getElementById('cpc-tab-'+k);
    el.className = 'cpc-dtab';
  });
  if(d==='PC') document.getElementById('cpc-tab-pc').classList.add('act-pc');
  else if(d==='모바일') document.getElementById('cpc-tab-mo').classList.add('act-mo');
  else document.getElementById('cpc-tab-all').classList.add('act-all');
  renderCpc();
}

function cpcCalcEstimates(r){
  // 기간 필터 적용 후 cost/clicks/rank 재집계
  const pd = cpcCalcByPeriod(r);
  const cpc = pd.clicks > 0 ? Math.round(pd.cost / pd.clicks) : 0;
  const rank = pd.avg_rank || r.avg_rank || 3;
  const isMo = r.media === '모바일';
  const moAdj = isMo ? 0.78 : 1.0;
  // 순위별 가중치: 현재 평균순위 기준으로 역산하여 각 순위 추정
  // 1위 프리미엄이 가장 높고 낮은 순위일수록 CPC 낮음
  const rankWeight = {1: 1.8, 2: 1.35, 3: 1.0, 4: 0.75, 5: 0.55};
  // 현재 순위 기준 기본 CPC 역산
  const curW = rank <= 1 ? rankWeight[1] : rank <= 2 ? rankWeight[2] : rank <= 3 ? rankWeight[3] : rank <= 4 ? rankWeight[4] : rankWeight[5];
  const baseCpc = cpc > 0 && curW > 0 ? cpc / curW : cpc;
  return {
    cpc_actual: cpc,
    cpc_r1: Math.round(baseCpc * rankWeight[1] * moAdj),
    cpc_r2: Math.round(baseCpc * rankWeight[2] * moAdj),
    cpc_r3: Math.round(baseCpc * rankWeight[3] * moAdj),
    cpc_r4: Math.round(baseCpc * rankWeight[4] * moAdj),
    cpc_r5: Math.round(baseCpc * rankWeight[5] * moAdj),
  };
}

function cpcGetFiltered(){
  const srcData = _cpcAllData || resultData;
  if(!srcData.length) return [];
  const q = (document.getElementById('cpc-search').value||'').toLowerCase();
  const cat = document.getElementById('cpc-cat').value;
  return srcData.filter(r=>{
    // 기간 필터 적용 후 cost/clicks 있는 그룹만
    const pd = cpcCalcByPeriod(r);
    if(pd.clicks <= 0 || !pd.avg_rank) return false;
    const dm = _cpcDevice === '전체' || r.media === _cpcDevice;
    const cm = cat === 'all' || r.cat === cat;
    const qm = !q || r.group.toLowerCase().includes(q) || (r.cat||'').toLowerCase().includes(q);
    const km = !_keyFilterState['cpc'] || isKeyGroup(r.group, r.media);
    return dm && cm && qm && km;
  });
}

function cpcSorted(rows){
  return [...rows].sort((a,b)=>{
    const ea = cpcCalcEstimates(a), eb = cpcCalcEstimates(b);
    let va, vb;
    if(_cpcSortCol==='group')  { va=a.group||''; vb=b.group||''; return _cpcSortAsc ? va.localeCompare(vb,'ko') : vb.localeCompare(va,'ko'); }
    if(_cpcSortCol==='media')  { va=a.media||''; vb=b.media||''; return _cpcSortAsc ? va.localeCompare(vb,'ko') : vb.localeCompare(va,'ko'); }
    if(_cpcSortCol==='cat')    { va=a.cat||''; vb=b.cat||''; return _cpcSortAsc ? va.localeCompare(vb,'ko') : vb.localeCompare(va,'ko'); }
    if(_cpcSortCol==='rank')   { va=a.avg_rank||99; vb=b.avg_rank||99; }
    else if(_cpcSortCol==='cpc') { va=ea.cpc_actual; vb=eb.cpc_actual; }
    else if(_cpcSortCol==='r1')  { va=ea.cpc_r1; vb=eb.cpc_r1; }
    else if(_cpcSortCol==='r2')  { va=ea.cpc_r2; vb=eb.cpc_r2; }
    else if(_cpcSortCol==='r3')  { va=ea.cpc_r3; vb=eb.cpc_r3; }
    else if(_cpcSortCol==='r4')  { va=ea.cpc_r4; vb=eb.cpc_r4; }
    else if(_cpcSortCol==='r5')  { va=ea.cpc_r5; vb=eb.cpc_r5; }
    else { va=0; vb=0; }
    return _cpcSortAsc ? va-vb : vb-va;
  });
}

function rankBadgeCls(rank){
  if(rank <= 1.5) return 'rb1';
  if(rank <= 2.5) return 'rb2';
  if(rank <= 3.5) return 'rb3';
  if(rank <= 4.5) return 'rb4';
  return 'rb5';
}

function initCpcTab(){
  const doRender = () => {
    // 보종 필터 초기화
    const sel = document.getElementById('cpc-cat');
    if(sel.options.length <= 1 && resultData.length){
      const cats = [...new Set(resultData.map(r=>r.cat).filter(Boolean))].sort();
      cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
    }
    if(!_cpcChartJsLoaded && !window.Chart){
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
      s.onload = ()=>{ _cpcChartJsLoaded=true; renderCpc(); };
      document.head.appendChild(s);
    } else {
      renderCpc();
    }
  };

  // resultData가 없으면 자동 로드
  if(!resultData.length && !_cpcAllData){
    setStatus('CPC 데이터 로드 중...','');
    Promise.all([loadAllSheets(), _ensureIntypeMapLoaded()]).then(([s])=>{
      const mon=document.getElementById('month-select')?.value||'';
      const adRes=_apiAnalyze(mon,s),crmRes=_apiCrm(mon,s);
      if(adRes&&!adRes.error){ resultData=adRes.result||[]; filteredData=[...resultData]; }
      CRM_DATA=crmRes.crm_data||{};CRM_MEDIA_LIST=crmRes.media_list||[];KW_DAILY_COST=crmRes.kw_daily_cost||{};
      setStatus(`로드 완료 — ${resultData.length}개`,'ok'); doRender();
    }).catch(()=>{ setStatus('로드 실패','err'); doRender(); });
  } else {
    doRender();
  }
}

function renderCpc(){
  const rows = cpcGetFiltered();
  const sorted = cpcSorted(rows);

  // 데이터 없음 처리
  const noData = document.getElementById('cpc-no-data');
  const tableCard = document.getElementById('cpc-table-card');
  if(!((_cpcAllData||resultData).length)){
    noData.style.display='block'; tableCard.style.display='none';
    document.getElementById('cpc-summary').innerHTML='';
    return;
  }
  noData.style.display='none'; tableCard.style.display='block';

  // 요약 지표
  const estimates = rows.map(cpcCalcEstimates);
  // 평균 실제 CPC = 전체 cost 합 ÷ 전체 clicks 합 (가중평균, 그룹별 단순평균 아님)
  const periodData = rows.map(r => cpcCalcByPeriod(r));
  const totalCost   = periodData.reduce((s,p)=>s+(p.cost||0), 0);
  const totalClicks = periodData.reduce((s,p)=>s+(p.clicks||0), 0);
  const avgCpc = totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0;
  // 1위 예상 CPC: 각 그룹 1위 예상값을 clicks 가중평균
  const avgR1  = totalClicks > 0
    ? Math.round(rows.reduce((s,r,i)=>s+estimates[i].cpc_r1*(periodData[i].clicks||0),0) / totalClicks)
    : (estimates.length ? Math.round(estimates.reduce((s,e)=>s+e.cpc_r1,0)/estimates.length) : 0);
  const maxCpc = estimates.length ? Math.max(...estimates.map(e=>e.cpc_actual)) : 0;
  const minCpc = estimates.length ? Math.min(...estimates.filter(e=>e.cpc_actual>0).map(e=>e.cpc_actual)) : 0;
  // 평균 노출순위 = impressions 가중평균
  const totalImp  = periodData.reduce((s,p,i)=>{ const r=rows[i]; const d=r.daily_raw||[]; return s+d.reduce((ss,dd)=>ss+(dd.impressions||0),0); },0);
  const rankWSum  = rows.reduce((s,r)=>{ const pd=cpcCalcByPeriod(r); return s+(pd.avg_rank||0)*(r.daily_raw||[]).reduce((ss,d)=>ss+(d.impressions||0),0); },0);
  const avgRank   = totalImp > 0 ? Math.round(rankWSum/totalImp*10)/10
    : (rows.length ? Math.round(rows.reduce((s,r)=>s+(cpcCalcByPeriod(r).avg_rank||0),0)/rows.length*10)/10 : 0);
  document.getElementById('cpc-summary').innerHTML = `
    <div class="cpc-metric"><div class="label">평균 실제 CPC</div><div class="val blue">${avgCpc.toLocaleString()}원</div></div>
    <div class="cpc-metric"><div class="label">1위 예상 CPC (평균)</div><div class="val amber">${avgR1.toLocaleString()}원</div></div>
    <div class="cpc-metric"><div class="label">최고 CPC</div><div class="val">${maxCpc.toLocaleString()}원</div></div>
    <div class="cpc-metric"><div class="label">최저 CPC</div><div class="val green">${minCpc.toLocaleString()}원</div></div>
    <div class="cpc-metric"><div class="label">평균 노출순위</div><div class="val">${avgRank}위</div></div>
  `;

  // 기간 멘트 배너
  const periodLabel = _cpcPeriod==='month' ? '당월' : _cpcPeriod==='90d' ? '최근 90일' : '전체 기간';
  const avgR2 = totalClicks > 0
    ? Math.round(rows.reduce((s,r,i)=>s+estimates[i].cpc_r2*(periodData[i].clicks||0),0) / totalClicks)
    : (estimates.length ? Math.round(estimates.reduce((s,e)=>s+e.cpc_r2,0)/estimates.length) : 0);
  const avgR3 = totalClicks > 0
    ? Math.round(rows.reduce((s,r,i)=>s+estimates[i].cpc_r3*(periodData[i].clicks||0),0) / totalClicks)
    : (estimates.length ? Math.round(estimates.reduce((s,e)=>s+e.cpc_r3,0)/estimates.length) : 0);
  const bannerEl = document.getElementById('cpc-period-banner');
  const bannerText = document.getElementById('cpc-period-text');
  if(estimates.length && bannerEl && bannerText){
    bannerEl.style.display = 'block';
    bannerText.innerHTML =
      `${periodLabel} 기준 1위 예상 평균 CPC <strong>${avgR1.toLocaleString()}원</strong>, ` +
      `2위 <strong>${avgR2.toLocaleString()}원</strong>, ` +
      `3위 <strong>${avgR3.toLocaleString()}원</strong>입니다.`;
  } else if(bannerEl){
    bannerEl.style.display = 'none';
  }

  // 테이블
  const maxBar = sorted.length ? Math.max(...sorted.map(r=>cpcCalcEstimates(r).cpc_r1)) : 1;
  const fillCls = r => r.media==='PC' ? 'fill-pc' : 'fill-mo';
  document.getElementById('cpc-tbody').innerHTML = sorted.map(r=>{
    const e = cpcCalcEstimates(r);
    const bw = Math.round((e.cpc_actual / maxBar) * 100);
    const rnk = r.avg_rank || 0;
    const isKey = isKeyGroup(r.group, r.media);
    const keyBadge = isKey ? ' ⭐' : '';
    return `<tr style="${isKey?'background:#fffbeb;':''}">
      <td class="gname" title="${r.group}">${r.group}${keyBadge}</td>
      <td><span class="cpc-media-pill ${r.media==='PC'?'pill-pc':'pill-mo'}">${r.media}</span></td>
      <td style="color:var(--muted);font-size:12px">${r.cat||'-'}</td>
      <td class="r"><span class="cpc-rank-badge ${rankBadgeCls(rnk)}">${rnk.toFixed(1)}위</span></td>
      <td class="r" style="font-weight:700;color:var(--text)">${e.cpc_actual.toLocaleString()}원</td>
      <td class="r" style="color:#0C447C;font-weight:600">${e.cpc_r1.toLocaleString()}원</td>
      <td class="r">${e.cpc_r2.toLocaleString()}원</td>
      <td class="r">${e.cpc_r3.toLocaleString()}원</td>
      <td class="r">${e.cpc_r4.toLocaleString()}원</td>
      <td class="r" style="color:var(--faint)">${e.cpc_r5.toLocaleString()}원</td>
      <td>
        <div class="cpc-bar-wrap">
          <div class="cpc-bar-bg"><div class="cpc-bar-fill ${fillCls(r)}" style="width:${bw}%"></div></div>
          <span style="font-size:11px;color:var(--faint);min-width:48px;text-align:right">${e.cpc_actual.toLocaleString()}원</span>
        </div>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="11" class="cpc-no-data">조건에 맞는 데이터가 없습니다</td></tr>`;

  // 차트
  if(window.Chart) renderCpcCharts(rows);
}

function renderCpcCharts(rows){
  const pcRows = rows.filter(r=>r.media==='PC');
  const moRows = rows.filter(r=>r.media==='모바일');
  const avgByKey = (arr, key) => arr.length ? Math.round(arr.reduce((s,r)=>{const e=cpcCalcEstimates(r); return s+e[key];},0)/arr.length) : 0;

  // 순위별 CPC 막대
  const labels = ['1위','2위','3위','4위','5위+'];
  const pcBars = ['cpc_r1','cpc_r2','cpc_r3','cpc_r4','cpc_r5'].map(k=>avgByKey(pcRows,k));
  const moBars = ['cpc_r1','cpc_r2','cpc_r3','cpc_r4','cpc_r5'].map(k=>avgByKey(moRows,k));
  const ctx1 = document.getElementById('cpc-rank-chart').getContext('2d');
  if(_cpcRankChart) _cpcRankChart.destroy();
  const ds1 = [];
  if(_cpcDevice==='PC'||_cpcDevice==='전체') ds1.push({label:'PC',data:pcBars,backgroundColor:'#595959',barPercentage:0.6});
  if(_cpcDevice==='모바일'||_cpcDevice==='전체') ds1.push({label:'모바일',data:moBars,backgroundColor:'#166534',barPercentage:0.6});
  _cpcRankChart = new Chart(ctx1,{
    type:'bar', data:{labels,datasets:ds1},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y.toLocaleString()}원`}}},
      scales:{
        x:{grid:{display:false},ticks:{font:{size:11},color:'#888'}},
        y:{ticks:{callback:v=>v.toLocaleString()+'원',font:{size:10},color:'#888'},grid:{color:'rgba(0,0,0,0.05)'}}
      }
    }
  });

  // 순위 vs CPC 산점도
  const pcPts = pcRows.map(r=>({x:Math.round((r.avg_rank||0)*10)/10, y:cpcCalcEstimates(r).cpc_actual, label:r.group}));
  const moPts = moRows.map(r=>({x:Math.round((r.avg_rank||0)*10)/10, y:cpcCalcEstimates(r).cpc_actual, label:r.group}));
  const ctx2 = document.getElementById('cpc-scatter-chart').getContext('2d');
  if(_cpcScatterChart) _cpcScatterChart.destroy();
  const ds2 = [];
  if(_cpcDevice==='PC'||_cpcDevice==='전체') ds2.push({label:'PC',data:pcPts,backgroundColor:'rgba(89,89,89,0.65)',pointRadius:5,pointHoverRadius:7});
  if(_cpcDevice==='모바일'||_cpcDevice==='전체') ds2.push({label:'모바일',data:moPts,backgroundColor:'rgba(22,101,52,0.65)',pointRadius:5,pointHoverRadius:7,pointStyle:'triangle'});
  _cpcScatterChart = new Chart(ctx2,{
    type:'scatter', data:{datasets:ds2},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw.label}: ${c.parsed.x.toFixed(1)}위 / ${c.parsed.y.toLocaleString()}원`}}},
      scales:{
        x:{title:{display:true,text:'평균노출순위',font:{size:10},color:'#888'},min:0.5,max:8,grid:{color:'rgba(0,0,0,0.05)'},ticks:{callback:v=>v+'위',font:{size:10},color:'#888'}},
        y:{title:{display:true,text:'CPC (원)',font:{size:10},color:'#888'},ticks:{callback:v=>v.toLocaleString(),font:{size:10},color:'#888'},grid:{color:'rgba(0,0,0,0.05)'}}
      }
    }
  });
}

function downloadCpcCsv(){
  const rows = cpcSorted(cpcGetFiltered());
  const hdr = ['광고그룹','기기','보종','평균순위','실제CPC','1위예상CPC','2위예상CPC','3위예상CPC','4위예상CPC','5위+예상CPC'];
  const body = rows.map(r=>{
    const e = cpcCalcEstimates(r);
    return [r.group,r.media,r.cat||'',(r.avg_rank||0).toFixed(1),e.cpc_actual,e.cpc_r1,e.cpc_r2,e.cpc_r3,e.cpc_r4,e.cpc_r5].join(',');
  });
  const csv = [hdr.join(','),...body].join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '예상CPC_'+_cpcDevice+'.csv';
  a.click();
}
