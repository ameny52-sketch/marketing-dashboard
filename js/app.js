// ===== 초기 로딩: 전체 탭 / Daily DB 현황 패널 표시 =====
document.addEventListener('DOMContentLoaded', function(){
  // panel-daily에 show 클래스 부여 (HTML 기본값에는 없음)
  document.getElementById('panel-daily').classList.add('show');

  // 전체 서브탭바만 표시 (pc/kw는 숨김 유지)
  const subtabsAll = document.getElementById('subtabs-all');
  const subtabsPc  = document.getElementById('subtabs-pc');
  const subtabsKw  = document.getElementById('subtabs-kw');
  if(subtabsAll) subtabsAll.style.display = '';
  if(subtabsPc)  subtabsPc.style.display  = 'none';
  if(subtabsKw)  subtabsKw.style.display  = 'none';

  // 미디어 그룹 탭 active 상태 확인 (전체 버튼이 active인지)
  const allBtn = document.querySelector('.media-group-tab.active');
  if(!allBtn || allBtn.textContent.trim() !== '전체'){
    const firstBtn = document.querySelector('.media-group-tab');
    if(firstBtn) firstBtn.classList.add('active');
  }

  // CRM 데이터 자동 로드 후 Daily 탭 초기화
  const monthEl = document.getElementById('month-select-all');
  const month = monthEl?.value || '';
  if(Object.keys(CRM_DATA).length === 0){
    loadCrmData(month).then(()=>{
      initDailyTab();
    });
  } else {
    initDailyTab();
  }

  // 기준값 초과 알림 (백그라운드에서 조용히 체크, 화면 로딩을 막지 않음)
  _checkDashboardAlerts();
});

// ===== 기준값 초과 알림 팝업 =====
// 파워컨텐츠/키워드 전체 평균 DB단가, 디스플레이 특정 매체·영역의 광고비/DB단가가
// 기준을 넘으면 하나의 팝업으로 모아서 보여준다 (여러 조건이 동시에 걸려도 팝업은 1개)
const DASHBOARD_ALERT_RULES = {
  pcCpd: 100000,        // 파워컨텐츠 전체 평균 DB단가
  kwCpd: 100000,        // 키워드 전체 평균 DB단가
  kakaoCost: 5000000,   // 카카오페이 전체 영역 합산 광고비
  gasCpd: 100000,       // 가스락 영역별 DB단가 (영역 중 하나라도)
  ktpassPushCpd: 100000 // KT PASS · PUSH 영역 DB단가
};

function _alertsDismissedToday(){
  return localStorage.getItem('dashboard_alert_dismissed_date') === new Date().toISOString().slice(0,10);
}
function _dismissAlertsToday(){
  localStorage.setItem('dashboard_alert_dismissed_date', new Date().toISOString().slice(0,10));
}
function _closeAlertPopup(){
  if(document.getElementById('dashboard-alert-dismiss-cb').checked) _dismissAlertsToday();
  document.getElementById('dashboard-alert-modal-bg').style.display = 'none';
}

// 파워컨텐츠(daily_raw/daily_sales_map) 또는 키워드(daily) 데이터에서
// 가장 최신 날짜의 광고비/DB수를 합산해 DB단가를 계산
function _latestDayCpdFromRows(rows, mode){
  const dayMap = {};
  rows.forEach(r=>{
    if(mode==='pc'){
      (r.daily_raw||[]).forEach(d=>{
        if(!dayMap[d.date]) dayMap[d.date] = {cost:0, db:0};
        dayMap[d.date].cost += d.cost||0;
      });
      Object.entries(r.daily_sales_map||{}).forEach(([date,sv])=>{
        if(!dayMap[date]) dayMap[date] = {cost:0, db:0};
        dayMap[date].db += sv.db||0;
      });
    } else {
      Object.entries(r.daily||{}).forEach(([date,d])=>{
        if(!dayMap[date]) dayMap[date] = {cost:0, db:0};
        dayMap[date].cost += d.cost||0;
        dayMap[date].db += d.db||0;
      });
    }
  });
  const dates = Object.keys(dayMap).sort();
  if(!dates.length) return null;
  const latest = dates[dates.length-1];
  const d = dayMap[latest];
  if(d.db<=0 || d.cost<=0) return null;
  return {date:latest, cpd:Math.round(d.cost/d.db)};
}

