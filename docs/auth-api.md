# Auth API

The default development setup uses a local file-backed auth API so signup and
login work without creating AWS resources.

```powershell
npm run dev:local
```

Local endpoints:

```env
VITE_AUTH_API_BASE=http://127.0.0.1:4174
```

Local auth data is stored in `.local/auth/` and is ignored by git. The local
pepper key is generated on first run and is only for development.

The website uses `VITE_AUTH_API_BASE` for real account signup and login.

```env
VITE_AUTH_API_BASE=https://api-id.execute-api.ap-northeast-1.amazonaws.com
```

Do not put database keys or auth pepper values in Vite variables. `VITE_*` values are public in the browser.

## AWS Resources

AWS setup is blocked by default so it cannot accidentally create billable
resources. To intentionally use AWS, set `ALLOW_AWS_COSTS=1` for the command or
GitHub Actions workflow run.

```powershell
$env:ALLOW_AWS_COSTS="1"
npm run auth:setup:aws
```

`npm run auth:setup:aws` creates or updates:

- DynamoDB table for users
- Lambda function for `signup`, `login`, and `reset`
- IAM role with DynamoDB-only access for the user table
- HTTP API Gateway routes
- Lambda `AUTH_PEPPER` stored in the encrypted Lambda environment

Generated output:

```text
auth-output.json
.env.auth.generated
```

Both files are ignored by git.

## Endpoints

### Sign Up

```http
POST /auth/signup
Content-Type: application/json
```

```json
{
  "nickname": "PlayerName",
  "email": "player@example.com",
  "password": "minimum-8-characters"
}
```

Response:

```json
{
  "user": {
    "email": "player@example.com",
    "name": "PlayerName",
    "provider": "site",
    "signedInAt": "2026-07-01T00:00:00.000Z"
  },
  "session": {
    "token": "...",
    "expiresAt": "2026-07-15T00:00:00.000Z"
  }
}
```

### Login

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "player@example.com",
  "password": "minimum-8-characters"
}
```

### Reset

```http
POST /auth/reset
Content-Type: application/json
```

```json
{
  "email": "player@example.com"
}
```

The reset endpoint returns a generic success response so it does not reveal whether an email exists.
