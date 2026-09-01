// ===== 데이터 파이프라인 =====
const SHEETS_URLS = {
  // 매체별 광고비 + CRM 원본: GitHub Pages 정적 파일 (굿리치_자동화 스크립트가 매일 갱신·커밋)
  raw:    'data/raw_2026.csv',
  pc:     'data/pc_2026.csv',
  naver:  'data/naver_2026.csv',
  google: 'data/google_2026.csv',
  daum:   'data/daum_2026.csv',
  // 디스플레이(뉴미디어) 탭
  display_report:  'data/display_2026.csv',   // 통합 광고 리포트 (날짜,매체명,상품명,소재명,노출수,클릭수,발송수,비용,인타입)
  display_intype:  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSsBXKDYY2T7lRzlI0CJdVzcCCRElM5mb03D0ebTez0-cD5KDQY2In4kqVESmCRGHpmeEqna0__yjCH/pub?gid=454913560&single=true&output=csv',   // 인타입 참조표 (인타입,매체,월,영역,소재,보종) — 구글시트에서 직접 추가/수정/삭제 관리
  // 파워컨텐츠 그룹별 소재(블로그/랜딩) 링크: 자동화 대상 아님, 구글시트 라이브 유지
  group_content:   'https://docs.google.com/spreadsheets/d/e/2PACX-1vSsBXKDYY2T7lRzlI0CJdVzcCCRElM5mb03D0ebTez0-cD5KDQY2In4kqVESmCRGHpmeEqna0__yjCH/pub?gid=384816739&single=true&output=csv',
};
// 로드 실패 시 사용자에게 보여줄 한글 이름 (정적 파일도 네트워크/파싱 오류로 실패할 수 있어, 어떤 파일이 실패했는지 명시하기 위함)
const SHEET_LABELS = {
  raw:'CRM 원본', pc:'파워컨텐츠', naver:'네이버', google:'구글', daum:'다음',
};
const KW_INTYPE_MAP = {"DKAA": {"cat": "어린이보험", "media_name": "다음"}, "DKAB": {"cat": "보험", "media_name": "다음"}, "DKAC": {"cat": "암보험", "media_name": "다음"}, "DKAD": {"cat": "치아보험", "media_name": "다음"}, "DKAF": {"cat": "주택화재보험", "media_name": "다음"}, "DKAG": {"cat": "치매/간병", "media_name": "다음"}, "DKAJ": {"cat": "종신보험", "media_name": "다음"}, "DKAR": {"cat": "정기보험", "media_name": "다음"}, "DKAS": {"cat": "실비", "media_name": "다음"}, "DKAT": {"cat": "신생아보험", "media_name": "다음"}, "DKATLT1": {"cat": "신생아보험", "media_name": "다음"}, "DKAU": {"cat": "운전자보험", "media_name": "다음"}, "DKAV": {"cat": "보장분석", "media_name": "다음"}, "DKEA": {"cat": "어린이보험", "media_name": "다음"}, "DKEB": {"cat": "보험", "media_name": "다음"}, "DKEC": {"cat": "암보험", "media_name": "다음"}, "DKECL4": {"cat": "암보험", "media_name": "다음"}, "DKED": {"cat": "치아보험", "media_name": "다음"}, "DKEG": {"cat": "치매/간병", "media_name": "다음"}, "DKEJ": {"cat": "종신보험", "media_name": "다음"}, "DKER": {"cat": "정기보험", "media_name": "다음"}, "DKES": {"cat": "실비", "media_name": "다음"}, "DKESL1": {"cat": "실비", "media_name": "다음"}, "DKESL2": {"cat": "실비", "media_name": "다음"}, "DKET": {"cat": "신생아보험", "media_name": "다음"}, "DKMA": {"cat": "어린이보험", "media_name": "다음"}, "DKMB": {"cat": "보험", "media_name": "다음"}, "DKMC": {"cat": "암보험", "media_name": "다음"}, "DKMD": {"cat": "치아보험", "media_name": "다음"}, "DKMG": {"cat": "치매/간병", "media_name": "다음"}, "DKMS": {"cat": "실비", "media_name": "다음"}, "DKMT": {"cat": "신생아보험", "media_name": "다음"}, "GKAA": {"cat": "어린이보험", "media_name": "구글"}, "GKAB": {"cat": "보험", "media_name": "구글"}, "GKAC": {"cat": "암보험", "media_name": "구글"}, "GKAD": {"cat": "치아보험", "media_name": "구글"}, "GKAF": {"cat": "주택화재보험", "media_name": "구글"}, "GKAG": {"cat": "치매/간병", "media_name": "구글"}, "GKAJ": {"cat": "종신보험", "media_name": "구글"}, "GKAR": {"cat": "정기보험", "media_name": "구글"}, "GKAS": {"cat": "실비", "media_name": "구글"}, "GKAT": {"cat": "신생아보험", "media_name": "구글"}, "GKAU": {"cat": "운전자보험", "media_name": "구글"}, "GKAV": {"cat": "보장분석", "media_name": "구글"}, "GKEA": {"cat": "어린이보험", "media_name": "구글"}, "GKEB": {"cat": "보험", "media_name": "구글"}, "GKEC": {"cat": "암보험", "media_name": "구글"}, "GKED": {"cat": "치아보험", "media_name": "구글"}, "GKEG": {"cat": "치매/간병", "media_name": "구글"}, "GKEJ": {"cat": "종신보험", "media_name": "구글"}, "GKER": {"cat": "정기보험", "media_name": "구글"}, "GKES": {"cat": "실비", "media_name": "구글"}, "GKET": {"cat": "신생아보험", "media_name": "구글"}, "GKEV": {"cat": "보장분석", "media_name": "구글"}, "GKMA": {"cat": "어린이보험", "media_name": "구글"}, "GKMB": {"cat": "보험", "media_name": "구글"}, "GKMC": {"cat": "암보험", "media_name": "구글"}, "GKMD": {"cat": "치아보험", "media_name": "구글"}, "GKMG": {"cat": "치매/간병", "media_name": "구글"}, "GKMS": {"cat": "실비", "media_name": "구글"}, "GKMT": {"cat": "신생아보험", "media_name": "구글"}, "NKAA": {"cat": "어린이보험", "media_name": "네이버"}, "NKAAL1": {"cat": "어린이보험", "media_name": "네이버"}, "NKAAL2": {"cat": "어린이보험", "media_name": "네이버"}, "NKAAL3": {"cat": "어린이보험", "media_name": "네이버"}, "NKAAL4": {"cat": "어린이보험", "media_name": "네이버"}, "NKAALT1": {"cat": "어린이보험", "media_name": "네이버"}, "NKAB": {"cat": "보험", "media_name": "네이버"}, "NKABL1": {"cat": "보험", "media_name": "네이버"}, "NKABL2": {"cat": "보험", "media_name": "네이버"}, "NKABL3": {"cat": "보험", "media_name": "네이버"}, "NKABL4": {"cat": "보험", "media_name": "네이버"}, "NKAC": {"cat": "암보험", "media_name": "네이버"}, "NKACL1": {"cat": "암보험", "media_name": "네이버"}, "NKACL2": {"cat": "암보험", "media_name": "네이버"}, "NKACL3": {"cat": "암보험", "media_name": "네이버"}, "NKACL4": {"cat": "암보험", "media_name": "네이버"}, "NKAD": {"cat": "치아보험", "media_name": "네이버"}, "NKADL1": {"cat": "치아보험", "media_name": "네이버"}, "NKADL2": {"cat": "치아보험", "media_name": "네이버"}, "NKADL3": {"cat": "치아보험", "media_name": "네이버"}, "NKADL4": {"cat": "치아보험", "media_name": "네이버"}, "NKAF": {"cat": "주택화재보험", "media_name": "네이버"}, "NKAFL1": {"cat": "주택화재보험", "media_name": "네이버"}, "NKAFL2": {"cat": "주택화재보험", "media_name": "네이버"}, "NKAFL3": {"cat": "주택화재보험", "media_name": "네이버"}, "NKAFL4": {"cat": "주택화재보험", "media_name": "네이버"}, "NKAG": {"cat": "치매/간병", "media_name": "네이버"}, "NKAGL1": {"cat": "치매/간병", "media_name": "네이버"}, "NKAGL2": {"cat": "치매/간병", "media_name": "네이버"}, "NKAGL3": {"cat": "치매/간병", "media_name": "네이버"}, "NKAGL4": {"cat": "치매/간병", "media_name": "네이버"}, "NKAJ": {"cat": "종신보험", "media_name": "네이버"}, "NKAJL1": {"cat": "종신보험", "media_name": "네이버"}, "NKAJL2": {"cat": "종신보험", "media_name": "네이버"}, "NKAJL3": {"cat": "종신보험", "media_name": "네이버"}, "NKAJL4": {"cat": "종신보험", "media_name": "네이버"}, "NKAJLT1": {"cat": "종신보험", "media_name": "네이버"}, "NKAR": {"cat": "정기보험", "media_name": "네이버"}, "NKARL1": {"cat": "정기보험", "media_name": "네이버"}, "NKARL2": {"cat": "정기보험", "media_name": "네이버"}, "NKARL3": {"cat": "정기보험", "media_name": "네이버"}, "NKARL4": {"cat": "정기보험", "media_name": "네이버"}, "NKARLT1": {"cat": "정기보험", "media_name": "네이버"}, "NKAS": {"cat": "실비", "media_name": "네이버"}, "NKASL1": {"cat": "실비", "media_name": "네이버"}, "NKASL2": {"cat": "실비", "media_name": "네이버"}, "NKASL3": {"cat": "실비", "media_name": "네이버"}, "NKASL4": {"cat": "실비", "media_name": "네이버"}, "NKAT": {"cat": "신생아보험", "media_name": "네이버"}, "NKATL1": {"cat": "신생아보험", "media_name": "네이버"}, "NKATL2": {"cat": "신생아보험", "media_name": "네이버"}, "NKATL3": {"cat": "신생아보험", "media_name": "네이버"}, "NKATL4": {"cat": "신생아보험", "media_name": "네이버"}, "NKATLT1": {"cat": "신생아보험", "media_name": "네이버"}, "NKAU": {"cat": "운전자보험", "media_name": "네이버"}, "NKAUL1": {"cat": "운전자보험", "media_name": "네이버"}, "NKAUL2": {"cat": "운전자보험", "media_name": "네이버"}, "NKAUL3": {"cat": "운전자보험", "media_name": "네이버"}, "NKAUL4": {"cat": "운전자보험", "media_name": "네이버"}, "NKAV": {"cat": "보장분석", "media_name": "네이버"}, "NKAVL1": {"cat": "보장분석", "media_name": "네이버"}, "NKAVL2": {"cat": "보장분석", "media_name": "네이버"}, "NKAVL3": {"cat": "보장분석", "media_name": "네이버"}, "NKAVL4": {"cat": "보장분석", "media_name": "네이버"}, "NKEA": {"cat": "어린이보험", "media_name": "네이버"}, "NKEB": {"cat": "보험", "media_name": "네이버"}, "NKEC": {"cat": "암보험", "media_name": "네이버"}, "NKECL1": {"cat": "암보험", "media_name": "네이버"}, "NKECL2": {"cat": "암보험", "media_name": "네이버"}, "NKECL3": {"cat": "암보험", "media_name": "네이버"}, "NKED": {"cat": "치아보험", "media_name": "네이버"}, "NKEG": {"cat": "치매/간병", "media_name": "네이버"}, "NKEJ": {"cat": "종신보험", "media_name": "네이버"}, "NKER": {"cat": "정기보험", "media_name": "네이버"}, "NKES": {"cat": "실비", "media_name": "네이버"}, "NKESL1": {"cat": "실비", "media_name": "네이버"}, "NKESL2": {"cat": "실비", "media_name": "네이버"}, "NKESL3": {"cat": "실비", "media_name": "네이버"}, "NKET": {"cat": "신생아보험", "media_name": "네이버"}, "NKMA": {"cat": "어린이보험", "media_name": "네이버"}, "NKMB": {"cat": "보험", "media_name": "네이버"}, "NKMC": {"cat": "암보험", "media_name": "네이버"}, "NKMD": {"cat": "치아보험", "media_name": "네이버"}, "NKMG": {"cat": "치매/간병", "media_name": "네이버"}, "NKMS": {"cat": "실비", "media_name": "네이버"}, "NKMT": {"cat": "신생아보험", "media_name": "네이버"}, "TKAA": {"cat": "어린이보험", "media_name": "네이버"}, "TKAB": {"cat": "보험", "media_name": "네이버"}, "TKAC": {"cat": "암보험", "media_name": "네이버"}, "TKAD": {"cat": "치아보험", "media_name": "네이버"}, "TKAG": {"cat": "치매/간병", "media_name": "네이버"}, "TKAJ": {"cat": "종신보험", "media_name": "네이버"}, "TKAR": {"cat": "정기보험", "media_name": "네이버"}, "TKAS": {"cat": "실비", "media_name": "네이버"}, "TKAT": {"cat": "신생아보험", "media_name": "네이버"}, "TKEA": {"cat": "어린이보험", "media_name": "네이버"}, "TKEB": {"cat": "보험", "media_name": "네이버"}, "TKEC": {"cat": "암보험", "media_name": "네이버"}, "TKED": {"cat": "치아보험", "media_name": "네이버"}, "TKEG": {"cat": "치매/간병", "media_name": "네이버"}, "TKEJ": {"cat": "종신보험", "media_name": "네이버"}, "TKER": {"cat": "정기보험", "media_name": "네이버"}, "TKES": {"cat": "실비", "media_name": "네이버"}, "TKET": {"cat": "신생아보험", "media_name": "네이버"}, "TKMA": {"cat": "어린이보험", "media_name": "네이버"}, "TKMB": {"cat": "보험", "media_name": "네이버"}, "TKMC": {"cat": "암보험", "media_name": "네이버"}, "TKMD": {"cat": "치아보험", "media_name": "네이버"}, "TKMG": {"cat": "치매/간병", "media_name": "네이버"}, "TKMS": {"cat": "실비", "media_name": "네이버"}, "TKMT": {"cat": "신생아보험", "media_name": "네이버"}, "DKAJLT1": {"cat": "정기보험", "media_name": "다음"}, "DKEDL1": {"cat": "치아보험", "media_name": "다음"}, "DKABL3": {"cat": "보험", "media_name": "다음"}, "NKEDL1": {"cat": "치아보험", "media_name": "네이버"}, "NKEDL3": {"cat": "치아보험", "media_name": "네이버"}, "DKABL1": {"cat": "보험", "media_name": "다음"}, "NKESL4": {"cat": "실비", "media_name": "네이버"}, "ZKES": {"cat": "실비", "media_name": "네이버"}, "ZKEB": {"cat": "보험", "media_name": "네이버"}, "ZKESL1": {"cat": "실비", "media_name": "네이버"}, "ZKESL2": {"cat": "실비", "media_name": "네이버"}, "ZKESL3": {"cat": "실비", "media_name": "네이버"}, "ZKESL4": {"cat": "실비", "media_name": "네이버"}, "ZKEBL1": {"cat": "보험", "media_name": "네이버"}, "ZKEBL2": {"cat": "보험", "media_name": "네이버"}, "ZKEBL3": {"cat": "보험", "media_name": "네이버"}, "ZKEBL4": {"cat": "보험", "media_name": "네이버"}, "ZKEC": {"cat": "암보험", "media_name": "네이버"}, "ZKECL1": {"cat": "암보험", "media_name": "네이버"}, "ZKECL2": {"cat": "암보험", "media_name": "네이버"}, "ZKECL3": {"cat": "암보험", "media_name": "네이버"}, "ZKECL4": {"cat": "암보험", "media_name": "네이버"}, "ZKEA": {"cat": "어린이보험", "media_name": "네이버"}, "ZKEAL1": {"cat": "어린이보험", "media_name": "네이버"}, "ZKEAL2": {"cat": "어린이보험", "media_name": "네이버"}, "ZKEAL3": {"cat": "어린이보험", "media_name": "네이버"}, "ZKEAL4": {"cat": "어린이보험", "media_name": "네이버"}, "ZKAB": {"cat": "보험", "media_name": "네이버"}, "DKAALT1": {"cat": "어린이보험", "media_name": "다음"}, "NKEV": {"cat": "보장분석", "media_name": "네이버"}, "DKECL1": {"cat": "암보험", "media_name": "다음"}, "NKEDL4": {"cat": "치아보험", "media_name": "네이버"}, "DKABL2": {"cat": "보험", "media_name": "다음"}, "DKAVL2": {"cat": "보장분석", "media_name": "다음"}, "DKECL3": {"cat": "암보험", "media_name": "다음"}, "DKAVL3": {"cat": "보장분석", "media_name": "다음"}};
const CAMP_CAT_MAP  = {"C01": "보험", "C02": "실비", "C03": "암보험", "C04": "치아보험", "C05": "신생아보험", "C06": "어린이보험", "C07": "치매/간병", "C08": "자동차보험", "C09": "운전자보험", "C10": "저축성보험", "C11": "생명보험", "C12": "종신보험", "C15": "정기보험", "C16": "보장분석", "C17": "주택화재보험"};