async function _checkDisplayAlerts(){
  const alerts = [];
  if(!SHEETS_URLS.display_report) return alerts;
  try {
    const [data, s] = await Promise.all([
      _fetchDisplayReportOnce(),
      loadAllSheets()
    ]);
    const crmRaw = (s.raw||[]).filter(r=>(r['광고매체세부']||'').trim()==='애드온컴퍼니');

    const datesByMedia = {};
    data.forEach(r=>{
      const media=(r['매체명']||'').trim(), d=r['날짜'];
      if(!media||!d) return;
      if(!datesByMedia[media]) datesByMedia[media] = new Set();
      datesByMedia[media].add(d);
    });
    const latestByMedia = {};
    Object.entries(datesByMedia).forEach(([m,set])=>{ latestByMedia[m] = [...set].sort().slice(-1)[0]; });

    function latestDayAgg(media, areaFilter){
      const latest = latestByMedia[media];
      if(!latest) return null;
      let cost=0; const codes=new Set();
      data.forEach(r=>{
        if((r['매체명']||'').trim()!==media || r['날짜']!==latest) return;
        const area=(r['상품명']||'').trim()||'(미지정)';
        if(areaFilter && area!==areaFilter) return;
        cost += _cN(r['비용']);
        const code=(r['인타입']||'').trim();
        if(code) codes.add(code);
      });
      let db=0;
      crmRaw.forEach(r=>{
        const code=(r['인타입']||'').trim();
        if(!code || !codes.has(code)) return;
        if(_normDS(r['상담등록일']||'')!==latest) return;
        db+=_dbCount(r);
      });
      return {cost, db, date:latest};
    }

    const kko = latestDayAgg('카카오페이', null);
    if(kko && kko.cost>=DASHBOARD_ALERT_RULES.kakaoCost){
      alerts.push({label:'카카오페이', date:kko.date, text:`광고비 ${kko.cost.toLocaleString()}원 사용 (기준 ${DASHBOARD_ALERT_RULES.kakaoCost.toLocaleString()}원 이상)`});
    }

    const gasAreas = [...new Set(data.filter(r=>(r['매체명']||'').trim()==='가스락').map(r=>(r['상품명']||'').trim()||'(미지정)'))];
    gasAreas.forEach(area=>{
      const g = latestDayAgg('가스락', area);
      if(g && g.db>0 && g.cost>0){
        const cpd = Math.round(g.cost/g.db);
        if(cpd>DASHBOARD_ALERT_RULES.gasCpd) alerts.push({label:`가스락 · ${area}`, date:g.date, text:`DB단가 ${cpd.toLocaleString()}원 (기준 ${DASHBOARD_ALERT_RULES.gasCpd.toLocaleString()}원 초과)`});
      }
    });

    const ktp = latestDayAgg('KT PASS', 'PUSH');
    if(ktp && ktp.db>0 && ktp.cost>0){
      const cpd = Math.round(ktp.cost/ktp.db);
      if(cpd>DASHBOARD_ALERT_RULES.ktpassPushCpd) alerts.push({label:'KT PASS · PUSH', date:ktp.date, text:`DB단가 ${cpd.toLocaleString()}원 (기준 ${DASHBOARD_ALERT_RULES.ktpassPushCpd.toLocaleString()}원 초과)`});
    }
  } catch(e){ console.warn('디스플레이 알림 체크 실패:', e); }
  return alerts;
}

async function _checkDashboardAlerts(){
  if(_alertsDismissedToday()) return;
  try {
    const [s] = await Promise.all([loadAllSheets(), _ensureIntypeMapLoaded()]);
    const [adRes, kwRes, dispAlerts] = await Promise.all([
      Promise.resolve(_apiAnalyze('', s)),
      Promise.resolve(_apiKeyword('', s)),
      _checkDisplayAlerts()
    ]);
    const alerts = [...dispAlerts];

    if(adRes && !adRes.error){
      const pc = _latestDayCpdFromRows(adRes.result, 'pc');
      if(pc && pc.cpd>DASHBOARD_ALERT_RULES.pcCpd) alerts.push({label:'파워컨텐츠', date:pc.date, text:`전체 평균 DB단가 ${pc.cpd.toLocaleString()}원 (기준 ${DASHBOARD_ALERT_RULES.pcCpd.toLocaleString()}원 초과)`});
    }
    if(kwRes && !kwRes.error){
      // 구글/다음은 일별 광고비가 daily에 채워지지 않아 전체 평균을 내면 비용이 빠져 실제보다 낮게 잡힌다 —
      // 성과 진단 탭과 동일하게 일별 데이터가 정확한 네이버만으로 판단한다
      const kw = _latestDayCpdFromRows(kwRes.result.filter(r=>r.sub_media==='네이버'), 'kw');
      if(kw && kw.cpd>DASHBOARD_ALERT_RULES.kwCpd) alerts.push({label:'키워드(네이버)', date:kw.date, text:`DB단가 ${kw.cpd.toLocaleString()}원 (기준 ${DASHBOARD_ALERT_RULES.kwCpd.toLocaleString()}원 초과)`});
    }

    if(!alerts.length) return;
    document.getElementById('dashboard-alert-modal-body').innerHTML = alerts.map(a=>`
      <div style="display:flex;align-items:center;gap:12px;padding:.75rem 0;border-bottom:1px solid var(--border)">
        <div style="font-size:20px">⚠️</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${escHtml(a.label)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${escHtml(a.text)}</div>
          <div style="font-size:11px;color:var(--faint);margin-top:2px">기준일: ${a.date}</div>
        </div>
      </div>`).join('');
    document.getElementById('dashboard-alert-modal-bg').style.display = 'flex';
  } catch(e){ console.warn('알림 체크 실패:', e); }
}
