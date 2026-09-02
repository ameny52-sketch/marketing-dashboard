// ===== 키워드 성과 진단 =====
function renderKwInsight(){
  const noData  = document.getElementById('kw-insight-no-data');
  const banner  = document.getElementById('kw-insight-banner');
  const cards   = document.getElementById('kw-insight-cards');
  const detail  = document.getElementById('kw-insight-detail-section');

  // kwData: 키워드 탭 데이터 (window.kwData로 저장)
  const data = (window.kwData || []).filter(r=>r.sub_media==='네이버');
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
  if(cpdChg!==null) summaryParts.push(`DB단가 <span style="color:${cpdChg<0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(cpdChg)}% ${cpdChg<0?'하락':'상승'}</span>`);
  if(cpcChg!==null) summaryParts.push(`CPC <span style="color:${cpcChg<0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(cpcChg)}% ${cpcChg<0?'하락':'상승'}</span>`);
  if(dbChg!==null)  summaryParts.push(`DB수 <span style="color:${dbChg>0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(dbChg)}% ${dbChg>0?'증가':'감소'}</span>`);
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
    thead.innerHTML=`<tr style="background:#fafaf8"><th style="padding:7px 10px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;color:var(--muted);text-align:left">날짜</th>${['광고비','클릭','DB수','DB단가','CPC','CTR','DB전환율'].map(h=>`<th style="padding:7px 10px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;color:var(--muted);text-align:right">${h}</th>`).join('')}</tr>`;
    tbody.innerHTML=last7.map((k,i)=>{
      const d=sumDates([k]);
      const p=i>0?sumDates([last7[i-1]]):null;
      function td(val,pv,inv=false,sfx=''){
        const cv=p&&pv>0?Math.round((val-pv)/pv*100):null;
        const color=cv===null?'':((cv>0&&!inv)||(cv<0&&inv)?'#22c55e':'#ef4444');
        const arrow=cv===null?'':(cv>0?'▲':'▼');
        return `<td style="padding:7px 10px;text-align:right;font-size:12px">${val>0?val.toLocaleString()+sfx:'-'}${cv!==null?`<br><span style="font-size:10px;color:${color}">${arrow}${Math.abs(cv)}%</span>`:''}</td>`;
      }
      const pD=p||{};
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 10px;font-size:12px;color:var(--muted)">${k.replace(/\./g,'').slice(0,8)}</td>
        ${td(Math.round(d.cost/10000),Math.round((pD.cost||0)/10000),false,'만')}
        ${td(d.clicks,pD.clicks||0,false,'')}
        ${td(d.db,pD.db||0,false,'건')}
        ${td(d.cpd,pD.cpd||0,true,'원')}
        ${td(d.cpc,pD.cpc||0,true,'원')}
        <td style="padding:7px 10px;text-align:right;font-size:12px">${d.ctr.toFixed(2)}%</td>
        <td style="padding:7px 10px;text-align:right;font-size:12px">${d.dbcvr.toFixed(1)}%</td>
      </tr>`;
    }).join('');
  }
}

function renderKwInsightDetail(range, dates, dm){
  const section=document.getElementById('kw-insight-detail-section');
  const data=( window.kwData||[] ).filter(r=>r.sub_media==='네이버');
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
      <td style="padding:9px 14px;font-weight:600;font-size:13px">${kwName}</td>
      <td style="padding:9px 14px;font-size:11px;color:var(--muted)">${devicePart||''}</td>
      <td style="padding:9px 14px;text-align:right"><span style="color:var(--muted);font-size:11px">${r.prevCpd.toLocaleString()} → </span><strong>${r.curCpd.toLocaleString()}원</strong> <span style="color:${cpdC};font-weight:600;font-size:11px">${pctIcon(r.cpdPct)}${Math.abs(r.cpdPct)}%</span></td>
      <td style="padding:9px 14px;text-align:right"><span style="color:var(--muted);font-size:11px">${r.prevCpc.toLocaleString()} → </span><strong>${r.curCpc.toLocaleString()}원</strong>${r.cpcPct!==null?` <span style="color:${cpcC};font-weight:600;font-size:11px">${pctIcon(r.cpcPct)}${Math.abs(r.cpcPct)}%</span>`:''}</td>
      <td style="padding:9px 14px;text-align:right"><span style="color:var(--muted);font-size:11px">${r.prevCvr.toFixed(1)}% → </span><strong>${r.curCvr.toFixed(1)}%</strong> <span style="color:${cvrC};font-weight:600;font-size:11px">${r.cvrDiff>0?'▲':'▼'}${Math.abs(r.cvrDiff)}p</span></td>
      <td style="padding:9px 14px;text-align:right"><span style="color:var(--muted);font-size:11px">${r.prevDb}건 → </span><strong>${r.curDb}건</strong> <span style="color:${dbC};font-weight:600;font-size:11px">${r.dbDiff>=0?'+':''}${r.dbDiff}건</span></td>
      <td style="padding:9px 14px;text-align:center"><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${j.bg};color:${j.color}">${j.label}</span></td>
    </tr>`;
  }).join(''):`<tr><td colspan="7" style="padding:2rem;text-align:center;color:var(--faint);font-size:12px">비교 데이터 부족</td></tr>`;

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
      <td style="padding:8px 10px;font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;font-weight:500" title="${r.kw}">${r.kw}</td>
      <td style="padding:8px 10px;font-size:11px;color:var(--muted)">${r.device}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px"><strong style="color:${cc}">${r.curCpd.toLocaleString()}원</strong><span style="display:block;font-size:10px;color:${cc};font-weight:600">${pctIcon(r.cpdPct)}${Math.abs(r.cpdPct)}%</span></td>
      <td style="padding:8px 10px;text-align:right;font-size:12px">${r.curCpc.toLocaleString()}원${r.cpcPct!==null?`<span style="display:block;font-size:10px;color:${pctColor(r.cpcPct,true)};font-weight:600">${pctIcon(r.cpcPct)}${Math.abs(r.cpcPct)}%</span>`:''}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px">${r.curCvr.toFixed(1)}%<span style="display:block;font-size:10px;color:${pctColor(r.cvrDiff,false)};font-weight:600">${r.cvrDiff>0?'▲':'▼'}${Math.abs(r.cvrDiff)}p</span></td>
      <td style="padding:8px 10px;text-align:right;font-size:12px">${r.curDb}건</td>
    </tr>`;
  }
  const empty=`<tr><td colspan="6" style="padding:2rem;text-align:center;color:var(--faint);font-size:12px">비교 데이터 부족</td></tr>`;
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
  if(cpdChg!==null) summaryParts.push(`DB단가 <span style="color:${cpdChg<0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(cpdChg)}% ${cpdChg<0?'하락':'상승'}</span>`);
  if(cpcChg!==null) summaryParts.push(`CPC <span style="color:${cpcChg<0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(cpcChg)}% ${cpcChg<0?'하락':'상승'}</span>`);
  if(rankChg!==null&&Math.abs(rankChg)>=0.1) summaryParts.push(`평균순위 <span style="color:${rankChg<0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(rankChg)}단계 ${rankChg<0?'상승':'하락'}</span>`);
  if(dbChg!==null) summaryParts.push(`DB수 <span style="color:${dbChg>0?'#4ade80':'#f87171'};font-weight:700">${Math.abs(dbChg)}% ${dbChg>0?'증가':'감소'}</span>`);

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
    thead.innerHTML = `<tr style="background:#fafaf8"><th style="padding:7px 10px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;color:var(--muted);text-align:left">날짜</th>${['광고비','클릭','DB수','DB단가','CPC','CTR','DB전환율','평균순위'].map(h=>`<th style="padding:7px 10px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;color:var(--muted);text-align:right">${h}</th>`).join('')}</tr>`;
    tbody.innerHTML = last7.map((k,i)=>{
      const d = sumDates([k]);
      const p = i>0 ? sumDates([last7[i-1]]) : null;
      function td(val, prev_val, inverse=false, suffix=''){
        const chgV = p&&prev_val>0 ? Math.round((val-prev_val)/prev_val*100) : null;
        const color = chgV===null?'':( (chgV>0&&!inverse)||(chgV<0&&inverse) ? '#22c55e':'#ef4444');
        const arrow = chgV===null?'':(chgV>0?'▲':'▼');
        return `<td style="padding:7px 10px;text-align:right;font-size:12px">${val>0?val.toLocaleString()+suffix:'-'}${chgV!==null?`<br><span style="font-size:10px;color:${color}">${arrow}${Math.abs(chgV)}%</span>`:''}</td>`;
      }
      const prevD = p||{};
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 10px;font-size:12px;color:var(--muted)">${k.replace(/\./g,'').slice(0,8)}</td>
        ${td(Math.round(d.cost/10000), Math.round((prevD.cost||0)/10000), false, '만')}
        ${td(d.clicks, prevD.clicks||0, false, '')}
        ${td(d.db, prevD.db||0, false, '건')}
        ${td(d.cpd, prevD.cpd||0, true, '원')}
        ${td(d.cpc, prevD.cpc||0, true, '원')}
        <td style="padding:7px 10px;text-align:right;font-size:12px">${d.ctr.toFixed(2)}%</td>
        <td style="padding:7px 10px;text-align:right;font-size:12px">${d.dbcvr.toFixed(1)}%</td>
        <td style="padding:7px 10px;text-align:right;font-size:12px">${d.rank>0?d.rank.toFixed(1)+'위':'-'}</td>
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
      <td style="padding:9px 14px;font-weight:600;font-size:13px">${r.key}</td>
      <td style="padding:9px 14px;text-align:right"><span style="color:var(--muted);font-size:11px">${r.prevCpd.toLocaleString()} → </span><strong>${r.curCpd.toLocaleString()}원</strong> <span style="color:${cpdC};font-weight:600;font-size:11px">${pctIcon(r.cpdPct)}${Math.abs(r.cpdPct)}%</span></td>
      <td style="padding:9px 14px;text-align:right"><span style="color:var(--muted);font-size:11px">${r.prevCpc.toLocaleString()} → </span><strong>${r.curCpc.toLocaleString()}원</strong>${r.cpcPct!==null?` <span style="color:${cpcC};font-weight:600;font-size:11px">${pctIcon(r.cpcPct)}${Math.abs(r.cpcPct)}%</span>`:''}</td>
      <td style="padding:9px 14px;text-align:right"><span style="color:var(--muted);font-size:11px">${r.prevCvr.toFixed(1)}% → </span><strong>${r.curCvr.toFixed(1)}%</strong> <span style="color:${cvrC};font-weight:600;font-size:11px">${r.cvrDiff>0?'▲':'▼'}${Math.abs(r.cvrDiff)}p</span></td>
      <td style="padding:9px 14px;text-align:right"><span style="color:var(--muted);font-size:11px">${r.prevDb}건 → </span><strong>${r.curDb}건</strong> <span style="color:${dbC};font-weight:600;font-size:11px">${r.dbDiff>=0?'+':''}${r.dbDiff}건</span></td>
      <td style="padding:9px 14px;text-align:center"><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${j.bg};color:${j.color}">${j.label}</span></td>
    </tr>`;
  }).join('') : `<tr><td colspan="6" style="padding:2rem;text-align:center;color:var(--faint);font-size:12px">비교 데이터 부족</td></tr>`;

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
      <td style="padding:8px 10px;font-size:12px;max-width:130px;overflow:hidden;text-overflow:ellipsis;font-weight:500" title="${r.group}">${r.group}</td>
      <td style="padding:8px 10px;font-size:11px;color:var(--muted)">${r.cat}</td>
      <td style="padding:8px 10px;font-size:11px;color:var(--muted)">${r.media}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px"><strong style="color:${cc}">${r.curCpd.toLocaleString()}원</strong><span style="display:block;font-size:10px;color:${cc};font-weight:600">${pctIcon(r.cpdPct)}${Math.abs(r.cpdPct)}%</span></td>
      <td style="padding:8px 10px;text-align:right;font-size:12px">${r.curCpc.toLocaleString()}원${r.cpcPct!==null?`<span style="display:block;font-size:10px;color:${pctColor(r.cpcPct,true)};font-weight:600">${pctIcon(r.cpcPct)}${Math.abs(r.cpcPct)}%</span>`:''}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px">${r.curCvr.toFixed(1)}%<span style="display:block;font-size:10px;color:${pctColor(r.cvrDiff,false)};font-weight:600">${r.cvrDiff>0?'▲':'▼'}${Math.abs(r.cvrDiff)}p</span></td>
      <td style="padding:8px 10px;text-align:right;font-size:12px">${r.curDb}건</td>
    </tr>`;
  }
  const empty=`<tr><td colspan="7" style="padding:2rem;text-align:center;color:var(--faint);font-size:12px">비교 데이터 부족</td></tr>`;
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
            return `<th style="text-align:${c.num?'right':'left'};padding:8px 10px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border);cursor:pointer;white-space:nowrap" onclick="sortDailyGroupModal('${c.key}')">${c.label}${arrow}</th>`;
          }).join('')}
        </tr></thead>
        <tbody>
          ${sorted.map(g=>`<tr>
            ${DAILY_GROUP_MODAL_COLS.map(c=>{
              if(c.key==='group') return `<td style="padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(g.group)}">${escHtml(g.group)}</td>`;
              if(c.special==='roas') return `<td style="text-align:right;padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border)">${roasBadge(g.roas)}</td>`;
              return `<td style="text-align:right;padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border)">${c.fmt(g[c.key])}</td>`;
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
            return `<th style="text-align:${c.num?'right':'left'};padding:8px 10px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border);cursor:pointer;white-space:nowrap" onclick="sortDailyMediaModal('${c.key}')">${c.label}${arrow}</th>`;
          }).join('')}
        </tr></thead>
        <tbody>
          ${sorted.map(g=>`<tr>
            ${DAILY_MEDIA_MODAL_COLS.map(c=>{
              if(c.key==='media') return `<td style="padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border)">${escHtml(g.media)}</td>`;
              return `<td style="text-align:right;padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border)">${c.fmt(g[c.key])}</td>`;
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
    const color = good===null?'var(--faint)':good?'#22c55e':'#ef4444';
    const arrow = chg===null?'':(chg>0?'▲':'▼');
    const dateStr = k.replace(/\./g,'').slice(2,8); // YYMMDD
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px;font-size:13px;color:var(--muted)">${dateStr}</td>
      <td style="padding:8px 12px;text-align:right;font-size:15px;font-weight:600">${val>0?val.toLocaleString()+suffix(key):'-'}</td>
      <td style="padding:8px 12px;text-align:right;font-size:12px;color:${color}">${chg!==null?arrow+' '+Math.abs(chg)+'%':''}</td>
    </tr>`;
  }).join('');

  // 모달 표시
  const modal = document.getElementById('insight-detail-modal');
  document.getElementById('insight-detail-title').textContent = label + ' 최근 7일';
  document.getElementById('insight-detail-body').innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#fafaf8">
        <th style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--muted);text-align:left;border-bottom:1px solid var(--border)">날짜</th>
        <th style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--muted);text-align:right;border-bottom:1px solid var(--border)">${label}</th>
        <th style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--muted);text-align:right;border-bottom:1px solid var(--border)">전일대비</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  modal.style.display='flex';
}

// ===== 주요그룹 필터 토글 =====
const _keyFilterState = {alert: false, cpc: false, data: false};

function toggleKeyFilter(tab){
  _keyFilterState[tab] = !_keyFilterState[tab];
  const btn = document.getElementById(`${tab}-key-btn`);
  if(btn){
    btn.style.background   = _keyFilterState[tab] ? '#FFF3CD' : 'var(--surface)';
    btn.style.borderColor  = _keyFilterState[tab] ? '#F59E0B' : 'var(--border)';
    btn.style.color        = _keyFilterState[tab] ? '#92400E' : 'var(--muted)';
    btn.style.fontWeight   = _keyFilterState[tab] ? '700'     : 'normal';
  }
  if(tab==='alert') renderAlertBoard();
  if(tab==='cpc')   renderCpc();
  if(tab==='data')  applyFilter();
}


function renderAlertBoard(){
  if(!resultData.length) return;

  const cpdCalc = r => r.db>0 ? r.cpd : (r.cost>0 ? r.cost : null);

  // 매체별 분류
  const alertData = alertCatFilter==='all' ? resultData : resultData.filter(r=>r.cat===alertCatFilter);
  const alertFiltered = _keyFilterState['alert'] ? alertData.filter(r=>isKeyGroup(r.group, r.media)) : alertData;

  ['PC','모바일'].forEach(media=>{
    const sfx = media==='PC'?'pc':'mo';

    // ROAS: 1000% 미만 고효율 / 1000% 이상 저효율
    const roasPool = alertFiltered.filter(r=>r.roas!==null && r.cost>0 && r.media===media);
    const roasGood = [...roasPool].filter(r=>r.roas<1000).sort((a,b)=>a.roas-b.roas).slice(0,3);
    const roasBad  = [...roasPool].filter(r=>r.roas>=1000).sort((a,b)=>b.roas-a.roas).slice(0,3);
    document.getElementById(`cnt-roas-good-${sfx}`).textContent = roasPool.length+'개 중';
    document.getElementById(`cnt-roas-bad-${sfx}`).textContent  = roasPool.length+'개 중';

    const roasKpiFn = (cls) => r => [
      {label:'ROAS', val:r.roas+'%', cls},
    ];
    renderAlertList(`list-roas-good-${sfx}`, roasGood, 'green', roasKpiFn('green'));
    renderAlertList(`list-roas-bad-${sfx}`,  roasBad,  'red',   roasKpiFn('red'));

    // DB단가 고효율 (DB있는 그룹만)
    const cpdGoodPool = alertFiltered.filter(r=>r.db>0 && r.cpd!==null && r.cost>0 && r.media===media);
    const cpdGood = [...cpdGoodPool].sort((a,b)=>a.cpd-b.cpd).slice(0,3);
    const cpdGoodGroups = new Set(cpdGood.map(r=>r.group));
    document.getElementById(`cnt-cpd-good-${sfx}`).textContent = cpdGoodPool.length+'개 중';
    renderAlertList(`list-cpd-good-${sfx}`, cpdGood, 'green', r=>[
      {label:'DB단가', val:r.cpd.toLocaleString()+'원', cls:'green'},
    ]);

    // DB단가 저효율 (DB없으면 광고비=단가)
    const cpdBadPool = alertFiltered.filter(r=>r.cost>0 && cpdCalc(r)!==null && r.media===media && !cpdGoodGroups.has(r.group));
    const cpdBad = [...cpdBadPool].sort((a,b)=>cpdCalc(b)-cpdCalc(a)).slice(0,3);
    document.getElementById(`cnt-cpd-bad-${sfx}`).textContent = cpdBadPool.length+'개 중';
    renderAlertList(`list-cpd-bad-${sfx}`, cpdBad, 'red', r=>{
      const cpd = cpdCalc(r);
      return [
        {label:r.db===0?'DB단가 ⚠️ DB없음':'DB단가', val:cpd.toLocaleString()+'원', cls:'red'},
      ];
    });
  });
}

function renderAlertList(elId, data, colorCls, kpiFn){
  const el = document.getElementById(elId);
  if(!data.length){ el.innerHTML='<div class="alert-empty">데이터 없음</div>'; return; }
  el.innerHTML = data.map((r,i)=>{
    const kpis = kpiFn(r);
    return `
    <div class="alert-card" onclick="openDetailByGroup('${r.group.replace(/'/g,"\'")}')">
      <div class="alert-card-top">
        <div class="alert-rank ${colorCls}">${i+1}</div>
        <div>
          <div class="alert-card-name">${r.group}</div>
          <div class="alert-card-intype">${r.intype} · ${r.cat||'-'}</div>
        </div>
      </div>
      <div class="alert-kpi">
        ${kpis.map(k=>`
          <div class="alert-kpi-item">
            <div class="alert-kpi-label">${k.label}</div>
            <div class="alert-kpi-val ${k.cls||''}">${k.val}</div>
            ${k.sub?`<div class="alert-kpi-sub">${k.sub}</div>`:''}
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function openDetailByGroup(groupName){
  const idx = resultData.findIndex(r=>r.group===groupName);
  if(idx>=0) openDetail(idx);
}


// ===== 중요도 높은 광고그룹 (파워컨텐츠 메인키워드 리스트) =====
const KEY_GROUPS = new Set([
  "01_암보험|모바일","01_실비보험|모바일","01_실손보험|모바일","01_실비보험비교사이트|모바일",
  "암보험_PC|PC","01_치과보험|모바일","실비보험_PC|PC","01_암보험비갱신형|모바일",
  "01_암보험비교사이트|모바일","01_유병자실비보험비교|모바일","치아보험_PC|PC","01_치아보험|모바일",
  "01_실비신규6|모바일","암보험비교사이트_PC|PC","실손보험_PC|PC","01_실손보험비교|모바일",
  "01_어린이보험|모바일","01_실비보험가입조건|모바일","01_암보험추천|모바일","운전자보험_PC|PC",
  "01_보험상담|모바일","암보험비갱신형_PC|PC","01_치아보험임플란트|모바일","유병자실비보험비교_PC|PC",
  "어린이보험_PC|PC","01_치아보험비교|모바일","01_환급형암보험|모바일","실비보험비교사이트_PC|PC",
  "01_수술비보험|모바일","01_치아보험비교사이트|모바일","01_실비|모바일","01_20대암보험|모바일",
  "운전자보험비교사이트_PC|PC","01_보험점검|모바일","01_어린이실비보험|모바일","01_실속보장치아보험|모바일",
  "01_갑상선암보험|모바일","뇌혈관질환진단비_PC|PC","01_실손의료보험|모바일","01_실손보험추천|모바일",
  "보험리모델링_PC|PC","01_보험리모델링|모바일","01_비갱신어린이보험|모바일","01_암보험비교|모바일",
  "01_어린이암보험|모바일","01_치아보험가입조건|모바일","01_비갱신암보험|모바일","01_어린이보험가입순위|모바일"
]);
function isKeyGroup(group, media){ return KEY_GROUPS.has(`${group}|${media}`); }

// ===== 상담시스템 CRM 데이터 — 서버에서 동적 로드 =====
let CRM_MEDIA_LIST = [];
let CRM_DATA = {};
let KW_DAILY_COST = {};  // {date_key: {naver, google, daum}}

// Daily DB 현황(전체 탭)은 자체 월 선택기를 갖고 있어 다른 탭이 로드해둔 "이번달만"짜리
// resultData/CRM_DATA와 무관하게 전체 기간 데이터가 필요하다 — 한 번만 불러와 캐시한다.
let _dailyAllData = null;
let _dailyAllDataPromise = null;
async function _ensureDailyAllMonthsLoaded(){
  if(_dailyAllData) return _dailyAllData;
  if(_dailyAllDataPromise) return _dailyAllDataPromise;
  _dailyAllDataPromise = (async()=>{
    const [s] = await Promise.all([loadAllSheets(), _ensureIntypeMapLoaded()]);
    const adData = _apiAnalyze('', s);
    const crmRes = _apiCrm('', s);
    _dailyAllData = {
      resultData: (adData && !adData.error) ? (adData.result||[]) : [],
      crmData: crmRes.crm_data || {},
      crmMediaList: crmRes.media_list || [],
      kwDailyCost: crmRes.kw_daily_cost || {},
    };
    return _dailyAllData;
  })().catch(e=>{ console.warn('Daily DB 현황 전체기간 데이터 로드 실패:', e); _dailyAllDataPromise=null; throw e; });
  return _dailyAllDataPromise;
}

// 애드온컴퍼니(디스플레이 전체 매체 합산) 일별 광고비 — Daily DB 현황의 애드온컴퍼니 광고비 컬럼 자동 채우기용
let _displayDailyCost = null; // {date_key: 합산 광고비}
// 초기 부팅 시 알림 체크(_checkDisplayAlerts)와 일별 광고비 채우기(_loadDisplayDailyCost)가
// 거의 동시에 display_report를 각자 fetch하면 같은 큰 CSV를 두 번 받아와 느려지므로 하나로 공유한다
// (디스플레이 탭 자체는 최신 데이터를 위해 방문 시마다 별도로 새로 받아오는 기존 방식 그대로 유지)
let _displayReportBootstrapPromise = null;
function _fetchDisplayReportOnce(){
  if(!_displayReportBootstrapPromise){
    _displayReportBootstrapPromise = !SHEETS_URLS.display_report ? Promise.resolve([]) :
      fetch(SHEETS_URLS.display_report).then(r=>r.text()).then(text=>_pCSV(text)||[])
        .catch(e=>{ console.warn('디스플레이 리포트 로드 실패:', e); return []; });
  }
  return _displayReportBootstrapPromise;
}

async function _loadDisplayDailyCost(){
  if(_displayDailyCost) return _displayDailyCost;
  if(!SHEETS_URLS.display_report) return {};
  try{
    const rows = await _fetchDisplayReportOnce();
    const byDate = {};
    rows.forEach(r=>{
      const key = _normDK(r['날짜']||'');
      if(!key) return;
      // 부가세 포함가로 집계 (원본 광고비 × 1.1)
      byDate[key] = (byDate[key]||0) + Math.round(_cN(r['비용'])*1.1);
    });
    _displayDailyCost = byDate;
    return byDate;
  }catch(e){ console.warn('디스플레이 일별 광고비 로드 실패:', e); return {}; }
}

// 기타 매체 중 실제 광고비 데이터가 없는 매체는 환산료/DB수 기반 역산 공식으로 광고비를 추정한다
// (제공받은 공식 그대로 적용, 나머지 매체는 추후 공식 전달 예정)
function _crmMediaCost(media, c, dispCost){
  if(media==='애드온컴퍼니') return dispCost||0;
  if(media==='디티엔' || media==='에이온비' || media==='신성미디어') return Math.round((c?.perf||0)*9.99/11000)*11000;
  if(media==='두드림') return (c?.db||0)*55000;
  return 0;
}

// ===== Daily DB 현황: 소형 매체 컬럼 표시/숨기기 (가독성) =====
// '파워컨텐츠'/'키워드'(네이버+구글+다음 묶음)는 기본적으로 숨기고 전체합계만 보이게 함 (최초 1회만 적용)
let _dailyHiddenMedias = new Set(JSON.parse(localStorage.getItem('daily_hidden_medias')||'[]'));
if(!localStorage.getItem('daily_hidden_medias_v2')){
  _dailyHiddenMedias.add('파워컨텐츠');
  _dailyHiddenMedias.add('키워드');
  localStorage.setItem('daily_hidden_medias_v2', '1');
  localStorage.setItem('daily_hidden_medias', JSON.stringify([..._dailyHiddenMedias]));
}
function _dailySaveHidden(){ localStorage.setItem('daily_hidden_medias', JSON.stringify([..._dailyHiddenMedias])); }

// daily-month-sel이 "전체 월"(빈 문자열)로 이미 초기화됐는지 추적 (빈 문자열도 유효한 선택이라 값만으로는 최초 진입 여부를 구분할 수 없음)
let _dailyMonthSelInitialized = false;

// 계약수/계약율/환산료/ROAS는 당월/누적 토글에 따라 다른 값을 보여준다 (KPI카드의 당월/누적 개념과 동일)
let _dailyTableCumMode = false;
function setDailyTableCumMode(cum, btn){
  _dailyTableCumMode = cum;
  document.querySelectorAll('#daily-table-cum-toggle .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderDaily();
}
function toggleDailyMedia(m){
  if(_dailyHiddenMedias.has(m)) _dailyHiddenMedias.delete(m); else _dailyHiddenMedias.add(m);
  _dailySaveHidden(); renderDailyMediaToggle(); renderDaily();
}
function setDailyMediaAll(show){
  const crmMedias = (_dailyAllData?.crmMediaList||CRM_MEDIA_LIST).filter(m=>m!=='파워컨텐츠'&&m!=='네이버'&&m!=='구글'&&m!=='다음');
  _dailyHiddenMedias = show ? new Set() : new Set(['파워컨텐츠', '키워드', ...crmMedias]);
  _dailySaveHidden(); renderDailyMediaToggle(); renderDaily();
}
function renderDailyMediaToggle(){
  const el = document.getElementById('daily-media-toggle'); if(!el) return;
  const crmMedias = (_dailyAllData?.crmMediaList||CRM_MEDIA_LIST).filter(m=>m!=='파워컨텐츠'&&m!=='네이버'&&m!=='구글'&&m!=='다음');
  const toggleMedias = ['파워컨텐츠', '키워드', ...crmMedias];
  const hiddenCount = toggleMedias.filter(m=>_dailyHiddenMedias.has(m)).length;
  el.innerHTML = toggleMedias.map(m=>{
        const on = !_dailyHiddenMedias.has(m);
        return `<button onclick="toggleDailyMedia('${m.replace(/'/g,"\\'")}')" style="border:1px solid ${on?'var(--accent)':'var(--border-strong)'};background:${on?'var(--accent-bg)':'transparent'};color:${on?'var(--accent)':'var(--faint)'};border-radius:14px;padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">${m}</button>`;
      }).join('')
    + `<button onclick="setDailyMediaAll(${hiddenCount>0})" style="border:1px solid var(--border-strong);background:transparent;color:var(--muted);border-radius:14px;padding:3px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">${hiddenCount>0?'전체 표시':'전체 숨기기'}</button>`;
}

async function loadCrmData(month){
  try {
    const s = await loadAllSheets();
    const json = _apiCrm(month, s);
    CRM_DATA       = json.crm_data  || {};
    CRM_MEDIA_LIST = json.media_list || [];
    KW_DAILY_COST  = json.kw_daily_cost || {};
    if(_currentMediaGroup === 'all') _initDailyTabCore();
  } catch(e){ console.warn('CRM 로드 실패:', e); }
}
