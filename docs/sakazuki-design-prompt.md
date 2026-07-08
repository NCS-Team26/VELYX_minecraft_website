# VELYX × Sakazuki — 디자인 적용 프롬프트

> 붙여넣어 쓰는 실행 프롬프트. sakazuki.io의 "럭셔리 미니멀 / 에디토리얼" 감성을
> 현재 VELYX 사이트 위에 얹는다. 팔레트를 갈아엎는 게 아니라 **여백·타이포 스케일·
> 섹션 리듬**을 Sakazuki 쪽으로 당긴다.

---

## 배경 (읽고 시작)

현 상태는 이미 Sakazuki와 방향이 같다:
- `src/velyx-minecraft.css` = 최종 스킨 레이어. near-black(`--vlx-black #080807`) +
  warm ivory(`--vlx-ivory #e6e6df`), Space Grotesk 디스플레이 + Pretendard 본문,
  hairline border(`--vlx-hair`), emerald 최소 강조(`--vlx-emerald #4a9e73`).
- 즉 색은 손대지 마라. **여백/스케일/모션/구성**만 Sakazuki화 한다.

Sakazuki가 우리보다 나은 지점 (= 적용 대상 델타):
1. 여백이 훨씬 크다 — 섹션 사이 breathing room이 화면 절반급.
2. 히어로에서 브랜드 워드마크가 압도적으로 크다 (화면 폭급 타이포).
3. 모든 섹션이 동일 규격 카드 컨테이너로 모듈화 — 리듬이 일정.
4. "Collective / member roster" = 이름 그리드가 커뮤니티감을 만든다.
5. 스크롤 시 섹션이 부드럽게 fade/rise, hover는 아주 미세.
6. 카피가 짧고 선언적 ("Connection, beyond access.").

---

## 작업 규칙

- 편집은 `src/velyx-minecraft.css`에 집중. 필요 최소한만 `index.html` 마크업 조정.
- 색 토큰(`--vlx-*`) 추가/변경 금지. 기존 값 재사용.
- `!important` 관례 유지 — 이 파일은 main.css보다 먼저 로드됨(파일 상단 주석 참고).
- 반응형 유지: 큰 타이포/여백은 `clamp()`로. 모바일에서 안 깨지게.
- 접근성: 대비 유지, `prefers-reduced-motion`에서 모션 끄기.

---

## 실행 지시 (이대로 시켜라)

**1. 히어로 워드마크 확대**
`index.html` 히어로의 VELYX를 화면을 채우는 디스플레이 타이포로.
`font-size: clamp(3.5rem, 14vw, 12rem)`, Space Grotesk, `letter-spacing:-0.03em`,
`line-height:0.9`. 아래 태그라인은 짧은 선언형 한 줄 + emerald가 아닌 ivory-faint.
CTA는 hairline border 아웃라인 버튼 하나만(현 emerald 채움 버튼 → 아웃라인 우선).

**2. 섹션 리듬 = 여백 2배**
공통 섹션 패딩을 `padding-block: clamp(6rem, 14vh, 12rem)`로. 섹션 사이는
hairline border 하나로만 구분(그라디언트/박스섀도 제거). 최대폭
`max-width: 72rem; margin-inline:auto` 컨테이너로 콘텐츠를 가운데 모으고 좌우 여백 크게.

**3. 모듈 카드 규격 통일**
feature/benefit 블록을 동일 카드로: `--vlx-panel` 배경, `--vlx-hair` 1px border,
`border-radius: var(--vx-radius)`(2px 유지), 내부 패딩 `2.5rem`, 그림자 없음.
그리드 `repeat(auto-fit, minmax(18rem,1fr))`, gap `1px`(hairline 격자룩) 또는 `1.5rem`.

**4. Roster 그리드 (Collective 차용)**
커뮤니티/플레이어 목록을 Sakazuki member roster처럼: 균일 셀 그리드에 이름 반복,
각 셀 hairline border, hover 시 배경만 `--vlx-emerald-soft`로 미세 전환.
데이터 있으면 실제 플레이어명, 없으면 기존 커뮤니티 섹션에 이 룩만 입힘.

**5. 스크롤 모션 (미세하게)**
섹션 진입 시 `opacity 0→1 + translateY(24px→0)`, `600ms ease`, IntersectionObserver로
1회. 과하지 않게. `@media (prefers-reduced-motion: reduce)`에서 전부 off.
hover는 border-color/opacity만 `200ms` — 크기변화·글로우 금지.

**6. 카피 톤**
섹션 헤딩을 짧게, 선언형으로. 서브카피는 `--vlx-ivory-faint` eyebrow 라벨
(작은 대문자 `letter-spacing:0.2em`) + 큰 헤딩 조합. Minecraft 경제 정체성은
emerald 한 방울로만 유지(라벨/링크 강조에만).

---

## 완료 기준

- [ ] 히어로 워드마크가 뷰포트 폭급으로 크고, 모바일에서 안 깨짐(clamp 확인).
- [ ] 섹션 세로 여백이 눈에 띄게 늘고 구분은 hairline 하나뿐.
- [ ] 모든 feature/benefit 카드가 동일 규격(패딩·border·radius).
- [ ] roster 그리드 존재, hover가 미세(색 전환만).
- [ ] 스크롤 fade/rise 동작, reduced-motion에서 off.
- [ ] 색 토큰 신규 추가 0개. 대비 저하 없음.
- [ ] `npm run build` 통과.

---

## 검증

```
npm run build          # 빌드 통과
npm run preview        # 육안: 히어로 스케일 / 섹션 여백 / roster hover / reduced-motion
```
스샷으로 데스크톱·모바일 히어로, 한 섹션 전환, roster hover 상태 확인.