let _sheetsParsed = null;

function _pCSVLine(line) {
  const r=[];let c='';let q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}
    else if(ch===','&&!q){r.push(c);c='';}
    else c+=ch;
  }
  r.push(c);return r;
}
function _pCSV(text) {
  const lines=text.split('\n');if(!lines.length)return[];
  const hdrs=_pCSVLine(lines[0].trim());const rows=[];
  for(let i=1;i<lines.length;i++){
    const ln=lines[i].trim();if(!ln)continue;
    const v=_pCSVLine(ln);const o={};
    hdrs.forEach((h,idx)=>{o[h]=v[idx]||'';}); rows.push(o);
  }
  return rows;
}
function _normDS(d){
  if(!d)return'';
  let m=d.match(/^(\d{4})\.(\d{2})\.(\d{2})/);if(m)return`${m[1]}-${m[2]}-${m[3]}`;
  m=d.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return`${m[1]}-${m[2]}-${m[3]}`;
  m=d.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if(m)return`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return d;
}
function _normDK(d){
  const n=_normDS(d);const m=n.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?`${m[1]}.${m[2]}.${m[3]}.`:d;
}
function _filterMon(rows,col,monthLabel){
  if(!monthLabel)return rows;
  const m=monthLabel.match(/(\d{4})년\s*(\d{1,2})월/);if(!m)return rows;
  const pfx=`${m[1]}-${m[2].padStart(2,'0')}`;
  return rows.filter(r=>_normDS(r[col]||'').startsWith(pfx));
}
function _cN(v){return parseFloat(String(v).replace(/,/g,'').trim()||'0')||0;}
// raw_2026.csv는 매체/세부매체/인타입/상담등록일 등 기준으로 이미 집계된 파일이라, 한 행이 DB 1건이 아니라
// DB수 컬럼에 합산된 건수를 담고 있다 — DB를 셀 땐 항상 행 개수(++) 대신 이 값을 더해야 한다
function _dbCount(r){return Math.round(_cN(r['DB수']))||1;}

function _setLoadOverlay(show,msg,pct){
  const el=document.getElementById('loading-overlay');if(!el)return;
  if(show){el.style.display='flex';
    const me=el.querySelector('.lo-msg');const be=el.querySelector('.lo-bar-fill');
    if(me)me.textContent=msg||'';
    if(be)be.style.width=`${Math.round((pct||0)*100)}%`;
  }else el.style.display='none';
}

// 구글 시트 CSV export가 간헐적으로 응답 없이 멈추는 경우가 있어, 한 시트라도 무한정 기다리지 않도록 타임아웃을 건다
function _fetchWithTimeout(url, ms){
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), ms);
  return fetch(url, {signal: ctrl.signal}).finally(()=>clearTimeout(timer));
}
function _showSheetLoadWarning(labels){
  const el = document.getElementById('sheet-load-warning');
  if(!el) return;
  if(!labels || !labels.length){ el.style.display='none'; return; }
  el.style.display='block';
  el.textContent = `⚠️ 일부 데이터를 불러오지 못했습니다: ${labels.join(', ')} — ↻ 데이터 새로고침을 눌러 다시 시도해주세요.`;
}

// ===== IndexedDB 캐시 (용량 무제한) =====
const _IDB_NAME='adtool_cache_v4';
const _IDB_STORE='sheets';
const _TTL_DYNAMIC='daily';           // 매체별 광고비 + RAW: 날짜 바뀌면 자동 갱신

function _openIDB(){
  return new Promise((res,rej)=>{
    const req=indexedDB.open(_IDB_NAME,1);
    req.onupgradeneeded=e=>e.target.result.createObjectStore(_IDB_STORE);
    req.onsuccess=e=>res(e.target.result);
    req.onerror=e=>rej(e.target.error);
  });
}
async function _idbGet(key){
  try{
    const db=await _openIDB();
    return new Promise((res,rej)=>{
      const req=db.transaction(_IDB_STORE).objectStore(_IDB_STORE).get(key);
      req.onsuccess=e=>res(e.target.result);
      req.onerror=e=>rej(e.target.error);
    });
  }catch(e){return null;}
}
async function _idbSet(key,value){
  try{
    const db=await _openIDB();
    return new Promise((res,rej)=>{
      const tx=db.transaction(_IDB_STORE,'readwrite');
      tx.objectStore(_IDB_STORE).put(value,key);
      tx.oncomplete=res; tx.onerror=e=>rej(e.target.error);
    });
  }catch(e){}
}
function _today(){return new Date().toISOString().slice(0,10);}
async function _getCached(key,ttl){
  const entry=await _idbGet(key);
  if(!entry)return null;
  if(ttl==='daily'){
    if(entry.date!==_today())return null;
  } else {
    if(Date.now()-entry.ts>ttl)return null;
  }
  return entry.data;
}
async function _setCached(key,data){
  await _idbSet(key,{ts:Date.now(),date:_today(),data});
}

// 헤더의 "데이터 새로고침" 버튼: 시트 데이터는 하루 단위로 캐시되기 때문에
// 시트를 방금 수정했어도 당일에는 자동 반영이 안 됨 — 캐시를 지우고 강제로 다시 받아오게 한다
function _deleteIdbCache(){
  return new Promise(resolve=>{
    try{
      const req = indexedDB.deleteDatabase(_IDB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    }catch(e){ resolve(); }
  });
}
async function refreshAllData(btn){
  if(btn){ btn.disabled = true; btn.textContent = '새로고침 중...'; }
  await _deleteIdbCache();
  location.reload();
}

// 동시에 여러 곳(초기 부팅, 알림 체크 등)에서 호출돼도 실제 fetch는 한 번만 일어나도록
// 진행 중인 로딩 Promise를 공유한다 (안 그러면 겹쳐 호출될 때 시트 전체를 중복으로 받아와서 느려짐)
let _sheetsLoadingPromise = null;
async function loadAllSheets(){
  if(_sheetsParsed) return _sheetsParsed;
  if(_sheetsLoadingPromise) return _sheetsLoadingPromise;
  _sheetsLoadingPromise = _loadAllSheetsInner().finally(()=>{ _sheetsLoadingPromise = null; });
  return _sheetsLoadingPromise;
}

async function _loadAllSheetsInner(){
  _setLoadOverlay(true,'캐시 확인 중...',0);

  // IndexedDB에서 각 정적 파일 개별 확인 (raw/pc/naver/google/daum — 매체별 연간 통합 CSV)
  const KEYS = ['raw','pc','naver','google','daum'];
  const cachedList = await Promise.all(KEYS.map(k=>_getCached(k,_TTL_DYNAMIC)));
  const cachedByKey = {};
  KEYS.forEach((k,i)=>cachedByKey[k]=cachedList[i]);

  // 캐시된 값이 빈 배열이면(네트워크 순간 오류 등으로 파싱 결과가 비어 저장된 경우) 유효한 캐시로 치지 않고 다시 받아온다 —
  // 안 그러면 그 날 하루 종일 빈 화면으로 고정되고 "데이터 새로고침"을 눌러야만 복구된다
  const needFetch = KEYS.filter(k=>!cachedByKey[k] || !cachedByKey[k].length).map(k=>[k,SHEETS_URLS[k],_TTL_DYNAMIC]);

  const fetched={};
  const failedKeys=[];
  if(needFetch.length){
    let done=0;
    _setLoadOverlay(true,`데이터 로드 중... (${needFetch.length}개)`,0);
    // 첫 시도가 실패하면 잠깐(2초) 쉬었다가 한 번 더 재시도한다
    const fetchWithRetry = (key, url) =>
      _fetchWithTimeout(url,20000).then(r=>r.text()).catch(async err=>{
        console.warn(`[adtool] ${key} 1차 실패, 2초 후 재시도`, err);
        await new Promise(r=>setTimeout(r,2000));
        return _fetchWithTimeout(url,20000).then(r=>r.text());
      });
    const results = await Promise.allSettled(needFetch.map(([key,url,ttl])=>
      fetchWithRetry(key,url).then(async t=>{
        const parsed=_pCSV(t);
        fetched[key]=parsed;
        // 빈 배열은 캐시에 저장하지 않는다 — 그대로 저장하면 다음 방문 때도 "유효한 캐시"로 보여 계속 빈 화면이 된다
        if(parsed.length) await _setCached(key,parsed);
        done++;
        _setLoadOverlay(true,`${key} 완료 (${done}/${needFetch.length})`,done/needFetch.length);
      }).catch(err=>{
        done++;
        _setLoadOverlay(true,`${key} 실패 (${done}/${needFetch.length})`,done/needFetch.length);
        throw {key,err};
      })
    ));
    for(const r of results){
      if(r.status==='rejected'){
        const {key,err} = r.reason;
        failedKeys.push(key);
        console.warn(`[adtool] 데이터 로드 실패: ${key}`, err);
        // 실패한 파일은 만료됐더라도 예전 캐시가 있으면 그거라도 써서 화면이 완전히 비지 않게 한다
        const stale = await _idbGet(key);
        if(stale) fetched[key] = stale.data;
      }
    }
  }
  _showSheetLoadWarning(failedKeys.map(k=>SHEET_LABELS[k]||k));

  // 캐시값이 빈 배열이면(=needFetch에 포함돼 다시 받아온 경우) 그 빈 캐시 대신 새로 받은 값을 써야 한다
  const get=key=>(cachedByKey[key]&&cachedByKey[key].length ? cachedByKey[key] : fetched[key]) || [];

  _setLoadOverlay(true,'정리 중...',0.95);
  await new Promise(r=>setTimeout(r,10));

  _sheetsParsed={
    raw:    get('raw'),
    pc:     get('pc'),
    naver:  get('naver'),
    google: get('google'),
    daum:   get('daum'),
  };
  _setLoadOverlay(false);
  return _sheetsParsed;
}

function _getMonths(s){
  const ds=new Set();
  (s.pc||[]).forEach(r=>{const d=_normDS(r['일별']||'');if(d.length>=7)ds.add(d.substring(0,7));});
  return[...ds].filter(ym=>ym>='2026-01').sort().reverse().map(ym=>{const[y,mo]=ym.split('-');return`${y}년 ${parseInt(mo)}월`;});
}
// 월 선택 드롭다운 옆 ◀▶ 버튼 — 모든 월 선택 목록은 최신월이 앞(내림차순, "전체 월"이 있다면 그게 index 0)이라
// calendarDelta(+1=다음/최근 쪽, -1=이전/과거 쪽)를 실제로는 반대 방향 인덱스 이동으로 처리한다
function _stepMonthSelect(id, calendarDelta){
  const sel = document.getElementById(id);
  if(!sel || sel.options.length < 2) return;
  let idx = sel.selectedIndex; if(idx < 0) idx = 0;
  idx = Math.max(0, Math.min(sel.options.length - 1, idx - calendarDelta));
  if(idx === sel.selectedIndex) return;
  sel.selectedIndex = idx;
  sel.dispatchEvent(new Event('change'));
}
function _fillMonSels(months){
  ['month-select','month-select-all','month-select-kw'].forEach(id=>{
    const sel=document.getElementById(id);if(!sel)return;
    sel.innerHTML='';
    if(id==='month-select'||id==='month-select-kw'){
      const allOpt=document.createElement('option');allOpt.value='';allOpt.textContent='전체 월';sel.appendChild(allOpt);
    }
    months.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o);});
    if(months.length)sel.value=months[0];
  });
}

function _apiAnalyze(month,s){
  const pcR=_filterMon(s.pc,'일별',month);
  const rawR=_filterMon(s.raw,'상담등록일',month).filter(r=>r['광고매체']==='파워컨텐츠');
  const adG={},adRaw={};
  pcR.forEach(r=>{
    const g=(r['광고그룹']||'').trim();if(!g)return;
    const cost=Math.round(_cN(r['총비용'])),clk=Math.round(_cN(r['클릭수'])),imp=Math.round(_cN(r['노출수']));
    const rank=_cN(r['평균노출순위']),date=_normDK(r['일별']||'');
    const keyword=(r['키워드']||'').trim();
    if(!adG[g])adG[g]={cost:0,clicks:0,impressions:0,rS:0,rIS:0};
    adG[g].cost+=cost;adG[g].clicks+=clk;adG[g].impressions+=imp;
    if(rank>0&&imp>0){adG[g].rS+=rank*imp;adG[g].rIS+=imp;}
    if(!adRaw[g])adRaw[g]=[];adRaw[g].push({date,cost,clicks:clk,impressions:imp,rank,keyword});
  });
  const sIT={},sITD={};
  rawR.forEach(r=>{
    const it=(r['인타입']||'').trim();if(!it||it==='0')return;
    const dbn=_dbCount(r),cnt=Math.round(_cN(r['계약수'])),perf=_cN(r['평가업적']);
    const cC=Math.round(_cN(r['계약수(누적)'])),pC=_cN(r['평가업적(누적)']);
    const dt=_normDK(r['상담등록일']||'');
    if(!sIT[it])sIT[it]={db:0,contracts:0,performance:0,contracts_cum:0,performance_cum:0};
    sIT[it].db+=dbn;sIT[it].contracts+=cnt;sIT[it].performance+=perf;sIT[it].contracts_cum+=cC;sIT[it].performance_cum+=pC;
    if(!sITD[it])sITD[it]={};if(!sITD[it][dt])sITD[it][dt]={db:0,contracts:0,performance:0,contracts_cum:0,performance_cum:0};
    sITD[it][dt].db+=dbn;sITD[it][dt].contracts+=cnt;sITD[it][dt].performance+=perf;sITD[it][dt].contracts_cum+=cC;sITD[it][dt].performance_cum+=pC;
  });
  const res=[];
  for(const[g,ad]of Object.entries(adG)){
    const it=INTYPE_MAP[g],sv=sIT[it]||{db:0,contracts:0,performance:0,contracts_cum:0,performance_cum:0};
    const camp=GROUP_TO_CAMP[g]||'',meta=CAMP_META[camp]||{cat:'기타',media:g.endsWith('_PC')?'PC':'모바일'};
    res.push({
      group:g,intype:it||'-',cost:ad.cost,clicks:ad.clicks,impressions:ad.impressions,
      db:sv.db,contracts:sv.contracts,performance:Math.round(sv.performance),
      contracts_cum:sv.contracts_cum||0,performance_cum:Math.round(sv.performance_cum||0),
      roas:(ad.cost>0&&sv.performance>0)?Math.round(ad.cost/sv.performance*100):null,
      cpc:ad.clicks>0?Math.round(ad.cost/ad.clicks):null,
      cpd:sv.db>0?Math.round(ad.cost/sv.db):null,
      cvr:sv.db>0?Math.round(sv.contracts/sv.db*1000)/10:null,
      dbcvr:ad.clicks>0?Math.round(sv.db/ad.clicks*1000)/10:null,
      avg_rank:ad.rIS>0?Math.round(ad.rS/ad.rIS*10)/10:null,
      rank_sum:ad.rS,rank_imp_sum:ad.rIS,camp,cat:meta.cat,media:meta.media,
      daily_raw:adRaw[g]||[],daily_sales_map:sITD[it]||{},is_unmapped:false
    });
  }
  // CRM에 DB는 있는데 이번 달 광고그룹 표에 안 잡힌 인타입 코드 — 그냥 두면 DB가 소리없이 누락된다.
  // (1) 그룹은 매핑돼 있지만 이번 달 광고비 집행이 없어 adG에 없는 경우 → 그 그룹 이름으로, 광고비 0으로 노출
  // (2) 아예 어떤 그룹에도 매핑 안 된 코드 → "(미매핑) 코드" 그룹으로 노출 (구글시트에 누락/오타 찾아 넣을 수 있게)
  const codeToGroup = {};
  Object.entries(INTYPE_MAP).forEach(([g,it])=>{ if(it) codeToGroup[it]=g; });
  Object.keys(sIT).forEach(it=>{
    const owningGroup = codeToGroup[it];
    if(owningGroup && adG[owningGroup]) return; // 이미 광고비 데이터와 함께 위에서 처리됨
    const sv = sIT[it];
    const group = owningGroup || `(미매핑) ${it}`;
    const camp = owningGroup ? (GROUP_TO_CAMP[owningGroup]||'') : '';
    const meta = owningGroup ? (CAMP_META[camp]||{cat:'기타',media:owningGroup.endsWith('_PC')?'PC':'모바일'}) : {cat:'기타',media:'모바일'};
    res.push({
      group,intype:it,cost:0,clicks:0,impressions:0,
      db:sv.db,contracts:sv.contracts,performance:Math.round(sv.performance),
      contracts_cum:sv.contracts_cum||0,performance_cum:Math.round(sv.performance_cum||0),
      roas:null,cpc:null,cpd:null,
      cvr:sv.db>0?Math.round(sv.contracts/sv.db*1000)/10:null,
      dbcvr:null,avg_rank:null,rank_sum:0,rank_imp_sum:0,
      camp,cat:meta.cat,media:meta.media,
      daily_raw:[],daily_sales_map:sITD[it]||{},is_unmapped:!owningGroup
    });
  });
  res.sort((a,b)=>(a.db===0?1:-1)-(b.db===0?1:-1)||b.db-a.db);
  return{result:res,ad_file:'파워컨텐츠 정적파일',sales_file:'RAW DB 정적파일',ad_count:pcR.length,sales_count:rawR.length};
}

function _apiCrm(month,s){
  const rawR=month?_filterMon(s.raw,'상담등록일',month):s.raw;
  const nR=(month?_filterMon(s.naver,'일별',month):s.naver).filter(r=>!(r['캠페인']||'').includes('브랜드검색'));
  const gR=(month?_filterMon(s.google,'일',month):s.google).filter(r=>(r['캠페인 유형']||'')!=='디스플레이'&&(r['캠페인 유형']||'')!=='실적 최대화');
  const dR=month?_filterMon(s.daum,'시작일',month):s.daum;
  const dm={},ms=new Set();
  rawR.forEach(r=>{
    const dr=r['상담등록일']||'',med=r['광고매체세부']||'';if(!dr||!med)return;
    const dk=_normDK(dr),dbn=_dbCount(r),cnt=Math.round(_cN(r['계약수'])),perf=_cN(r['평가업적']);
    const cC=Math.round(_cN(r['계약수(누적)'])),pC=_cN(r['평가업적(누적)']);
    ms.add(med);if(!dm[dk])dm[dk]={};if(!dm[dk][med])dm[dk][med]={db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0};
    const x=dm[dk][med];x.db+=dbn;x.contracts+=cnt;x.perf+=perf;x.contracts_cum+=cC;x.perf_cum+=pC;
  });
  const kdc={};
  const addC=(ds,mk,cost)=>{const k=_normDK(_normDS(ds));if(!kdc[k])kdc[k]={naver:0,google:0,daum:0};kdc[k][mk]=(kdc[k][mk]||0)+cost;};
  nR.forEach(r=>addC(r['일별']||'','naver',Math.round(_cN(r['총비용']))));
  gR.forEach(r=>addC(r['일']||'','google',Math.round(_cN(r['비용'])*1.1)));
  dR.forEach(r=>addC(r['시작일']||'','daum',Math.round(_cN(r['비용'])*1.1)));
  return{crm_data:dm,media_list:[...ms].sort(),kw_daily_cost:kdc,file:'구글시트'};
}

function _apiKeyword(month,s){
  const nR=(month?_filterMon(s.naver,'일별',month):s.naver).filter(r=>!(r['캠페인']||'').includes('브랜드검색'));
  const gR=(month?_filterMon(s.google,'일',month):s.google).filter(r=>(r['캠페인 유형']||'')!=='디스플레이'&&(r['캠페인 유형']||'')!=='실적 최대화');
  const dR=month?_filterMon(s.daum,'시작일',month):s.daum;
  const rawR=(month?_filterMon(s.raw,'상담등록일',month):s.raw).filter(r=>r['광고매체']==='키워드');
  const MOB=/^https?:\/\/m\./i,UKW=/바로가기|웹문서|즐겨찾기|미확인/i;
  const c2c={};for(const[code,cat]of Object.entries(CAMP_CAT_MAP))c2c[cat]=code;
  const exC=n=>{const m=n.match(/_C(\d+)/);return m?`C${m[1]}`:null;};
  const guC=n=>{const c=n.toLowerCase();
    if(c.includes('실비'))return'C02';if(c.includes('암'))return'C03';if(c.includes('치아'))return'C04';
    if(c.includes('어린이'))return'C06';if(c.includes('운전'))return'C09';if(c.includes('보장'))return'C16';return'C01';
  };
  const rm={};
  nR.forEach(r=>{
    const kw=r['키워드']||'',dev=r['PC/모바일 매체']||'',dt=r['일별']||'';
    const cost=Math.round(_cN(r['총비용'])),clk=Math.round(_cN(r['클릭수'])),imp=Math.round(_cN(r['노출수']));
    if(!kw)return;const device=dev==='모바일'?'모바일':'PC',key=`${kw}||네이버||${device}`;
    if(!rm[key])rm[key]={keyword:kw,intype:'',sub_media:'네이버',device,cat:'기타',db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0,daily:{},cost:0,clicks:0,impressions:0,intype_detail:{}};
    rm[key].cost+=cost;rm[key].clicks+=clk;rm[key].impressions+=imp;
    const dk=_normDK(dt);
    if(!rm[key].daily[dk])rm[key].daily[dk]={cost:0,clicks:0,impressions:0,db:0,contracts:0,perf:0};
    rm[key].daily[dk].cost+=cost;rm[key].daily[dk].clicks+=clk;rm[key].daily[dk].impressions+=imp;
  });
  const addAd=(rows,mName,dCol,cCol,tax)=>{
    rows.forEach(r=>{
      const camp=r[cCol]||'',dev=r['기기']||r['디바이스']||'',dt=r[dCol]||'';
      const raw=_cN(r['비용']||r['총비용']);
      const cost=Math.round(tax?raw*1.1:raw),clk=Math.round(_cN(r['클릭수'])),imp=Math.round(_cN(r['노출수']));
      const device=['휴대전화','태블릿','모바일'].includes(dev)?'모바일':'PC';
      const code=exC(camp)||guC(camp),cat=CAMP_CAT_MAP[code]||'기타',key=`${code}||${mName}||${device}`;
      if(!rm[key])rm[key]={keyword:cat,intype:'',sub_media:mName,device,cat,db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0,daily:{},cost:0,clicks:0,impressions:0,intype_detail:{}};
      rm[key].cost+=cost;rm[key].clicks+=clk;rm[key].impressions+=imp;
      const dk=_normDK(dt);
      if(!rm[key].daily[dk])rm[key].daily[dk]={cost:0,clicks:0,impressions:0,db:0,contracts:0,perf:0};
      rm[key].daily[dk].cost+=cost;rm[key].daily[dk].clicks+=clk;rm[key].daily[dk].impressions+=imp;
    });
  };
  addAd(gR,'구글','일','캠페인',true);addAd(dR,'다음','시작일','캠페인',true);
  rawR.forEach(r=>{
    const sub=r['광고매체세부']||'',it=r['인타입']||'',site=r['SITE_URL']||'',kw=r['키워드']||'';
    const dbn=_dbCount(r),cnt=Math.round(_cN(r['계약수'])),perf=_cN(r['평가업적']);
    const cC=Math.round(_cN(r['계약수(누적)'])),pC=_cN(r['평가업적(누적)']);
    const dm=r['상담등록일']||'';const mm=dm.match(/(\d{4})-(\d{2})-(\d{2})/);if(!mm)return;
    const dk=`${mm[1]}.${mm[2]}.${mm[3]}.`;
    if(it.startsWith('GKDA_'))return;
    const device=MOB.test(site)?'모바일':'PC',kwM=KW_INTYPE_MAP[it]||{},cat=kwM.cat||'기타';
    let key,kwLabel;
    if(sub==='네이버'){kwLabel=(!kw||UKW.test(kw))?'미매핑':kw;key=`${kwLabel}||네이버||${device}`;}
    else{const code=c2c[cat]||'';key=`${code}||${sub}||${device}`;}
    if(!rm[key])rm[key]={keyword:sub==='네이버'?kwLabel:cat,intype:it,sub_media:sub,device,cat,db:0,contracts:0,perf:0,contracts_cum:0,perf_cum:0,daily:{},cost:null,clicks:null,impressions:null,intype_detail:{}};
    const x=rm[key];x.db+=dbn;x.contracts+=cnt;x.perf+=perf;x.contracts_cum+=cC;x.perf_cum+=pC;
    if(!x.daily[dk])x.daily[dk]={cost:0,clicks:0,impressions:0,db:0,contracts:0,perf:0};
    x.daily[dk].db+=dbn;x.daily[dk].contracts+=cnt;x.daily[dk].perf+=perf;
    if(sub!=='네이버'){
      const id=x.intype_detail;if(!id[it])id[it]={intype:it,cat,db:0,contracts:0,perf:0,daily:{}};
      id[it].db+=dbn;id[it].contracts+=cnt;id[it].perf+=perf;
      if(!id[it].daily[dk])id[it].daily[dk]={db:0,contracts:0,perf:0};
      id[it].daily[dk].db+=dbn;id[it].daily[dk].contracts+=cnt;id[it].daily[dk].perf+=perf;
    }
  });
  const res=Object.values(rm).map(r=>{
    const cvr=r.db>0?Math.round(r.contracts/r.db*1000)/10:null;
    const cpd=r.cost&&r.db>0?Math.round(r.cost/r.db):null;
    const roas=r.cost&&r.perf>0?Math.round(r.cost/r.perf*100):null;
    const il=Object.values(r.intype_detail).map(d=>{
      return{intype:d.intype,cat:d.cat,db:d.db,contracts:d.contracts,perf:Math.round(d.perf),
        cvr:d.db>0?Math.round(d.contracts/d.db*1000)/10:null,daily:d.daily};
    }).sort((a,b)=>b.db-a.db);
    return{intype:r.intype,keyword:r.keyword,sub_media:r.sub_media,device:r.device,cat:r.cat,
      db:r.db,contracts:r.contracts,perf:Math.round(r.perf),contracts_cum:r.contracts_cum||0,perf_cum:Math.round(r.perf_cum||0),
      cvr,cost:r.cost,clicks:r.clicks,impressions:r.impressions,cpd,roas,daily:r.daily,intype_detail:il};
  });
  res.sort((a,b)=>(a.db===0?1:-1)-(b.db===0?1:-1)||b.db-a.db);
  return{result:res,file:'구글시트',count:res.length};
}

// ===== 전역 상태 =====
let adData=[], salesData=[], resultData=[], filteredData=[];
let sortCol='roas', sortAsc=false;
let activeMedia='all', activeCat='all', alertCat='all';

// ===== 파일 업로드 =====

function setStatus(msg,cls){
  // 상태 메시지는 콘솔로만 (UI에서 숨김)
  if(msg) console.log('[adtool]', msg);
}

// ===== 서버 API 연동 (Google Sheets 기반) =====
async function loadMonths(){
  try{
    const s = await loadAllSheets();
    _fillMonSels(_getMonths(s));
  }catch(e){ console.error('월 목록 로드 실패', e); }
  return true;
}

function onMonthChange(){
  document.getElementById('file-info').textContent = '';
  runAnalysis();
}

async function saveSnapshot(){
  alert('웹 버전에서는 저장 기능을 사용할 수 없습니다.');
}

loadMonths().then(async ()=>{
  const month = document.getElementById('month-select-all')?.value || '';
  setStatus('데이터 로드 중...','');
  try{
    const [s] = await Promise.all([loadAllSheets(), _ensureIntypeMapLoaded()]);
    const [adData, kwRes, crmRes] = await Promise.all([
      Promise.resolve(_apiAnalyze(month, s)),
      Promise.resolve(_apiKeyword(month, s)),
      Promise.resolve(_apiCrm(month, s)),
    ]);
    if(!adData.error){
      resultData = adData.result;
      document.getElementById('file-info').textContent =
        `📁 광고비: ${adData.ad_file} (${adData.ad_count}행) · 매출: ${adData.sales_file} (${adData.sales_count}행)`;
      filteredData=[...resultData];
      renderMetrics(filteredData);
      renderTable();
      renderAlertBoard();
      document.getElementById('results').classList.add('show');
    }
    if(!kwRes.error){ kwData = kwRes.result || []; }
    CRM_DATA       = crmRes.crm_data  || {};
    CRM_MEDIA_LIST = crmRes.media_list || [];
    KW_DAILY_COST  = crmRes.kw_daily_cost || {};
    setStatus(`분석 완료 — 광고그룹 ${resultData.length}개`,'ok');
    if(_currentMediaGroup === 'all') _initDailyTabCore();
  }catch(e){ setStatus('데이터 로드 실패: '+e.message,'err'); console.error(e); }
});

// ===== 분석 실행 =====
function getCampInfo(group){
  const camp = GROUP_TO_CAMP[group] || '';
  const meta = CAMP_META[camp] || {cat:'기타', media:group.endsWith('_PC')?'PC':'모바일'};
  return {camp, ...meta};
}

function runAnalysis(){
  setStatus('데이터 로드 중...','');
  const monthAll = document.getElementById('month-select-all');
  const monthPc  = document.getElementById('month-select');
  const monthKw  = document.getElementById('month-select-kw');
  const month = (_currentMediaGroup === 'keyword')
    ? (monthKw?.value || '')
    : (_currentMediaGroup === 'all')
    ? (monthAll?.value || '')
    : (monthPc?.value || '');

  loadAllSheets().then(async s=>{
    await _ensureIntypeMapLoaded();
    if(_currentMediaGroup === 'keyword'){
      const [data, crmRes] = await Promise.all([
        Promise.resolve(_apiKeyword(month, s)),
        Promise.resolve(_apiCrm(month, s)),
      ]);
      if(data.error){ setStatus('오류: '+data.error,'err'); return; }
      kwData = data.result || [];
      CRM_DATA=crmRes.crm_data||{};CRM_MEDIA_LIST=crmRes.media_list||[];KW_DAILY_COST=crmRes.kw_daily_cost||{};
      kwRendered = false; kwPage = 1;
      setStatus(`로드 완료 — ${kwData.length}개 키워드`,'ok');
      const activeKwTab = document.querySelector('#subtabs-kw .main-tab.active');
      const kwTabName = activeKwTab ? activeKwTab.getAttribute('onclick').match(/'([\w-]+)'/)?.[1] : 'kw-main';
      if(kwTabName === 'kw-insight') renderKwInsight();
      else renderKwTable();
      return;
    }
    if(_currentMediaGroup === 'all'){
      const [crmRes, adData, kwRes] = await Promise.all([
        Promise.resolve(_apiCrm(month, s)),
        Promise.resolve(_apiAnalyze(month, s)),
        Promise.resolve(_apiKeyword(month, s)),
      ]);
      if(adData && !adData.error){
        resultData=adData.result; filteredData=[...resultData];
        document.getElementById('file-info').textContent=`📁 광고비: ${adData.ad_file} (${adData.ad_count}행) · 매출: ${adData.sales_file} (${adData.sales_count}행)`;
      }
      if(kwRes && !kwRes.error){ kwData = kwRes.result || []; }
      CRM_DATA=crmRes.crm_data||{};CRM_MEDIA_LIST=crmRes.media_list||[];KW_DAILY_COST=crmRes.kw_daily_cost||{};
      initDailyTab(); setStatus('로드 완료','ok');
      return;
    }
    const activeTab = document.querySelector('#subtabs-pc .main-tab.active');
    const activeTabName = activeTab ? activeTab.getAttribute('onclick').match(/'(\w+)'/)?.[1] : 'insight';
    const pcMonth = ['alert','data'].includes(activeTabName) ? (monthPc?.value || '') : '';
    const [data, crmRes] = await Promise.all([
      Promise.resolve(_apiAnalyze(pcMonth, s)),
      Promise.resolve(_apiCrm(pcMonth, s)),
    ]);
    if(data.error){ setStatus('오류: '+data.error,'err'); return; }
    resultData=data.result;
    document.getElementById('file-info').textContent=`📁 광고비: ${data.ad_file} (${data.ad_count}행) · 매출: ${data.sales_file} (${data.sales_count}행)`;
    filteredData=[...resultData];
    CRM_DATA=crmRes.crm_data||{};CRM_MEDIA_LIST=crmRes.media_list||[];KW_DAILY_COST=crmRes.kw_daily_cost||{};
    renderMetrics(filteredData);renderTable();renderAlertBoard();initDailyTab();
    document.getElementById('results').classList.add('show');
    setStatus(`분석 완료 — 광고그룹 ${resultData.length}개`,'ok');
  }).catch(e=>setStatus('데이터 로드 실패: '+e.message,'err'));
}

// ===== 요약 지표 =====
// ===== 영업 성과 비교 카드 (당월 vs 누적) =====
// 계약수/계약률/평가업적/ROAS의 당월·누적 값을 계산 — KPI카드 하나에 "당월 / 누적"으로 같이 보여주기 위함
// (예전엔 KPI카드 아래에 별도 당월/누적 비교 블록을 또 그렸는데, 카드 하나로 합침)
function _calcMonCum(data){
  const mCon  = data.reduce((s,r)=>s+(r.contracts||0),0);
  const mPerf = data.reduce((s,r)=>s+(r.performance||0),0);
  const mDb   = data.reduce((s,r)=>s+(r.db||0),0);
  const mCost = data.reduce((s,r)=>s+(r.cost||0),0);
  const mCvr  = mDb>0 ? (mCon/mDb*100).toFixed(1) : null;
  const mRoas = mPerf>0 && mCost>0 ? Math.round(mCost/mPerf*100) : null;

  // 누적: contracts_cum / performance_cum 필드 (상담시스템에 칼럼 추가 전까지는 null 처리)
  const cCon  = data.reduce((s,r)=>s+(r.contracts_cum  ?? r.contracts  ?? 0),0);
  const cPerf = data.reduce((s,r)=>s+(r.performance_cum ?? r.performance ?? 0),0);
  const cDb   = data.reduce((s,r)=>s+(r.db_cum ?? r.db ?? 0),0);
  const hasCum = data.some(r=>r.contracts_cum!=null || r.performance_cum!=null);
  const cCvr  = cDb>0 ? (cCon/cDb*100).toFixed(1) : null;
  const cRoas = cPerf>0 && mCost>0 ? Math.round(mCost/cPerf*100) : null;

  return {mCon,mPerf,mDb,mCost,mCvr,mRoas,cCon,cPerf,cDb,hasCum,cCvr,cRoas};
}
// "당월 / 누적"으로 합쳐 보여줄 값 포맷 — 누적 데이터가 아직 없으면 당월 값만 보여준다
function _fmtMonCum(mVal, cVal, hasCum){
  const f = v => (v===null||v===undefined) ? '-' : (typeof v==='number'?v.toLocaleString():v);
  return hasCum ? `${f(mVal)} / ${f(cVal)}` : f(mVal);
}

// ===== KPI 카드 2.0: 당월 값을 큰 숫자로, 누적 값은 카드 하단 보조값으로 분리 표시 =====
// 카드 하나 = 라벨 + (당월)핵심 숫자 + 단위 + 누적/설명 보조줄. data-value가 있는 값만 카운트업 애니메이션 대상.
const _KPI_LAST = {};
function _kpiCard(containerId, idx, label, value, opts={}){
  const {unit='', decimals=0, color='default', sub='', subVal=null, subUnit=''} = opts;
  const key = `${containerId}#${idx}`;
  const hasVal = value!==null && value!==undefined && !Number.isNaN(value);
  const valueHtml = hasVal
    ? `<div class="kpi-value" data-key="${key}" data-value="${value}" data-decimals="${decimals}">0${unit?`<span class="kpi-unit">${unit}</span>`:''}</div>`
    : `<div class="kpi-value" data-key="${key}">-</div>`;
  const subText = (subVal!==null && subVal!==undefined)
    ? `누적 <strong>${(typeof subVal==='number'?subVal.toLocaleString():subVal)}${subUnit}</strong>`
    : sub;
  return `<div class="kpi-card kpi-${color}"><div class="kpi-label">${label}</div>${valueHtml}<div class="kpi-sub">${subText||''}</div></div>`;
}
// 카드 렌더 직후 호출 — 처음 보는 값이면 0→목표값 카운트업(약 820ms), 이전과 값이 같으면 즉시 표시(반복 재생 방지)
function _kpiFinish(containerId){
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 탭이 숨겨진 상태(display:none)에서 그려지면 카운트업이 화면 밖에서 끝나버려 사용자가 못 본다 —
  // 화면에 보일 때만 "이미 본 값"으로 기록해서, 실제로 탭을 열었을 때 애니메이션이 재생되게 한다
  const container = document.getElementById(containerId);
  const visible = !!(container && container.offsetParent !== null);
  document.querySelectorAll(`#${containerId} .kpi-value[data-value]`).forEach(el=>{
    const key = el.dataset.key;
    const target = Number(el.dataset.value);
    const decimals = Number(el.dataset.decimals||0);
    const unitEl = el.querySelector('.kpi-unit');
    const unitHtml = unitEl ? unitEl.outerHTML : '';
    const fmt = v => new Intl.NumberFormat('ko-KR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(v)+unitHtml;
    const digits = String(Math.round(Math.abs(target))).length;
    el.classList.toggle('long', digits>=6);
    const prev = _KPI_LAST[key];
    if(visible) _KPI_LAST[key] = target;
    if(reduceMotion || !visible || prev===target){ el.innerHTML = fmt(target); return; }
    const start = performance.now(), duration = 820;
    el.innerHTML = fmt(0);
    function tick(now){
      const p = Math.min((now-start)/duration,1), e = 1-Math.pow(1-p,4);
      el.innerHTML = fmt(target*e);
      if(p<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function renderMetrics(data){
  const tc=data.reduce((a,r)=>a+r.cost,0);
  const td=data.reduce((a,r)=>a+r.db,0);
  const tcpd=td>0?Math.round(tc/td):null;
  // 전체 평균순위: 노출수 가중평균
  const totalRankSum=data.reduce((a,r)=>a+((r.rank_sum ?? r.rankSum ?? 0)),0);
  const totalImpSum=data.reduce((a,r)=>a+((r.rank_imp_sum ?? r.rankImpSum ?? 0)),0);
  const avgRank=totalImpSum>0?Math.round(totalRankSum/totalImpSum*10)/10:null;
  const mc=_calcMonCum(data);
  const cid='metrics';
  document.getElementById(cid).innerHTML = [
    _kpiCard(cid,0,'총 광고비', tc>0?tc:null, {unit:'원', color:'default', sub:'당월 집행 기준'}),
    _kpiCard(cid,1,'총 DB수', td, {unit:'건', color:'accent', sub:'전체 채널 합계'}),
    _kpiCard(cid,2,'DB단가', tcpd, {unit:'원', color:'purple', sub:'광고비 ÷ DB수'}),
    _kpiCard(cid,3,'계약수', mc.mCon, {unit:'건', color:'green', subVal:mc.hasCum?mc.cCon:null, subUnit:'건'}),
    _kpiCard(cid,4,'계약률', mc.mCvr!==null?Number(mc.mCvr):null, {unit:'%', decimals:1, color:'green', subVal:(mc.hasCum&&mc.cCvr!==null)?Number(mc.cCvr):null, subUnit:'%'}),
    _kpiCard(cid,5,'평가업적', mc.mPerf>0?Math.round(mc.mPerf):null, {unit:'원', color:'amber', subVal:(mc.hasCum&&mc.cPerf>0)?Math.round(mc.cPerf):null, subUnit:'원'}),
    _kpiCard(cid,6,'ROAS', mc.mRoas, {unit:'%', color:'amber', subVal:mc.hasCum?mc.cRoas:null, subUnit:'%'}),
    _kpiCard(cid,7,'전체 평균순위', avgRank, {unit:'위', decimals:1, color:'accent', sub:'낮을수록 상위 노출'}),
  ].join('');
  _kpiFinish(cid);
}

// ===== 테이블 =====
const COLS=[
  {key:'group',label:'광고그룹',cls:'group-name'},
  {key:'intype',label:'인타입',cls:'intype-cell'},
  {key:'cost',label:'광고비(원)',cls:'num',fmt:v=>v.toLocaleString()},
  {key:'impressions',label:'노출수',cls:'num',fmt:v=>(v||0).toLocaleString()},
  {key:'clicks',label:'클릭수',cls:'num',fmt:v=>v.toLocaleString()},
  {key:'cpc',label:'평균CPC',cls:'num',fmt:v=>v===null?'-':v.toLocaleString()},
  {key:'db',label:'DB수',cls:'num',fmt:v=>v.toLocaleString()},
  {key:'cpd',label:'DB단가(원)',cls:'num',fmt:v=>v===null?'-':v.toLocaleString()},
  {key:'dbcvr',label:'DB전환율(%)',cls:'num',fmt:v=>v===null?'-':v+'%'},
  {key:'contracts',label:'계약수',cls:'num',fmt:v=>v.toLocaleString()},
  {key:'cvr',label:'계약률(%)',cls:'num',fmt:v=>v===null?'-':v+'%'},
  {key:'performance',label:'평가업적(원)',cls:'num',fmt:v=>v.toLocaleString()},
  {key:'roas',label:'ROAS(%)',cls:'num',special:'roas'},
  {key:'avg_rank',label:'평균순위',cls:'num',fmt:v=>(v===null||v===undefined)?'-':v+'위'},
];

function roasBadge(v){
  if(v===null) return '<span class="badge na">미매칭</span>';
  // 낮을수록 좋음: <=300% 고효율, <=1000% 중간, >1000% 저효율
  const cls=v<=300?'high':v<=1000?'mid':'low';
  return`<span class="badge ${cls}">${v.toLocaleString()}%</span>`;
}

// ===== 데이터현황 표시 단위 (캠페인별 / 광고그룹별 / 키워드별) =====
// 광고그룹명이 곧 키워드다 — 모바일은 "01_실비보험", PC는 "실비보험_PC" 형태라 접두 숫자와
// _PC 접미사를 떼면 같은 키워드로 합쳐진다(603그룹 → 414키워드). 캠페인/키워드 모두 결국
// 광고그룹을 합치는 것이므로 DB·계약수·평가업적이 그대로 따라온다.
let _pcViewMode = 'group';
const PC_VIEW_LABELS = {campaign:'캠페인', group:'광고그룹', keyword:'키워드'};
function _pcNormKeyword(group){
  return String(group||'').replace(/^\d+_/,'').replace(/_PC$/,'');
}
// 캠페인명에서 앞뒤 표기와 끝의 "보험"까지 떼어 카테고리만 남긴다
// ("1. 암보험_M_C03" / "1. 암보험_PC_C03" → "암"). 단 "보험" 자체는 떼면 빈 값이 되므로 그대로 둔다.
function _pcNormCat(camp){
  const base = String(camp||'').replace(/^\d+\.\s*/,'').replace(/_(M|PC|모바일)_C\d+$/,'');
  return base.replace(/보험$/,'') || base;
}
function _pcRollup(rows, mode){
  if(mode==='group') return rows;
  const agg={};
  rows.forEach(r=>{
    const name = mode==='campaign' ? (r.camp||'(미매핑)') : _pcNormKeyword(r.group);
    if(!agg[name]) agg[name]={
      group:name, cost:0, clicks:0, impressions:0, db:0, contracts:0, performance:0,
      contracts_cum:0, performance_cum:0, rank_sum:0, rank_imp_sum:0,
      cat:r.cat, media:r.media, camp:r.camp, members:[], is_unmapped:false
    };
    const a=agg[name];
    a.cost+=r.cost||0; a.clicks+=r.clicks||0; a.impressions+=r.impressions||0;
    a.db+=r.db||0; a.contracts+=r.contracts||0; a.performance+=r.performance||0;
    a.contracts_cum+=r.contracts_cum||0; a.performance_cum+=r.performance_cum||0;
    a.rank_sum+=r.rank_sum||0; a.rank_imp_sum+=r.rank_imp_sum||0;
    if(a.media && a.media!==r.media) a.media='전체';
    a.members.push(r);
  });
  return Object.values(agg).map(a=>({...a,
    // 광고비가 없는 그룹은 캠페인이 비어 있으므로 걸러낸다 (같은 키워드의 PC/모바일은 같은 카테고리로 합쳐짐)
    catNorm: (()=>{ const c=[...new Set(a.members.map(m=>_pcNormCat(m.camp)).filter(Boolean))]; return c.length?c.join(' / '):'-'; })(),
    intype: a.members.length,
    cpc: a.clicks>0 ? Math.round(a.cost/a.clicks) : null,
    cpd: a.db>0 ? Math.round(a.cost/a.db) : null,
    cvr: a.db>0 ? Math.round(a.contracts/a.db*1000)/10 : null,
    dbcvr: a.clicks>0 ? Math.round(a.db/a.clicks*1000)/10 : null,
    roas: (a.cost>0 && a.performance>0) ? Math.round(a.cost/a.performance*100) : null,
    avg_rank: a.rank_imp_sum>0 ? Math.round(a.rank_sum/a.rank_imp_sum*10)/10 : null,
  }));
}
// 첫 두 칼럼(이름 / 인타입·그룹수)만 표시 단위에 따라 바뀌고 나머지 지표 칼럼은 공통
function _pcCols(){
  const first={key:'group', label:PC_VIEW_LABELS[_pcViewMode], cls:'group-name'};
  let second;
  if(_pcViewMode==='group')        second={key:'intype', label:'인타입', cls:'intype-cell'};
  else if(_pcViewMode==='keyword') second={key:'catNorm', label:'카테고리'};
  else                             second={key:'intype', label:'그룹수', cls:'num', fmt:v=>(v||0).toLocaleString()+'개'};
  return [first, second, ...COLS.slice(2)];
}
function setPcViewMode(mode, btn){
  _pcViewMode = mode;
  document.querySelectorAll('#pc-view-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const isGroup = mode==='group';
  // 광고그룹 고유 속성에만 의미가 있는 필터는 다른 단위에서 숨긴다
  ['data-key-btn','data-renewal-btn','pc-key-legend'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display = isGroup ? '' : 'none';
  });
  const titleEl=document.getElementById('pc-table-title');
  if(titleEl) titleEl.innerHTML = `${PC_VIEW_LABELS[mode]}별 성과 <span style="font-size:11px;font-weight:400;color:var(--faint)">(행 클릭 → ${isGroup?'일별 상세':'포함된 광고그룹'})</span>`;
  const searchEl=document.getElementById('search-input');
  if(searchEl) searchEl.placeholder = isGroup ? '광고그룹 / 인타입...' : `${PC_VIEW_LABELS[mode]} 검색...`;
  if(sortCol==='intype'||sortCol==='catNorm') sortCol='cost';
  applyFilter();
}

function applyFilter(){
  const q=document.getElementById('search-input').value.toLowerCase();
  const rf=document.getElementById('roas-filter').value;
  const cf=document.getElementById('cpd-filter').value;
  const isGroup = _pcViewMode==='group';
  // 1) 기기/보종/주요그룹/교체임박은 광고그룹 고유 속성이라 합치기 전에 먼저 거른다
  const base = resultData.filter(r=>{
    const {cat, media} = getCampInfo(r.group);
    const mm = activeMedia==='all' || media===activeMedia;
    const mc = activeCat==='all' || cat===activeCat;
    const mk = !isGroup || !_keyFilterState['data'] || isKeyGroup(r.group, r.media);
    const mrw = !isGroup || !_renewalFilterActive || _isRenewalDue(r.group);
    return mm&&mc&&mk&&mrw;
  });
  // 2) 선택한 단위로 합친 뒤 3) 합쳐진 값 기준으로 검색/ROAS/DB단가를 거른다
  filteredData = _pcRollup(base, _pcViewMode).filter(r=>{
    const mq=!q||r.group.toLowerCase().includes(q)||String(r.intype??'').toLowerCase().includes(q)||String(r.catNorm??'').toLowerCase().includes(q);
    let mr=true;
    if(rf==='high') mr=r.roas!==null&&r.roas<=300;
    else if(rf==='mid') mr=r.roas!==null&&r.roas>300&&r.roas<=1000;
    else if(rf==='low') mr=r.roas!==null&&r.roas>1000;
    else if(rf==='na') mr=r.roas===null;
    let mcp = true;
    if(cf==='high') mcp = r.cpd!==null && r.cpd<=50000;
    else if(cf==='mid') mcp = r.cpd!==null && r.cpd>50000 && r.cpd<=100000;
    else if(cf==='low') mcp = r.cpd!==null && r.cpd>100000;
    else if(cf==='nodb') mcp = r.db>0;
    else if(cf==='na') mcp = r.cost>0 && r.db===0;
    return mq&&mr&&mcp;
  });
  renderTable();
}

let _renewalFilterActive = false;
function toggleRenewalFilter(){
  _renewalFilterActive = !_renewalFilterActive;
  const btn = document.getElementById('data-renewal-btn');
  if(btn){
    btn.style.background  = _renewalFilterActive ? '#FEE2E2' : 'var(--surface)';
    btn.style.borderColor = _renewalFilterActive ? '#dc2626' : 'var(--border)';
    btn.style.color       = _renewalFilterActive ? '#991B1B' : 'var(--muted)';
    btn.style.fontWeight  = _renewalFilterActive ? '700'     : 'normal';
  }
  applyFilter();
}

function setMediaFilter(val, btn){
  activeMedia = val;
  document.querySelectorAll('#media-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

function setCatFilter(val, btn){
  activeCat = val;
  document.querySelectorAll('#cat-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

// 계약수/계약률/평가업적/ROAS는 당월/누적 토글에 따라 다른 값을 보여준다 (KPI카드의 당월/누적 개념과 동일)
const PC_CUM_COLS = ['contracts','cvr','performance','roas'];
let _pcTableCumMode = false;

function setPcTableCumMode(cum, btn){
  _pcTableCumMode = cum;
  document.querySelectorAll('#pc-table-cum-toggle .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderTable();
}

function _pcCumVal(r, key){
  if(!_pcTableCumMode) return r[key];
  const contracts = r.contracts_cum ?? r.contracts ?? 0;
  const performance = r.performance_cum ?? r.performance ?? 0;
  if(key==='contracts') return contracts;
  if(key==='performance') return performance;
  if(key==='cvr') return r.db>0 ? Math.round(contracts/r.db*1000)/10 : null;
  if(key==='roas') return (r.cost>0 && performance>0) ? Math.round(r.cost/performance*100) : null;
  return r[key];
}

function renderTable(){
  const sorted=[...filteredData].sort((a,b)=>{
    let av=PC_CUM_COLS.includes(sortCol)?_pcCumVal(a,sortCol):a[sortCol];
    let bv=PC_CUM_COLS.includes(sortCol)?_pcCumVal(b,sortCol):b[sortCol];
    if(av===null) av=sortAsc?Infinity:-Infinity;
    if(bv===null) bv=sortAsc?Infinity:-Infinity;
    if(typeof av==='string') return sortAsc?av.localeCompare(bv):bv.localeCompare(av);
    return sortAsc?av-bv:bv-av;
  });

  const cols = _pcCols();
  const isGroup = _pcViewMode==='group';
  _pcTableRows = sorted;

  document.getElementById('thead').innerHTML='<tr>'+cols.map(c=>{
    const arr=c.key===sortCol?(sortAsc?' ↑':' ↓'):'';
    const label = (_pcTableCumMode && PC_CUM_COLS.includes(c.key)) ? c.label+' ·누적' : c.label;
    return`<th class="${c.cls||''}" onclick="sortBy('${c.key}')">${label}${arr}</th>`;
  }).join('')+'</tr>';

  document.getElementById('tbody').innerHTML=sorted.map((r,i)=>{
    const isKey = isGroup && isKeyGroup(r.group, r.media);
    const unmapped = isGroup && (r.is_unmapped ?? r.isUnmapped ?? false);
    const rowStyle = unmapped ? 'background:#fff8f0;' : isKey ? 'background:#fffbeb;' : '';
    const click = isGroup ? `openDetail(${resultData.indexOf(r)})` : `openRollupDetail(${i})`;
    return`<tr class="clickable" style="${rowStyle}" onclick="${click}">`+
      cols.map(c=>{
        if(c.special==='roas') return`<td class="num">${roasBadge(_pcCumVal(r,'roas'))}</td>`;
        const v=PC_CUM_COLS.includes(c.key)?_pcCumVal(r,c.key):r[c.key];
        if(c.key==='group'){
          if(!isGroup) return`<td class="${c.cls||''}">${v??'-'}</td>`;
          const renewalBadge = _renewalBadge(r.group);
          if(unmapped)
            return`<td class="${c.cls||''}"><span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-weight:600">미매핑</span>${renewalBadge}</td>`;
          if(isKey)
            return`<td class="${c.cls||''}">${v??'-'} <span title="메인키워드 중요그룹">⭐</span>${renewalBadge}</td>`;
          return`<td class="${c.cls||''}">${v??'-'}${renewalBadge}</td>`;
        }
        return`<td class="${c.cls||''}">${c.fmt?c.fmt(v):(v??'-')}</td>`;
      }).join('')+'</tr>';
  }).join('');

  document.getElementById('row-count').textContent=`${sorted.length}개 항목`;
  renderMetrics(filteredData);
  // 일별 추이 차트는 광고그룹 단위 원본(daily_raw)이 있어야 그려진다 — 합쳐진 행은 소속 그룹으로 되돌려 넘긴다
  renderDataChart(isGroup ? filteredData : filteredData.flatMap(r=>r.members||[]));
}

// 캠페인별/키워드별 행 클릭 → 그 안에 묶인 광고그룹 목록 (각 행은 다시 일별 상세로 연결)
let _pcTableRows = [];
function openRollupDetail(i){
  const r = _pcTableRows[i];
  if(!r || !r.members) return;
  const members = [...r.members].sort((a,b)=>b.cost-a.cost);
  const num = (v,unit='') => (v===null||v===undefined) ? '-' : v.toLocaleString()+unit;
  const th = l => `<th style="padding:7px 10px;text-align:right;background:#f8fafc;border-bottom:1px solid var(--border);white-space:nowrap;position:sticky;top:0">${l}</th>`;
  const td = (v,extra='') => `<td style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border);white-space:nowrap;${extra}">${v}</td>`;
  document.getElementById('daily-group-modal-title').textContent = `${r.group} — 포함된 광고그룹 ${members.length}개`;
  document.getElementById('daily-group-modal-body').innerHTML = `
    <div class="modal-metrics" style="margin-bottom:1rem">
      <div class="modal-metric"><div class="label">광고비</div><div class="val">${num(r.cost)}<span style="font-size:12px">원</span></div></div>
      <div class="modal-metric"><div class="label">DB수 / 계약수</div><div class="val">${num(r.db)} / ${num(r.contracts)}</div></div>
      <div class="modal-metric"><div class="label">DB단가</div><div class="val">${num(r.cpd,'원')}</div></div>
      <div class="modal-metric"><div class="label">ROAS</div><div class="val" style="color:var(--amber)">${r.roas!==null?num(r.roas,'%'):'-'}</div></div>
    </div>
    <div style="font-size:11px;color:var(--faint);margin-bottom:6px">광고그룹을 클릭하면 일별 상세가 열립니다</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr>${['광고그룹','기기','인타입','광고비','클릭수','DB수','DB단가','계약수','ROAS'].map(th).join('')}</tr></thead>
      <tbody>${members.map(m=>{
        const idx = resultData.indexOf(m);
        return `<tr class="clickable" style="cursor:pointer" onclick="document.getElementById('daily-group-modal-bg').style.display='none';openDetail(${idx})">
          ${td(m.group,'text-align:left;font-weight:600')}${td(m.media||'-')}${td(`<span style="font-family:monospace;font-size:11px">${m.intype||'-'}</span>`)}
          ${td(num(m.cost,'원'))}${td(num(m.clicks))}${td(num(m.db))}${td(num(m.cpd,'원'))}${td(num(m.contracts))}${td(m.roas!==null?num(m.roas,'%'):'-')}
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  document.getElementById('daily-group-modal-bg').style.display = 'flex';
}

function sortBy(col){
  if(sortCol===col) sortAsc=!sortAsc;
  else{sortCol=col;sortAsc=false;}
  renderTable();
}

// ===== 일별 드릴다운 모달 =====
function openDetail(idx){
  const r=resultData[idx];
  document.getElementById('modal-title').textContent=`${r.group} — 일별 상세`;

  // 모달 요약
  document.getElementById('modal-metrics').innerHTML=`
    <div class="modal-metric"><div class="label">보종</div><div class="val" style="font-size:15px">${r.cat||'-'}</div></div>
    <div class="modal-metric"><div class="label">매체 / 인타입</div><div class="val" style="font-size:13px">${r.media||'-'} · <span style="font-family:monospace;font-size:12px">${r.intype}</span></div></div>
    <div class="modal-metric"><div class="label">총 광고비</div><div class="val">${r.cost.toLocaleString()}<span style="font-size:12px">원</span></div></div>
    <div class="modal-metric"><div class="label">DB수 / 계약수</div><div class="val">${r.db} / ${r.contracts}</div></div>
    <div class="modal-metric"><div class="label">ROAS</div><div class="val" style="color:var(--amber)">${r.roas!==null?r.roas.toLocaleString()+'%':'-'}</div></div>
    <div class="modal-metric"><div class="label">DB단가 / DB전환율</div><div class="val" style="font-size:14px">${r.cpd!==null?r.cpd.toLocaleString()+'원':'-'} / ${r.dbcvr!==null?r.dbcvr+'%':'-'}</div></div>
  `;

  // 소재 (그룹별 컨텐츠 주소 + 교체주기)
  const contentUrls = GROUP_CONTENT_URLS[r.group];
  const isValidUrl = u => u && u !== '#N/A';
  const blogUrl = contentUrls && isValidUrl(contentUrls.blog) ? contentUrls.blog : null;
  const landingUrl = contentUrls && isValidUrl(contentUrls.landing) ? contentUrls.landing : null;
  const adminUrl = contentUrls && contentUrls.groupId ? `https://ads.naver.com/manage/ad-accounts/2069889/sa/adgroups/${contentUrls.groupId}` : null;
  const renewalDot = _renewalBadge(r.group);
  const renewalText = contentUrls && contentUrls.renewalStatus
    ? (contentUrls.renewalStatus === 'normal' ? `정상 (D-${contentUrls.daysRemaining||'?'})`
      : /^due_\d+d$/.test(contentUrls.renewalStatus) ? `교체 임박 (D-${contentUrls.daysRemaining||'?'})`
      : contentUrls.renewalStatus)
    : null;
  const contentBody = document.getElementById('modal-content-links');
  if(blogUrl || landingUrl || adminUrl || renewalText){
    contentBody.innerHTML = `
      <div style="margin-bottom:.5rem;display:flex;align-items:center;gap:6px">
        <span style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">소재</span>
        ${renewalText?`${renewalDot}<span style="font-size:12px;color:var(--muted)">${renewalText}</span>`:''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${blogUrl?`<a href="${escHtml(blogUrl)}" target="_blank" rel="noopener" style="font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;color:var(--accent);text-decoration:none">📝 블로그</a>`:''}
        ${landingUrl?`<a href="${escHtml(landingUrl)}" target="_blank" rel="noopener" style="font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;color:var(--accent);text-decoration:none">🔗 랜딩</a>`:''}
        ${adminUrl?`<a href="${escHtml(adminUrl)}" target="_blank" rel="noopener" style="font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;color:var(--accent);text-decoration:none">⚙️ 광고그룹 관리</a>`:''}
      </div>`;
  } else {
    contentBody.innerHTML = '';
  }

  // 일별 광고비 테이블 — 광고그룹+날짜 기준 1행 (키워드별 raw 데이터를 날짜 기준으로 합산)
  const daily=(r.daily_raw || r.dailyRaw || []);
  if(!daily.length){
    document.getElementById('modal-thead').innerHTML='';
    document.getElementById('modal-tbody').innerHTML='<tr><td style="padding:1rem;color:var(--faint)">일별 데이터 없음</td></tr>';
  } else {
    document.getElementById('modal-thead').innerHTML=`<tr>
      <th></th>
      <th>날짜</th>
      <th class="num">광고비(원)</th>
      <th class="num">클릭수</th>
      <th class="num">노출수</th>
      <th class="num">CTR(%)</th>
      <th class="num">CPC(원)</th>
      <th class="num">DB수</th>
      <th class="num">계약수</th>
      <th class="num">평가업적(원)</th>
      <th class="num">ROAS(%)</th>
      <th class="num">DB단가(원)</th>
      <th class="num">DB전환율(%)</th>
      <th class="num">계약률(%)</th>
      <th class="num">평균순위</th>
    </tr>`;

    // 키워드별 raw 행 → 날짜 기준으로 광고비/클릭수/노출수/순위 합산 (DB 데이터 중복 방지)
    const byDate = {};
    daily.forEach(d=>{
      if(!byDate[d.date]) byDate[d.date]={date:d.date,cost:0,clicks:0,impressions:0,rS:0,rIS:0,kws:[]};
      const g=byDate[d.date];
      g.cost+=d.cost||0; g.clicks+=d.clicks||0; g.impressions+=d.impressions||0;
      if(d.rank>0 && d.impressions>0){ g.rS+=d.rank*d.impressions; g.rIS+=d.impressions; }
      g.kws.push(d);
    });
    const sorted=Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date));
    const fmt = v => v!==null ? v.toLocaleString() : '-';
    const fmtP = v => v!==null ? v+'%' : '-';

    document.getElementById('modal-tbody').innerHTML=sorted.map((d,i)=>{
      const ds = (r.daily_sales_map || r.dailySalesMap || {})[d.date] || {db:0,contracts:0,performance:0};
      const dayCtr    = d.impressions>0 ? Math.round(d.clicks/d.impressions*1000)/10 : null;
      const dayCpc    = d.clicks>0 ? Math.round(d.cost/d.clicks) : null;
      const dayRoas   = ds.performance>0 && d.cost>0 ? Math.round(d.cost/ds.performance*100) : null;
      const dayCpd    = ds.db>0 && d.cost>0 ? Math.round(d.cost/ds.db) : null;
      const dayDbcvr  = d.clicks>0 ? Math.round(ds.db/d.clicks*1000)/10 : null;
      const dayCvr    = ds.db>0 ? Math.round(ds.contracts/ds.db*1000)/10 : null;
      const avgRank   = d.rIS>0 ? Math.round(d.rS/d.rIS*10)/10 : null;
      const rowCls = `daily-kwdet-${idx}-${i}`;
      const kwRows = d.kws.slice().sort((a,b)=>(b.cost||0)-(a.cost||0)).map(k=>{
        const ctr = k.impressions>0 ? Math.round(k.clicks/k.impressions*1000)/10 : null;
        const cpc = k.clicks>0 ? Math.round(k.cost/k.clicks) : null;
        return `<tr class="${rowCls}" style="display:none;background:var(--bg)">
          <td></td>
          <td style="padding-left:1.5rem;color:var(--muted)">${escHtml(k.keyword||'-')}</td>
          <td class="num">${(k.cost||0).toLocaleString()}</td>
          <td class="num">${(k.clicks||0).toLocaleString()}</td>
          <td class="num">${(k.impressions||0).toLocaleString()}</td>
          <td class="num">${ctr!==null?ctr+'%':'-'}</td>
          <td class="num">${cpc!==null?cpc.toLocaleString():'-'}</td>
          <td class="num" colspan="8" style="color:var(--faint);font-size:11px;text-align:left;padding-left:1rem">DB/계약 데이터는 광고그룹 기준으로만 집계됩니다</td>
        </tr>`;
      }).join('');
      return `<tr style="cursor:pointer" onclick="toggleDailyKwDetail('${rowCls}',this)">
        <td class="dk-caret" style="color:var(--faint);text-align:center">▸</td>
        <td>${d.date} <span style="font-size:11px;color:var(--faint)">(키워드 ${d.kws.length}개)</span></td>
        <td class="num">${d.cost.toLocaleString()}</td>
        <td class="num">${d.clicks.toLocaleString()}</td>
        <td class="num">${d.impressions.toLocaleString()}</td>
        <td class="num">${dayCtr!==null?dayCtr+'%':'-'}</td>
        <td class="num">${fmt(dayCpc)}</td>
        <td class="num">${ds.db.toLocaleString()}</td>
        <td class="num">${ds.contracts.toLocaleString()}</td>
        <td class="num">${ds.performance.toLocaleString()}</td>
        <td class="num">${dayRoas!==null?dayRoas.toLocaleString()+'%':'-'}</td>
        <td class="num">${fmt(dayCpd)}</td>
        <td class="num">${fmtP(dayDbcvr)}</td>
        <td class="num">${fmtP(dayCvr)}</td>
        <td class="num">${avgRank!==null?avgRank+'위':'-'}</td>
      </tr>${kwRows}`;
    }).join('');
  }

  // 키워드 목록
  const kws = KW_MAP[r.group] || [];
  const kwHtml = kws.length
    ? `<div style="margin-bottom:.5rem"><span style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">키워드 (${kws.length}개)</span></div>
       <div style="display:flex;flex-wrap:wrap;gap:6px">${kws.map(k=>`<span style="font-size:12px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;color:var(--text)">${k}</span>`).join('')}</div>`
    : `<div style="font-size:12px;color:var(--faint)">등록된 키워드 없음</div>`;
  document.getElementById('modal-keywords').innerHTML = kwHtml;

  document.getElementById('modal-bg').classList.add('show');
}

function toggleDailyKwDetail(rowCls, trigger){
  const rows = document.querySelectorAll('.'+rowCls);
  if(!rows.length) return;
  const show = rows[0].style.display === 'none';
  rows.forEach(tr=>{ tr.style.display = show ? 'table-row' : 'none'; });
  const caret = trigger.querySelector('.dk-caret');
  if(caret) caret.textContent = show ? '▾' : '▸';
}

function closeModal(e){
  if(e.target===document.getElementById('modal-bg')) closeModalDirect();
}
function closeModalDirect(){
  document.getElementById('modal-bg').classList.remove('show');
}
document.addEventListener('keydown',e=>{if(e.key==='Escape') closeModalDirect();});

// ===== 다운로드 =====
function getSortedFiltered(){
  return [...filteredData].sort((a,b)=>{
    let av=a[sortCol],bv=b[sortCol];
    if(av===null) av=sortAsc?Infinity:-Infinity;
    if(bv===null) bv=sortAsc?Infinity:-Infinity;
    if(typeof av==='string') return sortAsc?av.localeCompare(bv):bv.localeCompare(av);
    return sortAsc?av-bv:bv-av;
  });
}
function downloadCSV(){
  const cols=_pcCols();
  const headers=cols.map(c=>c.label);
  const rows=getSortedFiltered().map(r=>cols.map(c=>{
    if(c.special==='roas') return r.roas===null?'미매칭':r.roas+'%';
    const v=r[c.key]; return v===null?'':v;
  }));
  const csv=[headers,...rows].map(r=>r.join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`광고성과분석_${PC_VIEW_LABELS[_pcViewMode]}별.csv`; a.click();
}
function downloadXLSX(){
  const cols=_pcCols();
  const headers=cols.map(c=>c.label);
  const rows=getSortedFiltered().map(r=>cols.map(c=>{
    if(c.special==='roas') return r.roas===null?'미매칭':r.roas;
    return r[c.key]===null?'':r[c.key];
  }));
  const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'광고성과분석');
  XLSX.writeFile(wb,`광고성과분석_${PC_VIEW_LABELS[_pcViewMode]}별.xlsx`);
}
// ===== 알림판 보종 필터 =====
let alertCatFilter = 'all';
function setAlertCat(val, btn){
  alertCatFilter = val;
  document.querySelectorAll('#alert-cat-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderAlertBoard();
}

// ===== 탭 전환 =====
let _currentMediaGroup = 'all';

function switchMediaGroup(group, btn){
  document.querySelectorAll('.media-group-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _currentMediaGroup = group;

  const subtabsAll = document.getElementById('subtabs-all');
  const subtabsPc  = document.getElementById('subtabs-pc');
  const subtabsKw  = document.getElementById('subtabs-kw');

  // 모든 서브탭 숨김
  subtabsAll.style.display = 'none';
  subtabsPc.style.display  = 'none';
  subtabsKw.style.display  = 'none';

  // 모든 패널 숨김
  ['panel-alert','panel-cpc','panel-data','panel-daily','panel-kw-main','panel-kw-insight','panel-insight','panel-display'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.classList.remove('show');
  });

  if(group === 'all'){
    subtabsAll.style.display = '';
    document.getElementById('panel-daily').classList.add('show');
    // CRM 데이터 없으면 자동 로드
    if(Object.keys(CRM_DATA).length === 0){
      const monthAll = document.getElementById('month-select-all');
      const month = monthAll?.value || '';
      setStatus('데이터 로드 중...','');
      loadCrmData(month).then(()=>{
        initDailyTab();
        setStatus('로드 완료','ok');
      });
    } else {
      initDailyTab();
    }
  } else if(group === 'pc_content'){
    subtabsPc.style.display = '';
    const activeTab = document.querySelector('#subtabs-pc .main-tab.active');
    const tabName = activeTab ? activeTab.getAttribute('onclick').match(/'(\w+)'/)?.[1] : 'insight';
    showPcPanel(tabName);
  } else if(group === 'keyword'){
    subtabsKw.style.display = '';
    const activeKwTab = document.querySelector('#subtabs-kw .main-tab.active');
    const kwTabName = activeKwTab ? activeKwTab.getAttribute('onclick').match(/'([\w-]+)'/)?.[1] : 'kw-insight';
    document.getElementById('panel-kw-insight').classList.remove('show');
    document.getElementById('panel-kw-main').classList.remove('show');

    const showKwPanel = () => {
      // window.kwData는 renderKwTable()에서만 세팅되므로 여기서 동기화
      if(!window.kwData || !window.kwData.length) window.kwData = kwData;
      if(kwTabName === 'kw-insight'){
        document.getElementById('panel-kw-insight').classList.add('show');
        document.getElementById('kw-month-sel-wrap').style.display='none';
        renderKwInsight();
      } else {
        document.getElementById('panel-kw-main').classList.add('show');
        document.getElementById('kw-month-sel-wrap').style.display='flex';
        initKwTab();
      }
    };

    // kwData가 없으면 먼저 로드 후 렌더
    if(!kwData || kwData.length === 0){
      const monthKw = document.getElementById('month-select-kw');
      const month = monthKw?.value || '';
      setStatus('데이터 로드 중...', '');
      loadAllSheets().then(s=>{
        const data=_apiKeyword(month,s),crmRes=_apiCrm(month,s);
        if(data.error){ setStatus('오류: '+data.error,'err'); return; }
        kwData = data.result || [];
        window.kwData = kwData;
        CRM_DATA=crmRes.crm_data||{};CRM_MEDIA_LIST=crmRes.media_list||[];KW_DAILY_COST=crmRes.kw_daily_cost||{};
        setStatus(`로드 완료 — ${kwData.length}개 키워드`,'ok');
        showKwPanel();
      }).catch(e=>setStatus('데이터 로드 실패: '+e.message,'err'));
    } else {
      showKwPanel();
    }
  } else if(group === 'display'){
    document.getElementById('panel-display').classList.add('show');
    initDisplayTab();
  }
}

function showPcPanel(tab){
  ['panel-alert','panel-cpc','panel-data','panel-insight'].forEach(id=>{
    document.getElementById(id).classList.remove('show');
  });
  // 월선택: 성과 알림판, 전체 데이터만 표시
  const showMonthSel = ['alert','data'].includes(tab);
  const wrap = document.getElementById('pc-month-sel-wrap');
  if(wrap) wrap.style.display = showMonthSel ? 'flex' : 'none';

  if(tab==='alert')   { document.getElementById('panel-alert').classList.add('show');   renderAlertBoard(); }
  if(tab==='insight') { document.getElementById('panel-insight').classList.add('show'); renderInsight(); }
  if(tab==='cpc')     { document.getElementById('panel-cpc').classList.add('show');     initCpcTab(); }
  if(tab==='data')    { document.getElementById('panel-data').classList.add('show'); renderMetrics(filteredData); renderDataChart(filteredData); }
}

function switchTab(tab, btn){
  // 현재 활성 서브탭바 내 버튼만 active 처리
  const bar = btn.closest('.main-tabs');
  bar.querySelectorAll('.main-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');

  if(tab === 'daily'){
    document.getElementById('panel-daily').classList.add('show');
    initDailyTab();
  } else if(tab === 'kw-insight'){
    document.getElementById('panel-kw-main').classList.remove('show');
    document.getElementById('panel-kw-insight').classList.add('show');
    document.getElementById('kw-month-sel-wrap').style.display='none';
    renderKwInsight();
  } else if(tab === 'kw-main'){
    document.getElementById('panel-kw-insight').classList.remove('show');
    document.getElementById('panel-kw-main').classList.add('show');
    document.getElementById('kw-month-sel-wrap').style.display='flex';
    initKwTab();
  } else {
    document.getElementById('panel-daily').classList.remove('show');
    showPcPanel(tab);
  }
}

// 키워드 성과 진단 기기 필터
function setKwInsightDevice(device, btn){
  window.kwInsightDevice = device;
  document.querySelectorAll('#kw-insight-device-filter .tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // 상세 테이블만 재렌더 (renderKwInsight 전체 재호출)
  const range = document.getElementById('kw-insight-range').value;
  const data = (window.kwData||[]).filter(r=>r.sub_media==='네이버');
  if(!data.length) return;
  // dates 재계산
  const dayMap2={};
  data.forEach(r=>{
    const days=Object.keys(r.daily||{});
    const totalDb=days.reduce((s,k)=>s+(r.daily[k].db||0),0);
    days.forEach(k=>{
      if(!dayMap2[k]) dayMap2[k]={cost:0,db:0};
      const v=r.daily[k]; const dbShare=totalDb>0?(v.db||0)/totalDb:0;
      dayMap2[k].db+=v.db||0;
      if(r.cost) dayMap2[k].cost+=r.cost*dbShare;
    });
  });
  const dates=Object.keys(dayMap2).sort();
  renderKwInsightDetail(range, dates, dayMap2);
}
