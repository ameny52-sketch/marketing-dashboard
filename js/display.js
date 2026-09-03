// ===== 디스플레이(뉴미디어) 탭 =====
let _displayData = null;       // raw_통합 광고 리포트 행들
let _displayIntypeRef = null;  // 인타입 참조표 행들 (인타입,매체,월,영역,소재,보종)
let _displayCrmRaw = null;     // CRM raw 중 애드온컴퍼니(뉴미디어) 행들
let _displayLoaded = false;
let _displayMedia = '카카오페이';
let _displayChartJsLoading = false;
let _displayChartSingle = null;
let _displayChartMetric = 'db';
let _displayLastChartArgs = null; // 토글 버튼 클릭 시 재사용 (areaList, mediaRows, crmRows, monSel)
const _DISPLAY_AREA_COLORS = ['#ff9b00','#2b68ee','#00a874','#7224ea','#ef3554','#595959'];
const _DISPLAY_CHART_METRICS = {
  cost:  {label:'광고비',   type:'bar',  unit:'원'},
  db:    {label:'DB수',     type:'bar',  unit:'건'},
  cpd:   {label:'DB단가',   type:'line', unit:'원'},
  ctr:   {label:'CTR',      type:'line', unit:'%'},
  dbcvr: {label:'DB전환율', type:'line', unit:'%'}
};

function initDisplayTab(){
  if(!_displayLoaded){ _displayLoaded = true; loadDisplayData(); }
  else if(_isDisplayInsightActive()) renderDisplayInsight();
  else renderDisplayTab();
}

function _isDisplayInsightActive(){
  const activeBtn = document.querySelector('#display-media-tabs .main-tab.active');
  return !!activeBtn && activeBtn.textContent.trim()==='성과 진단';
}

