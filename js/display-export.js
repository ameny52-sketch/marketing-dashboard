// ===== 디스플레이 · 소재별 효율 내보내기 (팀 엑셀 붙여넣기용 CSV) =====
// (js/display.js 에서 분리 — 로직 변경 없음. 로드 순서는 index.html 참고)

// 팀 내부 소재별 효율 엑셀에 그대로 붙여넣을 수 있는 형태의 CSV — 매체 Total → 영역별 Total → 영역 안 소재별, 항목(지표)이 세로로 나열
// 비율 지표는 그 엑셀처럼 소수(0.35 = 35%) 그대로 두고 반올림하지 않는다 (반올림하면 붙여넣었을 때 값이 미묘하게 달라짐)
// 계약수/계약률/평가보험료/평가업적比광고비는 cumKey가 있어 "영역별 성과" 표의 당월/누적 토글(_displayAreaCumMode)에 따라 둘 중 하나만 나간다
const MEDIA_EXPORT_METRICS = [
  {key:'imp', label:'Imps'},
  {key:'clk', label:'Click'},
  {key:'cost', label:'Cost'},
  {key:'ctr', label:'CTR'},
  {key:'db', label:'DB'},
  {key:'cpd', label:'DB단가'},
  {key:'dbcvr', label:'DB전환율'},
  {key:'contracts', cumKey:'contracts_cum', label:'계약수'},
  {key:'cvr', cumKey:'cvr_cum', label:'계약률'},
  {key:'perf', cumKey:'perf_cum', label:'평가보험료'},
  {key:'roas', cumKey:'roas_cum', label:'평가업적比광고비'},
];
// 계약수(누적)/평가보험료(누적)은 CRM의 "계약수(누적)"/"평가업적(누적)" 필드 — 그 달 이후에도 계속 전환되는 후행 계약까지 반영된 값
function _deriveExportMetrics(sums){
  const {cost,imp,clk,db,contracts,perf,contracts_cum,perf_cum} = sums;
  return {
    imp, clk, cost, db, contracts, perf, contracts_cum, perf_cum,
    ctr: imp>0 ? clk/imp : '',
    dbcvr: clk>0 ? db/clk : '',
    cpd: db>0 ? cost/db : '',
    cvr: db>0 ? contracts/db : '',
    cvr_cum: db>0 ? contracts_cum/db : '',
    roas: perf>0 ? cost/perf : '',
    roas_cum: perf_cum>0 ? cost/perf_cum : '',
  };
}
// 특정 매체의 영역/소재별 월별 원본 합계(cost/imp/clk/db/contracts/perf/contracts_cum/perf_cum, 반올림 없음) — _buildCreativeHistoryMatrix와 동일한 코드소유권 로직
function _buildMediaExportSums(media){
  const rows = (_displayData||[]).filter(r=>(r['매체명']||'').trim()===media);
  const crmRows = _displayCrmRaw || [];
  const isPlaceholderLabel = l => l==='(소재 미기재)' || l==='미확인';

  const areas = {};
  rows.forEach(r=>{
    const area = (r['상품명']||'').trim() || '(미지정)';
    if(!areas[area]) areas[area] = {kws:{}, codeLabelCost:{}};
    const a = areas[area];
    const code = (r['인타입']||'').trim();
    const kw = (r['소재명']||'').trim() || '(소재 미기재)';
    const ym = (r['날짜']||'').slice(0,7);
    if(!a.kws[kw]) a.kws[kw] = {kw, codes:new Set(), months:{}};
    if(code) a.kws[kw].codes.add(code);
    if(!a.kws[kw].months[ym]) a.kws[kw].months[ym] = {cost:0,imp:0,clk:0,db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0};
    const rowCost = _cN(r['비용']);
    a.kws[kw].months[ym].cost += rowCost;
    a.kws[kw].months[ym].imp  += _cN(r['노출수(열람수)']);
    a.kws[kw].months[ym].clk  += _cN(r['클릭수']);
    if(code){
      if(!a.codeLabelCost[code]) a.codeLabelCost[code] = {};
      a.codeLabelCost[code][kw] = (a.codeLabelCost[code][kw]||0) + rowCost;
    }
  });

  // 강제 보정 코드: 오타로 확인된 특정 인타입을 지정된 영역/소재로 정상 코드처럼 편입 (renderDisplayTab과 동일한 안전망 —
  // 여기 안 넣으면 이 코드들이 리포트/엑셀 내보내기에서만 "미확인"으로 잘못 잡힌다)
  Object.entries(DISPLAY_INTYPE_FORCE_MAP).forEach(([code, map])=>{
    if(map.media !== media) return;
    if(!areas[map.area]) areas[map.area] = {kws:{}, codeLabelCost:{}};
    const a = areas[map.area];
    if(!a.kws[map.kw]) a.kws[map.kw] = {kw:map.kw, codes:new Set(), months:{}};
    a.kws[map.kw].codes.add(code);
    a.codeLabelCost[code] = {[map.kw]: 1}; // 소유권 판정용 더미 비용(실제 집계엔 미반영) — 강제 보정 소재가 확실히 owner가 되게 함
  });

  const codeToArea = {};
  Object.entries(areas).forEach(([area,a])=>{
    const codeOwner = {};
    Object.entries(a.codeLabelCost).forEach(([code, labelCosts])=>{
      const realLabels = Object.entries(labelCosts).filter(([l,c])=>c>0 && !isPlaceholderLabel(l));
      if(realLabels.length){
        realLabels.sort((x,y)=>y[1]-x[1]);
        codeOwner[code] = realLabels[0][0];
      } else {
        const labels = Object.keys(labelCosts);
        codeOwner[code] = labels.find(isPlaceholderLabel) || labels[0];
      }
    });
    Object.entries(a.kws).forEach(([label,k])=>{
      k.codes = new Set([...k.codes].filter(c=>codeOwner[c]===label));
      k.codes.forEach(c=>{ codeToArea[c] = {area, kw:label}; });
    });
  });

  // 리포트 인타입이 오타 등으로 안 걸린 코드는 참조표(매체/영역/소재)로 보정하고, 그마저도
  // 없으면 접두사로 매체만 확인해 "미확인" 영역에 담는다 (renderDisplayTab/_buildCreativeHistoryMatrix와 동일한 안전망)
  {
    const normM = media.replace(/\s+/g,'');
    const refByCode = {};
    (_displayIntypeRef||[]).forEach(r=>{
      if((r['매체']||'').replace(/\s+/g,'')!==normM) return;
      const code=(r['인타입']||'').trim(), area=(r['영역']||'').trim(), kw=(r['소재']||'').trim();
      if(code && area && !refByCode[code]) refByCode[code] = {area, kw: kw||'미확인'};
    });
    const myPrefixes = Object.entries(DISPLAY_INTYPE_PREFIX_MEDIA).filter(([,m])=>m===media).map(([p])=>p);
    const crmCodesForFallback = new Set(crmRows.map(r=>(r['인타입']||'').trim()).filter(Boolean));
    crmCodesForFallback.forEach(code=>{
      if(codeToArea[code]) return;
      let target = refByCode[code];
      if(!target && myPrefixes.some(p=>code.startsWith(p))) target = {area:'미확인', kw:'미확인'};
      if(!target) return;
      if(!areas[target.area]) areas[target.area] = {kws:{}, codeLabelCost:{}};
      if(!areas[target.area].kws[target.kw]) areas[target.area].kws[target.kw] = {kw:target.kw, codes:new Set(), months:{}};
      areas[target.area].kws[target.kw].codes.add(code);
      codeToArea[code] = target;
    });
  }

  crmRows.forEach(r=>{
    const code = (r['인타입']||'').trim();
    if(!code) return;
    const target = codeToArea[code];
    if(!target) return;
    const ym = _normDS(r['상담등록일']||'').slice(0,7);
    if(!ym) return;
    const k = areas[target.area].kws[target.kw];
    if(!k.months[ym]) k.months[ym] = {cost:0,imp:0,clk:0,db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0};
    k.months[ym].db+=_dbCount(r);
    k.months[ym].contracts += Math.round(_cN(r['계약수']));
    k.months[ym].perf += _cN(r['평가업적']);
    k.months[ym].contracts_cum += Math.round(_cN(r['계약수(누적)']));
    k.months[ym].perf_cum += _cN(r['평가업적(누적)']);
  });

  const allMonths = new Set();
  Object.values(areas).forEach(a=>Object.values(a.kws).forEach(k=>Object.keys(k.months).forEach(ym=>allMonths.add(ym))));
  const months = [...allMonths].sort();

  const kwSortKey = label => {
    const m = (label||'').match(/^소재\s*([A-Za-z])$/);
    return m ? m[1].toUpperCase().charCodeAt(0) : 999;
  };

  return {months, areas, kwSortKey};
}
function _sumMonths(monthsMap, months){
  const out = {};
  months.forEach(ym=>{
    const m = monthsMap[ym];
    out[ym] = m ? {cost:m.cost,imp:m.imp,clk:m.clk,db:m.db,contracts:m.contracts,perf:m.perf,contracts_cum:m.contracts_cum,perf_cum:m.perf_cum} : {cost:0,imp:0,clk:0,db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0};
  });
  return out;
}
function _addSums(a,b){
  return {cost:a.cost+b.cost, imp:a.imp+b.imp, clk:a.clk+b.clk, db:a.db+b.db, contracts:a.contracts+b.contracts, perf:a.perf+b.perf, contracts_cum:a.contracts_cum+b.contracts_cum, perf_cum:a.perf_cum+b.perf_cum};
}
// 매체 Total → 영역 Total → 그 영역의 소재별, 항목이 세로로 나열된 행 목록을 만든다 ("영역" 칸은 블록의 첫 항목 행에만 채움 — 엑셀 원본과 동일)
// cumMode는 "영역별 성과" 표의 당월/누적 토글과 동일 — 계약수/계약률/평가보험료/평가업적比광고비만 그에 따라 당월값 또는 누적값 하나만 나간다
function _buildMediaExportRows(media, cumMode){
  const {months, areas, kwSortKey} = _buildMediaExportSums(media);
  const areaNames = Object.keys(areas).sort((a,b)=>a.localeCompare(b,'ko'));

  const rows = [];
  const pushBlock = (label, monthSums) => {
    MEDIA_EXPORT_METRICS.forEach((m,i)=>{
      const useCum = cumMode && m.cumKey;
      rows.push({
        area: i===0 ? label : '',
        metric: useCum ? m.label+'(누적)' : m.label,
        values: months.map(ym=>_deriveExportMetrics(monthSums[ym])[useCum ? m.cumKey : m.key]),
      });
    });
  };

  // 매체 전체 Total
  let mediaTotal = {};
  months.forEach(ym=>{ mediaTotal[ym] = {cost:0,imp:0,clk:0,db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0}; });
  areaNames.forEach(area=>{
    Object.values(areas[area].kws).forEach(k=>{
      months.forEach(ym=>{ mediaTotal[ym] = _addSums(mediaTotal[ym], _sumMonths(k.months, months)[ym]); });
    });
  });
  pushBlock('Total', mediaTotal);

  areaNames.forEach(area=>{
    const a = areas[area];
    const kwList = Object.values(a.kws).sort((x,y)=> (kwSortKey(x.kw)-kwSortKey(y.kw)) || x.kw.localeCompare(y.kw,'ko'));
    // 이 영역의 소재 전체를 합친 Total
    let areaTotal = {};
    months.forEach(ym=>{ areaTotal[ym] = {cost:0,imp:0,clk:0,db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0}; });
    kwList.forEach(k=>{
      const sums = _sumMonths(k.months, months);
      months.forEach(ym=>{ areaTotal[ym] = _addSums(areaTotal[ym], sums[ym]); });
    });
    pushBlock(area, areaTotal);
    kwList.forEach(k=>{
      pushBlock(k.kw, _sumMonths(k.months, months));
    });
  });

  return {months, rows};
}

function downloadMediaCsv(media){
  const {months, rows} = _buildMediaExportRows(media, _displayAreaCumMode);
  if(!months.length){ alert('이 매체는 다운로드할 데이터가 없습니다.'); return; }
  const header = ['영역','항목', ...months.map(ym=>ym.replace('-',''))];
  const lines = [header, ...rows.map(r=>[r.area, r.metric, ...r.values])];
  const csv = lines.map(r=>r.map(_csvCell).join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${media}_소재별효율.csv`;
  a.click();
}
