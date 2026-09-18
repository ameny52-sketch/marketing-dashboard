// ===== 일별 추이 차트 + 날짜 클릭 상세 모달 (데이터현황 / 키워드) =====
// (js/insights.js 에서 분리 — 로직 변경 없음. 로드 순서는 index.html 참고)

// ===== 데이터현황 탭: 일별 추이 차트 (필터된 광고그룹 전체 합계) + 날짜 클릭 → 광고그룹별 상세 =====
let _dataChartJsLoading = false;
let _dataChartSingle = null;
let _dataChartMetric = 'db';
let _dataChartLastRows = null; // 토글 버튼 클릭 시 재사용
const _DATA_CHART_METRICS = {
  cost:  {label:'광고비',   type:'bar',  unit:'원'},
  db:    {label:'DB수',     type:'bar',  unit:'건'},
  cpd:   {label:'DB단가',   type:'line', unit:'원'},
  ctr:   {label:'CTR',      type:'line', unit:'%'},
  dbcvr: {label:'DB전환율', type:'line', unit:'%'}
};

function _parseYmd(s){
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}

// 광고그룹이 너무 많아 그룹별로 나누면 알아보기 어려우므로, 필터된 그룹 전체를 날짜별로 합산한 단일 시리즈로 표시
// 데이터가 없는 날짜도 0으로 채워서 기간 전체를 빈틈없이 보여준다
function _buildDataDailySeries(rows){
  const byDate = {};
  rows.forEach(r=>{
    (r.daily_raw||[]).forEach(d=>{
      if(!d.date) return;
      const k = _normDS(d.date);
      if(!byDate[k]) byDate[k] = {cost:0, imp:0, clk:0, db:0};
      byDate[k].cost += d.cost||0;
      byDate[k].imp  += d.impressions||0;
      byDate[k].clk  += d.clicks||0;
    });
    Object.entries(r.daily_sales_map||{}).forEach(([dt,v])=>{
      const k = _normDS(dt);
      if(!byDate[k]) byDate[k] = {cost:0, imp:0, clk:0, db:0};
      byDate[k].db += v.db||0;
    });
  });
  const known = Object.keys(byDate).sort();
  if(!known.length) return {dates:[], byDate};

  const dates = [];
  const cur = _parseYmd(known[0]);
  const end = _parseYmd(known[known.length-1]);
  while(cur <= end){
    const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    dates.push(ds);
    if(!byDate[ds]) byDate[ds] = {cost:0, imp:0, clk:0, db:0};
    cur.setDate(cur.getDate()+1);
  }
  return {dates, byDate};
}

// "2026년 7월" → "2026년 6월" (1월이면 전년도 12월로) — 그래프에 전달 비교선을 겹치기 위한 월 계산
function _prevMonthLabel(label){
  const m = (label||'').match(/(\d+)년\s*(\d+)월/);
  if(!m) return null;
  let y=+m[1], mo=+m[2]-1;
  if(mo<1){ mo=12; y-=1; }
  return `${y}년 ${mo}월`;
}

