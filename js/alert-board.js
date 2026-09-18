// ===== 효율 순위 (알림판) + 주요그룹 필터 =====
// (js/insights.js 에서 분리 — 로직 변경 없음. 로드 순서는 index.html 참고)

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
