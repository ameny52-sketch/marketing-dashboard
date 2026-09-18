// ===== 성과 진단 (키워드 / 파워컨텐츠) =====
// (js/insights.js 에서 분리 — 로직 변경 없음. 로드 순서는 index.html 참고)

// ===== 키워드 성과 진단 =====
function renderKwInsight(){
  const noData  = document.getElementById('kw-insight-no-data');
  const banner  = document.getElementById('kw-insight-banner');
  const cards   = document.getElementById('kw-insight-cards');
  const detail  = document.getElementById('kw-insight-detail-section');

  // 항상 키워드 원본 전체(kwData)를 본다 — 성과 진단은 자체 기간/기기 필터를 갖고 있으므로
  // 키워드 표 쪽 검색·ROAS·DB단가 필터와는 독립적으로 동작해야 한다
  const data = (kwData || []).filter(r=>r.sub_media==='네이버');
  if(!data.length){
    noData.style.display='block'; banner.style.display='none';
    cards.style.display='none';  detail.style.display='none';
    return;
  }
  noData.style.display='none'; banner.style.display='block'; cards.style.display='grid';

  const range = document.getElementById('kw-insight-range').value;
  document.getElementById('kw-insight-trend').style.display = range==='7days'?'block':'none';

  // 날짜별 집계 - daily에 cost/clicks/impressions가 직접 있음 (네이버 광고비 일별 데이터)
  const dayMap2={};
  data.forEach(r=>{
    const days=Object.keys(r.daily||{});
    const totalDb=days.reduce((s,k)=>s+(r.daily[k].db||0),0);
    days.forEach(k=>{
      if(!dayMap2[k]) dayMap2[k]={cost:0,clicks:0,imp:0,db:0};
      const v=r.daily[k];
      dayMap2[k].db += v.db||0;
      // daily에 cost/clicks/impressions가 있으면 직접 사용, 없으면 전체값 db비중 배분
      if(v.cost!=null && v.cost>0){
        dayMap2[k].cost += v.cost;
        dayMap2[k].clicks += v.clicks||0;
        dayMap2[k].imp += v.impressions||0;
      } else if(r.cost && totalDb>0){
        const dbShare=(v.db||0)/totalDb;
        dayMap2[k].cost   += r.cost        * dbShare;
        dayMap2[k].clicks += (r.clicks||0) * dbShare;
        dayMap2[k].imp    += (r.impressions||0) * dbShare;
      }
    });
  });

  const dm = dayMap2;
  const dates = Object.keys(dm).sort();
  if(!dates.length){ noData.style.display='block'; banner.style.display='none'; cards.style.display='none'; return; }

  function sumDates(dl){
    const s={cost:0,clicks:0,imp:0,db:0};
    dl.forEach(k=>{ const d=dm[k]||{}; Object.keys(s).forEach(f=>{ s[f]+=(d[f]||0); }); });
    s.cpc   = s.clicks>0?Math.round(s.cost/s.clicks):0;
    s.cpd   = s.db>0?Math.round(s.cost/s.db):0;
    s.ctr   = s.imp>0?s.clicks/s.imp*100:0;
    s.dbcvr = s.clicks>0?s.db/s.clicks*100:0;
    s.rank  = 0;
    return s;
  }

  const today    = dates[dates.length-1];
  const yesterday= dates.length>=2?dates[dates.length-2]:null;
  const last7    = dates.slice(-7);
  const prev7    = dates.slice(-14,-7);

  let cur,prev;
  if(range==='yesterday'){
    cur=sumDates([today]); prev=yesterday?sumDates([yesterday]):{};
  } else {
    cur=sumDates(last7); prev=sumDates(prev7);
  }

  function chg(c,p){ return p>0?Math.round((c-p)/p*100):null; }
  function fmtChg(v,inv=false){
    if(v===null) return '';
    const icon=v>0?'▲':'▼';
    const color=(v>0&&!inv)||(v<0&&inv)?'#22c55e':'#ef4444';
    return `<span style="color:${color};font-size:13px;font-weight:600">${icon} ${Math.abs(v)}%</span>`;
  }
  function fmtPtChg(c,p,inv=false){
    const diff=Math.round((c-p)*10)/10; if(diff===0) return '';
    const icon=diff>0?'▲':'▼';
    const color=(diff>0&&!inv)||(diff<0&&inv)?'#22c55e':'#ef4444';
    return `<span style="color:${color};font-size:13px;font-weight:600">${icon} ${Math.abs(diff)}p</span>`;
  }

  const cpdChg=chg(cur.cpd,prev.cpd), cpcChg=chg(cur.cpc,prev.cpc), dbChg=chg(cur.db,prev.db);

  const summaryParts=[];
  if(cpdChg!==null) summaryParts.push(`DB단가 <span class="${cpdChg<0?'delta-good':'delta-bad'}">${Math.abs(cpdChg)}% ${cpdChg<0?'하락':'상승'}</span>`);
  if(cpcChg!==null) summaryParts.push(`CPC <span class="${cpcChg<0?'delta-good':'delta-bad'}">${Math.abs(cpcChg)}% ${cpcChg<0?'하락':'상승'}</span>`);
  if(dbChg!==null)  summaryParts.push(`DB수 <span class="${dbChg>0?'delta-good':'delta-bad'}">${Math.abs(dbChg)}% ${dbChg>0?'증가':'감소'}</span>`);
  document.getElementById('kw-insight-summary-text').innerHTML = summaryParts.length?summaryParts.join(', ')+'했습니다.':'전일 대비 큰 변화가 없습니다.';

  const badgeStyle='padding:6px 14px;border-radius:20px;background:rgba(255,255,255,0.12);color:#fff;font-size:12px;font-weight:500';
  const badges=[];
  if(prev.cpd>0) badges.push(`DB단가 ${prev.cpd.toLocaleString()}원 → ${cur.cpd.toLocaleString()}원`);
  if(prev.cpc>0) badges.push(`CPC ${prev.cpc.toLocaleString()}원 → ${cur.cpc.toLocaleString()}원`);
  if(prev.dbcvr>0) badges.push(`DB전환율 ${prev.dbcvr.toFixed(1)}% → ${cur.dbcvr.toFixed(1)}%`);
  document.getElementById('kw-insight-badges').innerHTML = badges.map(t=>`<span style="${badgeStyle}">${t}</span>`).join('');

  const metrics=[
    {key:'cost',   label:'광고비',   value:Math.round(cur.cost/10000), unit:'만원', color:'default', chgEl:fmtChg(chg(cur.cost,prev.cost),false)},
    {key:'db',     label:'DB수',     value:cur.db, unit:'건', color:'accent', chgEl:fmtChg(dbChg,false)},
    {key:'cpd',    label:'DB단가',   value:cur.cpd, unit:'원', color:'purple', chgEl:fmtChg(cpdChg,true)},
    {key:'ctr',    label:'CTR',      value:cur.ctr, unit:'%', decimals:2, color:'red', chgEl:fmtPtChg(cur.ctr,prev.ctr||0,false)},
    {key:'cpc',    label:'CPC',      value:cur.cpc, unit:'원', color:'amber', chgEl:fmtChg(cpcChg,true)},
    {key:'dbcvr',  label:'DB전환율', value:cur.dbcvr, unit:'%', decimals:1, color:'red', chgEl:fmtPtChg(cur.dbcvr,prev.dbcvr||0,false)},
    {key:'count',  label:'키워드 수', value:data.length, unit:'개', color:'accent', chgEl:''},
  ];
  const cid='kw-insight-cards';
  cards.innerHTML = metrics.map((m,i)=>_kpiCard(cid,i,m.label,m.value,{
    unit:m.unit, decimals:m.decimals||0, color:m.color,
    sub:m.chgEl||'<span style="color:var(--faint)">-</span>',
  })).join('');
  _kpiFinish(cid);

  // 상세 분석
  renderKwInsightDetail(range, dates, dm);

  // 7일 추이
  if(range==='7days'){
    const thead=document.getElementById('kw-insight-trend-thead');
    const tbody=document.getElementById('kw-insight-trend-tbody');
    thead.innerHTML=`<tr><th>날짜</th>${['광고비','클릭','DB수','DB단가','CPC','CTR','DB전환율'].map(h=>`<th class="ta-right">${h}</th>`).join('')}</tr>`;
    tbody.innerHTML=last7.map((k,i)=>{
      const d=sumDates([k]);
      const p=i>0?sumDates([last7[i-1]]):null;
      function td(val,pv,inv=false,sfx=''){
        const cv=p&&pv>0?Math.round((val-pv)/pv*100):null;
        const color=cv===null?'':((cv>0&&!inv)||(cv<0&&inv)?'#22c55e':'#ef4444');
        const arrow=cv===null?'':(cv>0?'▲':'▼');
        return `<td class="ta-right">${val>0?val.toLocaleString()+sfx:'-'}${cv!==null?`<br><span style="font-size:10px;color:${color}">${arrow}${Math.abs(cv)}%</span>`:''}</td>`;
      }
      const pD=p||{};
      return `<tr style="border-bottom:1px solid var(--border)">
        <td class="cell-muted">${k.replace(/\./g,'').slice(0,8)}</td>
        ${td(Math.round(d.cost/10000),Math.round((pD.cost||0)/10000),false,'만')}
        ${td(d.clicks,pD.clicks||0,false,'')}
        ${td(d.db,pD.db||0,false,'건')}
        ${td(d.cpd,pD.cpd||0,true,'원')}
        ${td(d.cpc,pD.cpc||0,true,'원')}
        <td class="ta-right">${d.ctr.toFixed(2)}%</td>
        <td class="ta-right">${d.dbcvr.toFixed(1)}%</td>
      </tr>`;
    }).join('');
  }
}