async function renderDataChart(rows){
  _dataChartLastRows = rows;
  if(!window.Chart){
    if(!_dataChartJsLoading){
      _dataChartJsLoading = true;
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
      s.onload = () => { renderDataChart(rows); };
      document.head.appendChild(s);
    }
    return;
  }

  const {dates, byDate} = _buildDataDailySeries(rows);
  const metric = _DATA_CHART_METRICS[_dataChartMetric] || _DATA_CHART_METRICS.cost;
  const titleEl = document.getElementById('data-chart-title-text');
  if(titleEl) titleEl.textContent = `일별 ${metric.label} 추이`;

  const ctx = document.getElementById('data-chart-single')?.getContext('2d');
  if(!ctx) return;
  if(_dataChartSingle) _dataChartSingle.destroy();
  if(!dates.length) return;

  const valueOf = (b) => {
    if(_dataChartMetric==='cost')   return b.cost;
    if(_dataChartMetric==='db')     return b.db;
    if(_dataChartMetric==='cpd')    return b.db>0 ? Math.round(b.cost/b.db) : null;
    if(_dataChartMetric==='ctr')    return b.imp>0 ? Math.round(b.clk/b.imp*10000)/100 : null;
    if(_dataChartMetric==='dbcvr')  return b.clk>0 ? Math.round(b.db/b.clk*1000)/10 : null;
    return null;
  };

  const dayLabels = dates.map(d=>parseInt(d.split('-')[2],10)+'일');
  const values = dates.map(d=>valueOf(byDate[d]));
  const curDataset = metric.type==='bar'
    ? {type:'bar', label:metric.label, data:values, backgroundColor:'#ff9b00', stack:'cur'}
    : {type:'line', label:metric.label, data:values, borderColor:'#ff9b00', backgroundColor:'#ff9b00', tension:0.3};
  let datasets = [curDataset];

  // 광고비는 절대 금액이라 전달과 겹쳐봐야 큰 의미가 없어 제외 — 나머지 지표는 같은 날짜(N일) 축으로
  // 전달 값을 겹쳐서 추이 비교가 가능하게 한다 (현재 적용된 매체/카테고리 등 필터는 반영 안 하고 전체 기준).
  // DB수처럼 막대 지표는 전달도 막대로(왼쪽)+당월 막대(오른쪽), 비율 지표는 점선으로 겹친다
  if(_dataChartMetric!=='cost'){
    const monthSel = document.getElementById('month-select')?.value || '';
    const prevLabel = _prevMonthLabel(monthSel);
    if(prevLabel){
      const s = await loadAllSheets();
      const prevResult = _apiAnalyze(prevLabel, s).result || [];
      const {byDate: prevByDate} = _buildDataDailySeries(prevResult);
      const prevByDay = {};
      Object.keys(prevByDate).forEach(d=>{ prevByDay[parseInt(d.split('-')[2],10)] = prevByDate[d]; });
      const prevValues = dates.map(d=>{
        const b = prevByDay[parseInt(d.split('-')[2],10)];
        return b ? valueOf(b) : null;
      });
      const prevDataset = metric.type==='bar'
        ? {type:'bar', label:'전달', data:prevValues, backgroundColor:'#9ca3af', stack:'prev'}
        : {type:'line', label:'전달', data:prevValues, borderColor:'#9ca3af', backgroundColor:'#9ca3af', borderDash:[5,4], tension:0.3, pointRadius:2};
      datasets = [prevDataset, curDataset]; // 전달을 왼쪽, 당월을 오른쪽에 그리도록 순서 배치
    }
  }

  const fmtVal = v => v===null||v===undefined ? '-' : (metric.unit==='%' ? v+'%' : v.toLocaleString()+(metric.unit==='원'?'원':''));
  _dataChartSingle = new Chart(ctx, {
    type: metric.type,
    data: {labels: dayLabels, datasets},
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction: {mode:'index', intersect:false},
      plugins:{
        legend:{display: datasets.length>1, labels:{boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmtVal(c.parsed.y)}`}}
      },
      scales:{
        x:{grid:{display:false},ticks:{font:{size:10},color:'#888',maxRotation:0,autoSkip:true}},
        y:{ticks:{callback:v=>metric.unit==='%'?v+'%':v.toLocaleString(),font:{size:10},color:'#888'},grid:{color:'rgba(0,0,0,0.05)'}}
      },
      onClick: (evt, elements) => {
        if(!elements.length) return;
        const idx = elements[0].index;
        showDailyGroupBreakdown(dates[idx], rows);
      }
    }
  });
}

function switchDataChartMetric(metric, btn){
  document.querySelectorAll('#data-chart-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _dataChartMetric = metric;
  if(_dataChartLastRows) renderDataChart(_dataChartLastRows);
}

// 차트에서 날짜 클릭 시, 그 날짜의 광고그룹별 데이터(광고비/노출/클릭/DB/DB단가/ROAS)를 팝업으로 표시
const DAILY_GROUP_MODAL_COLS = [
  {key:'group', label:'광고그룹'},
  {key:'cost', label:'광고비', num:true, fmt:v=>v.toLocaleString()+'원'},
  {key:'imp', label:'노출수', num:true, fmt:v=>v.toLocaleString()},
  {key:'clicks', label:'클릭수', num:true, fmt:v=>v.toLocaleString()},
  {key:'cpc', label:'CPC', num:true, fmt:v=>v!==null?v.toLocaleString()+'원':'-'},
  {key:'ctr', label:'CTR', num:true, fmt:v=>v!==null?v+'%':'-'},
  {key:'db', label:'DB수', num:true, fmt:v=>v.toLocaleString()+'건'},
  {key:'cpd', label:'DB단가', num:true, fmt:v=>v!==null?v.toLocaleString()+'원':'-'},
  {key:'dbcvr', label:'DB전환율', num:true, fmt:v=>v!==null?v+'%':'-'},
  {key:'roas', label:'ROAS', num:true, special:'roas'},
];
let _dailyGroupModalRows = [];
let _dailyGroupModalDate = '';
let _dailyGroupModalSortCol = 'cost';
let _dailyGroupModalSortAsc = false;

function sortDailyGroupModal(col){
  if(_dailyGroupModalSortCol===col) _dailyGroupModalSortAsc=!_dailyGroupModalSortAsc;
  else{ _dailyGroupModalSortCol=col; _dailyGroupModalSortAsc=false; }
  _renderDailyGroupModalTable();
}

function _renderDailyGroupModalTable(){
  const col = _dailyGroupModalSortCol, asc = _dailyGroupModalSortAsc;
  const list = _dailyGroupModalRows;
  document.getElementById('daily-group-modal-title').textContent = `${_dailyGroupModalDate} — 광고그룹별 상세`;
  const body = document.getElementById('daily-group-modal-body');
  if(!list.length){
    body.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--faint);font-size:12px">해당 날짜에 데이터가 없습니다.</div>`;
    return;
  }
  const sorted = [...list].sort((a,b)=>{
    let av=a[col], bv=b[col];
    if(av===null) av = asc?Infinity:-Infinity;
    if(bv===null) bv = asc?Infinity:-Infinity;
    if(typeof av==='string') return asc?av.localeCompare(bv):bv.localeCompare(av);
    return asc?av-bv:bv-av;
  });
  body.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          ${DAILY_GROUP_MODAL_COLS.map(c=>{
            const arrow = c.key===col ? (asc?' ↑':' ↓') : '';
            return `<th class="${c.num?'ta-right':''}" onclick="sortDailyGroupModal('${c.key}')">${c.label}${arrow}</th>`;
          }).join('')}
        </tr></thead>
        <tbody>
          ${sorted.map(g=>`<tr>
            ${DAILY_GROUP_MODAL_COLS.map(c=>{
              if(c.key==='group') return `<td class="cell-truncate" title="${escHtml(g.group)}">${escHtml(g.group)}</td>`;
              if(c.special==='roas') return `<td class="ta-right">${roasBadge(g.roas)}</td>`;
              return `<td class="ta-right">${c.fmt(g[c.key])}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showDailyGroupBreakdown(date, rows){
  const list = (rows||_dataChartLastRows||[]).map(r=>{
    let cost=0, clicks=0, imp=0;
    (r.daily_raw||[]).forEach(x=>{
      if(_normDS(x.date)!==date) return;
      cost += x.cost||0; clicks += x.clicks||0; imp += x.impressions||0;
    });
    let db=0, perf=0;
    Object.entries(r.daily_sales_map||{}).forEach(([dt,v])=>{
      if(_normDS(dt)!==date) return;
      db += v.db||0; perf += v.performance||0;
    });
    const ctr = imp>0 ? Math.round(clicks/imp*10000)/100 : null;
    const cpc = clicks>0 ? Math.round(cost/clicks) : null;
    const dbcvr = clicks>0 ? Math.round(db/clicks*1000)/10 : null;
    const cpd = db>0 ? Math.round(cost/db) : null;
    const roas = (perf>0 && cost>0) ? Math.round(cost/perf*100) : null;
    return {group:r.group, cost, clicks, imp, db, cpc, cpd, ctr, dbcvr, roas};
  }).filter(g=>g.cost>0 || g.db>0 || g.clicks>0 || g.imp>0);

  _dailyGroupModalRows = list;
  _dailyGroupModalDate = date;
  _renderDailyGroupModalTable();
  document.getElementById('daily-group-modal-bg').style.display = 'flex';
}

// ===== 키워드 데이터현황 탭: 일별 추이 차트 (매체별 누적) + 날짜 클릭 → 매체별 상세 =====
let _kwChartInstance = null;
let _kwChartMetric = 'db';
let _kwChartLastRows = null;
const KW_CHART_MEDIA_COLORS = {네이버:'#03c75a', 구글:'#4285f4', 다음:'#ff6b57'};

// 키워드는 매체(네이버/구글/다음)별로 나눠 봐야 의미가 있어서, 파워컨텐츠 차트(전체 합산 단일 시리즈)와 달리
// 날짜별로 매체 3개를 각각 합산한다. 빈 날짜도 0으로 채워 기간 전체를 빈틈없이 보여준다
function _buildKwDailySeriesByMedia(rows){
  const medias = ['네이버','구글','다음'];
  const empty = () => ({네이버:{cost:0,imp:0,clk:0,db:0},구글:{cost:0,imp:0,clk:0,db:0},다음:{cost:0,imp:0,clk:0,db:0}});
  const byDateMedia = {};
  rows.forEach(r=>{
    if(!medias.includes(r.sub_media)) return;
    Object.entries(r.daily||{}).forEach(([dk,v])=>{
      if(!byDateMedia[dk]) byDateMedia[dk] = empty();
      byDateMedia[dk][r.sub_media].cost += v.cost||0;
      byDateMedia[dk][r.sub_media].imp  += v.impressions||0;
      byDateMedia[dk][r.sub_media].clk  += v.clicks||0;
      byDateMedia[dk][r.sub_media].db   += v.db||0;
    });
  });
  const known = Object.keys(byDateMedia).sort();
  if(!known.length) return {dates:[], byDateMedia};

  const toDate = k=>{ const m=k.match(/(\d+)\.(\d+)\.(\d+)/); return m?new Date(+m[1],+m[2]-1,+m[3]):null; };
  const dates = [];
  const cur = toDate(known[0]), end = toDate(known[known.length-1]);
  while(cur && cur<=end){
    const key = `${cur.getFullYear()}.${String(cur.getMonth()+1).padStart(2,'0')}.${String(cur.getDate()).padStart(2,'0')}.`;
    dates.push(key);
    if(!byDateMedia[key]) byDateMedia[key] = empty();
    cur.setDate(cur.getDate()+1);
  }
  return {dates, byDateMedia};
}

// 매체 3개 값을 하나로 합친 값 — 지난달 비교선은 매체별까지 다 보여주면 너무 복잡해져서 합계 하나만 겹친다
function _sumKwMediaDay(dayObj){
  const out = {cost:0,imp:0,clk:0,db:0};
  ['네이버','구글','다음'].forEach(m=>{
    const b = dayObj[m];
    out.cost+=b.cost; out.imp+=b.imp; out.clk+=b.clk; out.db+=b.db;
  });
  return out;
}

async function renderKwChart(rows){
  _kwChartLastRows = rows;
  if(!window.Chart){
    if(!_dataChartJsLoading){
      _dataChartJsLoading = true;
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
      s.onload = () => { renderKwChart(rows); };
      document.head.appendChild(s);
    }
    return;
  }

  const {dates, byDateMedia} = _buildKwDailySeriesByMedia(rows);
  const metric = _DATA_CHART_METRICS[_kwChartMetric] || _DATA_CHART_METRICS.cost;
  const titleEl = document.getElementById('kw-chart-title-text');
  if(titleEl) titleEl.textContent = `일별 ${metric.label} 추이 (매체별)`;

  const ctx = document.getElementById('kw-chart-single')?.getContext('2d');
  if(!ctx) return;
  if(_kwChartInstance) _kwChartInstance.destroy();
  if(!dates.length) return;

  const medias = ['네이버','구글','다음'];
  const valueOf = (b) => {
    if(_kwChartMetric==='cost')   return b.cost;
    if(_kwChartMetric==='db')     return b.db;
    if(_kwChartMetric==='cpd')    return b.db>0 ? Math.round(b.cost/b.db) : null;
    if(_kwChartMetric==='ctr')    return b.imp>0 ? Math.round(b.clk/b.imp*10000)/100 : null;
    if(_kwChartMetric==='dbcvr')  return b.clk>0 ? Math.round(b.db/b.clk*1000)/10 : null;
    return null;
  };

  // 광고비/DB수는 매체를 더한 값이 의미있어 누적 막대로, DB단가/CTR/DB전환율은 비율이라 매체별 개별 선으로 비교한다
  const stackable = metric.type==='bar';
  const datasets = medias.map(m=>{
    const data = dates.map(d=>valueOf(byDateMedia[d][m]));
    return stackable
      ? {type:'bar', label:m, data, backgroundColor:KW_CHART_MEDIA_COLORS[m], stack:'total'}
      : {type:'line', label:m, data, borderColor:KW_CHART_MEDIA_COLORS[m], backgroundColor:KW_CHART_MEDIA_COLORS[m], tension:0.3, spanGaps:true};
  });

  // 광고비는 절대 금액이라 전달과 겹쳐봐야 큰 의미가 없어 제외 — 나머지 지표는 매체 합계 기준으로
  // 전달 추이를 겹친다 (매체별까지 넣으면 선이 너무 많아져서 합계만). DB수는 막대(왼쪽에 배치),
  // 비율 지표는 점선으로 구분
  if(_kwChartMetric!=='cost'){
    const monthSel = document.getElementById('month-select-kw')?.value || '';
    const prevLabel = _prevMonthLabel(monthSel);
    if(prevLabel){
      const s = await loadAllSheets();
      const prevResult = _apiKeyword(prevLabel, s).result || [];
      const {dates: prevDates, byDateMedia: prevByDateMedia} = _buildKwDailySeriesByMedia(prevResult);
      const prevByDay = {};
      prevDates.forEach(dk=>{
        const day = parseInt(dk.split('.')[2],10);
        prevByDay[day] = _sumKwMediaDay(prevByDateMedia[dk]);
      });
      const prevValues = dates.map(dk=>{
        const b = prevByDay[parseInt(dk.split('.')[2],10)];
        return b ? valueOf(b) : null;
      });
      const prevDataset = stackable
        ? {type:'bar', label:'전달 합계', data:prevValues, backgroundColor:'#9ca3af', stack:'prev'}
        : {type:'line', label:'전달 합계', data:prevValues, borderColor:'#9ca3af', backgroundColor:'#9ca3af', borderDash:[5,4], tension:0.3, pointRadius:2, spanGaps:true};
      datasets.unshift(prevDataset); // 전달을 왼쪽에 그리도록 매체 막대들보다 앞에 배치
    }
  }

  // 당월 막대에 마우스 올렸을 때 뜨는 툴팁에 "당월 합계"(그 날 네이버+구글+다음 합) 한 줄을 추가한다.
  // 전달 합계/네이버/구글/다음은 이미 각 시리즈 자체가 툴팁 한 줄씩 보여주고 있어 손댈 필요 없음
  const fmtVal = v => v===null||v===undefined ? '-' : (metric.unit==='%' ? v+'%' : v.toLocaleString()+(metric.unit==='원'?'원':''));
  _kwChartInstance = new Chart(ctx, {
    type: metric.type,
    data: {labels: dates, datasets},
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction: {mode:'index', intersect:false},
      plugins:{
        legend:{display:true, labels:{boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{
          label:c=>`${c.dataset.label}: ${fmtVal(c.parsed.y)}`,
          footer: metric.type==='bar' ? (items)=>{
            const sum = items.filter(i=>i.dataset.label!=='전달 합계').reduce((s,i)=>s+(i.parsed.y||0),0);
            return `당월 합계 : ${fmtVal(sum)}`;
          } : undefined,
        }}
      },
      scales:{
        x:{stacked:stackable, grid:{display:false},ticks:{font:{size:10},color:'#888',maxRotation:0,autoSkip:true}},
        y:{stacked:stackable, ticks:{callback:v=>metric.unit==='%'?v+'%':v.toLocaleString(),font:{size:10},color:'#888'},grid:{color:'rgba(0,0,0,0.05)'}}
      },
      onClick: (evt, elements) => {
        if(!elements.length) return;
        const idx = elements[0].index;
        showDailyMediaBreakdown(dates[idx], rows);
      }
    }
  });
}

function switchKwChartMetric(metric, btn){
  document.querySelectorAll('#kw-chart-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _kwChartMetric = metric;
  if(_kwChartLastRows) renderKwChart(_kwChartLastRows);
}

// 날짜 클릭 시 그 날의 매체별(네이버/구글/다음) 데이터를 팝업으로 표시 (기존 daily-group-modal 껄 재사용)
const DAILY_MEDIA_MODAL_COLS = [
  {key:'media', label:'매체'},
  {key:'cost', label:'광고비', num:true, fmt:v=>v.toLocaleString()+'원'},
  {key:'imp', label:'노출수', num:true, fmt:v=>v.toLocaleString()},
  {key:'clicks', label:'클릭수', num:true, fmt:v=>v.toLocaleString()},
  {key:'cpc', label:'CPC', num:true, fmt:v=>v!==null?v.toLocaleString()+'원':'-'},
  {key:'ctr', label:'CTR', num:true, fmt:v=>v!==null?v+'%':'-'},
  {key:'db', label:'DB수', num:true, fmt:v=>v.toLocaleString()+'건'},
  {key:'cpd', label:'DB단가', num:true, fmt:v=>v!==null?v.toLocaleString()+'원':'-'},
  {key:'dbcvr', label:'DB전환율', num:true, fmt:v=>v!==null?v+'%':'-'},
];
let _dailyMediaModalRows = [];
let _dailyMediaModalDate = '';
let _dailyMediaModalSortCol = 'cost';
let _dailyMediaModalSortAsc = false;

function sortDailyMediaModal(col){
  if(_dailyMediaModalSortCol===col) _dailyMediaModalSortAsc=!_dailyMediaModalSortAsc;
  else{ _dailyMediaModalSortCol=col; _dailyMediaModalSortAsc=false; }
  _renderDailyMediaModalTable();
}

function _renderDailyMediaModalTable(){
  const col = _dailyMediaModalSortCol, asc = _dailyMediaModalSortAsc;
  const list = _dailyMediaModalRows;
  document.getElementById('daily-group-modal-title').textContent = `${_dailyMediaModalDate} — 매체별 상세`;
  const body = document.getElementById('daily-group-modal-body');
  if(!list.length){
    body.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--faint);font-size:12px">해당 날짜에 데이터가 없습니다.</div>`;
    return;
  }
  const sorted = [...list].sort((a,b)=>{
    let av=a[col], bv=b[col];
    if(av===null) av = asc?Infinity:-Infinity;
    if(bv===null) bv = asc?Infinity:-Infinity;
    if(typeof av==='string') return asc?av.localeCompare(bv):bv.localeCompare(av);
    return asc?av-bv:bv-av;
  });
  body.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          ${DAILY_MEDIA_MODAL_COLS.map(c=>{
            const arrow = c.key===col ? (asc?' ↑':' ↓') : '';
            return `<th class="${c.num?'ta-right':''}" onclick="sortDailyMediaModal('${c.key}')">${c.label}${arrow}</th>`;
          }).join('')}
        </tr></thead>
        <tbody>
          ${sorted.map(g=>`<tr>
            ${DAILY_MEDIA_MODAL_COLS.map(c=>{
              if(c.key==='media') return `<td>${escHtml(g.media)}</td>`;
              return `<td class="ta-right">${c.fmt(g[c.key])}</td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showDailyMediaBreakdown(date, rows){
  const medias = ['네이버','구글','다음'];
  const list = medias.map(m=>{
    let cost=0, clicks=0, imp=0, db=0;
    rows.filter(r=>r.sub_media===m).forEach(r=>{
      const d = (r.daily||{})[date];
      if(!d) return;
      cost += d.cost||0; clicks += d.clicks||0; imp += d.impressions||0; db += d.db||0;
    });
    const ctr = imp>0 ? Math.round(clicks/imp*10000)/100 : null;
    const cpc = clicks>0 ? Math.round(cost/clicks) : null;
    const dbcvr = clicks>0 ? Math.round(db/clicks*1000)/10 : null;
    const cpd = db>0 ? Math.round(cost/db) : null;
    return {media:m, cost, clicks, imp, db, cpc, cpd, ctr, dbcvr};
  }).filter(g=>g.cost>0 || g.db>0 || g.clicks>0 || g.imp>0);

  _dailyMediaModalRows = list;
  _dailyMediaModalDate = date;
  _renderDailyMediaModalTable();
  document.getElementById('daily-group-modal-bg').style.display = 'flex';
}

function showInsightDetail(key){
  // 최근 7일 데이터 집계
  const dayMap2 = {};
  resultData.forEach(r=>{
    (r.daily_raw||[]).forEach(d=>{
      const k=d.date;
      if(!dayMap2[k]) dayMap2[k]={cost:0,clicks:0,imp:0,db:0,perf:0,rank_sum:0,rank_imp:0};
      dayMap2[k].cost+=d.cost||0; dayMap2[k].clicks+=d.clicks||0; dayMap2[k].imp+=d.impressions||0;
      dayMap2[k].rank_sum+=(d.rank||0)*(d.impressions||0); dayMap2[k].rank_imp+=d.impressions||0;
    });
    Object.entries(r.daily_sales_map||{}).forEach(([k,v])=>{
      if(!dayMap2[k]) dayMap2[k]={cost:0,clicks:0,imp:0,db:0,perf:0,rank_sum:0,rank_imp:0};
      dayMap2[k].db+=v.db||0; dayMap2[k].perf+=v.performance||0;
    });
  });
  const last7 = Object.keys(dayMap2).sort().slice(-7);

  const labelMap = {cost:'광고비',db:'DB수',cpd:'DB단가',ctr:'CTR',cpc:'CPC',dbcvr:'DB전환율',rank:'평균순위'};
  const label = labelMap[key]||key;

  function getVal(d, key){
    const clicks=d.clicks||0, imp=d.imp||0, db=d.db||0, cost=d.cost||0;
    if(key==='cost')   return Math.round(cost/10000);
    if(key==='db')     return db;
    if(key==='cpd')    return db>0?Math.round(cost/db):0;
    if(key==='ctr')    return imp>0?+(clicks/imp*100).toFixed(2):0;
    if(key==='cpc')    return clicks>0?Math.round(cost/clicks):0;
    if(key==='dbcvr')  return clicks>0?+(db/clicks*100).toFixed(1):0;
    if(key==='rank')   return d.rank_imp>0?+(d.rank_sum/d.rank_imp).toFixed(1):0;
    return 0;
  }
  function suffix(key){ return {cost:'만원',db:'건',cpd:'원',ctr:'%',cpc:'원',dbcvr:'%',rank:'위'}[key]||''; }
  const inverse = ['cpd','cpc','rank'].includes(key);

  const rows = last7.map((k,i)=>{
    const d = dayMap2[k]||{};
    const val = getVal(d, key);
    const prev = i>0 ? getVal(dayMap2[last7[i-1]]||{}, key) : null;
    const chg = prev!==null&&prev>0 ? Math.round((val-prev)/prev*100) : null;
    const good = chg===null?null:((chg>0&&!inverse)||(chg<0&&inverse));
    const colorCls = good===null?'text-faint':good?'text-good':'text-bad';
    const arrow = chg===null?'':(chg>0?'▲':'▼');
    const dateStr = k.replace(/\./g,'').slice(2,8); // YYMMDD
    return `<tr style="border-bottom:1px solid var(--border)">
      <td class="cell-muted">${dateStr}</td>
      <td class="ta-right cell-big">${val>0?val.toLocaleString()+suffix(key):'-'}</td>
      <td class="ta-right ${colorCls}">${chg!==null?arrow+' '+Math.abs(chg)+'%':''}</td>
    </tr>`;
  }).join('');

  // 모달 표시
  const modal = document.getElementById('insight-detail-modal');
  document.getElementById('insight-detail-title').textContent = label + ' 최근 7일';
  document.getElementById('insight-detail-body').innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th>날짜</th>
        <th class="ta-right">${label}</th>
        <th class="ta-right">전일대비</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  modal.style.display='flex';
}
