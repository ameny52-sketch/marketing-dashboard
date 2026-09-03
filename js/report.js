// ===== 커스텀 보고서 (파워컨텐츠/키워드/디스플레이/제휴·기타 공용 피벗 빌더) =====
// 각 카테고리의 실제 데이터를 "롱포맷"(한 행 = 축값들 + 지표 원천값)으로 펼친 뒤,
// 사용자가 고른 행/열 축·지표로 다시 묶어 표로 그린다. 목업(custom-report-prototype-v4.html)의
// 피벗 로직을 그대로 쓰되, 데이터는 SAMPLE이 아니라 실제 resultData/kwData/_displayData/CRM_DATA다.

const CR_METRIC_DEFS = {
  '노출수':   {type:'count',  calc:s=>s.imp},
  '클릭수':   {type:'count',  calc:s=>s.clk},
  'DB수':     {type:'count',  calc:s=>s.db},
  '광고비':   {type:'money',  calc:s=>s.cost},
  'CTR':      {type:'percent',calc:s=>s.imp>0?Math.round(s.clk/s.imp*10000)/100:null},
  'DB전환율': {type:'percent',calc:s=>s.clk>0?Math.round(s.db/s.clk*1000)/10:null},
  'DB단가':   {type:'money',  calc:s=>s.db>0?Math.round(s.cost/s.db):null},
  '계약수':   {type:'count',  calc:s=>s.contracts},
  '계약률':   {type:'percent',calc:s=>s.db>0?Math.round(s.contracts/s.db*1000)/10:null},
  '평가업적': {type:'money',  calc:s=>Math.round(s.perf)},
  '평가업적比광고비': {type:'percent', calc:s=>s.perf>0?Math.round(s.cost/s.perf*1000)/10:null},
  '계약수(누적)':   {type:'count',  calc:s=>s.contracts_cum},
  '계약률(누적)':   {type:'percent',calc:s=>s.db>0?Math.round(s.contracts_cum/s.db*1000)/10:null},
  '평가업적(누적)': {type:'money',  calc:s=>Math.round(s.perf_cum)},
  '평가업적比광고비(누적)': {type:'percent', calc:s=>s.perf_cum>0?Math.round(s.cost/s.perf_cum*1000)/10:null},
};