function renderKwInsightDetail(range, dates, dm){
  const section=document.getElementById('kw-insight-detail-section');
  const data=( kwData||[] ).filter(r=>r.sub_media==='네이버');
  if(!data.length||!dates.length){section.style.display='none';return;}

  const today=dates[dates.length-1];
  const yesterday=dates.length>=2?dates[dates.length-2]:null;
  const last7=dates.slice(-7), prev7=dates.slice(-14,-7);

  let curDates,prevDates,rangeLabel;
  if(range==='yesterday'){
    curDates=[today];prevDates=yesterday?[yesterday]:[];rangeLabel='오늘 vs 어제';
  } else {
    curDates=last7;prevDates=prev7;rangeLabel=range==='week'?'이번 7일 vs 이전 7일':'최근 7일 vs 이전 7일';
  }
  // prevDates가 비어도(월초라 비교할 전날 데이터가 아직 없는 경우 등) 섹션을 숨기지 않는다 —
  // 아래 각 테이블은 비교 대상이 없으면 "비교 데이터 부족"을 자체적으로 표시한다
  section.style.display='block';
  document.getElementById('kw-insight-catmedia-label').textContent=rangeLabel+' · DB단가 변화율 절대값 순';

  // 키워드 단위 집계
  function aggKw(r, ds){
    let cost=0,clicks=0,db=0;
    const days=Object.keys(r.daily||{});
    const totalDb=days.reduce((s,k)=>s+(r.daily[k].db||0),0);
    days.forEach(k=>{
      if(!ds.includes(k)) return;
      const v=r.daily[k];
      const hasDailyCost = v.cost!=null && v.cost>0;
      const dbShare=totalDb>0?(v.db||0)/totalDb:0;
      db     += v.db||0;
      cost   += hasDailyCost ? v.cost         : (r.cost||0)  *dbShare;
      clicks += hasDailyCost ? (v.clicks||0)  : (r.clicks||0)*dbShare;
    });
    const cpd=db>0?Math.round(cost/db):0;
    const cpc=clicks>0?Math.round(cost/clicks):0;
    const dbcvr=clicks>0?db/clicks*100:0;
    return {cost,clicks,db,cpd,cpc,dbcvr};
  }

  // 키워드+기기 기준 집계 (daily의 cost/clicks/impressions 직접 사용)
  const cmMap={};
  data.forEach(r=>{
    const catKey=`${r.keyword||'기타'} · ${r.device||''}`;
    if(!cmMap[catKey]) cmMap[catKey]={curCost:0,curClicks:0,curImp:0,curDb:0,prevCost:0,prevClicks:0,prevImp:0,prevDb:0};
    const m=cmMap[catKey];
    const days=Object.keys(r.daily||{});
    const totalDb=days.reduce((s,k)=>s+(r.daily[k].db||0),0);
    days.forEach(k=>{
      const v=r.daily[k]||{};
      // daily에 cost 있으면 직접, 없으면 db비중 배분
      const hasDailyCost = v.cost!=null && v.cost>0;
      const dbShare = totalDb>0?(v.db||0)/totalDb:0;
      const costVal   = hasDailyCost ? v.cost   : (r.cost||0)*dbShare;
      const clicksVal = hasDailyCost ? (v.clicks||0) : (r.clicks||0)*dbShare;
      const impVal    = hasDailyCost ? (v.impressions||0) : (r.impressions||0)*dbShare;
      if(curDates.includes(k)){m.curCost+=costVal;m.curClicks+=clicksVal;m.curImp+=impVal;m.curDb+=v.db||0;}
      if(prevDates.includes(k)){m.prevCost+=costVal;m.prevClicks+=clicksVal;m.prevImp+=impVal;m.prevDb+=v.db||0;}
    });
  });

  const cmRows=Object.entries(cmMap).map(([key,m])=>{
    const curCpd=m.curDb>0?Math.round(m.curCost/m.curDb):0;
    const prevCpd=m.prevDb>0?Math.round(m.prevCost/m.prevDb):0;
    if(!curCpd||!prevCpd) return null;
    const curCpc=m.curClicks>0?Math.round(m.curCost/m.curClicks):0;
    const prevCpc=m.prevClicks>0?Math.round(m.prevCost/m.prevClicks):0;
    const curCvr=m.curClicks>0?m.curDb/m.curClicks*100:0;
    const prevCvr=m.prevClicks>0?m.prevDb/m.prevClicks*100:0;
    const cpdPct=Math.round((curCpd-prevCpd)/prevCpd*100);
    const cpcPct=prevCpc>0?Math.round((curCpc-prevCpc)/prevCpc*100):null;
    const cvrDiff=Math.round((curCvr-prevCvr)*10)/10;
    return {key,curCpd,prevCpd,cpdPct,curCpc,prevCpc,cpcPct,curCvr,prevCvr,cvrDiff,curDb:m.curDb,prevDb:m.prevDb,dbDiff:m.curDb-m.prevDb};
  }).filter(Boolean);
  cmRows.sort((a,b)=>Math.abs(b.cpdPct)-Math.abs(a.cpdPct));

  function pctColor(v,inv=false){return v===null?'var(--muted)':((v<0&&inv)||(v>0&&!inv))?'#16a34a':'#dc2626';}
  function pctIcon(v){return v>0?'▲':'▼';}
  function judgeRow(r){
    if(r.cpdPct<-5&&r.dbDiff>0) return{label:'효율 개선',bg:'#f0fdf4',color:'#16a34a'};
    if(r.cpdPct>5&&r.dbDiff<0)  return{label:'효율 악화',bg:'#fef2f2',color:'#dc2626'};
    if(r.cpdPct<-5) return{label:'단가 개선',bg:'#f0fdf4',color:'#16a34a'};
    if(r.cpdPct>5)  return{label:'단가 악화',bg:'#fef2f2',color:'#dc2626'};
    return{label:'변화 미미',bg:'#fefce8',color:'#92400e'};
  }

  const tbody1=document.getElementById('kw-insight-catmedia-tbody');
  const deviceFilter = window.kwInsightDevice || 'all';
  const filteredCmRows = deviceFilter==='all' ? cmRows : cmRows.filter(r=>r.key.endsWith('· '+deviceFilter));
  tbody1.innerHTML=filteredCmRows.length?filteredCmRows.map(r=>{
    const j=judgeRow(r);
    const cpdC=pctColor(r.cpdPct,true),cpcC=pctColor(r.cpcPct,true),cvrC=pctColor(r.cvrDiff,false),dbC=r.dbDiff>=0?'#16a34a':'#dc2626';
    const [kwName, devicePart] = r.key.split(' · ');
    return `<tr style="border-bottom:1px solid var(--border)">
      <td class="cell-strong">${kwName}</td>
      <td class="cell-muted-sm">${devicePart||''}</td>
      <td class="ta-right"><span style="color:var(--muted);font-size:11px">${r.prevCpd.toLocaleString()} → </span><strong>${r.curCpd.toLocaleString()}원</strong> <span style="color:${cpdC};font-weight:600;font-size:11px">${pctIcon(r.cpdPct)}${Math.abs(r.cpdPct)}%</span></td>
      <td class="ta-right"><span style="color:var(--muted);font-size:11px">${r.prevCpc.toLocaleString()} → </span><strong>${r.curCpc.toLocaleString()}원</strong>${r.cpcPct!==null?` <span style="color:${cpcC};font-weight:600;font-size:11px">${pctIcon(r.cpcPct)}${Math.abs(r.cpcPct)}%</span>`:''}</td>
      <td class="ta-right"><span style="color:var(--muted);font-size:11px">${r.prevCvr.toFixed(1)}% → </span><strong>${r.curCvr.toFixed(1)}%</strong> <span style="color:${cvrC};font-weight:600;font-size:11px">${r.cvrDiff>0?'▲':'▼'}${Math.abs(r.cvrDiff)}p</span></td>
      <td class="ta-right"><span style="color:var(--muted);font-size:11px">${r.prevDb}건 → </span><strong>${r.curDb}건</strong> <span style="color:${dbC};font-weight:600;font-size:11px">${r.dbDiff>=0?'+':''}${r.dbDiff}건</span></td>
      <td class="ta-center"><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${j.bg};color:${j.color}">${j.label}</span></td>
    </tr>`;
  }).join(''):`<tr><td colspan="7" class="cell-empty-center">비교 데이터 부족</td></tr>`;

  // 키워드 단위 개선·악화 TOP5
  const kwRows=data.map(r=>{
    const c=aggKw(r,curDates),p=aggKw(r,prevDates);
    if(!c.cpd||!p.cpd) return null;
    const cpdPct=Math.round((c.cpd-p.cpd)/p.cpd*100);
    const cpcPct=p.cpc>0?Math.round((c.cpc-p.cpc)/p.cpc*100):null;
    const cvrDiff=Math.round((c.dbcvr-p.dbcvr)*10)/10;
    return {kw:r.keyword||'-',device:r.device||'-',curCpd:c.cpd,prevCpd:p.cpd,cpdPct,curCpc:c.cpc,cpcPct,curCvr:c.dbcvr,cvrDiff,curDb:c.db};
  }).filter(Boolean);

  function kwHtml(r,isGood){
    const cc=isGood?'#16a34a':'#dc2626';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td class="cell-truncate" title="${r.kw}">${r.kw}</td>
      <td class="cell-muted-sm">${r.device}</td>
      <td class="ta-right"><strong style="color:${cc}">${r.curCpd.toLocaleString()}원</strong><span style="display:block;font-size:10px;color:${cc};font-weight:600">${pctIcon(r.cpdPct)}${Math.abs(r.cpdPct)}%</span></td>
      <td class="ta-right">${r.curCpc.toLocaleString()}원${r.cpcPct!==null?`<span style="display:block;font-size:10px;color:${pctColor(r.cpcPct,true)};font-weight:600">${pctIcon(r.cpcPct)}${Math.abs(r.cpcPct)}%</span>`:''}</td>
      <td class="ta-right">${r.curCvr.toFixed(1)}%<span style="display:block;font-size:10px;color:${pctColor(r.cvrDiff,false)};font-weight:600">${r.cvrDiff>0?'▲':'▼'}${Math.abs(r.cvrDiff)}p</span></td>
      <td class="ta-right">${r.curDb}건</td>
    </tr>`;
  }
  const empty=`<tr><td colspan="6" class="cell-empty-center">비교 데이터 부족</td></tr>`;
  const goodRows=[...kwRows].sort((a,b)=>a.cpdPct-b.cpdPct).slice(0,5);
  const badRows =[...kwRows].sort((a,b)=>b.cpdPct-a.cpdPct).slice(0,5);
  document.getElementById('kw-insight-good-tbody').innerHTML=goodRows.length?goodRows.map(r=>kwHtml(r,true)).join(''):empty;
  document.getElementById('kw-insight-bad-tbody').innerHTML =badRows.length ?badRows.map(r=>kwHtml(r,false)).join(''):empty;
}

// ===== 성과 분석 =====
function renderInsight(){
  if(!resultData.length){
    document.getElementById('insight-no-data').style.display='block';
    document.getElementById('insight-banner').style.display='none';
    document.getElementById('insight-cards').style.display='none';
    document.getElementById('insight-detail-section').style.display='none';
    return;
  }
  document.getElementById('insight-no-data').style.display='none';
  document.getElementById('insight-banner').style.display='block';
  document.getElementById('insight-cards').style.display='grid';

  const range = document.getElementById('insight-range').value;
  document.getElementById('insight-trend').style.display = range==='7days' ? 'block' : 'none';

  // 전체 일별 집계 (광고비+DB+클릭+노출+순위)
  const dayMap = {}; // date_key → {cost, clicks, imp, db, contracts, perf, rank_sum, rank_imp}
  resultData.forEach(r=>{
    (r.daily_raw||[]).forEach(d=>{
      const k = d.date;
      if(!dayMap[k]) dayMap[k]={cost:0,clicks:0,imp:0,db:0,contracts:0,perf:0,rank_sum:0,rank_imp:0};
      dayMap[k].cost  += d.cost||0;
      dayMap[k].clicks+= d.clicks||0;
      dayMap[k].imp   += d.impressions||0;
      dayMap[k].rank_sum += (d.rank||0)*(d.impressions||0);
      dayMap[k].rank_imp += d.impressions||0;
    });
    Object.entries(r.daily_sales_map||{}).forEach(([k,v])=>{
      if(!dayMap[k]) dayMap[k]={cost:0,clicks:0,imp:0,db:0,contracts:0,perf:0,rank_sum:0,rank_imp:0};
      dayMap[k].db        += v.db||0;
      dayMap[k].contracts += v.contracts||0;
      dayMap[k].perf      += v.performance||0;
    });
  });

  const dates = Object.keys(dayMap).sort();
  if(!dates.length){ return; }

  // 집계 함수
  function sumDates(dateList){
    const s={cost:0,clicks:0,imp:0,db:0,contracts:0,perf:0,rank_sum:0,rank_imp:0};
    dateList.forEach(k=>{ const d=dayMap[k]||{}; Object.keys(s).forEach(f=>{ s[f]+=(d[f]||0); }); });
    s.cpc    = s.clicks>0 ? Math.round(s.cost/s.clicks) : 0;
    s.cpd    = s.db>0     ? Math.round(s.cost/s.db)     : 0;
    s.ctr    = s.imp>0    ? s.clicks/s.imp*100           : 0;
    s.dbcvr  = s.clicks>0 ? s.db/s.clicks*100           : 0;
    s.rank   = s.rank_imp>0 ? s.rank_sum/s.rank_imp     : 0;
    s.roas   = s.perf>0   ? Math.round(s.cost/s.perf*100): 0;
    return s;
  }

  // 날짜 구간 계산
  const today   = dates[dates.length-1];
  const yesterday = dates.length>=2 ? dates[dates.length-2] : null;
  const last7   = dates.slice(-7);
  const prev7   = dates.slice(-14, -7);

  let cur, prev, curLabel, prevLabel;
  if(range==='yesterday'){
    cur=sumDates([today]); prev=yesterday?sumDates([yesterday]):{};
    curLabel='오늘'; prevLabel='어제';
  } else if(range==='week'){
    cur=sumDates(last7); prev=sumDates(prev7);
    curLabel='이번 7일'; prevLabel='이전 7일';
  } else {
    cur=sumDates(last7); prev=sumDates(prev7);
    curLabel='최근 7일'; prevLabel='이전 7일';
  }

  // 변화율 계산
  function chg(c,p){ return p>0?Math.round((c-p)/p*100):null; }
  function fmtChg(v, inverse=false){
    if(v===null) return '';
    const good = inverse ? v<0 : v>0;
    const icon = v>0?'▲':'▼';
    const color = (v>0&&!inverse)||(v<0&&inverse) ? '#22c55e' : '#ef4444';
    return `<span style="color:${color};font-size:13px;font-weight:600">${icon} ${Math.abs(v)}%</span>`;
  }
  function fmtPtChg(c,p,inverse=false){
    const diff = Math.round((c-p)*10)/10;
    if(diff===0) return '';
    const good = inverse ? diff<0 : diff>0;
    const icon = diff>0?'▲':'▼';
    const color = (diff>0&&!inverse)||(diff<0&&inverse) ? '#22c55e' : '#ef4444';
    return `<span style="color:${color};font-size:13px;font-weight:600">${icon} ${Math.abs(diff)}p</span>`;
  }

  const costChg   = chg(cur.cost,   prev.cost);
  const dbChg     = chg(cur.db,     prev.db);
  const cpdChg    = chg(cur.cpd,    prev.cpd);
  const ctrChg    = prev.ctr>0?Math.round((cur.ctr-prev.ctr)*10)/10:null;
  const cpcChg    = chg(cur.cpc,    prev.cpc);
  const dbcvrChg  = prev.dbcvr>0?Math.round((cur.dbcvr-prev.dbcvr)*10)/10:null;
  const rankChg   = prev.rank>0?Math.round((cur.rank-prev.rank)*10)/10:null;

  // ── 한줄 요약 ──────────────────────────────────────────────
  const summaryParts = [];
  if(cpdChg!==null) summaryParts.push(`DB단가 <span class="${cpdChg<0?'delta-good':'delta-bad'}">${Math.abs(cpdChg)}% ${cpdChg<0?'하락':'상승'}</span>`);
  if(cpcChg!==null) summaryParts.push(`CPC <span class="${cpcChg<0?'delta-good':'delta-bad'}">${Math.abs(cpcChg)}% ${cpcChg<0?'하락':'상승'}</span>`);
  if(rankChg!==null&&Math.abs(rankChg)>=0.1) summaryParts.push(`평균순위 <span class="${rankChg<0?'delta-good':'delta-bad'}">${Math.abs(rankChg)}단계 ${rankChg<0?'상승':'하락'}</span>`);
  if(dbChg!==null) summaryParts.push(`DB수 <span class="${dbChg>0?'delta-good':'delta-bad'}">${Math.abs(dbChg)}% ${dbChg>0?'증가':'감소'}</span>`);

  document.getElementById('insight-summary-text').innerHTML =
    summaryParts.length ? summaryParts.join(', ')+'했습니다.' : '전일 대비 큰 변화가 없습니다.';

  // ── 뱃지 ──────────────────────────────────────────────────
  const badgeStyle = 'padding:6px 14px;border-radius:20px;background:rgba(255,255,255,0.12);color:#fff;font-size:12px;font-weight:500';
  const badges = [];
  if(prev.cpd>0) badges.push(`DB단가 ${prev.cpd.toLocaleString()}원 → ${cur.cpd.toLocaleString()}원`);
  if(prev.cpc>0) badges.push(`CPC ${prev.cpc.toLocaleString()}원 → ${cur.cpc.toLocaleString()}원`);
  if(prev.rank>0) badges.push(`평균순위 ${prev.rank.toFixed(1)}위 → ${cur.rank.toFixed(1)}위`);
  if(prev.dbcvr>0) badges.push(`DB전환율 ${prev.dbcvr.toFixed(1)}% → ${cur.dbcvr.toFixed(1)}%`);
  // ── 뱃지 (클릭 가능) ──────────────────────────────────────
  const badgeData = [];
  if(prev.cpd>0)   badgeData.push({key:'cpd',  text:`DB단가 ${prev.cpd.toLocaleString()}원 → ${cur.cpd.toLocaleString()}원`});
  if(prev.cpc>0)   badgeData.push({key:'cpc',  text:`CPC ${prev.cpc.toLocaleString()}원 → ${cur.cpc.toLocaleString()}원`});
  if(prev.rank>0)  badgeData.push({key:'rank', text:`평균순위 ${prev.rank.toFixed(1)}위 → ${cur.rank.toFixed(1)}위`});
  if(prev.dbcvr>0) badgeData.push({key:'dbcvr',text:`DB전환율 ${prev.dbcvr.toFixed(1)}% → ${cur.dbcvr.toFixed(1)}%`});
  const badgeStyle2 = 'padding:6px 14px;border-radius:20px;background:rgba(255,255,255,0.12);color:#fff;font-size:12px;font-weight:500;cursor:pointer';
  document.getElementById('insight-badges').innerHTML = badgeData.map(b=>
    `<span onclick="showInsightDetail('${b.key}')" style="${badgeStyle2}">${b.text}</span>`
  ).join('');

  // ── 지표 카드 ─────────────────────────────────────────────
  const metrics = [
    { key:'cost',  label:'광고비',   value:Math.round(cur.cost/10000), unit:'만원', color:'default', chgEl: fmtChg(costChg, false) },
    { key:'db',    label:'DB수',     value:cur.db, unit:'건', color:'accent', chgEl: fmtChg(dbChg, false)   },
    { key:'cpd',   label:'DB단가',   value:cur.cpd, unit:'원', color:'purple', chgEl: fmtChg(cpdChg, true)   },
    { key:'ctr',   label:'CTR',      value:cur.ctr, unit:'%', decimals:2, color:'red', chgEl: fmtPtChg(cur.ctr,prev.ctr||0,false) },
    { key:'cpc',   label:'CPC',      value:cur.cpc, unit:'원', color:'amber', chgEl: fmtChg(cpcChg, true)   },
    { key:'dbcvr', label:'DB전환율', value:cur.dbcvr, unit:'%', decimals:1, color:'red', chgEl: fmtPtChg(cur.dbcvr,prev.dbcvr||0,false) },
    { key:'rank',  label:'평균순위', value:cur.rank>0?cur.rank:null, unit:'위', decimals:1, color:'accent',
      chgEl: cur.rank>0&&prev.rank>0?`<span style="color:${rankChg<0?'#22c55e':'#ef4444'};font-size:13px;font-weight:600">${rankChg<0?'▲':'▼'} ${Math.abs(rankChg)}</span>`:'' },
  ];

  {
    const cid='insight-cards';
    document.getElementById(cid).innerHTML = metrics.map((m,i)=>_kpiCard(cid,i,m.label,m.value,{
      unit:m.unit, decimals:m.decimals||0, color:m.color,
      sub:m.chgEl||'<span style="color:var(--faint)">-</span>',
      onclick:`showInsightDetail('${m.key}')`,
    })).join('');
    _kpiFinish(cid);
  }

  // ── 상세 분석 (보종·기기별 / 개선·악화 그룹) ──────────────
  renderInsightDetail(range, dates);

  // ── 7일 추이 테이블 ───────────────────────────────────────
  if(range==='7days'){
    const thead = document.getElementById('insight-trend-thead');
    const tbody = document.getElementById('insight-trend-tbody');
    thead.innerHTML = `<tr><th>날짜</th>${['광고비','클릭','DB수','DB단가','CPC','CTR','DB전환율','평균순위'].map(h=>`<th class="ta-right">${h}</th>`).join('')}</tr>`;
    tbody.innerHTML = last7.map((k,i)=>{
      const d = sumDates([k]);
      const p = i>0 ? sumDates([last7[i-1]]) : null;
      function td(val, prev_val, inverse=false, suffix=''){
        const chgV = p&&prev_val>0 ? Math.round((val-prev_val)/prev_val*100) : null;
        const color = chgV===null?'':( (chgV>0&&!inverse)||(chgV<0&&inverse) ? '#22c55e':'#ef4444');
        const arrow = chgV===null?'':(chgV>0?'▲':'▼');
        return `<td class="ta-right">${val>0?val.toLocaleString()+suffix:'-'}${chgV!==null?`<br><span style="font-size:10px;color:${color}">${arrow}${Math.abs(chgV)}%</span>`:''}</td>`;
      }
      const prevD = p||{};
      return `<tr style="border-bottom:1px solid var(--border)">
        <td class="cell-muted">${k.replace(/\./g,'').slice(0,8)}</td>
        ${td(Math.round(d.cost/10000), Math.round((prevD.cost||0)/10000), false, '만')}
        ${td(d.clicks, prevD.clicks||0, false, '')}
        ${td(d.db, prevD.db||0, false, '건')}
        ${td(d.cpd, prevD.cpd||0, true, '원')}
        ${td(d.cpc, prevD.cpc||0, true, '원')}
        <td class="ta-right">${d.ctr.toFixed(2)}%</td>
        <td class="ta-right">${d.dbcvr.toFixed(1)}%</td>
        <td class="ta-right">${d.rank>0?d.rank.toFixed(1)+'위':'-'}</td>
      </tr>`;
    }).join('');
  }
}

// 광고그룹 r의 daily_raw/daily_sales_map을 주어진 날짜 목록(ds) 기준으로 집계
function _aggGroupDates(r, ds){
  let cost=0,clicks=0,db=0;
  (r.daily_raw||[]).forEach(d=>{ if(ds.includes(d.date)){cost+=d.cost||0;clicks+=d.clicks||0;} });
  Object.entries(r.daily_sales_map||{}).forEach(([dt,v])=>{ if(ds.includes(dt)) db+=v.db||0; });
  const cpd=db>0?Math.round(cost/db):0;
  const cpc=clicks>0?Math.round(cost/clicks):0;
  const dbcvr=clicks>0?db/clicks*100:0;
  return {cost,clicks,db,cpd,cpc,dbcvr};
}

// ===== 성과 분석 상세 (보종·기기별 / 개선·악화 그룹) =====
function renderInsightDetail(range, dates){
  const section = document.getElementById('insight-detail-section');
  if(!resultData.length || !dates.length){ section.style.display='none'; return; }

  const today     = dates[dates.length-1];
  const yesterday = dates.length>=2 ? dates[dates.length-2] : null;
  const last7     = dates.slice(-7);
  const prev7     = dates.slice(-14,-7);

  let curDates, prevDates, rangeLabel;
  if(range==='yesterday'){
    curDates=[today]; prevDates=yesterday?[yesterday]:[]; rangeLabel='오늘 vs 어제';
  } else {
    curDates=last7; prevDates=prev7; rangeLabel=range==='week'?'이번 7일 vs 이전 7일':'최근 7일 vs 이전 7일';
  }
  // prevDates가 비어도(월초라 비교할 전날 데이터가 아직 없는 경우 등) 섹션을 숨기지 않는다 —
  // 아래 각 테이블은 비교 대상이 없으면 "비교 데이터 부족"을 자체적으로 표시한다
  section.style.display='block';
  document.getElementById('insight-catmedia-label').textContent = rangeLabel+' · DB단가 변화율 절대값 순';

  const aggGroup = _aggGroupDates;

  // ── 보종·기기 집계 ───────────────────────────────────────
  const cmMap={};
  resultData.forEach(r=>{
    const key=`${r.cat||'기타'}·${r.media||'기타'}`;
    if(!cmMap[key]) cmMap[key]={curCost:0,curClicks:0,curDb:0,prevCost:0,prevClicks:0,prevDb:0};
    const m=cmMap[key];
    (r.daily_raw||[]).forEach(d=>{
      if(curDates.includes(d.date)){m.curCost+=d.cost||0;m.curClicks+=d.clicks||0;}
      if(prevDates.includes(d.date)){m.prevCost+=d.cost||0;m.prevClicks+=d.clicks||0;}
    });
    Object.entries(r.daily_sales_map||{}).forEach(([dt,v])=>{
      if(curDates.includes(dt))  m.curDb+=v.db||0;
      if(prevDates.includes(dt)) m.prevDb+=v.db||0;
    });
  });

  // 팝업(원인 기여 그룹)에서 같은 기간 기준으로 재계산할 수 있도록 보관
  window.__insightCatMediaCtx = {curDates, prevDates};

  const cmRows=Object.entries(cmMap).map(([key,m])=>{
    const curCpd=m.curDb>0?Math.round(m.curCost/m.curDb):0;
    const prevCpd=m.prevDb>0?Math.round(m.prevCost/m.prevDb):0;
    if(!curCpd||!prevCpd) return null;
    const curCpc=m.curClicks>0?Math.round(m.curCost/m.curClicks):0;
    const prevCpc=m.prevClicks>0?Math.round(m.prevCost/m.prevClicks):0;
    const curCvr=m.curClicks>0?m.curDb/m.curClicks*100:0;
    const prevCvr=m.prevClicks>0?m.prevDb/m.prevClicks*100:0;
    const cpdPct=Math.round((curCpd-prevCpd)/prevCpd*100);
    const cpcPct=prevCpc>0?Math.round((curCpc-prevCpc)/prevCpc*100):null;
    const cvrDiff=Math.round((curCvr-prevCvr)*10)/10;
    const [cat,media]=key.split('·');
    return {key,cat,media,curCpd,prevCpd,cpdPct,curCpc,prevCpc,cpcPct,curCvr,prevCvr,cvrDiff,curDb:m.curDb,prevDb:m.prevDb,dbDiff:m.curDb-m.prevDb};
  }).filter(Boolean);
  cmRows.sort((a,b)=>Math.abs(b.cpdPct)-Math.abs(a.cpdPct));

  function pctColor(v,inv=false){ return v===null?'var(--muted)':((v<0&&inv)||(v>0&&!inv))?'#16a34a':'#dc2626'; }
  function pctIcon(v){ return v>0?'▲':'▼'; }
  function judgeRow(r){
    if(r.cpdPct<-5&&(r.cvrDiff>0.5||r.dbDiff>0)) return{label:'효율 개선',bg:'#f0fdf4',color:'#16a34a'};
    if(r.cpdPct>5&&(r.cvrDiff<-0.5||r.dbDiff<0))  return{label:'효율 악화',bg:'#fef2f2',color:'#dc2626'};
    if(r.cpdPct<-5) return{label:'단가 개선',bg:'#f0fdf4',color:'#16a34a'};
    if(r.cpdPct>5)  return{label:'단가 악화',bg:'#fef2f2',color:'#dc2626'};
    return{label:'변화 미미',bg:'#fefce8',color:'#92400e'};
  }

  const tbody1=document.getElementById('insight-catmedia-tbody');
  tbody1.innerHTML=cmRows.length ? cmRows.map((r,i)=>{
    const j=judgeRow(r);
    const cpdC=pctColor(r.cpdPct,true); const cpcC=pctColor(r.cpcPct,true); const cvrC=pctColor(r.cvrDiff,false); const dbC=r.dbDiff>=0?'#16a34a':'#dc2626';
    return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="showCatMediaDetail('${escHtml(r.cat)}','${escHtml(r.media)}')" title="클릭하면 원인 기여 그룹을 볼 수 있습니다">
      <td class="cell-strong">${r.key}</td>
      <td class="ta-right"><span style="color:var(--muted);font-size:11px">${r.prevCpd.toLocaleString()} → </span><strong>${r.curCpd.toLocaleString()}원</strong> <span style="color:${cpdC};font-weight:600;font-size:11px">${pctIcon(r.cpdPct)}${Math.abs(r.cpdPct)}%</span></td>
      <td class="ta-right"><span style="color:var(--muted);font-size:11px">${r.prevCpc.toLocaleString()} → </span><strong>${r.curCpc.toLocaleString()}원</strong>${r.cpcPct!==null?` <span style="color:${cpcC};font-weight:600;font-size:11px">${pctIcon(r.cpcPct)}${Math.abs(r.cpcPct)}%</span>`:''}</td>
      <td class="ta-right"><span style="color:var(--muted);font-size:11px">${r.prevCvr.toFixed(1)}% → </span><strong>${r.curCvr.toFixed(1)}%</strong> <span style="color:${cvrC};font-weight:600;font-size:11px">${r.cvrDiff>0?'▲':'▼'}${Math.abs(r.cvrDiff)}p</span></td>
      <td class="ta-right"><span style="color:var(--muted);font-size:11px">${r.prevDb}건 → </span><strong>${r.curDb}건</strong> <span style="color:${dbC};font-weight:600;font-size:11px">${r.dbDiff>=0?'+':''}${r.dbDiff}건</span></td>
      <td class="ta-center"><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${j.bg};color:${j.color}">${j.label}</span></td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" class="cell-empty-center">비교 데이터 부족</td></tr>`;

  // ── 광고그룹 개선·악화 TOP5 ─────────────────────────────
  const grpRows=resultData.map(r=>{
    const c=aggGroup(r,curDates), p=aggGroup(r,prevDates);
    if(!c.cpd||!p.cpd) return null;
    const cpdPct=Math.round((c.cpd-p.cpd)/p.cpd*100);
    const cpcPct=p.cpc>0?Math.round((c.cpc-p.cpc)/p.cpc*100):null;
    const cvrDiff=Math.round((c.dbcvr-p.dbcvr)*10)/10;
    return {group:r.group,cat:r.cat||'-',media:r.media||'-',curCpd:c.cpd,prevCpd:p.cpd,cpdPct,curCpc:c.cpc,cpcPct,curCvr:c.dbcvr,cvrDiff,curDb:c.db};
  }).filter(Boolean);

  function grpHtml(r,isGood){
    const cc=isGood?'#16a34a':'#dc2626';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td class="cell-truncate" title="${r.group}">${r.group}</td>
      <td class="cell-muted-sm">${r.cat}</td>
      <td class="cell-muted-sm">${r.media}</td>
      <td class="ta-right"><strong style="color:${cc}">${r.curCpd.toLocaleString()}원</strong><span style="display:block;font-size:10px;color:${cc};font-weight:600">${pctIcon(r.cpdPct)}${Math.abs(r.cpdPct)}%</span></td>
      <td class="ta-right">${r.curCpc.toLocaleString()}원${r.cpcPct!==null?`<span style="display:block;font-size:10px;color:${pctColor(r.cpcPct,true)};font-weight:600">${pctIcon(r.cpcPct)}${Math.abs(r.cpcPct)}%</span>`:''}</td>
      <td class="ta-right">${r.curCvr.toFixed(1)}%<span style="display:block;font-size:10px;color:${pctColor(r.cvrDiff,false)};font-weight:600">${r.cvrDiff>0?'▲':'▼'}${Math.abs(r.cvrDiff)}p</span></td>
      <td class="ta-right">${r.curDb}건</td>
    </tr>`;
  }
  const empty=`<tr><td colspan="7" class="cell-empty-center">비교 데이터 부족</td></tr>`;
  const goodRows=[...grpRows].sort((a,b)=>a.cpdPct-b.cpdPct).slice(0,5);
  const badRows =[...grpRows].sort((a,b)=>b.cpdPct-a.cpdPct).slice(0,5);
  document.getElementById('insight-good-tbody').innerHTML=goodRows.length?goodRows.map(r=>grpHtml(r,true)).join(''):empty;
  document.getElementById('insight-bad-tbody').innerHTML =badRows.length ?badRows.map(r=>grpHtml(r,false)).join(''):empty;
}

// "보종·기기별 변화 TOP" 행 클릭 → 그 보종×기기 안에서 광고비가 급증했거나 DB가 급감한 광고그룹 TOP5를 보여줘
// 어떤 그룹 때문에 전체 DB단가가 오르내렸는지 바로 판단할 수 있게 한다
function showCatMediaDetail(cat, media){
  const ctx = window.__insightCatMediaCtx;
  if(!ctx) return;
  const {curDates, prevDates} = ctx;
  const groups = resultData
    .filter(r => (r.cat||'기타')===cat && (r.media||'기타')===media)
    .map(r=>{
      const cur = _aggGroupDates(r, curDates);
      const prev = _aggGroupDates(r, prevDates);
      const cpdPct = (prev.cpd>0 && cur.cpd>0) ? Math.round((cur.cpd-prev.cpd)/prev.cpd*100) : null;
      return {
        group:r.group, cur, prev, cpdPct,
        costDiff: cur.cost-prev.cost,
        dbDiff: cur.db-prev.db
      };
    })
    .filter(g => g.cur.cost>0 || g.prev.cost>0 || g.cur.db>0 || g.prev.db>0);

  // 전체(=이 보종×기기 안 모든 그룹) 순변화량 대비, 각 그룹이 차지하는 비중을 기여도(%)로 표시
  const totalCostDiff = groups.reduce((s,g)=>s+g.costDiff, 0);
  const totalDbDiff   = groups.reduce((s,g)=>s+g.dbDiff, 0);

  const costUp = [...groups].filter(g=>g.costDiff>0).sort((a,b)=>b.costDiff-a.costDiff).slice(0,5)
    .map(g=>({...g, contribPct: totalCostDiff!==0 ? Math.round(g.costDiff/totalCostDiff*100) : null}));
  const dbDown = [...groups].filter(g=>g.dbDiff<0).sort((a,b)=>a.dbDiff-b.dbDiff).slice(0,5)
    .map(g=>({...g, contribPct: totalDbDiff!==0 ? Math.round(g.dbDiff/totalDbDiff*100) : null}));

  document.getElementById('catmedia-detail-title').textContent = `${cat} · ${media} — 원인 분석`;
  const body = document.getElementById('catmedia-detail-body');

  function listHtml(rows, kind){
    if(!rows.length) return `<div style="color:var(--faint);font-size:12px;padding:.5rem 0">해당 없음</div>`;
    return `<div style="display:flex;flex-direction:column;gap:2px">
      ${rows.map(g=>{
        const valTxt = kind==='cost'
          ? `광고비 ${g.prev.cost.toLocaleString()}원 → ${g.cur.cost.toLocaleString()}원 <strong style="color:#dc2626">(+${g.costDiff.toLocaleString()}원)</strong>`
          : `DB수 ${g.prev.db}건 → ${g.cur.db}건 <strong style="color:#dc2626">(${g.dbDiff}건)</strong>`;
        const cpdTxt = g.cpdPct!==null
          ? `이 그룹 DB단가 ${g.prev.cpd.toLocaleString()}원 → ${g.cur.cpd.toLocaleString()}원 (${g.cpdPct>0?'+':''}${g.cpdPct}%)`
          : `이 그룹 DB단가 ${g.cur.cpd?g.cur.cpd.toLocaleString()+'원':'-'} (비교 데이터 부족)`;
        return `<div style="padding:.6rem 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px">
            <div style="font-size:13px;font-weight:600;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(g.group)}">${escHtml(g.group)}</div>
            ${g.contribPct!==null?`<div style="font-size:12px;font-weight:700;color:#dc2626;white-space:nowrap">기여도 ${g.contribPct}%</div>`:''}
          </div>
          <div style="font-size:12px;color:var(--muted)">${valTxt}</div>
          <div style="font-size:11px;color:var(--faint);margin-top:1px">${cpdTxt}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  body.innerHTML = `
    <div style="margin-bottom:1.25rem">
      <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:.5rem">📈 광고비 급증 그룹 TOP5</div>
      ${listHtml(costUp, 'cost')}
    </div>
    <div>
      <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:.5rem">📉 DB 급감 그룹 TOP5</div>
      ${listHtml(dbDown, 'db')}
    </div>
  `;
  document.getElementById('catmedia-detail-modal-bg').style.display = 'flex';
}
