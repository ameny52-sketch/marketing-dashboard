# 마케팅 성과 모니터링 대시보드 — 작업 안내

광고 매체별 성과(광고비·DB수·계약·평가업적)를 한곳에서 보는 사내 대시보드.
**빌드 도구가 없다.** `index.html`을 열면 그대로 돌아간다. 이게 단점이 아니라 의도된 선택이므로
번들러·프레임워크·TypeScript를 도입하려면 먼저 그 전제를 다시 논의할 것.

---

## 실행과 배포

| 상황 | 방법 |
|---|---|
| 로컬에서 보기 | 정적 서버로 폴더를 열면 된다 (`python -m http.server`). `file://` 로 열면 CSV fetch가 막힌다 |
| 배포 | `main` 에 push → GitHub Pages 자동 반영 (https://github.com/ameny52-sketch/marketing-dashboard) |
| 데이터 갱신 | 별도 자동화 스크립트가 `data/*.csv` 를 매일 다시 만들어 커밋한다 (커밋 메시지 "대시보드 데이터 자동 갱신") |

배포 후 화면이 그대로면 브라우저 강력 새로고침. JS/CSS가 캐시될 수 있다.

---

## 파일 구조

스크립트는 `index.html` 아래쪽에서 **순서대로** 로드된다. 전부 모듈이 아닌 일반 스크립트라
**하나의 전역 스코프를 공유**한다. 순서는 "데이터 레이어 → 화면" 이다.

```
mappings.js → core.js → daily-data.js → insight.js → charts.js → alert-board.js
            → keyword.js → app.js → display.js → display-creative.js
            → display-export.js → report.js
```

| 파일 | 담당 |
|---|---|
| `js/data/mappings.js` | 매핑 테이블 전부 + **매핑 지도 주석**(파일 맨 위). "이 값 어디서 오나?" 는 여기부터 |
| `js/core.js` | CSV 로드·캐시, `_apiAnalyze`/`_apiKeyword`/`_apiCrm` 집계, 파워컨텐츠 표, 탭 전환, 공용 유틸 |
| `js/daily-data.js` | CRM·Daily DB 현황 데이터 로더 (`CRM_DATA` 등의 집) |
| `js/insight.js` | 성과 진단 (키워드 / 파워컨텐츠) |
| `js/charts.js` | 일별 추이 차트 + 날짜 클릭 상세 모달 |
| `js/alert-board.js` | 효율 순위(알림판), 주요그룹 필터 |
| `js/keyword.js` | 키워드 표, Daily DB 현황 표, CPC 분석 |
| `js/app.js` | 초기 실행, 사이드바 접기, 기준값 초과 알림 팝업 |
| `js/display.js` | 디스플레이 탭 본체 (영역별 성과, 차트, 데이터 로드) |
| `js/display-creative.js` | 소재 랭킹 · 월별 이력 매트릭스 · 이미지 모달 |
| `js/display-export.js` | 소재별 효율 CSV (팀 엑셀에 붙여넣는 형식) |
| `js/report.js` | 커스텀 보고서 (피벗 빌더) + 매체별 데이터 어댑터 |
| `css/base.css` | 리셋과 기본 요소. **디자인 토큰은 여기 없다** |
| `css/components.css` | 공통 UI 부품 (KPI 카드, 표, 탭, 모달) + 유틸 클래스 |
| `css/layout.css` | **디자인 토큰(`:root`)** + 테마 오버라이드 + 화면별 배치 |

---

## 데이터가 어디서 오는가

### 1. 정적 CSV (자동화가 매일 커밋)
`data/raw_2026.csv`(CRM 원본 6.7MB) · `pc_2026.csv`(9.5MB) · `naver_2026.csv`(**28MB**) ·
`google_2026.csv` · `daum_2026.csv` · `display_2026.csv`

첫 방문 시 이걸 전부 받아 메인 스레드에서 파싱한다(약 55만 행). 로딩 중 잠깐 멈추는 이유.
IndexedDB(`adtool_cache_v4`)에 1시간 캐시되고, 사이드바의 "데이터 새로고침"이 캐시를 지운다.

### 2. 구글시트 2개 (실시간, 배포 불필요)
`js/core.js` 의 `SHEETS_URLS` 참고.
- **group_content** — 광고그룹 → 인타입 / 캠페인 / 카테고리 / 기기 / 블로그·랜딩주소
- **display_intype** — 인타입 → 매체 / 월 / 영역 / 소재 / 보종 (디스플레이 탭 전용)

시트만 고치면 바로 반영된다. 자세한 관계는 `js/data/mappings.js` 맨 위 주석에 정리돼 있다.

### 매체 분류 (raw CSV의 `광고매체` 열)
- `파워컨텐츠` → 파워컨텐츠 탭
- `키워드` (세부: 네이버/구글/다음) → 키워드 탭
- `뉴미디어` → 세부매체가 `애드온컴퍼니`면 디스플레이 탭(인타입으로 매체 구분), 나머지는 제휴·기타

### 숫자가 안 맞을 때 확인 순서
1. **디스플레이**: 영역별 성과 표 위에 "미확인 DB" 경고 배너가 뜨는지 → 뜨면 그 인타입을 display_intype 시트에 추가
2. **파워컨텐츠**: 표에 "(미매핑)" 행이 있는지 → group_content 시트의 `인타입` 열 확인
3. **키워드-구글**: `GKDA_` 로 시작하는 인타입은 **의도적으로 제외**된다 (별도 캠페인). `core.js` 의 `_apiKeyword` 참고
4. 월 판단은 항상 CRM의 `상담등록일` 기준이다. 인타입 코드 이름에 붙은 월(`...0820`)은 라벨일 뿐 집계에 안 쓰인다

---

## 전역 상태 (여럿이 동시에 작업할 때 주의)

전부 한 전역 스코프라, **선언된 파일 밖에서 값이 바뀌는 변수**가 있다. 여기를 건드릴 땐 다른 파일도 같이 봐야 한다.

| 변수 | 선언 | 밖에서 쓰는 곳 |
|---|---|---|
| `CRM_DATA` / `CRM_MEDIA_LIST` / `KW_DAILY_COST` | `daily-data.js` | `core.js`, `keyword.js` |
| `kwData` / `kwPage` / `kwRendered` | `keyword.js` | `core.js` |
| `adData` | `core.js` | `daily-data.js`, `keyword.js` |
| `_displayLoaded` | `display.js` | `report.js` |
| `_creativeRankingList` | `display-creative.js` | `display.js` |
| `_dailyMonthSelInitialized` | `daily-data.js` | `keyword.js` |

`resultData`(파워컨텐츠 행) / `filteredData`(필터 결과) / `_sheetsParsed`(파싱된 CSV 캐시) 는
`core.js` 소유이고 읽기는 여기저기서 한다.

`_` 접두사는 "이 파일 전용"을 뜻하지 **않는다**. `_apiAnalyze`, `_kpiCard`, `_csvCell` 처럼
파일을 넘나드는 공용 함수도 `_` 가 붙어 있다.

---

## 화면 스타일 규칙

### 1. 디자인 토큰은 `css/layout.css` 맨 위 `:root` 한 곳
색·모서리 반경을 바꾸려면 여기만 고친다. `base.css` 에도 `:root` 가 있었는데 layout 이 전부
덮어써서 "고쳐도 안 바뀌는" 상태였어서 제거했다. 다시 만들지 말 것.

### 2. 표 셀 밀도는 두 가지만
```css
기본(클래스 없음)  9px 12px   /* 행이 적고 찬찬히 읽는 표 */
.tbl-dense        7px 10px   /* 행이 많아 한 화면에 많이 담아야 하는 표 */
```
표에 `.tbl-dense` 를 붙이냐 마냐로만 결정된다. 개별 표에 패딩을 새로 선언하지 말 것.

### 3. JS 템플릿에 인라인 스타일을 넣지 말 것
표 셀 인라인 스타일 168곳을 전부 클래스로 옮겼다. 디자이너가 CSS에서 작업할 수 있게 하는 게 목적이므로
새 코드에서 `<td style="...">` 를 쓰면 원점으로 돌아간다. 쓸 수 있는 유틸:

`.ta-right` `.ta-center` `.num` `.fw-600` `.cell-muted` `.cell-muted-sm` `.cell-faint`
`.cell-strong` `.cell-big` `.cell-truncate` `.cell-note` `.cell-indent` `.cell-empty`
`.cell-empty-center` `.no-data-inline` `.text-good` `.text-bad` `.text-faint` `.is-hidden`

(예외: JS가 계산해 넣는 값 — Daily 표 2단 헤더의 sticky `top` 처럼 — 은 인라인이 맞다.)

### 4. 구체성 함정 ★ 이 프로젝트에서 제일 자주 걸린다
새 클래스를 만들었는데 **색이나 여백이 안 먹으면** 기존 규칙에 밀린 것이다. 실제로 걸렸던 사례:

| 새 클래스가 진 상대 | 해결 |
|---|---|
| `tbody td.num { color:var(--muted) }` | `tbody td.cell-best` 처럼 구체성을 맞추고 **뒤에** 배치 |
| `.cpc-tbl tbody td { color:var(--text) }` | `.cpc-tbl td.cell-muted` 로 같은 스코프에 배치 |
| `#daily-table thead th:first-child { background:var(--bg) }` | `#daily-thead tr th.dth-corner` 로 구체성을 맞추고 **파일에서 그 뒤로** 이동 |

구체성이 같으면 **나중에 오는 규칙이 이긴다.** 구체성만 맞추거나 위치만 옮겨서는 안 되고 둘 다 필요할 때가 있다.

---

## 알아둘 것들

- **CSV 내보내기**는 전부 `core.js` 의 `_csvCell` 로 각 칸을 감싼다. 안 쓰면 광고그룹명에 콤마가 있을 때 열이 밀린다
- **화면 표와 CSV 컬럼은 같이 고쳐야 한다.** 예전에 키워드 표에만 노출수·평균CPC가 있고 CSV엔 빠져 있었다
- **fetch는 `_fetchWithTimeout`** 을 쓴다. 시트가 죽으면 CSV 대신 HTML 안내 페이지가 200으로 오는데,
  이 함수가 그걸 걸러낸다. 안 거치면 쓰레기 데이터가 캐시에 1시간 저장된다
- **시트 컬럼명을 바꾸면 조용히 0이 된다.** 코드가 `r['DB수']` 처럼 한글 컬럼명을 직접 참조한다.
  기획팀이 시트를 정리할 때 컬럼명은 건드리지 않도록 안내할 것
- **구글 캠페인에는 `_C##` 코드를 붙일 것.** 없으면 `core.js` 의 `guC()` 가 캠페인명으로 보종을 추측하는데,
  추측 규칙이 6개 보종만 커버해서 신생아·치매·자동차·저축성·생명·종신·정기·주택화재는 '보험'으로 잘못 분류된다
- **디스플레이 CTR의 분모는 노출수가 아니라 `_dispRowReach()`** (`js/display.js`). T멤버십 PUSH처럼 매체 리포트에 노출 개념 없이 발송 건수만 오는 상품이 있어, **노출수가 0이면 발송수를 분모로 쓴다**(둘 다 있는 카카오페이 TMS는 노출 사용). 합산은 반드시 **행 단위로 `reach`를 누적**해야 한다 — 영역이 섞인 합계(매체 합계/KPI/오늘의 요약)에서 발송형·노출형이 각자 제 분모로 더해져야 하기 때문. `imp`로 CTR을 새로 계산하면 그 화면만 부풀려진다
- **성과 진단과 데이터 표의 필터는 독립이다.** 예전엔 표의 필터가 성과 진단 숫자까지 바꿨는데 분리했다. 다시 엮지 말 것

---

## 아직 남은 것

- `naver_2026.csv` 가 28MB. 월별로 쪼개면 첫 로딩·파싱·깃 용량이 한 번에 개선된다
- 사내 서버로 옮기면 **gzip 설정**을 꼭 확인할 것 (GitHub Pages는 자동. 없으면 5MB가 45MB가 된다)
- 자동화 스크립트의 배포 경로(현재 git push)가 문서화돼 있지 않다
- 로그인·권한 기능은 없다. 넣으려면 백엔드가 필요하다
