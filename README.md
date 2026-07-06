# VELYX Minecraft Site

## AWS 비용 방지 메모

이 작업본은 기본 상태에서 AWS 리소스를 만들지 않도록 막혀 있습니다. 로컬 실행은 `npm run dev:local`, 관리자 계정 생성은 `npm run admin:create`를 사용하세요. AWS 배포나 인증 백엔드 생성은 `ALLOW_AWS_COSTS=1`을 명시적으로 넣기 전에는 실패합니다.

자세한 내용은 [`docs/aws-zero-cost.md`](docs/aws-zero-cost.md)를 참고하세요.

`velyx.kr` 마인크래프트 서버용 정적 웹사이트입니다.

루트 도메인 `velyx.kr`은 마크 서버 접속 주소로 계속 쓰고, 웹사이트는 우선 CloudFront 기본 주소로 공개하거나 나중에 `www.velyx.kr`에 붙이는 구성을 권장합니다.

## 사이트 기능

- Three.js 기반 3D 마인크래프트 히어로 씬 (Data Saver / 모션 최소화 시 자동 폴백)
- mcstatus.io API 실시간 서버 상태 (접속자 수, 버전, 온라인 표시)
- 서버 주소 클립보드 복사 (`복사됨 ✓` 피드백)
- 같은 탭에서 열리는 로그인 전용 화면 (`login.html`)
- Google 계정 로그인 UI, DB 기반 회원가입/로그인/비밀번호 찾기, 자동 로그인 버튼
- 로그인 후 캐릭터 인증, 인벤토리 확인 UI, Minecraft Player API 연동
- 스크롤 등장 애니메이션, hover 인터랙션, 모바일 햄버거 메뉴
- 접근성: `prefers-reduced-motion` 존중, 키보드 포커스 링, 본문 건너뛰기 링크
- SEO/공유: Open Graph · Twitter Card · JSON-LD 메타

## 로컬 실행

```powershell
npm install
npm run dev:local
```

로컬 주소:

```text
http://127.0.0.1:5173/
```

`npm run dev:local`은 사이트와 회원가입/로그인 로컬 API를 같이 실행합니다.
회원가입 데이터와 로컬 pepper 키는 `.local/auth/`에 저장되고 git에는 올라가지 않습니다.
AWS 리소스를 만들지 않으므로 이 개발 모드에서는 AWS 비용이 발생하지 않습니다.

## Google 로그인 설정

Google 로그인 버튼을 활성화하려면 Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 만든 뒤 환경변수에 넣어야 합니다.

1. Google Cloud Console에서 `API 및 서비스` > `사용자 인증 정보` > `OAuth 클라이언트 ID`를 생성합니다.
2. 애플리케이션 유형은 `웹 애플리케이션`을 선택합니다.
3. 승인된 JavaScript 원본에 로컬 개발 주소와 배포 주소를 추가합니다.

```text
http://127.0.0.1:5173
https://<cloudfront_domain_name>
https://www.velyx.kr
```

4. `.env.example`을 참고해 `.env`를 만들고 클라이언트 ID를 넣습니다.

```powershell
Copy-Item .env.example .env
```

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

현재 사이트는 정적 프론트엔드라 Google ID 토큰과 일반 로그인 폼 입력을 브라우저 표시용으로만 사용합니다. 서버 API와 연결해 권한 처리를 할 경우에는 서버에서 ID 토큰 서명과 계정 정보를 검증해야 합니다.

## 회원가입 DB와 보안 설정

실제 회원가입은 브라우저에 DB 키를 넣지 않고 AWS Lambda API를 통해 처리합니다.

```powershell
npm run auth:setup:aws
```

AWS 생성/배포 명령은 기본적으로 막혀 있습니다. 정말 AWS 리소스를 만들 때만 아래처럼
명시적으로 허용하세요.

```powershell
$env:ALLOW_AWS_COSTS="1"
npm run auth:setup:aws
```

이 스크립트는 DynamoDB 사용자 테이블, Lambda 함수, IAM 권한, HTTP API Gateway를 생성하거나 업데이트합니다. 비밀번호는 Lambda에서 PBKDF2-SHA256, 사용자별 salt, Lambda 환경변수의 `AUTH_PEPPER`로 해시되어 저장됩니다. DynamoDB는 서버 측 암호화가 켜지고, Lambda에는 해당 테이블 접근 권한만 부여됩니다. 인증 API는 허용된 Origin만 받으며, 로그인/회원가입/이메일 인증/비밀번호 재설정/Google 로그인 요청에 rate limit을 적용합니다.

로컬에서 AWS 자격 증명이 없다면 GitHub Actions의 `Setup auth backend on AWS` 워크플로를 수동 실행할 수 있습니다. 실행 후 출력되는 값을 Repository secret에 넣습니다.

```text
VITE_AUTH_API_BASE=https://<api-id>.execute-api.<region>.amazonaws.com
```

프론트엔드는 `VITE_AUTH_API_BASE`가 있으면 실제 API로 회원가입/로그인을 처리합니다. 이 값은 공개 API URL이며, DB 키나 pepper 같은 비밀값은 절대 `VITE_*` 환경변수에 넣지 마세요.

