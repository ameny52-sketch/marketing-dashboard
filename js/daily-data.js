// ===== CRM · Daily DB 현황 데이터 로더 (데이터 레이어) =====
// (js/insights.js 에서 분리 — 로직 변경 없음. 로드 순서는 index.html 참고)

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
      _fetchWithTimeout(SHEETS_URLS.display_report, 20000).then(r=>r.text()).then(text=>_pCSV(text)||[])
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
        return `<button class="media-pill${on?' is-on':''}" onclick="toggleDailyMedia('${m.replace(/'/g,"\\'")}')">${m}</button>`;
      }).join('')
    + `<button class="media-pill media-pill--all" onclick="setDailyMediaAll(${hiddenCount>0})">${hiddenCount>0?'전체 표시':'전체 숨기기'}</button>`;
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
