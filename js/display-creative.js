// ===== 디스플레이 · 크리에이티브 (소재 랭킹 / 월별 이력 매트릭스 / 이미지 모달) =====
// (js/display.js 에서 분리 — 로직 변경 없음. 로드 순서는 index.html 참고)

// 이번 달(당월) 기준 매체×영역×소재별 성과 집계 (renderDisplayTab의 코드소유권 로직과 동일한 방식으로,
// 전체 매체를 한번에 묶어서 계산한다 — 어떤 소재가 좋고 나쁜지 매체 구분 없이 한눈에 보기 위함)
function _buildCreativeRankingThisMonth(){
  const curMonth = _today().slice(0,7);
  const rows = _displayData || [];
  const crmRows = _displayCrmRaw || [];
  const isPlaceholderLabel = l => l==='(소재 미기재)' || l==='미확인';

  const areas = {}; // key: media||area
  rows.forEach(r=>{
    const media = (r['매체명']||'').trim();
    const area = (r['상품명']||'').trim() || '(미지정)';
    const key = `${media}||${area}`;
    if(!areas[key]) areas[key] = {media, area, kws:{}, codeLabelCost:{}};
    const a = areas[key];
    const code = (r['인타입']||'').trim();
    const kw = (r['소재명']||'').trim() || '(소재 미기재)';
    if(!a.kws[kw]) a.kws[kw] = {kw, cost:0, imp:0, clk:0, db:0, contracts:0, perf:0, codes:new Set()};
    if(code) a.kws[kw].codes.add(code);

    const rowCost = _cN(r['비용']);
    if(code){
      if(!a.codeLabelCost[code]) a.codeLabelCost[code] = {};
      a.codeLabelCost[code][kw] = (a.codeLabelCost[code][kw]||0) + rowCost;
    }
    if((r['날짜']||'').startsWith(curMonth)){
      a.kws[kw].cost += rowCost;
      a.kws[kw].imp  += _cN(r['노출수(열람수)']);
      a.kws[kw].clk  += _cN(r['클릭수']);
    }
  });

  // 강제 보정 코드: 오타로 확인된 특정 인타입을 지정된 영역/소재로 정상 코드처럼 편입 (renderDisplayTab과 동일한 안전망)
  Object.entries(DISPLAY_INTYPE_FORCE_MAP).forEach(([code, map])=>{
    const key = `${map.media}||${map.area}`;
    if(!areas[key]) areas[key] = {media:map.media, area:map.area, kws:{}, codeLabelCost:{}};
    const a = areas[key];
    if(!a.kws[map.kw]) a.kws[map.kw] = {kw:map.kw, cost:0, imp:0, clk:0, db:0, contracts:0, perf:0, codes:new Set()};
    a.kws[map.kw].codes.add(code);
    a.codeLabelCost[code] = {[map.kw]: 1}; // 소유권 판정용 더미 비용(실제 집계엔 미반영)
  });

  // 코드 하나는 소재 하나에만 귀속 (실제 광고비가 찍힌 소재 우선 — renderDisplayTab과 동일 로직)
  const codeToKw = {}; // code -> {areaKey, kw}
  Object.entries(areas).forEach(([areaKey,a])=>{
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
      k.codes.forEach(c=>{ codeToKw[c] = {areaKey, kw:label}; });
    });
  });

  // 리포트 인타입이 오타 등으로 안 걸린 코드는 참조표(매체/영역)로 보정하고, 그마저도 없으면
  // 접두사로 매체만 확인해 "미확인" 소재로 담는다 (renderDisplayTab과 동일한 안전망 — 이번 달
  // TOP5 순위에서 코드 불일치로 특정 매체가 통째로 빠지는 것을 방지)
  {
    const refAreaByMediaCode = {};
    (_displayIntypeRef||[]).forEach(r=>{
      const m=(r['매체']||'').replace(/\s+/g,''), code=(r['인타입']||'').trim(), area=(r['영역']||'').trim();
      if(m && code && area) refAreaByMediaCode[`${m}||${code}`] = area;
    });
    (_displayCrmRaw||[]).forEach(r=>{
      const code = (r['인타입']||'').trim();
      if(!code || codeToKw[code]) return;
      const prefixMedia = Object.entries(DISPLAY_INTYPE_PREFIX_MEDIA).find(([p])=>code.startsWith(p))?.[1];
      if(!prefixMedia) return;
      const area = refAreaByMediaCode[`${prefixMedia.replace(/\s+/g,'')}||${code}`] || '미확인';
      const areaKey = `${prefixMedia}||${area}`;
      if(!areas[areaKey]) areas[areaKey] = {media:prefixMedia, area, kws:{}, codeLabelCost:{}};
      if(!areas[areaKey].kws['미확인']) areas[areaKey].kws['미확인'] = {kw:'미확인', cost:0, imp:0, clk:0, db:0, contracts:0, perf:0, codes:new Set()};
      areas[areaKey].kws['미확인'].codes.add(code);
      codeToKw[code] = {areaKey, kw:'미확인'};
    });
  }

  crmRows.forEach(r=>{
    const code = (r['인타입']||'').trim();
    if(!code) return;
    const target = codeToKw[code];
    if(!target) return;
    if(!_normDS(r['상담등록일']||'').startsWith(curMonth)) return;
    const k = areas[target.areaKey].kws[target.kw];
    k.db+=_dbCount(r);
    k.contracts += Math.round(_cN(r['계약수']));
    k.perf += _cN(r['평가업적']);
  });

  const list = [];
  Object.values(areas).forEach(a=>{
    Object.values(a.kws).forEach(k=>{
      if(k.cost<=0 && k.db<=0) return; // 이번 달 활동 없는 소재는 랭킹에서 제외
      const ctr = k.imp>0 ? Math.round(k.clk/k.imp*10000)/100 : null;
      const dbcvr = k.clk>0 ? Math.round(k.db/k.clk*1000)/10 : null;
      const cpd = (k.db>0 && k.cost>0) ? Math.round(k.cost/k.db) : null;
      list.push({media:a.media, area:a.area, kw:k.kw, cost:k.cost, imp:k.imp, clk:k.clk, db:k.db, ctr, dbcvr, cpd, codes:[...k.codes]});
    });
  });
  return list;
}