function switchDisplayMedia(media, btn){
  document.querySelectorAll('#display-media-tabs .main-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _displayMedia = media;
  document.getElementById('display-insight').style.display = 'none';
  document.getElementById('display-content').style.display = '';
  document.getElementById('display-content').classList.remove('is-hidden');
  document.getElementById('display-month-sel-wrap').style.display = 'flex';
  renderDisplayTab();
}

function switchDisplayInsight(btn){
  document.querySelectorAll('#display-media-tabs .main-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('display-pending').style.display = 'none';
  document.getElementById('display-content').style.display = 'none';
  document.getElementById('display-month-sel-wrap').style.display = 'none';
  document.getElementById('display-insight').style.display = '';
  document.getElementById('display-insight').classList.remove('is-hidden');
  renderDisplayInsight();
}

// 매체 전체 기준, 최근 이틀 변화 감지 (매체마다 데이터 입력 시차가 있을 수 있어
// 전체 공통 날짜가 아니라 "매체별로 자기 자신의 최신 2일"을 기준으로 비교한다)
// 다른 탭(성과 진단)과 같은 형식의 "오늘의 요약" 배너 + 영역·소재 단위 변화 TOP 리스트로 구성
function renderDisplayInsight(){
  const body = document.getElementById('display-insight-body');
  const rows = _displayData || [];
  if(!rows.length){
    body.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--faint)">데이터를 불러오면 이 영역에 결과가 표시됩니다.</div>`;
    return;
  }

  // 매체별 자기 날짜 기준 어제/오늘 산출 (매체마다 데이터 입력 시차가 있을 수 있어
  // 전체 공통 날짜가 아니라 "매체별로 자기 자신의 최신 2일"을 기준으로 비교한다)
  const datesByMedia = {};
  rows.forEach(r=>{
    const media = (r['매체명']||'').trim();
    const d = r['날짜'];
    if(!media || !d) return;
    if(!datesByMedia[media]) datesByMedia[media] = new Set();
    datesByMedia[media].add(d);
  });
  const mediaDates = {};
  Object.entries(datesByMedia).forEach(([media, dateSet])=>{
    const dates = [...dateSet].sort();
    if(dates.length>=2) mediaDates[media] = {today:dates[dates.length-1], yesterday:dates[dates.length-2]};
  });
  const mediaList = Object.keys(mediaDates);
  if(!mediaList.length){
    body.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--faint)">비교할 날짜 데이터가 부족합니다.</div>`;
    return;
  }

  // 매체별 전체 영역 통합 집계 (오늘/어제) + 인타입 코드 집합 (DB수 매칭용)
  const agg = {};
  mediaList.forEach(m=>{ agg[m] = {today:{cost:0,imp:0,clk:0,db:0}, yesterday:{cost:0,imp:0,clk:0,db:0}, codes:new Set()}; });
  rows.forEach(r=>{
    const media = (r['매체명']||'').trim();
    const md = mediaDates[media];
    if(!md) return;
    const d = r['날짜'];
    if(d!==md.today && d!==md.yesterday) return;
    const bucket = d===md.today ? agg[media].today : agg[media].yesterday;
    bucket.cost += _cN(r['비용']);
    bucket.imp  += _cN(r['노출수(열람수)']);
    bucket.clk  += _cN(r['클릭수']);
    const code = (r['인타입']||'').trim();
    if(code) agg[media].codes.add(code);
  });
  const codeToMedia = {};
  Object.entries(agg).forEach(([media,a])=>{ a.codes.forEach(c=>{ codeToMedia[c]=media; }); });
  (_displayCrmRaw||[]).forEach(r=>{
    const code = (r['인타입']||'').trim();
    if(!code) return;
    const media = codeToMedia[code];
    if(!media) return;
    const md = mediaDates[media];
    const d = _normDS(r['상담등록일']||'');
    const dbn=_dbCount(r);
    if(d===md.today) agg[media].today.db+=dbn;
    else if(d===md.yesterday) agg[media].yesterday.db+=dbn;
  });

  function calc(b){
    return {
      cpd: b.db>0 ? Math.round(b.cost/b.db) : null,
      ctr: b.imp>0 ? Math.round(b.clk/b.imp*10000)/100 : null,
      dbcvr: b.clk>0 ? Math.round(b.db/b.clk*1000)/10 : null
    };
  }
  function chg(c,p){ return p>0 ? Math.round((c-p)/p*1000)/10 : null; }

  // 파워컨텐츠/키워드 성과 진단과 동일한 형식: 매체별이 아닌 전체 매체 합산 한 줄 요약
  // (매체마다 "오늘"의 실제 날짜는 다를 수 있으나, 매체별 최신 데이터를 그대로 합산한다)
  const totalY = {cost:0,imp:0,clk:0,db:0}, totalT = {cost:0,imp:0,clk:0,db:0};
  mediaList.forEach(m=>{
    const y = agg[m].yesterday, t = agg[m].today;
    totalY.cost+=y.cost; totalY.imp+=y.imp; totalY.clk+=y.clk; totalY.db+=y.db;
    totalT.cost+=t.cost; totalT.imp+=t.imp; totalT.clk+=t.clk; totalT.db+=t.db;
  });
  const blocks = (()=>{
    const y = totalY, t = totalT;
    const yc = calc(y), tc = calc(t);
    const costChg = chg(t.cost, y.cost);
    const dbChg   = chg(t.db, y.db);
    const cpdChg  = (yc.cpd!=null && tc.cpd!=null) ? chg(tc.cpd, yc.cpd) : null;
    const ctrDiff = (yc.ctr!=null && tc.ctr!=null) ? Math.round((tc.ctr-yc.ctr)*10)/10 : null;
    const dbcvrDiff = (yc.dbcvr!=null && tc.dbcvr!=null) ? Math.round((tc.dbcvr-yc.dbcvr)*10)/10 : null;

    const parts = [];
    if(costChg!==null) parts.push(`광고비 <span style="color:#facc15;font-weight:700">${Math.abs(costChg)}% ${costChg>0?'증가':'감소'}</span>`);
    else if(y.cost===0 && t.cost>0) parts.push(`광고비 <span style="color:#facc15;font-weight:700">신규 집행</span>`);
    if(dbChg!==null) parts.push(`DB수 <span style="color:${dbChg>0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(dbChg)}% ${dbChg>0?'증가':'감소'}</span>`);
    if(cpdChg!==null) parts.push(`DB단가 <span style="color:${cpdChg<0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(cpdChg)}% ${cpdChg<0?'하락':'상승'}</span>`);
    if(ctrDiff!==null && Math.abs(ctrDiff)>=0.1) parts.push(`CTR <span style="color:${ctrDiff>0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(ctrDiff)}%p ${ctrDiff>0?'상승':'하락'}</span>`);
    if(dbcvrDiff!==null && Math.abs(dbcvrDiff)>=0.1) parts.push(`DB전환율 <span style="color:${dbcvrDiff>0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(dbcvrDiff)}%p ${dbcvrDiff>0?'상승':'하락'}</span>`);
    const sentence = parts.length ? parts.join(', ')+'했습니다.' : '전일 대비 큰 변화가 없습니다.';

    const badges = [];
    badges.push(`광고비 ${y.cost.toLocaleString()}원 → ${t.cost.toLocaleString()}원`);
    badges.push(`DB수 ${y.db.toLocaleString()}건 → ${t.db.toLocaleString()}건`);
    if(yc.cpd!=null || tc.cpd!=null) badges.push(`DB단가 ${(yc.cpd||0).toLocaleString()}원 → ${(tc.cpd||0).toLocaleString()}원`);
    if(yc.ctr!=null || tc.ctr!=null) badges.push(`CTR ${(yc.ctr||0).toFixed(2)}% → ${(tc.ctr||0).toFixed(2)}%`);
    if(yc.dbcvr!=null || tc.dbcvr!=null) badges.push(`DB전환율 ${(yc.dbcvr||0).toFixed(1)}% → ${(tc.dbcvr||0).toFixed(1)}%`);

    return [{sentence, badges}];
  })();

  // ── 광고 매체별 성과 표 (매체×영역 단위, 표 우측 월선택으로 기간 지정 가능 · 기본값 전체 기간) ──
  // 인타입 코드는 월 상관없이 전체 기간 기준으로 모으고(DB는 상담등록일로 월을 판단하므로),
  // 광고비/노출/클릭 등 광고 지표만 선택된 월에 맞는 행으로 한정한다 (renderDisplayTab과 동일한 방식)
  const insightMonSel = document.getElementById('display-insight-month-sel')?.value || '';
  const groupMap = {};
  rows.forEach(r=>{
    const media = (r['매체명']||'').trim();
    const area = (r['상품명']||'').trim() || '(미지정)';
    const key = `${media}||${area}`;
    if(!groupMap[key]) groupMap[key] = {media, area, cost:0, imp:0, clk:0, snd:0, codes:new Set()};
    const g = groupMap[key];
    const code = (r['인타입']||'').trim();
    if(code) g.codes.add(code);
    if(!insightMonSel || (r['날짜']||'').startsWith(insightMonSel)){
      g.cost += _cN(r['비용']);
      g.imp  += _cN(r['노출수(열람수)']);
      g.clk  += _cN(r['클릭수']);
      g.snd  += _cN(r['발송수']);
    }
  });
  const codeToGroup = {};
  Object.values(groupMap).forEach(g=>{ g.codes.forEach(c=>{ codeToGroup[c]=g; }); });
  // 리포트 인타입이 오타 등으로 안 걸린 코드는 참조표(매체/영역)로 보정 — 리포트엔 잘못된 코드가
  // 찍혀도 참조표·CRM엔 맞는 코드로 등록된 경우 DB가 누락되지 않게 함 (매체별 성과 표 전용)
  {
    const refAreaByMediaCode = {};
    (_displayIntypeRef||[]).forEach(r=>{
      const m=(r['매체']||'').replace(/\s+/g,''), code=(r['인타입']||'').trim(), area=(r['영역']||'').trim();
      if(m && code && area) refAreaByMediaCode[`${m}||${code}`] = area;
    });
    (_displayCrmRaw||[]).forEach(r=>{
      const code = (r['인타입']||'').trim();
      if(!code || codeToGroup[code]) return;
      const prefixMedia = Object.entries(DISPLAY_INTYPE_PREFIX_MEDIA).find(([p])=>code.startsWith(p))?.[1];
      if(!prefixMedia) return;
      const area = refAreaByMediaCode[`${prefixMedia.replace(/\s+/g,'')}||${code}`] || '미확인';
      const key = `${prefixMedia}||${area}`;
      if(!groupMap[key]) groupMap[key] = {media:prefixMedia, area, cost:0, imp:0, clk:0, snd:0, codes:new Set()};
      groupMap[key].codes.add(code);
      codeToGroup[code] = groupMap[key];
    });
  }
  const dbAgg = {}; // key -> {db,contracts,perf,contracts_cum,perf_cum}
  Object.keys(groupMap).forEach(k=>{ dbAgg[k] = {db:0, contracts:0, perf:0, contracts_cum:0, perf_cum:0}; });
  (_displayCrmRaw||[]).forEach(r=>{
    const code = (r['인타입']||'').trim();
    if(!code) return;
    const g = codeToGroup[code];
    if(!g) return;
    if(insightMonSel && !_normDS(r['상담등록일']||'').startsWith(insightMonSel)) return;
    const key = `${g.media}||${g.area}`;
    dbAgg[key].db+=_dbCount(r);
    dbAgg[key].contracts += Math.round(_cN(r['계약수']));
    dbAgg[key].perf += _cN(r['평가업적']);
    dbAgg[key].contracts_cum += Math.round(_cN(r['계약수(누적)']));
    dbAgg[key].perf_cum += _cN(r['평가업적(누적)']);
  });
  const tableRows = Object.entries(groupMap).map(([key,g])=>{
    const d = dbAgg[key];
    const ctr = g.imp>0 ? Math.round(g.clk/g.imp*10000)/100 : null;
    const dbcvr = g.clk>0 ? Math.round(d.db/g.clk*1000)/10 : null;
    const cpd = d.db>0 ? Math.round(g.cost/d.db) : null;
    const roas = (d.perf>0 && g.cost>0) ? Math.round(g.cost/d.perf*100) : null;
    const roas_cum = (d.perf_cum>0 && g.cost>0) ? Math.round(g.cost/d.perf_cum*100) : null;
    return {...g, db:d.db, contracts:d.contracts, perf:d.perf, contracts_cum:d.contracts_cum, perf_cum:d.perf_cum, ctr, dbcvr, cpd, roas, roas_cum};
  });
  _displayInsightRows = tableRows;

  body.innerHTML = `
    <div class="insight-hero">
      <div class="insight-hero__top">
        <div class="insight-hero__label">오늘의 요약 · 전체 매체 합산 최신 이틀 비교</div>
      </div>
      ${blocks.map(b=>`
        <div class="insight-hero__summary">${b.sentence}</div>
        <div class="insight-hero__badges">
          ${b.badges.map(t=>`<span style="padding:6px 14px;border-radius:20px;background:rgba(255,255,255,0.12);color:#fff;font-size:12px;font-weight:500">${t}</span>`).join('')}
        </div>`).join('')}
    </div>
    <div class="table-card" style="margin-bottom:1.25rem">
      <div class="table-header">
        <h2>영역·소재 순위 <span style="font-size:11px;font-weight:400;color:var(--faint)">(이번 달 기준, 클릭 → 소재 상세)</span></h2>
      </div>
      <div style="padding:.75rem 1.25rem 0;border-bottom:0px">
        <div class="tab-bar" id="creative-ranking-toggle" style="margin-bottom:0">
          <button class="tab-btn" onclick="setCreativeRankingMetric('cpd',this)">DB단가</button>
          <button class="tab-btn" onclick="setCreativeRankingMetric('ctr',this)">CTR</button>
          <button class="tab-btn" onclick="setCreativeRankingMetric('dbcvr',this)">DB전환율</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;padding:1rem 1.25rem">
        <div>
          <div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:.5rem">👍 좋은 소재 TOP5</div>
          <div id="creative-ranking-good"></div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:.5rem">👎 안좋은 소재 TOP5</div>
          <div id="creative-ranking-bad"></div>
        </div>
      </div>
    </div>
    <div class="table-card" style="margin-bottom:1.25rem">
      <div class="table-header">
        <h2>영역별 소재 월간 히스토리 <span style="font-size:11px;font-weight:400;color:var(--faint)">(어느 달에 어떤 소재가 좋았는지 비교)</span></h2>
      </div>
      <div style="padding:.75rem 1.25rem 0;border-bottom:0px">
        <div class="tab-bar" id="creative-history-media-toggle" style="margin-bottom:0">
          <button class="tab-btn active" onclick="setCreativeHistoryMedia('카카오페이',this)">카카오페이</button>
          <button class="tab-btn" onclick="setCreativeHistoryMedia('T멤버십',this)">T멤버십</button>
          <button class="tab-btn" onclick="setCreativeHistoryMedia('가스락',this)">가스락</button>
          <button class="tab-btn" onclick="setCreativeHistoryMedia('KT PASS',this)">KT PASS</button>
        </div>
      </div>
      <div style="padding:.75rem 1.25rem 0;border-bottom:0px">
        <div class="tab-bar" id="creative-history-metric-toggle" style="margin-bottom:0">
          <button class="tab-btn active" onclick="setCreativeHistoryMetric('cpd',this)">DB단가</button>
          <button class="tab-btn" onclick="setCreativeHistoryMetric('ctr',this)">CTR</button>
          <button class="tab-btn" onclick="setCreativeHistoryMetric('dbcvr',this)">DB전환율</button>
        </div>
      </div>
      <div class="table-wrap">
        <table style="width:100%;border-collapse:collapse">
          <thead id="creative-history-thead"></thead>
          <tbody id="creative-history-tbody"></tbody>
        </table>
      </div>
    </div>
    <div class="table-card">
      <div class="table-header">
        <h2>광고 매체별 성과</h2>
        <div style="display:flex;align-items:center;gap:4px">
          <button class="month-step" onclick="_stepMonthSelect('display-insight-month-sel',-1)" title="이전 달">◀</button>
          <select id="display-insight-month-sel" onchange="renderDisplayInsight()" style="border:1px solid var(--border-strong);border-radius:var(--rs);padding:5px 10px;font-size:12px;font-family:inherit;color:var(--text);background:var(--surface);outline:none">
            <option value="">전체 월</option>
          </select>
          <button class="month-step" onclick="_stepMonthSelect('display-insight-month-sel',1)" title="다음 달">▶</button>
        </div>
      </div>
      <div style="padding:.75rem 1.25rem">
        <div class="tab-bar" id="display-insight-cum-toggle" style="margin-bottom:0">
          <button class="tab-btn active" onclick="setDisplayInsightCumMode(false,this)">당월</button>
          <button class="tab-btn" onclick="setDisplayInsightCumMode(true,this)">누적</button>
        </div>
      </div>
      <div class="table-wrap">
        <table style="width:100%;border-collapse:collapse">
          <thead id="display-insight-thead"></thead>
          <tbody id="display-insight-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  // 방금 새로 만든 select에 월 옵션을 채우고, 위에서 읽어둔 선택값(insightMonSel)을 그대로 복원한다
  // (innerHTML로 select 자체가 매번 새로 생성되므로 값이 초기화되는 것을 막기 위함)
  _fillDisplayInsightMonSel();
  const insightMonSelEl = document.getElementById('display-insight-month-sel');
  if(insightMonSelEl) insightMonSelEl.value = insightMonSel;
  _renderDisplayInsightTable();
  _creativeRankingList = _buildCreativeRankingThisMonth();
  _renderCreativeRanking();
  renderCreativeHistoryMatrix();
}

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
    tbody.innerHTML = `<tr><td style="padding:1.5rem;color:var(--faint);font-size:12px;text-align:center">데이터가 없습니다.</td></tr>`;
    return;
  }

  thead.innerHTML = `<tr>
    <th></th>
    <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)">영역 (클릭 → 소재별 펼치기)</th>
    ${months.map(ym=>{
      const [y,mo] = ym.split('-');
      return `<th class="num" style="padding:8px 10px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)">${parseInt(mo)}월</th>`;
    }).join('')}
  </tr>`;

  tbody.innerHTML = areaList.map((a,i)=>{
    const rowCls = `hist-kwdet-${i}`;
    const bestYm = _bestMonthOf(a.cellsByMonth, months, metric, lowerIsBetter);
    const parentRow = `<tr style="cursor:pointer;font-weight:600" onclick="toggleDailyKwDetail('${rowCls}',this)">
      <td class="dk-caret" style="color:var(--faint);text-align:center;padding:8px 10px;border-bottom:1px solid var(--border)">▸</td>
      <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(a.area)}">${escHtml(a.area)}</td>
      ${months.map(ym=>{
        const c = a.cellsByMonth[ym];
        const v = c ? c[metric] : null;
        const isBest = ym===bestYm && v!==null;
        const style = isBest ? 'font-weight:700;color:#166534;background:#EAF3DE' : '';
        return `<td class="num" style="padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border);${style}">${fmtVal(v)}</td>`;
      }).join('')}
    </tr>`;
    const childRows = a.kws.map(k=>{
      const kBestYm = _bestMonthOf(k.cellsByMonth, months, metric, lowerIsBetter);
      return `<tr class="${rowCls}" style="display:none;background:var(--bg)">
        <td></td>
        <td style="padding-left:1.5rem;color:var(--muted);font-size:12px;border-bottom:1px solid var(--border);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(k.kw)}">${escHtml(k.kw)}</td>
        ${months.map(ym=>{
          const c = k.cellsByMonth[ym];
          const v = c ? c[metric] : null;
          const isBest = ym===kBestYm && v!==null;
          const style = isBest ? 'font-weight:700;color:#166534;background:#EAF3DE' : '';
          return `<td class="num" style="padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border);${style}">${fmtVal(v)}</td>`;
        }).join('')}
      </tr>`;
    }).join('');
    return parentRow + childRows;
  }).join('') || `<tr><td colspan="${months.length+2}" style="padding:1.5rem;color:var(--faint);font-size:12px;text-align:center">이 매체에 소재 데이터가 없습니다.</td></tr>`;
}

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
function _csvCell(v){
  if(v===''||v===null||v===undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
}

// ===== 디스플레이 롱포맷 집계 (커스텀 보고서 탭의 디스플레이 어댑터가 재사용) =====
// 매체별로 이미 검증된 _buildMediaExportSums()의 영역↔소재↔인타입 매칭 결과를 4개 매체 모두에 대해
// 모아 "매체,영역,소재,월" 단위 롱포맷 행 목록으로 만든다 (노출/클릭/DB/광고비 + 계약수/평가업적, 당월+누적).
const DISPLAY_REPORT_MEDIAS = ['카카오페이','T멤버십','가스락','KT PASS'];
let _reportLongRowsCache = null;
function _buildAllDisplayLongRows(){
  if(_reportLongRowsCache) return _reportLongRowsCache;
  const long = [];
  DISPLAY_REPORT_MEDIAS.forEach(media=>{
    const {areas} = _buildMediaExportSums(media);
    Object.entries(areas).forEach(([area,a])=>{
      Object.values(a.kws).forEach(k=>{
        Object.entries(k.months).forEach(([ym,m])=>{
          if(!m.imp && !m.clk && !m.db && !m.cost) return;
          long.push({매체:media, 영역:area, 소재:k.kw, 월:ym,
            imp:m.imp, clk:m.clk, db:m.db, cost:m.cost,
            contracts:m.contracts||0, perf:m.perf||0,
            contracts_cum:m.contracts_cum||0, perf_cum:m.perf_cum||0});
        });
      });
    });
  });
  _reportLongRowsCache = long;
  return long;
}
function _reportMonthLabel(ym){
  const mm = ym.match(/^(\d{4})-(\d{2})$/);
  return mm ? `${mm[1]}년 ${parseInt(mm[2])}월` : ym;
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

const DISPLAY_INSIGHT_COLS = [
  {key:'media', label:'매체'},
  {key:'area', label:'영역'},
  {key:'cost', label:'광고비', num:true, fmt:v=>v.toLocaleString()},
  {key:'imp', label:'노출수', num:true, fmt:v=>v.toLocaleString()},
  {key:'snd', label:'발송수', num:true, fmt:v=>v.toLocaleString()},
  {key:'clk', label:'클릭수', num:true, fmt:v=>v.toLocaleString()},
  {key:'ctr', label:'CTR', num:true, fmt:v=>v!==null?v+'%':'-'},
  {key:'dbcvr', label:'DB전환율', num:true, fmt:v=>v!==null?v+'%':'-'},
  {key:'db', label:'DB수', num:true, fmt:v=>v.toLocaleString()},
  {key:'cpd', label:'DB단가', num:true, fmt:v=>v!==null?v.toLocaleString()+'원':'-'},
  {key:'contracts', label:'계약수', num:true, fmt:v=>v.toLocaleString()},
  {key:'perf', label:'평가업적', num:true, fmt:v=>v>0?Math.round(v).toLocaleString()+'원':'-'},
  {key:'roas', label:'ROAS', num:true, special:'roas'},
];
let _displayInsightRows = [];
let _displayInsightSortCol = 'cost';
let _displayInsightSortAsc = false;
const DISPLAY_INSIGHT_CUM_COLS = ['contracts','perf','roas'];
let _displayInsightCumMode = false;

function setDisplayInsightCumMode(cum, btn){
  _displayInsightCumMode = cum;
  document.querySelectorAll('#display-insight-cum-toggle .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _renderDisplayInsightTable();
}

function _displayInsightCumVal(r, key){
  if(!_displayInsightCumMode) return r[key];
  if(key==='contracts') return r.contracts_cum ?? r.contracts ?? 0;
  if(key==='perf') return r.perf_cum ?? r.perf ?? 0;
  if(key==='roas') return r.roas_cum ?? null;
  return r[key];
}

function sortDisplayInsightTable(col){
  if(_displayInsightSortCol===col) _displayInsightSortAsc=!_displayInsightSortAsc;
  else{ _displayInsightSortCol=col; _displayInsightSortAsc=false; }
  _renderDisplayInsightTable();
}

function _renderDisplayInsightTable(){
  const col = _displayInsightSortCol, asc = _displayInsightSortAsc;
  const sorted = [..._displayInsightRows].sort((a,b)=>{
    let av=DISPLAY_INSIGHT_CUM_COLS.includes(col)?_displayInsightCumVal(a,col):a[col];
    let bv=DISPLAY_INSIGHT_CUM_COLS.includes(col)?_displayInsightCumVal(b,col):b[col];
    if(av===null) av = asc?Infinity:-Infinity;
    if(bv===null) bv = asc?Infinity:-Infinity;
    if(typeof av==='string') return asc?av.localeCompare(bv):bv.localeCompare(av);
    return asc?av-bv:bv-av;
  });

  document.getElementById('display-insight-thead').innerHTML = '<tr>'+DISPLAY_INSIGHT_COLS.map(c=>{
    const arrow = c.key===col ? (asc?' ↑':' ↓') : '';
    const label = (_displayInsightCumMode && DISPLAY_INSIGHT_CUM_COLS.includes(c.key)) ? c.label+' ·누적' : c.label;
    return `<th class="${c.num?'num':''}" style="cursor:pointer" onclick="sortDisplayInsightTable('${c.key}')">${label}${arrow}</th>`;
  }).join('')+'</tr>';

  document.getElementById('display-insight-tbody').innerHTML = sorted.map(r=>`<tr>
    ${DISPLAY_INSIGHT_COLS.map(c=>{
      if(c.special==='roas') return `<td class="num">${roasBadge(_displayInsightCumVal(r,'roas'))}</td>`;
      const v = DISPLAY_INSIGHT_CUM_COLS.includes(c.key) ? _displayInsightCumVal(r,c.key) : r[c.key];
      return c.key==='media'||c.key==='area' ? `<td>${escHtml(v)}</td>` : `<td class="num">${c.fmt(v)}</td>`;
    }).join('')}
  </tr>`).join('') || `<tr><td colspan="${DISPLAY_INSIGHT_COLS.length}" style="padding:1rem;color:var(--faint)">데이터 없음</td></tr>`;
}

// 영역별 추이 데이터 준비: 특정 월 선택 시 일별, 전체 월 선택 시 월별로 집계
function _displayBuildChartSeries(areaList, mediaRows, crmRows, monSel){
  const byMonth = !monSel;
  const periodOf = date => byMonth ? date.slice(0,7) : date;
  const dayRows = mediaRows.filter(r=>!monSel || (r['날짜']||'').startsWith(monSel));

  let periods;
  if(byMonth){
    periods = [...new Set(dayRows.map(r=>periodOf(r['날짜']||'')).filter(Boolean))].sort();
  } else {
    // 선택된 월의 달력상 모든 날짜를 채워서 데이터 없는 날도 0으로 표시
    const [y, m] = monSel.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    periods = Array.from({length: daysInMonth}, (_, i) => `${monSel}-${String(i+1).padStart(2,'0')}`);
  }

  const data = {};
  areaList.forEach(a=>{
    data[a.area] = {};
    periods.forEach(p=>data[a.area][p] = {cost:0, imp:0, clk:0, db:0});
  });

  dayRows.forEach(r=>{
    const area = (r['상품명']||'').trim() || '(미지정)';
    const b = data[area] && data[area][periodOf(r['날짜']||'')];
    if(!b) return;
    b.cost += _cN(r['비용']);
    b.imp  += _cN(r['노출수(열람수)']);
    b.clk  += _cN(r['클릭수']);
  });

  (crmRows||[]).forEach(r=>{
    const code = (r['인타입']||'').trim();
    if(!code) return;
    const d = _normDS(r['상담등록일']||'');
    if(!d || (monSel && !d.startsWith(monSel))) return;
    const p = periodOf(d);
    const area = areaList.find(a=>a.codes.has(code));
    if(!area) return;
    const b = data[area.area] && data[area.area][p];
    if(!b) return;
    b.db+=_dbCount(r);
  });

  return {periods, data, byMonth};
}

// 토글 버튼으로 지표 하나씩 전환하는 영역별 추이 차트
// "2026-07" → "2026-06" (1월이면 전년도 12월로)
function _prevMonthKey(ym){
  const m = (ym||'').match(/^(\d{4})-(\d{2})$/);
  if(!m) return null;
  let y=+m[1], mo=+m[2]-1;
  if(mo<1){ mo=12; y-=1; }
  return `${y}-${String(mo).padStart(2,'0')}`;
}

// 디스플레이 그래프의 "전달 합계" 비교선용 — 영역 구분 없이 이 매체 전체를 일자별로 합산한다
// (영역별로 지난달까지 다 겹치면 선/막대가 너무 많아지므로 합계 하나만 비교)
// 전달 데이터를 "합계"뿐 아니라 "영역별"로도 같이 계산해둔다 — 화면엔 합계 막대/선 하나만 그리지만,
// 툴팁에서는 당월처럼 영역별 수치도 같이 보여주기 위함 (인타입→영역 매핑은 월과 무관하므로
// areaList의 codes를 그대로 재사용해 전달 CRM 데이터를 같은 영역으로 분류한다)
function _displayPrevMonthTotals(media, prevKey, areaList){
  const empty = () => ({cost:0,imp:0,clk:0,db:0});
  const byDay = {};      // {day: {cost,imp,clk,db}} — 합계 (그래프에 그리는 값)
  const byDayArea = {};  // {day: {영역명: {cost,imp,clk,db}}} — 영역별 (툴팁 표시용)

  const rows = (_displayData||[]).filter(r=>(r['매체명']||'').trim()===media && (r['날짜']||'').startsWith(prevKey));
  rows.forEach(r=>{
    const day = parseInt((r['날짜']||'').split('-')[2],10);
    const area = (r['상품명']||'').trim() || '(미지정)';
    if(!byDay[day]) byDay[day] = empty();
    if(!byDayArea[day]) byDayArea[day] = {};
    if(!byDayArea[day][area]) byDayArea[day][area] = empty();
    const cost=_cN(r['비용']), imp=_cN(r['노출수(열람수)']), clk=_cN(r['클릭수']);
    byDay[day].cost+=cost; byDay[day].imp+=imp; byDay[day].clk+=clk;
    byDayArea[day][area].cost+=cost; byDayArea[day][area].imp+=imp; byDayArea[day][area].clk+=clk;
  });

  const normM = media.replace(/\s+/g,'');
  const refAreaByCode = {};
  (_displayIntypeRef||[]).forEach(r=>{
    if((r['매체']||'').replace(/\s+/g,'')===normM){
      const c=(r['인타입']||'').trim(), a=(r['영역']||'').trim();
      if(c && a && !refAreaByCode[c]) refAreaByCode[c]=a;
    }
  });
  const myPrefixes = Object.entries(DISPLAY_INTYPE_PREFIX_MEDIA).filter(([,m])=>m===media).map(([p])=>p);

  (_displayCrmRaw||[]).forEach(r=>{
    const code = (r['인타입']||'').trim();
    if(!code) return;
    const d = _normDS(r['상담등록일']||'');
    if(!d.startsWith(prevKey)) return;
    const foundArea = (areaList||[]).find(a=>a.codes.has(code));
    const area = foundArea ? foundArea.area : (refAreaByCode[code] || (myPrefixes.some(p=>code.startsWith(p)) ? '미확인' : null));
    if(!area) return;
    const day = parseInt(d.split('-')[2],10);
    const dbn = _dbCount(r);
    if(!byDay[day]) byDay[day] = empty();
    byDay[day].db += dbn;
    if(!byDayArea[day]) byDayArea[day] = {};
    if(!byDayArea[day][area]) byDayArea[day][area] = empty();
    byDayArea[day][area].db += dbn;
  });

  return {byDay, byDayArea};
}

function renderDisplayCharts(areaList, mediaRows, crmRows, monSel){
  _displayLastChartArgs = {areaList, mediaRows, crmRows, monSel};
  if(!window.Chart){
    if(!_displayChartJsLoading){
      _displayChartJsLoading = true;
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
      s.onload = () => { renderDisplayCharts(areaList, mediaRows, crmRows, monSel); };
      document.head.appendChild(s);
    }
    return;
  }

  const {periods, data, byMonth} = _displayBuildChartSeries(areaList, mediaRows, crmRows, monSel);
  const metric = _DISPLAY_CHART_METRICS[_displayChartMetric] || _DISPLAY_CHART_METRICS.cost;
  const titleEl = document.getElementById('display-chart-title-text');
  if(titleEl) titleEl.textContent = `영역별 ${metric.label} 추이 (${byMonth?'월별':'일별'})`;

  const ctx = document.getElementById('display-chart-single')?.getContext('2d');
  if(!ctx) return;
  if(_displayChartSingle) _displayChartSingle.destroy();
  if(!periods.length) return;

  const valueOf = (b) => {
    if(_displayChartMetric==='cost')   return b.cost;
    if(_displayChartMetric==='db')     return b.db;
    if(_displayChartMetric==='cpd')    return b.db>0 ? Math.round(b.cost/b.db) : null;
    if(_displayChartMetric==='ctr')    return b.imp>0 ? Math.round(b.clk/b.imp*10000)/100 : null;
    if(_displayChartMetric==='dbcvr')  return b.clk>0 ? Math.round(b.db/b.clk*1000)/10 : null;
    return null;
  };

  const datasets = areaList.map((a,i)=>{
    const color = _DISPLAY_AREA_COLORS[i % _DISPLAY_AREA_COLORS.length];
    const values = periods.map(p=>valueOf(data[a.area][p]));
    return metric.type==='bar'
      ? {type:'bar', label:a.area, data:values, backgroundColor:color, stack:'s'}
      : {type:'line', label:a.area, data:values, borderColor:color, backgroundColor:color, tension:0.3};
  });

  // 광고비는 절대 금액이라 전달과 겹쳐봐야 의미가 적어 제외 — 나머지는 영역 구분 없이 매체 전체
  // 합계로 지난달 추이를 겹친다 (막대/선 자체를 영역별로 나누면 너무 복잡해짐. 대신 툴팁에서는
  // prevByDayArea로 영역별 수치를 같이 보여준다). DB수는 막대(별도 스택), 비율 지표는 점선으로 구분
  let prevByDayArea = null;
  if(_displayChartMetric!=='cost' && !byMonth && monSel){
    const prevKey = _prevMonthKey(monSel);
    if(prevKey){
      const prev = _displayPrevMonthTotals(_displayMedia, prevKey, areaList);
      prevByDayArea = prev.byDayArea;
      const prevValues = periods.map(p=>{
        const b = prev.byDay[parseInt(p.split('-')[2],10)];
        return b ? valueOf(b) : null;
      });
      // 전달을 왼쪽에 그리도록 영역 막대/선들보다 앞에 배치
      if(_displayChartMetric==='db'){
        datasets.unshift({type:'bar', label:'전달 합계', data:prevValues, backgroundColor:'#9ca3af', stack:'prev'});
      } else {
        datasets.unshift({type:'line', label:'전달 합계', data:prevValues, borderColor:'#9ca3af', backgroundColor:'#9ca3af', borderDash:[5,4], tension:0.3, pointRadius:2});
      }
    }
  }

  const fmtVal = v => v===null||v===undefined ? '-' : (metric.unit==='%' ? v+'%' : v.toLocaleString()+(metric.unit==='원'?'원':''));
  _displayChartSingle = new Chart(ctx, {
    type: metric.type,
    data: {labels: periods, datasets},
    options: {
      responsive:true, maintainAspectRatio:false,
      // 막대 하나씩 개별로 안 보고, 그 날짜의 모든 영역(+전달)을 한 번에 툴팁으로 보여준다
      interaction: {mode:'index', intersect:false},
      plugins:{
        legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{
          label: c=>{
            // 전달 합계는 그 자체 숫자에 더해, 그날 영역별로 어떻게 나뉘는지도 같이 보여준다
            if(c.dataset.label==='전달 합계' && prevByDayArea){
              const day = parseInt(String(periods[c.dataIndex]).split('-')[2],10);
              const areaBreak = prevByDayArea[day] || {};
              const lines = [`전달 합계: ${fmtVal(c.parsed.y)}`];
              areaList.forEach(a=>{
                const b = areaBreak[a.area];
                const v = b ? valueOf(b) : null;
                if(v!==null) lines.push(`   · ${a.area}: ${fmtVal(v)}`);
              });
              return lines;
            }
            return `${c.dataset.label}: ${fmtVal(c.parsed.y)}`;
          },
          // 전달 제외, 당월 영역들만 더한 합계를 맨 아래에 한 줄 더 보여준다
          footer: items=>{
            const total = items.filter(i=>i.dataset.label!=='전달 합계').reduce((s,i)=>s+(i.parsed.y||0),0);
            return `당월 합계: ${fmtVal(total)}`;
          }
        }}
      },
      scales:{
        x:{stacked: metric.type==='bar', grid:{display:false},ticks:{font:{size:10},color:'#888',maxRotation:0,autoSkip:true}},
        y:{stacked: metric.type==='bar', ticks:{callback:v=>metric.unit==='%'?v+'%':v.toLocaleString(),font:{size:10},color:'#888'},grid:{color:'rgba(0,0,0,0.05)'}}
      }
    }
  });
}

function switchDisplayChartMetric(metric, btn){
  document.querySelectorAll('#display-chart-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _displayChartMetric = metric;
  if(_displayLastChartArgs){
    const {areaList, mediaRows, crmRows, monSel} = _displayLastChartArgs;
    renderDisplayCharts(areaList, mediaRows, crmRows, monSel);
  }
}

async function loadDisplayData(){
  const pending = document.getElementById('display-pending');
  const content = document.getElementById('display-content');
  if(!SHEETS_URLS.display_report){
    pending.textContent = '▶ 광고 리포트 데이터 연결 대기 중입니다. (구글시트 URL 등록 필요)';
    pending.style.display=''; pending.classList.remove('is-hidden'); content.style.display='none';
    return;
  }
  pending.textContent = '▶ 데이터 로드 중...';
  pending.style.display=''; pending.classList.remove('is-hidden'); content.style.display='none';
  try{
    // 준비 단계라 시트가 자주 바뀌므로 display_report/display_intype는 캐싱 없이 매번 새로 받는다.
    // display_intype(구글시트 참조표)는 응답이 없거나 느려도 화면 전체가 "로드 중"에 멈추면 안 되므로
    // 타임아웃을 걸고, 실패해도 빈 참조표로 계속 진행한다 (인타입 매핑만 못 쓸 뿐 핵심 데이터는 정상 표시)
    const [reportText, intypeText, s] = await Promise.all([
      fetch(SHEETS_URLS.display_report).then(r=>r.text()),
      SHEETS_URLS.display_intype ? _fetchWithTimeout(SHEETS_URLS.display_intype, 8000).then(r=>r.text()).catch(()=>'') : Promise.resolve(''),
      loadAllSheets(),
    ]);
    _displayData = _pCSV(reportText) || [];
    _displayIntypeRef = intypeText ? (_pCSV(intypeText) || []) : [];
    _displayCrmRaw = (s.raw||[]).filter(r=>(r['광고매체세부']||'').trim()==='애드온컴퍼니');
  }catch(e){
    pending.textContent = '▶ 데이터 로드 실패: ' + e.message;
    pending.style.display=''; pending.classList.remove('is-hidden'); content.style.display='none';
    return;
  }
  if(!_displayData.length){
    pending.textContent = '▶ 광고 리포트 데이터가 아직 없습니다.';
    pending.style.display=''; pending.classList.remove('is-hidden'); content.style.display='none';
    return;
  }
  pending.style.display='none';
  _fillDisplayMonSel();
  if(_isDisplayInsightActive()){
    content.style.display='none';
    document.getElementById('display-insight').style.display='';
    document.getElementById('display-insight').classList.remove('is-hidden');
    renderDisplayInsight();
  } else {
    content.style.display='';
    content.classList.remove('is-hidden');
    renderDisplayTab();
  }
}

function _fillDisplayMonSel(){
  const sel = document.getElementById('display-month-sel');
  // 광고 리포트에 아직 그 달 행이 없어도(광고비 업로드 전) CRM에 상담등록일이 있으면 월 선택지에 넣는다
  // — DB는 상담등록일 기준으로 이미 잡히므로, 광고비만 나중에 채워지는 구조를 지원
  const reportMonths = _displayData.map(r=>(r['날짜']||'').slice(0,7));
  const crmMonths = (_displayCrmRaw||[]).map(r=>_normDS(r['상담등록일']||'').slice(0,7));
  const months = [...new Set([...reportMonths, ...crmMonths])].filter(m=>/^\d{4}-\d{2}$/.test(m)).sort().reverse();
  const cur = sel.value;
  sel.innerHTML = '<option value="">전체 월</option>' + months.map(m=>{
    const [y,mo]=m.split('-'); return `<option value="${m}">${y}년 ${parseInt(mo)}월</option>`;
  }).join('');
  if(months.includes(cur)) sel.value = cur;
  else if(months.length) sel.value = months[0]; // 최신 월을 기본값으로 (전체 월 대신)
}

function _fillDisplayInsightMonSel(){
  const sel = document.getElementById('display-insight-month-sel');
  if(!sel) return;
  const reportMonths = (_displayData||[]).map(r=>(r['날짜']||'').slice(0,7));
  const crmMonths = (_displayCrmRaw||[]).map(r=>_normDS(r['상담등록일']||'').slice(0,7));
  const months = [...new Set([...reportMonths, ...crmMonths])].filter(m=>/^\d{4}-\d{2}$/.test(m)).sort().reverse();
  const cur = sel.value;
  sel.innerHTML = '<option value="">전체 월</option>' + months.map(m=>{
    const [y,mo]=m.split('-'); return `<option value="${m}">${y}년 ${parseInt(mo)}월</option>`;
  }).join('');
  if(months.includes(cur)) sel.value = cur; // 기본값은 "전체 월" 유지
}

// {매체,영역} 기준으로 인타입 참조표에서 해당하는 모든 소재의 인타입 코드를 찾는다 (월 무관, 전체 기간)
// (소재 A/B가 광고 리포트에서 안 구분되므로, 영역 단위로 코드를 모아 DB를 합산 매칭한다)
function _displayIntypeCodes(media, area){
  if(!_displayIntypeRef || !_displayIntypeRef.length) return [];
  const norm = s => (s||'').replace(/\s+/g,'');
  return _displayIntypeRef
    .filter(r => norm(r['매체'])===norm(media) && norm(r['영역'])===norm(area))
    .map(r => (r['인타입']||'').trim())
    .filter(Boolean);
}

// 인타입은 사람이 랜딩페이지 뒤에 직접 입력해서 가끔 오타가 나고, 그러면 참조표(display_intype.csv)에도
// 못 등록되고 광고비 리포트에도 없어서 DB가 소리 없이 누락된다 — 접두사만으로 매체를 구분해 최소한 매체별
// "미확인" 영역에는 잡히게 한다 (영역/소재까지는 알 수 없음)
const DISPLAY_INTYPE_PREFIX_MEDIA = {A_kpa:'카카오페이', A_skt:'T멤버십', A_gas:'가스락', A_pas:'KT PASS'};
// 위 접두사 규칙으로도 부족한, 등록 자체를 실수한(숫자 하나 빠짐 등) 것으로 확인된 특정 코드는
// 영역/소재까지 강제로 지정해 정상 코드처럼 취급한다
const DISPLAY_INTYPE_FORCE_MAP = {
  A_sktB810: {media:'T멤버십', area:'PUSH',   kw:'소재 A'},
  A_sktB820: {media:'T멤버십', area:'미션탭', kw:'소재 A'},
};

function renderDisplayTab(){
  if(!_displayData || !_displayData.length) return;
  const monSel = document.getElementById('display-month-sel').value; // "" 또는 "2026-01"
  const mediaRows = _displayData.filter(r=>(r['매체명']||'').trim() === _displayMedia);

  // 영역(상품명)별 그룹 + 소재별 하위 그룹
  // 인타입 코드는 월 상관없이 전체 기간 기준으로 모으고(DB는 상담등록일로 월을 판단하므로),
  // 광고비/노출/클릭 등 광고 지표만 선택된 월에 맞는 행으로 한정한다
  const areas = {};
  mediaRows.forEach(r=>{
    const area = (r['상품명']||'').trim() || '(미지정)';
    if(!areas[area]) areas[area] = {area, cost:0, imp:0, clk:0, snd:0, kws:{}, codes:new Set(), monthCodes:new Set(), codeLabelCost:{}};
    const a = areas[area];
    const code = (r['인타입']||'').trim();
    const kw = (r['소재명']||'').trim() || '(소재 미기재)';
    if(code) a.codes.add(code);
    if(!a.kws[kw]) a.kws[kw] = {kw, cost:0, imp:0, clk:0, snd:0, codes:new Set(), monthCodes:new Set()};
    if(code) a.kws[kw].codes.add(code);

    const rowCost = _cN(r['비용']);
    if(code){
      // 코드별로 어떤 소재명 아래 "실제 광고비"가 찍혔는지 전체 기간 기준으로 기록
      // (0원짜리 placeholder 행의 라벨한테 코드 소유권이 뺏기지 않게 하기 위함)
      if(!a.codeLabelCost[code]) a.codeLabelCost[code] = {};
      a.codeLabelCost[code][kw] = (a.codeLabelCost[code][kw]||0) + rowCost;
    }

    const inMonth = !monSel || (r['날짜']||'').startsWith(monSel);
    if(inMonth){
      const imp=_cN(r['노출수(열람수)']), clk=_cN(r['클릭수']), snd=_cN(r['발송수']);
      a.cost+=rowCost; a.imp+=imp; a.clk+=clk; a.snd+=snd;
      a.kws[kw].cost+=rowCost; a.kws[kw].imp+=imp; a.kws[kw].clk+=clk; a.kws[kw].snd+=snd;
      if(code){ a.monthCodes.add(code); a.kws[kw].monthCodes.add(code); }
    }
  });

  const hasIntypeRef = !!(_displayIntypeRef && _displayIntypeRef.length);
  const crmRows = _displayCrmRaw || [];

  // 강제 보정 코드: 오타로 확인된 특정 인타입을 지정된 영역/소재로 정상 코드처럼 편입시킨다
  Object.entries(DISPLAY_INTYPE_FORCE_MAP).forEach(([code, map])=>{
    if(map.media !== _displayMedia) return;
    if(!areas[map.area]) areas[map.area] = {area:map.area, cost:0, imp:0, clk:0, snd:0, kws:{}, codes:new Set(), monthCodes:new Set(), codeLabelCost:{}};
    const a = areas[map.area];
    a.codes.add(code);
    if(!a.kws[map.kw]) a.kws[map.kw] = {kw:map.kw, cost:0, imp:0, clk:0, snd:0, codes:new Set(), monthCodes:new Set()};
    a.kws[map.kw].codes.add(code);
    // 더미 비용을 실제 라벨(map.kw)에 걸어둬야 소재 소유권 판정에서 이 코드가 그 소재로 확정된다 —
    // 빈 객체({})로 두면 아래 codeOwner 판정에서 owner가 없어져(undefined) 이 코드가 모든 소재에서
    // 빠지고, 영역 합계(a.db)에만 잡힌 채 소재별 표에는 안 보이는 "숨은 DB"가 된다
    a.codeLabelCost[code] = {[map.kw]: 1};
    const inSelMonth = crmRows.some(r=>(r['인타입']||'').trim()===code && (!monSel || _normDS(r['상담등록일']||'').startsWith(monSel)));
    if(inSelMonth){ a.monthCodes.add(code); a.kws[map.kw].monthCodes.add(code); }
  });

  function matchDb(codes){
    let db=0, contracts=0, perf=0, contracts_cum=0, perf_cum=0;
    if(codes && codes.size){
      crmRows.forEach(r=>{
        if(!codes.has((r['인타입']||'').trim())) return;
        // 월 필터가 걸려있으면 그 코드가 다른 달에도 쓰인 경우까지 잡히지 않도록 상담일도 같이 맞춘다
        if(monSel && !_normDS(r['상담등록일']||'').startsWith(monSel)) return;
        db+=_dbCount(r); contracts+=Math.round(_cN(r['계약수'])); perf+=_cN(r['평가업적']);
        contracts_cum+=Math.round(_cN(r['계약수(누적)'])); perf_cum+=_cN(r['평가업적(누적)']);
      });
    }
    return {db, contracts, perf, contracts_cum, perf_cum};
  }
  function calcMetrics(cost, clk, db, perf, contracts, perf_cum, contracts_cum){
    const roas = (db>0 && perf>0 && cost>0) ? Math.round(cost/perf*100) : null;
    const cpd  = (db>0 && cost>0) ? Math.round(cost/db) : null;
    const dbcvr = (clk>0 && db>0) ? Math.round(db/clk*1000)/10 : null;
    const cvr = (db>0 && contracts>0) ? Math.round(contracts/db*1000)/10 : null;
    const roas_cum = (db>0 && perf_cum>0 && cost>0) ? Math.round(cost/perf_cum*100) : null;
    const cvr_cum = (db>0 && contracts_cum>0) ? Math.round(contracts_cum/db*1000)/10 : null;
    return {roas, cpd, dbcvr, cvr, roas_cum, cvr_cum};
  }

  // DB에는 들어왔지만 광고비 시트에는 없는(과거) 인타입 코드 처리:
  // 참조표에서 그 코드의 매체/영역만 확인해 해당 영역의 DB로는 잡아주되,
  // 어떤 소재였는지는 알 수 없으므로 소재 구분 없이 "미확인"으로만 묶는다
  // (영역 자체가 광고비 데이터 없이 참조표 전체 코드로 대체되는 경우는 위 fallback이 이미 커버하므로 제외)
  if(hasIntypeRef){
    const norm = s => (s||'').replace(/\s+/g,'');
    const refAreaByCode = {};
    const refKwByCode = {};
    _displayIntypeRef.forEach(r=>{
      if(norm(r['매체'])!==norm(_displayMedia)) return;
      const code = (r['인타입']||'').trim();
      const area = (r['영역']||'').trim();
      const kw = (r['소재']||'').trim();
      if(code && area && !refAreaByCode[code]) refAreaByCode[code] = area;
      if(code && kw && !refKwByCode[code]) refKwByCode[code] = kw;
    });
    const claimedCodes = new Set();
    Object.values(areas).forEach(a=>a.codes.forEach(c=>claimedCodes.add(c)));
    const crmCodes = new Set(crmRows.map(r=>(r['인타입']||'').trim()).filter(Boolean));
    crmCodes.forEach(code=>{
      if(claimedCodes.has(code)) return; // 광고비 시트에 이미 있는 코드는 기존 로직으로 처리
      const area = refAreaByCode[code];
      if(!area) return; // 참조표에도 없으면 매체/영역 판단 불가
      const a = areas[area];
      if(!a) return; // 광고비가 아예 없는 영역은 위 hasIntype fallback이 이미 전체 코드로 커버함
      a.codes.add(code);
      // 참조표에 소재까지 등록돼 있으면 그 소재로 정확히 잡고, 없으면(구버전 데이터 등) "미확인"으로 묶는다 —
      // 광고비 리포트에 인타입을 안 넣어도 참조표만 채워두면 소재 단위까지 정확히 반영되게 하기 위함
      const kwLabel = refKwByCode[code] || '미확인';
      if(!a.kws[kwLabel]) a.kws[kwLabel] = {kw:kwLabel, cost:0, imp:0, clk:0, snd:0, codes:new Set(), monthCodes:new Set()};
      a.kws[kwLabel].codes.add(code);
      if(!a.codeLabelCost[code]) a.codeLabelCost[code] = {[kwLabel]:0};
      // 이 코드로 들어온 DB가 선택된 월(상담등록일 기준)에 실제로 있을 때만 그 월의 인타입 표시에 포함
      const inSelMonth = crmRows.some(r=>(r['인타입']||'').trim()===code && (!monSel || _normDS(r['상담등록일']||'').startsWith(monSel)));
      if(inSelMonth){ a.monthCodes.add(code); a.kws[kwLabel].monthCodes.add(code); }
    });
  }

  // 참조표에도 없고 광고비 리포트에도 없는(순수 오타) 코드는 인타입 접두사로 매체만이라도 구분해
  // 그 매체의 "미확인" 영역에 담는다 — 영역/소재는 알 수 없지만 최소한 DB가 아예 누락되진 않게 함
  {
    const myPrefixes = Object.entries(DISPLAY_INTYPE_PREFIX_MEDIA).filter(([,m])=>m===_displayMedia).map(([p])=>p);
    if(myPrefixes.length){
      const claimedCodes = new Set();
      Object.values(areas).forEach(a=>a.codes.forEach(c=>claimedCodes.add(c)));
      const crmCodes = new Set(crmRows.map(r=>(r['인타입']||'').trim()).filter(Boolean));
      crmCodes.forEach(code=>{
        if(claimedCodes.has(code)) return;
        if(!myPrefixes.some(p=>code.startsWith(p))) return;
        const AREA = '미확인';
        if(!areas[AREA]) areas[AREA] = {area:AREA, cost:0, imp:0, clk:0, snd:0, kws:{}, codes:new Set(), monthCodes:new Set(), codeLabelCost:{}};
        const a = areas[AREA];
        a.codes.add(code);
        if(!a.kws['미확인']) a.kws['미확인'] = {kw:'미확인', cost:0, imp:0, clk:0, snd:0, codes:new Set(), monthCodes:new Set()};
        a.kws['미확인'].codes.add(code);
        if(!a.codeLabelCost[code]) a.codeLabelCost[code] = {'미확인':0};
        const inSelMonth = crmRows.some(r=>(r['인타입']||'').trim()===code && (!monSel || _normDS(r['상담등록일']||'').startsWith(monSel)));
        if(inSelMonth){ a.monthCodes.add(code); a.kws['미확인'].monthCodes.add(code); }
      });
    }
  }

  const areaList = Object.values(areas).map(a=>{
    // 리포트 행에 인타입이 있으면 그걸로, 없으면(레거시 대비) 참조표에서 영역 기준으로 조회
    let codes = a.codes;
    let hasIntype = codes.size>0;
    if(!hasIntype && hasIntypeRef){
      codes = new Set(_displayIntypeCodes(_displayMedia, a.area));
      hasIntype = codes.size>0;
    }
    const {db, contracts, perf, contracts_cum, perf_cum} = matchDb(codes);
    const ctr = a.imp>0 ? Math.round(a.clk/a.imp*10000)/100 : null;
    const {roas, cpd, dbcvr, cvr, roas_cum, cvr_cum} = calcMetrics(a.cost, a.clk, db, perf, contracts, perf_cum, contracts_cum);

    // 같은 인타입 코드가 소재명별로 여러 번 찍힌 경우(예: 원래 "소재 B"로 광고비가 나갔는데,
    // 그 코드로 들어온 DB 중 일부가 "미확인"이라는 0원짜리 placeholder 행으로도 남은 경우) —
    // 코드 하나는 소재 하나에만 귀속시킨다. "실제 광고비가 찍힌 소재"가 있으면 그 소재가 우선(그래야
    // 진짜 광고비 나간 소재의 효율이 정확해짐) — 그런 소재가 없는(전부 0원) 코드만 미확인 등에 남는다
    const isPlaceholderLabel = l => l==='(소재 미기재)' || l==='미확인';
    const kwEntries = Object.entries(a.kws);
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
    kwEntries.forEach(([label,k])=>{
      k.codes = new Set([...k.codes].filter(c=>codeOwner[c]===label));
      k.monthCodes = new Set([...k.monthCodes].filter(c=>codeOwner[c]===label));
    });

    // 소재별 — 행 단위 인타입이 있는 소재만 DB 매칭 (없으면 광고 지표만)
    const kws = Object.values(a.kws).map(k=>{
      const kHasIntype = k.codes.size>0;
      const {db:kdb, contracts:kcon, perf:kperf, contracts_cum:kcon_cum, perf_cum:kperf_cum} = matchDb(k.codes);
      const {roas:kroas, cpd:kcpd, dbcvr:kdbcvr, cvr:kcvr, roas_cum:kroas_cum, cvr_cum:kcvr_cum} = calcMetrics(k.cost, k.clk, kdb, kperf, kcon, kperf_cum, kcon_cum);
      return {...k, hasIntype:kHasIntype, db:kdb, contracts:kcon, perf:kperf, contracts_cum:kcon_cum, perf_cum:kperf_cum,
        roas:kroas, cpd:kcpd, dbcvr:kdbcvr, cvr:kcvr, roas_cum:kroas_cum, cvr_cum:kcvr_cum};
    });

    // 화면에 보여줄 인타입 코드는 선택된 월(monSel)에 실제로 쓰인 것만 (DB/계약 매칭 자체는 전체 기간 codes 기준 그대로 유지)
    // 단, 광고비 데이터가 아예 없어 참조표 전체 코드로 대체 매칭된 영역은 그 대체 코드를 그대로 보여준다
    const displayCodes = (a.codes.size===0 && hasIntype) ? codes : a.monthCodes;

    return {...a, ctr, db, contracts, perf, contracts_cum, perf_cum, roas, cpd, dbcvr, cvr, roas_cum, cvr_cum, hasIntype, kws, codes, displayCodes};
  }).sort((a,b)=>b.cost-a.cost);

  const hasIntype = areaList.some(a=>a.hasIntype);
  renderDisplaySummary(areaList, hasIntype);
  renderDisplayAreaTable(areaList);
  renderDisplayCharts(areaList, mediaRows, crmRows, monSel);
}

function renderDisplaySummary(areaList, hasIntype){
  const totalCost = areaList.reduce((s,a)=>s+a.cost,0);
  const totalImp  = areaList.reduce((s,a)=>s+a.imp,0);
  const totalClk  = areaList.reduce((s,a)=>s+a.clk,0);
  const totalDb   = areaList.reduce((s,a)=>s+a.db,0);
  const ctr   = totalImp>0 ? Math.round(totalClk/totalImp*10000)/100 : null;
  const cpd   = (hasIntype && totalDb>0) ? Math.round(totalCost/totalDb) : null;
  const dbcvr = (hasIntype && totalClk>0 && totalDb>0) ? Math.round(totalDb/totalClk*1000)/10 : null;
  const mc = _calcMonCum(areaList.map(a=>({...a, performance: a.perf||0, performance_cum: a.perf_cum||0, cost: a.cost||0})));
  const cid='display-summary';
  document.getElementById(cid).innerHTML = [
    _kpiCard(cid,0,'광고비', totalCost>0?totalCost:null, {unit:'원', color:'default', sub:'디스플레이 합계'}),
    _kpiCard(cid,1,'CTR', ctr, {unit:'%', decimals:2, color:'red', sub:'클릭 ÷ 노출'}),
    _kpiCard(cid,2,'DB전환율', dbcvr, {unit:'%', decimals:1, color:'red', sub:'DB ÷ 클릭'}),
    _kpiCard(cid,3,'DB수', hasIntype?totalDb:null, {unit:'건', color:'accent', sub:'매칭 DB'}),
    _kpiCard(cid,4,'DB단가', cpd, {unit:'원', color:'purple', sub:'광고비 ÷ DB수'}),
    _kpiCard(cid,5,'계약수', hasIntype?mc.mCon:null, {unit:'건', color:'green', subVal:(hasIntype&&mc.hasCum)?mc.cCon:null, subUnit:'건'}),
    _kpiCard(cid,6,'계약률', (hasIntype&&mc.mCvr!==null)?Number(mc.mCvr):null, {unit:'%', decimals:1, color:'green', subVal:(hasIntype&&mc.hasCum&&mc.cCvr!==null)?Number(mc.cCvr):null, subUnit:'%'}),
    _kpiCard(cid,7,'평가업적', (hasIntype&&mc.mPerf>0)?Math.round(mc.mPerf):null, {unit:'원', color:'amber', subVal:(hasIntype&&mc.hasCum&&mc.cPerf>0)?Math.round(mc.cPerf):null, subUnit:'원'}),
    _kpiCard(cid,8,'ROAS', hasIntype?mc.mRoas:null, {unit:'%', color:'amber', subVal:(hasIntype&&mc.hasCum)?mc.cRoas:null, subUnit:'%'}),
  ].join('');
  _kpiFinish(cid);
}

let _displayLastAreaList = null;
let _displayAreaCumMode = false;
function setDisplayAreaCumMode(cum, btn){
  _displayAreaCumMode = cum;
  document.querySelectorAll('#display-area-cum-toggle .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(_displayLastAreaList) renderDisplayAreaTable(_displayLastAreaList);
}

function renderDisplayAreaTable(areaList){
  _displayLastAreaList = areaList;
  const cum = _displayAreaCumMode;
  const s = cum ? ' ·누적' : '';
  document.getElementById('display-thead').innerHTML = `<tr>
    <th></th><th>영역</th><th>인타입</th><th class="num">광고비</th><th class="num">노출수</th><th class="num">발송수</th>
    <th class="num">클릭수</th><th class="num">CTR</th><th class="num">DB전환율</th>
    <th class="num">DB수</th><th class="num">DB단가</th><th class="num">계약수${s}</th><th class="num">계약률${s}</th>
    <th class="num">평가업적${s}</th><th class="num">ROAS${s}</th>
  </tr>`;
  if(!areaList.length){
    document.getElementById('display-tbody').innerHTML = '<tr><td colspan="15" style="padding:1rem;color:var(--faint)">데이터 없음</td></tr>';
    return;
  }
  // 소재 A,B,C... 순으로, "미확인"/소재 미기재 등은 맨 뒤로
  const kwSortKey = label => {
    const m = (label||'').match(/^소재\s*([A-Za-z])$/);
    return m ? m[1].toUpperCase().charCodeAt(0) : 999;
  };
  window.__creativeLookup = [];
  document.getElementById('display-tbody').innerHTML = areaList.map((a,i)=>{
    const rowCls = `disp-kwdet-${i}`;
    const kwRows = [...a.kws].sort((x,y)=>{
      const kx=kwSortKey(x.kw), ky=kwSortKey(y.kw);
      return kx!==ky ? kx-ky : x.kw.localeCompare(y.kw,'ko');
    }).map(k=>{
      const kctr = k.imp>0 ? Math.round(k.clk/k.imp*10000)/100 : null;
      const kContracts = cum ? (k.contracts_cum||0) : k.contracts;
      const kCvr = cum ? k.cvr_cum : k.cvr;
      const kPerf = cum ? (k.perf_cum||0) : k.perf;
      const kRoas = cum ? k.roas_cum : k.roas;
      const dbCells = k.hasIntype
        ? `<td class="num">${k.dbcvr!==null?k.dbcvr.toLocaleString()+'%':'-'}</td>
        <td class="num">${k.db.toLocaleString()}</td>
        <td class="num">${k.cpd!==null?k.cpd.toLocaleString()+'원':'-'}</td>
        <td class="num">${kContracts.toLocaleString()}</td>
        <td class="num">${kCvr!==null?kCvr.toLocaleString()+'%':'-'}</td>
        <td class="num">${kPerf>0?Math.round(kPerf).toLocaleString()+'원':'-'}</td>
        <td class="num">${roasBadge(kRoas)}</td>`
        : `<td class="num" colspan="7" style="color:var(--faint);font-size:11px;text-align:left;padding-left:1rem">DB/계약 데이터는 영역 기준으로만 집계됩니다</td>`;
      const kCodesTxt = [...k.monthCodes].join(', ');
      const lookupIdx = window.__creativeLookup.length;
      window.__creativeLookup.push({media:_displayMedia, area:a.area, kw:k.kw, codes:[...k.monthCodes]});
      return `<tr class="${rowCls}" style="display:none;background:var(--bg)">
        <td></td>
        <td style="padding-left:1.5rem;color:var(--muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" title="클릭하면 크리에이티브 이미지를 볼 수 있습니다" onclick="openCreativeModal(${lookupIdx})">🖼️ ${escHtml(k.kw)}</td>
        <td style="color:var(--faint);font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(kCodesTxt)}">${escHtml(kCodesTxt)||'-'}</td>
        <td class="num">${k.cost.toLocaleString()}</td>
        <td class="num">${k.imp.toLocaleString()}</td>
        <td class="num">${k.snd.toLocaleString()}</td>
        <td class="num">${k.clk.toLocaleString()}</td>
        <td class="num">${kctr!==null?kctr+'%':'-'}</td>
        ${dbCells}
      </tr>`;
    }).join('');
    const aCodesTxt = [...a.displayCodes].join(', ');
    const aContracts = cum ? (a.contracts_cum||0) : a.contracts;
    const aCvr = cum ? a.cvr_cum : a.cvr;
    const aPerf = cum ? (a.perf_cum||0) : a.perf;
    const aRoas = cum ? a.roas_cum : a.roas;
    return `<tr style="cursor:pointer" onclick="toggleDailyKwDetail('${rowCls}',this)">
      <td class="dk-caret" style="color:var(--faint);text-align:center">▸</td>
      <td>${escHtml(a.area)}</td>
      <td style="color:var(--faint);font-size:12px" title="${escHtml(aCodesTxt)}">${a.displayCodes.size ? a.displayCodes.size+'개' : '-'}</td>
      <td class="num">${a.cost.toLocaleString()}</td>
      <td class="num">${a.imp.toLocaleString()}</td>
      <td class="num">${a.snd.toLocaleString()}</td>
      <td class="num">${a.clk.toLocaleString()}</td>
      <td class="num">${a.ctr!==null?a.ctr+'%':'-'}</td>
      <td class="num">${a.dbcvr!==null?a.dbcvr.toLocaleString()+'%':'-'}</td>
      <td class="num">${a.hasIntype?a.db.toLocaleString():'-'}</td>
      <td class="num">${a.cpd!==null?a.cpd.toLocaleString()+'원':'-'}</td>
      <td class="num">${a.hasIntype?aContracts.toLocaleString():'-'}</td>
      <td class="num">${aCvr!==null?aCvr.toLocaleString()+'%':'-'}</td>
      <td class="num">${aPerf>0?Math.round(aPerf).toLocaleString()+'원':'-'}</td>
      <td class="num">${roasBadge(aRoas)}</td>
    </tr>${kwRows}`;
  }).join('');
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
  const th = label => `<th class="num" style="padding:6px 10px;text-align:right;background:#fafaf8;border-bottom:1px solid var(--border);position:sticky;top:0">${label}</th>`;
  dailyEl.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">일별 데이터</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:.75rem">
      ${sumCard('CTR','brand-red', sumCtr!==null?sumCtr+'%':'-')}
      ${sumCard('DB단가','purple', sumCpd!==null?sumCpd.toLocaleString()+'원':'-')}
      ${sumCard('DB전환율','brand-red', sumDbcvr!==null?sumDbcvr+'%':'-')}
      ${sumCard('계약률','green', sumCvr!==null?sumCvr+'%':'-')}
    </div>
    <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs)">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>
          <th style="padding:6px 10px;text-align:left;background:#fafaf8;border-bottom:1px solid var(--border);position:sticky;top:0">날짜</th>
          ${th('광고비')}${th('노출수')}${th('발송수')}${th('클릭수')}${th('CTR')}${th('DB수')}${th('DB단가')}${th('DB전환율')}
        </tr></thead>
        <tbody>
          ${days.map(d=>{
            const ctr = d.imp>0 ? Math.round(d.clk/d.imp*10000)/100 : null;
            const cpd = d.db>0 ? Math.round(d.cost/d.db) : null;
            const dbcvr = d.clk>0 ? Math.round(d.db/d.clk*1000)/10 : null;
            return `<tr>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border)">${d.date}</td>
            <td class="num" style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">${d.cost.toLocaleString()}</td>
            <td class="num" style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">${d.imp.toLocaleString()}</td>
            <td class="num" style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">${d.snd.toLocaleString()}</td>
            <td class="num" style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">${d.clk.toLocaleString()}</td>
            <td class="num" style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">${ctr!==null?ctr+'%':'-'}</td>
            <td class="num" style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">${d.db.toLocaleString()}</td>
            <td class="num" style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">${cpd!==null?cpd.toLocaleString()+'원':'-'}</td>
            <td class="num" style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border)">${dbcvr!==null?dbcvr+'%':'-'}</td>
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

function escHtml(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