const CUSTOM_REPORT_CONFIG = {
  pc: {
    name:'파워컨텐츠', filterKey:'기기', filterLabel:'기기',
    axes:['월','일자','보종','캠페인','광고그룹','기기','인타입'],
    metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가','계약수','계약률','평가업적','평가업적比광고비','계약수(누적)','계약률(누적)','평가업적(누적)','평가업적比광고비(누적)'],
    presets:{
      monthly:{label:'월별 보종 성과', rows:['보종'], cols:['월'], metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가'], metricPosition:'row'},
      group:{label:'광고그룹 효율', rows:['보종','광고그룹'], cols:['월'], metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가'], metricPosition:'column'},
      sales:{label:'계약 효율', rows:['보종','광고그룹'], cols:['월'], metrics:['DB수','계약수','계약률','평가업적','평가업적比광고비'], metricPosition:'row'},
      cum:{label:'누적 영업 성과', rows:['보종','기기'], cols:['월'], metrics:['DB수','계약수(누적)','계약률(누적)','평가업적(누적)'], metricPosition:'column'},
    }
  },
  keyword: {
    name:'키워드', filterKey:'매체', filterLabel:'매체',
    axes:['월','일자','매체','기기','보종','키워드','인타입'],
    metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가','계약수','계약률','평가업적','평가업적比광고비'],
    presets:{
      monthly:{label:'월별 매체 성과', rows:['매체'], cols:['월'], metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가'], metricPosition:'row'},
      category:{label:'보종별 효율', rows:['매체','보종'], cols:['월'], metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가'], metricPosition:'column'},
      keyword:{label:'키워드 상세', rows:['매체','키워드'], cols:['월'], metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가'], metricPosition:'row'},
      sales:{label:'계약 효율', rows:['매체','보종'], cols:['월'], metrics:['DB수','계약수','계약률','평가업적'], metricPosition:'row'},
    }
  },
  display: {
    name:'디스플레이', filterKey:'매체', filterLabel:'매체',
    axes:['매체','영역','소재','월'],
    metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가','계약수','계약률','평가업적','평가업적比광고비','계약수(누적)','계약률(누적)','평가업적(누적)','평가업적比광고비(누적)'],
    presets:{
      monthly:{label:'월별 매체 성과', rows:['매체'], cols:['월'], metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가'], metricPosition:'row'},
      area:{label:'영역별 효율 비교', rows:['매체'], cols:['영역'], metrics:['DB수','광고비','CTR','DB전환율','DB단가','계약수','계약률','평가업적比광고비'], metricPosition:'row'},
      creative:{label:'소재별 상세 성과', rows:['매체','영역','소재'], cols:['월'], metrics:['노출수','클릭수','DB수','광고비','CTR','DB전환율','DB단가'], metricPosition:'column'},
      sales:{label:'영업 성과 비교', rows:['매체','영역'], cols:['월'], metrics:['DB수','계약수','계약률','평가업적'], metricPosition:'row'},
    }
  },
  affiliate: {
    name:'제휴·기타', filterKey:'세부매체', filterLabel:'세부매체',
    axes:['세부매체','월','일자'],
    metrics:['DB수','계약수','계약률','평가업적','계약수(누적)','계약률(누적)','평가업적(누적)'],
    presets:{
      monthly:{label:'월별 DB 현황', rows:['세부매체'], cols:['월'], metrics:['DB수','계약수','계약률','평가업적'], metricPosition:'row'},
      cum:{label:'누적 영업 성과', rows:['세부매체'], cols:['월'], metrics:['DB수','계약수(누적)','계약률(누적)','평가업적(누적)'], metricPosition:'column'},
      daily:{label:'최근 일자별 추이', rows:['세부매체'], cols:['일자'], metrics:['DB수','계약수'], metricPosition:'row'},
    }
  },
};

// ===== 상태 =====
let _crCategory = 'pc';
let _crEditMode = 'rows';
let _crState = null;      // 사용자가 편집 중인 상태
let _crApplied = null;    // 마지막으로 "적용"된 상태의 스냅샷
let _crDragged = null;
let _crPivotResult = null; // CSV 다운로드용
let _crInitialized = false;
const _crRowsCache = {pc:null, keyword:null, display:null, affiliate:null};
const _crLoadingPromise = {};

function _crEmptySum(){ return {imp:0,clk:0,db:0,cost:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0}; }
function _crAddSum(a,b){ ['imp','clk','db','cost','contracts','perf','contracts_cum','perf_cum'].forEach(k=>a[k]+=(b[k]||0)); return a; }
function _crMetricValue(sum,key){ const def=CR_METRIC_DEFS[key]; return def ? def.calc(sum) : null; }
function _crFormat(v,key){
  if(v===null||v===undefined||!Number.isFinite(v)) return '—';
  const def = CR_METRIC_DEFS[key];
  if(def && def.type==='percent') return `${v.toLocaleString('ko-KR',{maximumFractionDigits:1})}%`;
  if(def && def.type==='money') return `${Math.round(v).toLocaleString('ko-KR')}원`;
  return Math.round(v).toLocaleString('ko-KR');
}
function _crMonthLabel(ym){
  const mm = String(ym).match(/^(\d{4})-(\d{2})$/);
  return mm ? `${mm[1]}년 ${parseInt(mm[2])}월` : ym;
}
function _crAxisLabel(axis,v){ return axis==='월' ? _crMonthLabel(v) : v; }
function _crMonthFromDK(dk){
  const mm = String(dk).match(/^(\d{4})\.(\d{2})\./);
  return mm ? `${mm[1]}-${mm[2]}` : null;
}

// ===== 카테고리별 롱포맷 어댑터 =====
async function _crBuildPcRows(){
  if(_crRowsCache.pc) return _crRowsCache.pc;
  const data = await _ensureDailyAllMonthsLoaded();
  const long = [];
  (data.resultData||[]).forEach(r=>{
    const dateSet = new Set();
    (r.daily_raw||[]).forEach(d=>{ if(d.date) dateSet.add(d.date); });
    Object.keys(r.daily_sales_map||{}).forEach(dk=>dateSet.add(dk));
    dateSet.forEach(dk=>{
      const ym = _crMonthFromDK(dk);
      if(!ym) return;
      const adEntries = (r.daily_raw||[]).filter(d=>d.date===dk);
      const cost = adEntries.reduce((s,d)=>s+(d.cost||0),0);
      const clk  = adEntries.reduce((s,d)=>s+(d.clicks||0),0);
      const imp  = adEntries.reduce((s,d)=>s+(d.impressions||0),0);
      const sale = (r.daily_sales_map||{})[dk] || {};
      long.push({
        월:ym, 일자:dk, 보종:r.cat||'기타', 캠페인:r.camp||'(미지정)', 광고그룹:r.group, 기기:r.media||'-', 인타입:r.intype||'-',
        imp, clk, cost,
        db: sale.db||0, contracts: sale.contracts||0, perf: sale.performance||0,
        contracts_cum: sale.contracts_cum||0, perf_cum: sale.performance_cum||0,
      });
    });
  });
  _crRowsCache.pc = long;
  return long;
}

async function _crBuildKeywordRows(){
  if(_crRowsCache.keyword) return _crRowsCache.keyword;
  const s = await loadAllSheets();
  const data = _apiKeyword('', s);
  const rows = (data && !data.error) ? (data.result||[]) : [];
  const long = [];
  rows.forEach(r=>{
    Object.entries(r.daily||{}).forEach(([dk,d])=>{
      const ym = _crMonthFromDK(dk);
      if(!ym) return;
      long.push({
        월:ym, 일자:dk, 매체:r.sub_media||'-', 기기:r.device||'-', 보종:r.cat||'기타', 키워드:r.keyword||'-', 인타입:r.intype||'-',
        imp: d.impressions||0, clk: d.clicks||0, cost: d.cost||0,
        db: d.db||0, contracts: d.contracts||0, perf: d.perf||0,
        contracts_cum: 0, perf_cum: 0,
      });
    });
  });
  _crRowsCache.keyword = long;
  return long;
}

async function _crEnsureDisplayDataLoaded(){
  if(_displayData) return;
  if(!_displayLoaded){ _displayLoaded = true; await loadDisplayData(); return; }
  let tries = 0;
  while(!_displayData && tries < 50){ await new Promise(r=>setTimeout(r,100)); tries++; }
}

async function _crBuildDisplayRows(){
  if(_crRowsCache.display) return _crRowsCache.display;
  await _crEnsureDisplayDataLoaded();
  const long = _buildAllDisplayLongRows();
  _crRowsCache.display = long;
  return long;
}

async function _crBuildAffiliateRows(){
  if(_crRowsCache.affiliate) return _crRowsCache.affiliate;
  const data = await _ensureDailyAllMonthsLoaded();
  const crmData = data.crmData || {};
  const excluded = new Set(['파워컨텐츠','네이버','구글','다음']);
  const long = [];
  Object.entries(crmData).forEach(([dk, mediaMap])=>{
    const ym = _crMonthFromDK(dk);
    if(!ym) return;
    Object.entries(mediaMap).forEach(([media, sum])=>{
      if(excluded.has(media)) return;
      long.push({
        월:ym, 일자:dk, 세부매체:media,
        imp:0, clk:0, cost:0,
        db: sum.db||0, contracts: sum.contracts||0, perf: sum.perf||0,
        contracts_cum: sum.contracts_cum||0, perf_cum: sum.perf_cum||0,
      });
    });
  });
  _crRowsCache.affiliate = long;
  return long;
}

function _crBuildRows(cat){
  if(_crLoadingPromise[cat]) return _crLoadingPromise[cat];
  const fn = {pc:_crBuildPcRows, keyword:_crBuildKeywordRows, display:_crBuildDisplayRows, affiliate:_crBuildAffiliateRows}[cat];
  _crLoadingPromise[cat] = fn().finally(()=>{ _crLoadingPromise[cat] = null; });
  return _crLoadingPromise[cat];
}

// ===== 초기화 / 카테고리 전환 =====
function initCustomReportTab(){
  if(_crInitialized) return;
  _crInitialized = true;
  const firstBtn = document.querySelector('#cr-category-tabs .main-tab');
  switchCustomReportCategory('pc', firstBtn);
}

function _crDefaultState(cat, rows){
  const cfg = CUSTOM_REPORT_CONFIG[cat];
  const filterValues = _crFilterValues(cat, rows);
  const months = _crMonthsFor(rows);
  const preset = cfg.presets.monthly || Object.values(cfg.presets)[0];
  return {
    filters: [...filterValues],
    from: months[0] || '',
    to: months[months.length-1] || '',
    rows: [...preset.rows], cols: [...preset.cols],
    metrics: [...preset.metrics], metricPosition: preset.metricPosition,
  };
}
function _crFilterValues(cat, rows){
  const key = CUSTOM_REPORT_CONFIG[cat].filterKey;
  return [...new Set((rows||[]).map(r=>r[key]).filter(v=>v!==undefined && v!==null && v!==''))].sort((a,b)=>String(a).localeCompare(String(b),'ko'));
}
function _crMonthsFor(rows){
  return [...new Set((rows||[]).map(r=>r.월).filter(Boolean))].sort();
}

async function switchCustomReportCategory(cat, btn){
  _crCategory = cat;
  _crEditMode = 'rows';
  if(btn){
    document.querySelectorAll('#cr-category-tabs .main-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  q('#cr-settings-title').textContent = `${CUSTOM_REPORT_CONFIG[cat].name} 보고서 설정`;
  q('#cr-preview-title').textContent = `${CUSTOM_REPORT_CONFIG[cat].name} 결과 미리보기`;
  q('#cr-table').innerHTML = '';
  q('#cr-summary').textContent = '';
  _crSetNotice('데이터 불러오는 중', ' 잠시만 기다려주세요...');

  const rows = await _crBuildRows(cat);
  if(_crCategory !== cat) return; // 그 사이 다른 카테고리로 전환됨
  _crState = _crDefaultState(cat, rows);
  _crRenderPresets('monthly');
  _crRenderControls();
  applyCustomReport();
}

// ===== 컨트롤 렌더링 =====
function q(sel){ return document.querySelector(sel); }
function qa(sel){ return [...document.querySelectorAll(sel)]; }

function _crRenderControls(){
  _crRenderFilters();
  _crRenderAxisOptions();
  _crRenderMetrics();
  _crRenderSummary();
}

function _crRenderPresets(activeKey){
  const cfg = CUSTOM_REPORT_CONFIG[_crCategory];
  q('#cr-preset-buttons').innerHTML = Object.entries(cfg.presets).map(([k,p])=>
    `<button class="tab-btn ${k===activeKey?'active':''}" data-preset="${k}">${p.label}</button>`
  ).join('');
}

function _crRenderFilters(){
  const cfg = CUSTOM_REPORT_CONFIG[_crCategory];
  const rows = _crRowsCache[_crCategory] || [];
  const values = _crFilterValues(_crCategory, rows);
  q('#cr-filter-label').textContent = cfg.filterLabel;
  q('#cr-filter-options').innerHTML = values.map(v=>
    `<button class="tab-btn cr-filter-btn ${_crState.filters.includes(v)?'active':''}" data-value="${v}">${v}</button>`
  ).join('');
  const months = _crMonthsFor(rows);
  const opt = m => `<option value="${m}">${_crMonthLabel(m)}</option>`;
  q('#cr-month-from').innerHTML = months.map(opt).join('');
  q('#cr-month-to').innerHTML = months.map(opt).join('');
  q('#cr-month-from').value = _crState.from;
  q('#cr-month-to').value = _crState.to;
}

function _crRenderAxisOptions(){
  const cfg = CUSTOM_REPORT_CONFIG[_crCategory];
  const usedOther = _crEditMode==='rows' ? _crState.cols : _crState.rows;
  const current = _crState[_crEditMode];
  q('#cr-axis-help').textContent = `아래 항목을 선택하면 ${_crEditMode==='rows'?'행':'열'} 기준에 추가됩니다.`;
  qa('#cr-mode-switch .tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===_crEditMode));
  qa('.cr-order-zone').forEach(z=>z.classList.toggle('active', z.dataset.zone===_crEditMode));
  q('#cr-axis-options').innerHTML = cfg.axes.map(a=>{
    const disabled = usedOther.includes(a);
    return `<button class="tab-btn cr-axis-btn ${current.includes(a)?'active':''}" data-axis="${a}" ${disabled?'disabled':''}>${a}</button>`;
  }).join('');
  _crRenderOrders();
}

function _crRenderOrders(){
  _crRenderOrder('rows', q('#cr-row-sortable'));
  _crRenderOrder('cols', q('#cr-col-sortable'));
}
function _crRenderOrder(kind, wrap){
  const arr = _crState[kind];
  wrap.innerHTML = arr.length ? arr.map(a=>
    `<div class="cr-order-item" draggable="true" data-kind="${kind}" data-axis="${a}">
      <span class="cr-drag-handle" aria-hidden="true">⠿</span>
      <span class="cr-order-label">${a}</span>
      <button class="cr-order-remove" type="button" aria-label="${a} 제거">×</button>
    </div>`
  ).join('') : `<div class="cr-order-empty">${kind==='rows'?'행':'열'} 기준을 선택하세요.</div>`;
  qa('.cr-order-item', wrap).forEach(item=>{
    item.addEventListener('dragstart', ()=>{ _crDragged = {kind:item.dataset.kind, axis:item.dataset.axis}; item.classList.add('dragging'); });
    item.addEventListener('dragend', ()=>{ _crDragged = null; qa('.cr-order-item').forEach(x=>x.classList.remove('dragging','drag-over')); });
    item.addEventListener('dragover', e=>{ e.preventDefault(); if(_crDragged && _crDragged.kind===item.dataset.kind) item.classList.add('drag-over'); });
    item.addEventListener('dragleave', ()=>item.classList.remove('drag-over'));
    item.addEventListener('drop', e=>{
      e.preventDefault();
      if(!_crDragged || _crDragged.kind!==item.dataset.kind) return;
      _crMoveAxis(_crDragged.kind, _crDragged.axis, item.dataset.axis);
    });
    item.querySelector('.cr-order-remove').addEventListener('click', e=>{
      e.stopPropagation();
      _crState[kind] = _crState[kind].filter(x=>x!==item.dataset.axis);
      _crChanged();
    });
  });
}
function _crMoveAxis(kind, fromKey, toKey){
  if(fromKey===toKey) return;
  const arr = _crState[kind];
  const from = arr.indexOf(fromKey), to = arr.indexOf(toKey);
  arr.splice(from,1); arr.splice(to,0,fromKey);
  _crChanged();
}

function _crRenderMetrics(){
  const cfg = CUSTOM_REPORT_CONFIG[_crCategory];
  q('#cr-metric-groups').innerHTML = `<div class="tab-bar">${cfg.metrics.map(m=>
    `<button class="tab-btn cr-metric-btn ${_crState.metrics.includes(m)?'active':''}" data-metric="${m}">${m}</button>`
  ).join('')}</div>`;
  qa('#cr-metric-position .tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.position===_crState.metricPosition));
}

function _crRenderSummary(){
  const cfg = CUSTOM_REPORT_CONFIG[_crCategory];
  const values = _crFilterValues(_crCategory, _crRowsCache[_crCategory]||[]);
  const filterText = _crState.filters.length===values.length ? `전체 ${cfg.filterLabel}` : `${_crState.filters.length}개 ${cfg.filterLabel}`;
  const rowsText = _crState.rows.join(' › ') || '미선택';
  const colsText = _crState.cols.join(' › ') || '미선택';
  q('#cr-summary').textContent =
    `${filterText} · ${_crState.from||'-'}~${_crState.to||'-'} · 행 ${rowsText} · 열 ${colsText} · 지표 ${_crState.metricPosition==='row'?'행':'열'} 배치`;
}

function _crSetNotice(title, text, warning){
  q('#cr-notice-title').textContent = title;
  q('#cr-notice-text').textContent = text;
  q('#cr-notice').classList.toggle('warning', !!warning);
}

function _crChanged(){
  qa('#cr-preset-buttons .tab-btn').forEach(b=>b.classList.remove('active'));
  _crRenderControls();
  _crSetNotice('사용자 설정', ' 조건이 변경되었습니다. 보고서 적용을 눌러주세요.');
}

function setCustomReportEditMode(mode, btn){
  _crEditMode = mode;
  _crRenderAxisOptions();
}
function setCustomReportMetricPosition(pos, btn){
  _crState.metricPosition = pos;
  _crChanged();
}

function _crUsePreset(key){
  const cfg = CUSTOM_REPORT_CONFIG[_crCategory];
  const p = cfg.presets[key];
  if(!p) return;
  _crState = {..._crState, rows:[...p.rows], cols:[...p.cols], metrics:[...p.metrics], metricPosition:p.metricPosition};
  _crRenderPresets(key);
  _crRenderControls();
  applyCustomReport();
  _crSetNotice(p.label, ' 프리셋이 적용되었습니다.');
}

function resetCustomReport(){
  _crState = _crDefaultState(_crCategory, _crRowsCache[_crCategory]||[]);
  _crRenderPresets('monthly');
  _crRenderControls();
  applyCustomReport();
}

// ===== 피벗 계산 =====
function _crFilteredRows(){
  const cfg = CUSTOM_REPORT_CONFIG[_crCategory];
  const key = cfg.filterKey;
  const rows = _crRowsCache[_crCategory] || [];
  return rows.filter(r=>_crState.filters.includes(r[key]) && r.월>=_crState.from && r.월<=_crState.to);
}
function _crComboKey(values){ return values.join(''); }
function _crMakeCombos(rows, axes){
  const m = new Map();
  rows.forEach(r=>{ const v = axes.map(a=>r[a]!==undefined&&r[a]!==null&&r[a]!==''?r[a]:'(미지정)'); m.set(_crComboKey(v), v); });
  return [...m.values()].sort((a,b)=>_crComboKey(a).localeCompare(_crComboKey(b),'ko'));
}
function _crComputeRowGroupSpans(combos, levelCount){
  const meta = combos.map(()=>Array(levelCount).fill(null));
  for(let lvl=0; lvl<levelCount; lvl++){
    let i=0;
    while(i<combos.length){
      let j=i+1;
      const prefix = combos[i].slice(0,lvl+1).join('');
      while(j<combos.length && combos[j].slice(0,lvl+1).join('')===prefix) j++;
      meta[i][lvl] = j-i;
      for(let k=i+1;k<j;k++) meta[k][lvl] = 0;
      i=j;
    }
  }
  return meta;
}
function _crBuildPivot(){
  const rows = _crFilteredRows();
  const s = _crState;
  const rowCombos = _crMakeCombos(rows, s.rows);
  const colCombos = s.cols.length ? _crMakeCombos(rows, s.cols) : [[]];
  const sums = new Map();
  rows.forEach(r=>{
    const rk = s.rows.map(a=>r[a]!==undefined&&r[a]!==null&&r[a]!==''?r[a]:'(미지정)').join('');
    const ck = s.cols.map(a=>r[a]!==undefined&&r[a]!==null&&r[a]!==''?r[a]:'(미지정)').join('');
    const key = rk+''+ck;
    if(!sums.has(key)) sums.set(key, _crEmptySum());
    _crAddSum(sums.get(key), r);
  });
  return {rows, rowCombos, colCombos, sums, state:{...s, rows:[...s.rows], cols:[...s.cols], metrics:[...s.metrics]}};
}
function _crSumCell(p, rowCombo, colCombo){
  return p.sums.get(_crComboKey(rowCombo)+''+_crComboKey(colCombo)) || _crEmptySum();
}

function _crRenderMetricRows(p){
  const s = p.state;
  const headers = s.rows.map(a=>`<th class="cr-axis-cell" rowspan="${s.cols.length>1?2:1}">${a}</th>`).join('')
    + `<th class="cr-metric-cell" rowspan="${s.cols.length>1?2:1}">지표</th>`;
  let thead;
  if(s.cols.length>1){
    thead = `<tr>${headers}${p.colCombos.map(c=>`<th class="cr-column-group">${c.map((v,i)=>_crAxisLabel(s.cols[i],v)).join(' › ')}</th>`).join('')}<th class="cr-total" rowspan="2">합계</th></tr><tr>${p.colCombos.map(()=>'<th>값</th>').join('')}</tr>`;
  } else {
    thead = `<tr>${headers}${p.colCombos.map(c=>`<th>${c.length?c.map((v,i)=>_crAxisLabel(s.cols[i],v)).join(' › '):'값'}</th>`).join('')}<th class="cr-total">합계</th></tr>`;
  }
  const max = Math.max(1, Math.floor(240/s.metrics.length));
  const shown = p.rowCombos.slice(0, max);
  const spans = _crComputeRowGroupSpans(shown, s.rows.length);
  const body = shown.map((rc,ri)=>s.metrics.map((m,mi)=>{
    let levelCells = '';
    if(mi===0){
      levelCells = s.rows.map((a,lvl)=>{
        const span = spans[ri][lvl];
        if(!span) return '';
        return `<td class="cr-axis-cell" rowspan="${span*s.metrics.length}">${_crAxisLabel(a,rc[lvl])}</td>`;
      }).join('');
    }
    const total = _crEmptySum();
    const cells = p.colCombos.map(cc=>{
      const sum = _crSumCell(p, rc, cc);
      _crAddSum(total, sum);
      return `<td>${_crFormat(_crMetricValue(sum,m), m)}</td>`;
    }).join('');
    const rowStartCls = (ri && mi===0) ? ' cr-group-start' : '';
    return `<tr class="${rowStartCls}">${levelCells}<td class="cr-metric-cell">${m}</td>${cells}<td class="cr-total">${_crFormat(_crMetricValue(total,m), m)}</td></tr>`;
  }).join('')).join('');
  return {html:`<thead>${thead}</thead><tbody>${body}</tbody>`, shown: shown.length*s.metrics.length, total: p.rowCombos.length*s.metrics.length};
}

function _crRenderMetricColumns(p){
  const s = p.state;
  const dimHeads = s.rows.map(a=>`<th class="cr-axis-cell" rowspan="2">${a}</th>`).join('');
  const colGroups = p.colCombos.map(c=>`<th class="cr-column-group" colspan="${s.metrics.length}">${c.length?c.map((v,i)=>_crAxisLabel(s.cols[i],v)).join(' › '):'값'}</th>`).join('');
  const totalGroup = `<th class="cr-column-group cr-total" colspan="${s.metrics.length}">합계</th>`;
  const metricHeads = [...p.colCombos, []].map(()=>s.metrics.map(m=>`<th>${m}</th>`).join('')).join('');
  const shown = p.rowCombos.slice(0,240);
  const body = shown.map((rc,ri)=>{
    const total = _crEmptySum();
    const cells = p.colCombos.map(cc=>{
      const sum = _crSumCell(p, rc, cc);
      _crAddSum(total, sum);
      return s.metrics.map(m=>`<td>${_crFormat(_crMetricValue(sum,m), m)}</td>`).join('');
    }).join('');
    return `<tr class="${ri?'cr-group-start':''}">${rc.map((v,i)=>`<td class="cr-axis-cell">${_crAxisLabel(s.rows[i],v)}</td>`).join('')}${cells}${s.metrics.map(m=>`<td class="cr-total">${_crFormat(_crMetricValue(total,m), m)}</td>`).join('')}</tr>`;
  }).join('');
  return {html:`<thead><tr>${dimHeads}${colGroups}${totalGroup}</tr><tr>${metricHeads}</tr></thead><tbody>${body}</tbody>`, shown: shown.length, total: p.rowCombos.length};
}

function applyCustomReport(){
  if(!_crState.rows.length) return _crShowEmpty('행 기준을 1개 이상 선택하세요.');
  if(!_crState.metrics.length) return _crShowEmpty('표시 지표를 1개 이상 선택하세요.');
  if(_crState.from > _crState.to) return _crShowEmpty('조회 시작 월이 종료 월보다 늦습니다.');
  _crApplied = {..._crState};
  _crPivotResult = _crBuildPivot();
  const out = _crApplied.metricPosition==='row' ? _crRenderMetricRows(_crPivotResult) : _crRenderMetricColumns(_crPivotResult);
  q('#cr-table').innerHTML = out.html;
  q('#cr-table-foot').textContent = `원천 ${_crPivotResult.rows.length.toLocaleString()}행 · 결과 ${out.total.toLocaleString()}행${out.shown<out.total?` · 화면 ${out.shown.toLocaleString()}행 표시(CSV는 전체)`:''}`;
  _crSetNotice('보고서 적용 완료', ' 선택한 행·열·지표 구성으로 결과를 만들었습니다.');
  _crRenderSummary();
}
function _crShowEmpty(msg){
  q('#cr-table').innerHTML = `<tbody><tr><td class="cr-empty-cell">${msg}</td></tr></tbody>`;
  q('#cr-table-foot').textContent = '결과 없음';
  _crPivotResult = null;
}

function downloadCustomReportCsv(){
  if(!_crPivotResult || !_crPivotResult.state.metrics.length){ alert('먼저 보고서를 적용하세요.'); return; }
  const p = _crPivotResult, s = p.state;
  const lines = [];
  if(s.metricPosition==='row'){
    lines.push([...s.rows, '지표', ...p.colCombos.map(c=>c.length?c.map((v,i)=>_crAxisLabel(s.cols[i],v)).join(' › '):'값'), '합계']);
    p.rowCombos.forEach(rc=>s.metrics.forEach(m=>{
      const total = _crEmptySum();
      const vals = p.colCombos.map(cc=>{ const x=_crSumCell(p,rc,cc); _crAddSum(total,x); const v=_crMetricValue(x,m); return v===null||v===undefined?'':v; });
      lines.push([...rc, m, ...vals, _crMetricValue(total,m)??'']);
    }));
  } else {
    const heads = [...s.rows];
    p.colCombos.forEach(c=>s.metrics.forEach(m=>heads.push(`${c.length?c.map((v,i)=>_crAxisLabel(s.cols[i],v)).join(' › '):'값'} · ${m}`)));
    s.metrics.forEach(m=>heads.push(`합계 · ${m}`));
    lines.push(heads);
    p.rowCombos.forEach(rc=>{
      const total = _crEmptySum(); const vals=[];
      p.colCombos.forEach(cc=>{ const x=_crSumCell(p,rc,cc); _crAddSum(total,x); s.metrics.forEach(m=>vals.push(_crMetricValue(x,m)??'')); });
      lines.push([...rc, ...vals, ...s.metrics.map(m=>_crMetricValue(total,m)??'')]);
    });
  }
  const csv = lines.map(r=>r.map(_csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${CUSTOM_REPORT_CONFIG[_crCategory].name}_커스텀보고서_${s.metricPosition==='row'?'지표행':'지표열'}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 0);
}

// ===== 이벤트 바인딩 (한 번만) =====
document.addEventListener('DOMContentLoaded', ()=>{
  q('#cr-preset-buttons').addEventListener('click', e=>{
    if(e.target.dataset.preset) _crUsePreset(e.target.dataset.preset);
  });
  q('#cr-filter-options').addEventListener('click', e=>{
    const btn = e.target.closest('.cr-filter-btn'); if(!btn) return;
    btn.classList.toggle('active');
    _crState.filters = qa('#cr-filter-options .cr-filter-btn.active').map(b=>b.dataset.value);
    _crChanged();
  });
  q('#cr-month-from').addEventListener('change', e=>{ _crState.from = e.target.value; _crChanged(); });
  q('#cr-month-to').addEventListener('change', e=>{ _crState.to = e.target.value; _crChanged(); });
  q('#cr-axis-options').addEventListener('click', e=>{
    const btn = e.target.closest('.cr-axis-btn'); if(!btn || btn.disabled) return;
    const arr = _crState[_crEditMode], key = btn.dataset.axis;
    const limit = _crEditMode==='rows' ? 4 : 3;
    if(!btn.classList.contains('active')){
      if(arr.length>=limit){ alert(`${_crEditMode==='rows'?'행':'열'} 기준은 최대 ${limit}개까지 선택할 수 있습니다.`); return; }
      arr.push(key);
    } else {
      _crState[_crEditMode] = arr.filter(x=>x!==key);
    }
    _crChanged();
  });
  q('#cr-metric-groups').addEventListener('click', e=>{
    const btn = e.target.closest('.cr-metric-btn'); if(!btn) return;
    btn.classList.toggle('active');
    const key = btn.dataset.metric;
    _crState.metrics = btn.classList.contains('active') ? [..._crState.metrics, key] : _crState.metrics.filter(x=>x!==key);
    _crChanged();
  });
});
