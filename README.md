# nfoifsb.kr Minecraft Site

`nfoifsb.kr` 마인크래프트 서버용 정적 웹사이트입니다.

루트 도메인 `nfoifsb.kr`은 마크 서버 접속 주소로 계속 쓰고, 웹사이트는 우선 CloudFront 기본 주소로 공개하거나 나중에 `www.nfoifsb.kr`에 붙이는 구성을 권장합니다.

## 사이트 기능

- Three.js 기반 3D 마인크래프트 히어로 씬 (Data Saver / 모션 최소화 시 자동 폴백)
- mcstatus.io API 실시간 서버 상태 (접속자 수, 버전, 온라인 표시)
- 서버 주소 클립보드 복사 (`복사됨 ✓` 피드백)
- 새 창으로 열리는 로그인 전용 화면 (`login.html`)
- Google 계정 로그인 UI, 회원가입/비밀번호 찾기/자동 로그인 버튼
- 스크롤 등장 애니메이션, hover 인터랙션, 모바일 햄버거 메뉴
- 접근성: `prefers-reduced-motion` 존중, 키보드 포커스 링, 본문 건너뛰기 링크
- SEO/공유: Open Graph · Twitter Card · JSON-LD 메타

## 로컬 실행

```powershell
npm install
npm run dev
```

로컬 주소:

```text
http://127.0.0.1:5173/
```

## Google 로그인 설정

Google 로그인 버튼을 활성화하려면 Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 만든 뒤 환경변수에 넣어야 합니다.

1. Google Cloud Console에서 `API 및 서비스` > `사용자 인증 정보` > `OAuth 클라이언트 ID`를 생성합니다.
2. 애플리케이션 유형은 `웹 애플리케이션`을 선택합니다.
3. 승인된 JavaScript 원본에 로컬 개발 주소와 배포 주소를 추가합니다.

```text
http://127.0.0.1:5173
https://<cloudfront_domain_name>
https://www.nfoifsb.kr
```

4. `.env.example`을 참고해 `.env`를 만들고 클라이언트 ID를 넣습니다.

```powershell
Copy-Item .env.example .env
```

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

현재 사이트는 정적 프론트엔드라 Google ID 토큰과 일반 로그인 폼 입력을 브라우저 표시용으로만 사용합니다. 서버 API와 연결해 권한 처리를 할 경우에는 서버에서 ID 토큰 서명과 계정 정보를 검증해야 합니다.

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
$env:AWS_REGION="ap-northeast-2"
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
VITE_GOOGLE_CLIENT_ID   # Google 로그인 버튼 활성화
SITE_BUCKET             # 기본값: menhera-minecraft-server-website
SITE_DOMAIN             # 기본값: www.nfoifsb.kr
CERTIFICATE_ARN         # 기본값: www.nfoifsb.kr용 us-east-1 ACM 인증서 ARN
```

`SITE_BUCKET`을 기본값이 아닌 이름으로 바꾸려면 AWS IAM Role 정책의 S3 bucket ARN도 같이 바꿔야 합니다.

수동으로 다시 배포하고 싶으면 GitHub `Actions` 탭에서 `Deploy website to AWS` 워크플로를 `Run workflow`로 실행할 수 있습니다.

## www.nfoifsb.kr 연결

`www.nfoifsb.kr`까지 붙이려면 CloudFront용 ACM 인증서가 필요합니다. 인증서는 반드시 `us-east-1` 리전에 만들어야 합니다.

인증서가 준비되면 첫 배포 전에 이렇게 실행할 수 있습니다:

```powershell
$env:SITE_DOMAIN="www.nfoifsb.kr"
$env:CERTIFICATE_ARN="arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID"
npm run deploy:aws
```

배포 후 가비아 DNS에는 이런 CNAME을 추가합니다:

```text
타입: CNAME
호스트: www
값: <cloudfront_domain_name>
```

주의: `nfoifsb.kr` 루트 A 레코드는 마크 서버용이므로 웹사이트용으로 바꾸지 마세요.

## Terraform 구성

Terraform으로 관리하고 싶으면 `infra/terraform`도 준비되어 있습니다.

```powershell
cd infra\terraform
terraform init
terraform apply
```