자세한 API 형식은 `docs/auth-api.md`를 참고하세요.

## 캐릭터 인증과 인벤토리 API

로그인 화면은 `VITE_PLAYER_API_BASE`가 설정되어 있으면 서버 API로 캐릭터 인증과 인벤토리를 불러옵니다. 설정이 없을 때는 UI 확인용 로컬 미리보기 데이터를 표시합니다.

```env
VITE_PLAYER_API_BASE=https://api.example.com/minecraft
```

Paper 플러그인이나 별도 백엔드는 `docs/minecraft-player-api.md`의 `/verification/start`, `/verification/check`, `/players/{nickname}/inventory` 형식에 맞추면 됩니다.

이 저장소에는 Paper 서버용 커스텀 브릿지 플러그인 **AuroraLink**도 포함되어 있습니다.
AuroraLink는 캐릭터 인증, 인벤토리 조회, 출석 보상, 웹 핑, 장터 알림, 24시간 주식 거래소를 웹사이트 버튼과 연결합니다.

```powershell
cd minecraft-plugin\aurora-link
.\gradlew.bat build
```

빌드 결과 JAR:

```text
minecraft-plugin/aurora-link/build/libs/AuroraLink-0.1.0.jar
```

설치와 API 보안 설정은 `docs/aurora-link-plugin.md`를 참고하세요.

## 빌드

```powershell
npm run build
```

결과물은 `dist/`에 생성됩니다.

## AWS 배포

이 프로젝트는 AWS CLI 없이도 Node 스크립트로 배포할 수 있습니다.

먼저 AWS 인증 정보를 설정해야 합니다. 예:

```powershell
$env:AWS_ACCESS_KEY_ID="..."
$env:AWS_SECRET_ACCESS_KEY="..."
$env:AWS_REGION="ap-northeast-1"
```

그 다음:

```powershell
npm run deploy:aws
```

배포 스크립트가 하는 일:

- S3 버킷 생성 또는 재사용
- S3 public access 차단
- CloudFront Origin Access Control 생성 또는 재사용
- CloudFront 배포 생성 또는 재사용
- CloudFront 보안 응답 헤더 정책 연결
- `dist/` 업로드
- CloudFront 캐시 무효화
- `deploy-output.json`에 배포 URL 저장

배포 후 우선 이 주소로 접속합니다:

```text
https://<cloudfront_domain_name>
```

## GitHub Actions 자동 배포

`.github/workflows/deploy-aws.yml` 워크플로가 `main` 브랜치에 push될 때 자동으로 `npm run deploy:aws`를 실행합니다. GitHub Actions는 AWS 장기 액세스 키 대신 OIDC로 아래 IAM Role을 assume합니다.

```text
arn:aws:iam::358982198253:role/GitHubActionsMincraftServerWebsiteDeployRole
```

필수 Repository secret은 없습니다. 필요하면 GitHub의 `Settings` > `Secrets and variables` > `Actions`에서 아래 선택 secret만 등록합니다.

선택:

```text
AWS_REGION              # 기본값: ap-northeast-1
VITE_GOOGLE_CLIENT_ID   # Google 로그인 버튼 활성화 및 서버 측 ID 토큰 검증 audience
VITE_AUTH_API_BASE      # 회원가입/로그인 API 주소
VITE_PLAYER_API_BASE    # AuroraLink 플레이어 API 주소, 예: https://api.velyx.kr/minecraft
AUTH_EMAIL_FROM         # 인증/비밀번호 재설정 메일 발신자, 기본값 no-reply@velyx.kr
AUTH_APP_BASE_URL       # 메일 인증 링크에 들어갈 사이트 URL
SITE_BUCKET             # 기본값: velyx-minecraft-site-358982198253
SITE_DOMAIN             # 기본값: www.velyx.kr
CERTIFICATE_ARN         # 기본값: www.velyx.kr용 us-east-1 ACM 인증서 ARN
```

`SITE_BUCKET`을 기본값이 아닌 이름으로 바꾸려면 AWS IAM Role 정책의 S3 bucket ARN도 같이 바꿔야 합니다.

수동으로 다시 배포하고 싶으면 GitHub `Actions` 탭에서 `Deploy website to AWS` 워크플로를 `Run workflow`로 실행할 수 있습니다.

## www.velyx.kr 연결

`www.velyx.kr`까지 붙이려면 CloudFront용 ACM 인증서가 필요합니다. 인증서는 반드시 `us-east-1` 리전에 만들어야 합니다.

인증서가 준비되면 첫 배포 전에 이렇게 실행할 수 있습니다:

```powershell
$env:SITE_DOMAIN="www.velyx.kr"
$env:CERTIFICATE_ARN="arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"
npm run deploy:aws
```

배포 후 가비아 DNS에는 이런 CNAME을 추가합니다:

```text
타입: CNAME
호스트: www
값: <cloudfront_domain_name>
```

주의: `velyx.kr` 루트 A 레코드는 마크 서버용이므로 웹사이트용으로 바꾸지 마세요.

## Terraform 구성

Terraform으로 관리하고 싶으면 `infra/terraform`도 준비되어 있습니다.

```powershell
cd infra\terraform
terraform init
terraform apply
```
