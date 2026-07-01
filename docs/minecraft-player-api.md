# Minecraft Player API

The login page can show a verified Minecraft character and inventory when a server-side API is available.

Set the API base URL at build time:

```env
VITE_PLAYER_API_BASE=https://api.example.com/minecraft
```

## Verification

### Start Verification

```http
POST /verification/start
Content-Type: application/json
```

Request:

```json
{
  "nickname": "PlayerName",
  "account": {
    "email": "player@example.com",
    "name": "PlayerName",
    "provider": "site",
    "sub": ""
  }
}
```

Response:

```json
{
  "nickname": "PlayerName",
  "code": "482913",
  "uuid": "",
  "verified": false
}
```

The Paper plugin should accept the in-game command:

```text
/webauth 482913
```

When a player runs the command in game, the plugin should bind that Minecraft UUID to the web account that requested the code.

### Check Verification

```http
POST /verification/check
Content-Type: application/json
```

Request:

```json
{
  "nickname": "PlayerName",
  "code": "482913",
  "account": {
    "email": "player@example.com",
    "provider": "site",
    "sub": ""
  }
}
```

Response:

```json
{
  "nickname": "PlayerName",
  "uuid": "00000000-0000-0000-0000-000000000000",
  "verified": true,
  "webToken": "player-scoped-web-action-token"
}
```

`webToken`은 웹사이트에서 플레이어 본인 액션을 실행할 때 사용합니다. 이 값은 관리자 토큰이
아니며, 해당 캐릭터에 대한 제한된 액션에만 사용해야 합니다.

## Inventory

```http
GET /players/PlayerName/inventory
```

Response:

```json
{
  "level": 27,
  "health": "20 / 20",
  "location": "128, 64, -320",
  "updatedAt": "2026-07-01T12:00:00.000Z",
  "items": [
    {
      "slot": 0,
      "name": "다이아몬드 검",
      "count": 1,
      "color": "#55d9e8"
    }
  ]
}
```

The web client renders 36 inventory slots. Empty slots can be omitted.

## Player Web Actions

AuroraLink는 인증된 플레이어가 웹사이트 버튼으로 서버에 가벼운 액션을 보낼 수 있게 합니다.

```http
POST /players/PlayerName/actions/daily-reward
Authorization: Bearer player-scoped-web-action-token
Content-Type: application/json
```

Request:

```json
{
  "webToken": "player-scoped-web-action-token"
}
```

Response:

```json
{
  "ok": true,
  "action": "daily-reward",
  "message": "Daily reward sent.",
  "money": 250
}
```

Available actions:

- `daily-reward`: daily economy/item reward
- `spark`: visual ping effect on the online player
- `market-bell`: market broadcast with cooldown
