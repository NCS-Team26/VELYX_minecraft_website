# nfoifsb.kr Minecraft Site

`nfoifsb.kr` 마인크래프트 서버용 정적 웹사이트입니다.

루트 도메인 `nfoifsb.kr`은 마크 서버 접속 주소로 계속 쓰고, 웹사이트는 우선 CloudFront 기본 주소로 공개하거나 나중에 `www.nfoifsb.kr`에 붙이는 구성을 권장합니다.

## 로컬 실행

```powershell
npm install
npm run dev
```

로컬 주소:

```text
http://127.0.0.1:5173/
```

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
