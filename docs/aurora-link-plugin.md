# AuroraLink Paper Plugin

AuroraLink는 `nfoifsb.kr` 웹사이트와 Paper 서버를 연결하는 커스텀 브릿지 플러그인입니다.

## 기능

- 웹 계정과 Minecraft 캐릭터 연결
- 인게임 명령어 `/webauth <code>` 지원
- 웹에서 온라인 캐릭터 인벤토리, 레벨, 체력, 좌표 조회
- 웹 버튼 액션
  - `daily-reward`: 출석 보상 지급
  - `spark`: 접속 중인 캐릭터에게 웹 핑 이펙트 표시
  - `market-bell`: 장터 알림 서버 브로드캐스트
- 24시간 서버 주식 거래소
  - `/stocks/market`: 공개 실시간 시세, 24h 캔들, 최근 체결
  - `/stocks/portfolio`: 인증 플레이어 보유량/잔고 조회
  - `/stocks/trade`: Vault 머니 기반 매수/매도 체결
- Vault 경제 플러그인이 있으면 출석 보상 money 자동 지급
- CORS, 요청 제한, 플레이어별 web token, 관리자 API token 적용

## 빌드

```powershell
cd minecraft-plugin\aurora-link
.\gradlew.bat build
```

빌드 결과:

```text
minecraft-plugin/aurora-link/build/libs/AuroraLink-0.1.0.jar
```

## 서버 설치

1. `AuroraLink-0.1.0.jar`를 Paper 서버의 `plugins/` 폴더에 넣습니다.
2. 서버를 한 번 실행해 `plugins/AuroraLink/config.yml`을 생성합니다.
3. `config.yml`에서 아래 값을 확인합니다.

```yaml
api:
  enabled: true
  host: "0.0.0.0"
  port: 8787
  base-path: "/minecraft"
  allowed-origins:
    - "https://www.nfoifsb.kr"
  admin-token: "긴_랜덤_비밀값"

stock-market:
  enabled: true
  tick-seconds: 60
  candle-seconds: 900
  history-hours: 24
  fee-rate: 0.003
  max-order-shares: 500
```

4. 서버 방화벽 또는 프록시에서 `8787` 포트를 웹 API로 열거나, 더 안전하게 Tailscale Funnel/Nginx/Cloudflare Tunnel/API Gateway 뒤에 둡니다.
5. 웹사이트 빌드 환경에 API 주소를 넣습니다.

```env
VITE_PLAYER_API_BASE=https://api.example.com/minecraft
```

## 웹 API

기존 `docs/minecraft-player-api.md`의 API를 구현합니다.

- `POST /minecraft/verification/start`
- `POST /minecraft/verification/check`
- `GET /minecraft/players/{nickname}/inventory`
- `GET /minecraft/stocks/market`
- `POST /minecraft/stocks/portfolio`
- `POST /minecraft/stocks/trade`

추가 액션 API:

```http
POST /minecraft/players/{nickname}/actions/daily-reward
Authorization: Bearer <webToken>
Content-Type: application/json
```

```json
{
  "webToken": "<webToken>"
}
```

액션 이름:

- `daily-reward`
- `spark`
- `market-bell`

`webToken`은 `/verification/check` 성공 응답에 포함됩니다.

주식 거래소는 `plugins/AuroraLink/stocks.json`에 가격 캔들, 플레이어별 보유량, 평균 매수가, 최근 체결을 저장합니다. 서버가 켜져 있는 동안 24시간 가격 틱이 계속 생성되고, 웹 주문이 들어오면 체결가/수량/플레이어명이 즉시 기록됩니다.

## 추천 서버 플러그인 스택

AuroraLink는 단독으로도 인증/웹 액션이 동작하지만, 경제 야생 서버에서는 아래 조합을 권장합니다.

- **Vault**: 경제/권한 플러그인 표준 브릿지
- **EssentialsX**: 기본 명령어, 홈, 스폰, 경제 provider
- **LuckPerms**: 권한 관리
- **QuickShop-Hikari 또는 QuickShop 계열**: 유저 상점
- **AuctionHouse 계열**: 경매장
- **GriefPrevention 또는 GriefDefender 계열**: 토지 보호
- **DiscordSRV 계열**: 디스코드 연동
- **Chunky**: 월드 사전 생성

AuroraLink `plugin.yml`에는 위 플러그인들이 `softdepend`로 선언되어 있어, 설치되어 있으면 자연스럽게 뒤에 로드됩니다.

## 보안 메모

- `api.admin-token`은 절대 웹사이트 `VITE_*` 환경변수에 넣지 마세요.
- 정적 웹사이트는 플레이어별 `webToken`만 사용합니다.
- 관리자 API는 서버-서버 백엔드에서만 호출해야 합니다.
- API를 인터넷에 직접 열 때는 반드시 방화벽, 프록시, HTTPS, rate limit를 같이 사용하세요.