let _creativeRankingList = [];
let _creativeRankingMetric = 'cpd';
function setCreativeRankingMetric(metric, btn){
  _creativeRankingMetric = metric;
  document.querySelectorAll('#creative-ranking-toggle .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _renderCreativeRanking();
}

function _renderCreativeRanking(){
  const metric = _creativeRankingMetric;
  const lowerIsBetter = metric === 'cpd';
  const valid = _creativeRankingList.filter(x=>x[metric]!==null);
  const sorted = [...valid].sort((a,b)=> lowerIsBetter ? a[metric]-b[metric] : b[metric]-a[metric]);
  const good = sorted.slice(0,5);
  const bad = sorted.length>5 ? [...sorted].reverse().slice(0,5) : [];

  window.__creativeRankingLookup = [];
  const fmtVal = v => v===null ? '-' : (metric==='cpd' ? v.toLocaleString()+'원' : v+'%');
  function rowHtml(item){
    const idx = window.__creativeRankingLookup.length;
    window.__creativeRankingLookup.push({media:item.media, area:item.area, kw:item.kw, codes:item.codes});
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:.5rem 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="openCreativeRankingModal(${idx})">
      <div style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><strong>${escHtml(item.area)}</strong> · ${escHtml(item.kw)} <span style="color:var(--faint);font-size:11px">(${escHtml(item.media)})</span></div>
      <div style="font-size:13px;font-weight:700;white-space:nowrap">${fmtVal(item[metric])}</div>
    </div>`;
  }
  const empty = `<div style="color:var(--faint);font-size:12px;padding:.5rem 0">데이터 없음</div>`;
  document.getElementById('creative-ranking-good').innerHTML = good.length ? good.map(rowHtml).join('') : empty;
  document.getElementById('creative-ranking-bad').innerHTML = bad.length ? bad.map(rowHtml).join('') : empty;
}

function openCreativeRankingModal(idx){
  const info = (window.__creativeRankingLookup||[])[idx];
  if(!info) return;
  window.__creativeLookup = window.__creativeLookup || [];
  const globalIdx = window.__creativeLookup.length;
  window.__creativeLookup.push(info);
  openCreativeModal(globalIdx, _today().slice(0,7));
}

let _creativeHistoryMedia = '카카오페이';
function setCreativeHistoryMedia(media, btn){
  _creativeHistoryMedia = media;
  document.querySelectorAll('#creative-history-media-toggle .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderCreativeHistoryMatrix();
}

let _creativeHistoryMetric = 'cpd';
function setCreativeHistoryMetric(metric, btn){
  _creativeHistoryMetric = metric;
  document.querySelectorAll('#creative-history-metric-toggle .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderCreativeHistoryMatrix();
}

// 매체 전체 영역의 소재별 월별 성과 매트릭스 (전체 기간, _buildCreativeRankingThisMonth와 동일한 코드소유권 로직 — 영역 단위로 스코프)
function _buildCreativeHistoryMatrix(media){
  const rows = (_displayData||[]).filter(r=>(r['매체명']||'').trim()===media);
  const crmRows = _displayCrmRaw || [];
  const isPlaceholderLabel = l => l==='(소재 미기재)' || l==='미확인';

  const areas = {}; // area -> {kws:{kw->{kw,codes:Set,months:{}}}, codeLabelCost:{}}
  rows.forEach(r=>{
    const area = (r['상품명']||'').trim() || '(미지정)';
    if(!areas[area]) areas[area] = {kws:{}, codeLabelCost:{}};
    const a = areas[area];
    const code = (r['인타입']||'').trim();
    const kw = (r['소재명']||'').trim() || '(소재 미기재)';
    const ym = (r['날짜']||'').slice(0,7);
    if(!a.kws[kw]) a.kws[kw] = {kw, codes:new Set(), months:{}};
    if(code) a.kws[kw].codes.add(code);
    if(!a.kws[kw].months[ym]) a.kws[kw].months[ym] = {cost:0,imp:0,clk:0,db:0,contracts:0,perf:0};
    const rowCost = _cN(r['비용']);
    a.kws[kw].months[ym].cost += rowCost;
    a.kws[kw].months[ym].imp  += _cN(r['노출수(열람수)']);
    a.kws[kw].months[ym].clk  += _cN(r['클릭수']);
    if(code){
      if(!a.codeLabelCost[code]) a.codeLabelCost[code] = {};
      a.codeLabelCost[code][kw] = (a.codeLabelCost[code][kw]||0) + rowCost;
    }
  });

  // 강제 보정 코드: 오타로 확인된 특정 인타입을 지정된 영역/소재로 정상 코드처럼 편입 (renderDisplayTab과 동일한 안전망)
  Object.entries(DISPLAY_INTYPE_FORCE_MAP).forEach(([code, map])=>{
    if(map.media !== media) return;
    if(!areas[map.area]) areas[map.area] = {kws:{}, codeLabelCost:{}};
    const a = areas[map.area];
    if(!a.kws[map.kw]) a.kws[map.kw] = {kw:map.kw, codes:new Set(), months:{}};
    a.kws[map.kw].codes.add(code);
    a.codeLabelCost[code] = {[map.kw]: 1}; // 소유권 판정용 더미 비용(실제 집계엔 미반영)
  });

  const codeToArea = {}; // code -> {area, kw}
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
  // 없으면 접두사로 매체만 확인해 "미확인" 영역에 담는다 (renderDisplayTab과 동일한 안전망 —
  // 예: 리포트엔 A_kpaC0810으로 잘못 입력됐지만 참조표·CRM엔 A_kpaB0810으로 등록된 경우도 반영됨)
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
      if(codeToArea[code]) return; // 리포트로 이미 해결된 코드는 그대로 둠
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
    if(!k.months[ym]) k.months[ym] = {cost:0,imp:0,clk:0,db:0,contracts:0,perf:0};
    k.months[ym].db+=_dbCount(r);
    k.months[ym].contracts += Math.round(_cN(r['계약수']));
    k.months[ym].perf += _cN(r['평가업적']);
  });

  const allMonths = new Set();
  Object.values(areas).forEach(a=>Object.values(a.kws).forEach(k=>Object.keys(k.months).forEach(ym=>allMonths.add(ym))));
  const months = [...allMonths].sort();

  // 소재 A,B,C... 순으로 정렬 (renderDisplayTab과 동일한 정렬 기준)
  const kwSortKey = label => {
    const m = (label||'').match(/^소재\s*([A-Za-z])$/);
    return m ? m[1].toUpperCase().charCodeAt(0) : 999;
  };

  const rowList = [];
  Object.entries(areas).forEach(([area,a])=>{
    Object.values(a.kws).forEach(k=>{
      const cellsByMonth = {};
      months.forEach(ym=>{
        const m = k.months[ym];
        if(!m){ cellsByMonth[ym] = null; return; }
        const ctr = m.imp>0 ? Math.round(m.clk/m.imp*10000)/100 : null;
        const dbcvr = m.clk>0 ? Math.round(m.db/m.clk*1000)/10 : null;
        const cpd = (m.db>0 && m.cost>0) ? Math.round(m.cost/m.db) : null;
        cellsByMonth[ym] = {cost:m.cost, imp:m.imp, clk:m.clk, db:m.db, ctr, dbcvr, cpd};
      });
      if(!Object.values(cellsByMonth).some(c=>c && (c.cost>0||c.db>0))) return;
      rowList.push({area, kw:k.kw, cellsByMonth});
    });
  });

  // 영역 단위로 묶고, 각 영역의 월별 합계(=소재 합산)를 따로 계산 — 접기/펼치기 부모 행에 쓰인다
  const areaMap = {};
  rowList.forEach(r=>{
    if(!areaMap[r.area]) areaMap[r.area] = {area:r.area, kws:[]};
    areaMap[r.area].kws.push({kw:r.kw, cellsByMonth:r.cellsByMonth});
  });
  const areaList = Object.values(areaMap).map(a=>{
    const cellsByMonth = {};
    months.forEach(ym=>{
      let cost=0,imp=0,clk=0,db=0;
      a.kws.forEach(k=>{
        const c = k.cellsByMonth[ym];
        if(!c) return;
        cost+=c.cost; imp+=c.imp; clk+=c.clk; db+=c.db;
      });
      if(cost<=0 && imp<=0 && clk<=0 && db<=0){ cellsByMonth[ym] = null; return; }
      const ctr = imp>0 ? Math.round(clk/imp*10000)/100 : null;
      const dbcvr = clk>0 ? Math.round(db/clk*1000)/10 : null;
      const cpd = (db>0 && cost>0) ? Math.round(cost/db) : null;
      cellsByMonth[ym] = {cost,imp,clk,db,ctr,dbcvr,cpd};
    });
    a.kws.sort((x,y)=> (kwSortKey(x.kw)-kwSortKey(y.kw)) || x.kw.localeCompare(y.kw,'ko'));
    return {area:a.area, cellsByMonth, kws:a.kws};
  });
  areaList.sort((x,y)=>x.area.localeCompare(y.area,'ko'));

  return {months, areaList};
}

// 특정 월들에 대해 metric 기준 최고값의 월을 찾는다 (강조 표시용, 부모/자식 행 공용)
function _bestMonthOf(cellsByMonth, months, metric, lowerIsBetter){
  let bestYm=null, bestVal=null;
  months.forEach(ym=>{
    const c = cellsByMonth[ym];
    const v = c ? c[metric] : null;
    if(v===null || v===undefined) return;
    if(bestVal===null || (lowerIsBetter ? v<bestVal : v>bestVal)){ bestVal=v; bestYm=ym; }
  });
  return bestYm;
}
function renderCreativeHistoryMatrix(){
  const thead = document.getElementById('creative-history-thead');
  const tbody = document.getElementById('creative-history-tbody');
  if(!thead || !tbody) return;
  const {months, areaList} = _buildCreativeHistoryMatrix(_creativeHistoryMedia);
  const metric = _creativeHistoryMetric;
  const lowerIsBetter = metric === 'cpd';
  const fmtVal = v => v===null||v===undefined ? '-' : (metric==='cpd' ? v.toLocaleString()+'원' : v+'%');

  if(!months.length){
    thead.innerHTML = '';
    tbody.innerHTML = `<tr><td class="cell-empty-center">데이터가 없습니다.</td></tr>`;
    return;
  }

  thead.innerHTML = `<tr>
    <th></th>
    <th>영역 (클릭 → 소재별 펼치기)</th>
    ${months.map(ym=>{
      const [y,mo] = ym.split('-');
      return `<th class="num">${parseInt(mo)}월</th>`;
    }).join('')}
  </tr>`;

  tbody.innerHTML = areaList.map((a,i)=>{
    const rowCls = `hist-kwdet-${i}`;
    const bestYm = _bestMonthOf(a.cellsByMonth, months, metric, lowerIsBetter);
    const parentRow = `<tr class="clickable row-area" onclick="toggleDailyKwDetail('${rowCls}',this)">
      <td class="dk-caret">▸</td>
      <td class="cell-name" title="${escHtml(a.area)}">${escHtml(a.area)}</td>
      ${months.map(ym=>{
        const c = a.cellsByMonth[ym];
        const v = c ? c[metric] : null;
        const isBest = ym===bestYm && v!==null;
        return `<td class="num${isBest?' cell-best':''}">${fmtVal(v)}</td>`;
      }).join('')}
    </tr>`;
    const childRows = a.kws.map(k=>{
      const kBestYm = _bestMonthOf(k.cellsByMonth, months, metric, lowerIsBetter);
      return `<tr class="${rowCls} row-sub" style="display:none">
        <td></td>
        <td class="cell-indent" title="${escHtml(k.kw)}">${escHtml(k.kw)}</td>
        ${months.map(ym=>{
          const c = k.cellsByMonth[ym];
          const v = c ? c[metric] : null;
          const isBest = ym===kBestYm && v!==null;
          return `<td class="num${isBest?' cell-best':''}">${fmtVal(v)}</td>`;
        }).join('')}
      </tr>`;
    }).join('');
    return parentRow + childRows;
  }).join('') || `<tr><td colspan="${months.length+2}" class="cell-empty-center">이 매체에 소재 데이터가 없습니다.</td></tr>`;
}

// 소재 클릭 → 크리에이티브 이미지 팝업
// 이미지는 배포 저장소 adtool/data/creatives/{매체명}/{인타입코드}_{년월}.jpg(또는 png) 로 올려두면 자동 매칭됨
function openCreativeModal(idx, monSelOverride){
  const info = (window.__creativeLookup||[])[idx];
  if(!info) return;
  const monSel = monSelOverride || document.getElementById('display-month-sel').value;
  document.getElementById('creative-modal-title').textContent = `${info.area} · ${info.kw}`;
  const body = document.getElementById('creative-modal-body');
  document.getElementById('creative-modal-bg').style.display = 'flex';
  if(!monSel){
    body.innerHTML = `<div style="padding:2rem;color:var(--faint);font-size:13px">월을 선택하면 크리에이티브 이미지와 일별 데이터를 볼 수 있습니다.</div>`;
    return;
  }

  body.innerHTML = `
    <div id="creative-modal-image"><div style="padding:2rem;color:var(--faint);font-size:13px">이미지를 불러오는 중...</div></div>
    <div id="creative-modal-daily" style="margin-top:1rem;text-align:left"></div>
  `;

  if(info.codes.length){
    const ym = monSel.replace('-','');
    const exts = ['jpg','jpeg','png'];
    // 같은 인타입 코드에 소재가 여러 종류인 경우 파일명 뒤에 _2, _3...을 붙여서 올리면 전부 찾아서 같이 보여준다
    const SLOTS = ['', '_2', '_3', '_4', '_5'];
    const candidateGroups = [];
    info.codes.forEach(code=>{
      SLOTS.forEach(slot=>{
        candidateGroups.push(exts.map(ext=>`data/creatives/${encodeURIComponent(info.media)}/${code}_${ym}${slot}.${ext}`));
      });
    });
    _loadCreativeImages(candidateGroups, document.getElementById('creative-modal-image'));
  } else {
    document.getElementById('creative-modal-image').innerHTML = `<div style="padding:1rem;color:var(--faint);font-size:13px">이 소재에 연결된 인타입 코드가 없어 이미지를 찾을 수 없습니다.</div>`;
  }

  _renderCreativeDaily(info, monSel);
}

// 소재 단위 일별 데이터: 광고비/노출수/발송수/클릭수/CTR/DB수/DB단가/DB전환율
function _renderCreativeDaily(info, monSel){
  const dayRows = (_displayData||[]).filter(r=>
    (r['매체명']||'').trim()===info.media &&
    (r['상품명']||'').trim()===info.area &&
    ((r['소재명']||'').trim()||'(소재 미기재)')===info.kw &&
    (r['날짜']||'').startsWith(monSel)
  );
  const byDate = {};
  dayRows.forEach(r=>{
    const d = r['날짜'];
    if(!byDate[d]) byDate[d] = {date:d, cost:0, imp:0, clk:0, snd:0, db:0};
    byDate[d].cost += _cN(r['비용']);
    byDate[d].imp  += _cN(r['노출수(열람수)']);
    byDate[d].clk  += _cN(r['클릭수']);
    byDate[d].snd  += _cN(r['발송수']);
  });
  // 일별 DB수/계약수 — 이 소재에 귀속된 인타입 코드 기준, 상담등록일로 매칭
  let totalContracts = 0;
  if(info.codes && info.codes.length){
    const codeSet = new Set(info.codes);
    (_displayCrmRaw||[]).forEach(r=>{
      if(!codeSet.has((r['인타입']||'').trim())) return;
      const d = _normDS(r['상담등록일']||'');
      if(!d.startsWith(monSel)) return;
      if(!byDate[d]) byDate[d] = {date:d, cost:0, imp:0, clk:0, snd:0, db:0};
      byDate[d].db+=_dbCount(r);
      totalContracts += Math.round(_cN(r['계약수']));
    });
  }
  const days = Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date));
  const dailyEl = document.getElementById('creative-modal-daily');
  if(!dailyEl) return;
  if(!days.length){
    dailyEl.innerHTML = `<div style="color:var(--faint);font-size:12px;padding:.5rem 0">이 달에 집계된 일별 데이터가 없습니다.</div>`;
    return;
  }
  const totalCost = days.reduce((s,d)=>s+d.cost,0);
  const totalImp  = days.reduce((s,d)=>s+d.imp,0);
  const totalClk  = days.reduce((s,d)=>s+d.clk,0);
  const totalDb   = days.reduce((s,d)=>s+d.db,0);
  const sumCtr   = totalImp>0 ? Math.round(totalClk/totalImp*10000)/100 : null;
  const sumCpd   = totalDb>0 ? Math.round(totalCost/totalDb) : null;
  const sumDbcvr = totalClk>0 ? Math.round(totalDb/totalClk*1000)/10 : null;
  const sumCvr   = totalDb>0 ? Math.round(totalContracts/totalDb*1000)/10 : null;
  const sumCard = (label,colorCls,val) => `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value ${colorCls}">${val}</div></div>`;
  const th = label => `<th class="num">${label}</th>`;
  dailyEl.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">일별 데이터</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:.75rem">
      ${sumCard('CTR','brand-red', sumCtr!==null?sumCtr+'%':'-')}
      ${sumCard('DB단가','purple', sumCpd!==null?sumCpd.toLocaleString()+'원':'-')}
      ${sumCard('DB전환율','brand-red', sumDbcvr!==null?sumDbcvr+'%':'-')}
      ${sumCard('계약률','green', sumCvr!==null?sumCvr+'%':'-')}
    </div>
    <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs)">
      <table class="tbl-creative-daily tbl-dense">
        <thead><tr>
          <th>날짜</th>
          ${th('광고비')}${th('노출수')}${th('발송수')}${th('클릭수')}${th('CTR')}${th('DB수')}${th('DB단가')}${th('DB전환율')}
        </tr></thead>
        <tbody>
          ${days.map(d=>{
            const ctr = d.imp>0 ? Math.round(d.clk/d.imp*10000)/100 : null;
            const cpd = d.db>0 ? Math.round(d.cost/d.db) : null;
            const dbcvr = d.clk>0 ? Math.round(d.db/d.clk*1000)/10 : null;
            return `<tr>
            <td>${d.date}</td>
            <td class="num">${d.cost.toLocaleString()}</td>
            <td class="num">${d.imp.toLocaleString()}</td>
            <td class="num">${d.snd.toLocaleString()}</td>
            <td class="num">${d.clk.toLocaleString()}</td>
            <td class="num">${ctr!==null?ctr+'%':'-'}</td>
            <td class="num">${d.db.toLocaleString()}</td>
            <td class="num">${cpd!==null?cpd.toLocaleString()+'원':'-'}</td>
            <td class="num">${dbcvr!==null?dbcvr+'%':'-'}</td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// candidateGroups: 그룹(=파일 슬롯)마다 확장자별 후보 URL 배열. 그룹당 최초로 로드에 성공한 1개만 채택하고,
// 모든 그룹의 결과가 나오면 채택된 이미지를 전부 나란히 보여준다 (같은 인타입에 소재가 여러 개인 경우 대비)
function _loadCreativeImages(candidateGroups, body){
  if(!candidateGroups.length){
    body.innerHTML = `<div style="padding:2rem;color:var(--faint);font-size:13px">이 달에 등록된 크리에이티브 이미지가 없습니다.</div>`;
    return;
  }
  const results = new Array(candidateGroups.length).fill(null);
  let remaining = candidateGroups.length;
  candidateGroups.forEach((urls, gi)=>{
    _tryOneOf(urls, 0, url=>{
      results[gi] = url;
      remaining--;
      if(remaining===0) _renderFoundImages(results.filter(Boolean), body);
    });
  });
}

function _tryOneOf(urls, i, cb){
  if(i>=urls.length){ cb(null); return; }
  const img = new Image();
  img.onload = () => cb(urls[i]);
  img.onerror = () => _tryOneOf(urls, i+1, cb);
  img.src = urls[i];
}

function _renderFoundImages(urls, body){
  if(!urls.length){
    body.innerHTML = `<div style="padding:2rem;color:var(--faint);font-size:13px">이 달에 등록된 크리에이티브 이미지가 없습니다.</div>`;
    return;
  }
  body.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
    ${urls.map(u=>`<img src="${u}" style="max-width:100%;max-height:280px;border-radius:8px;border:1px solid var(--border)">`).join('')}
  </div>`;
}
