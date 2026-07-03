# AWS zero-cost guard

이 저장소의 기본 설정은 AWS 리소스를 만들지 않는 방향입니다. 로컬 개발, 로컬 인증, 정적 빌드만 실행하면 AWS 비용이 발생하지 않습니다.

## 비용이 발생하지 않는 명령

```powershell
npm install
npm run admin:create
npm run dev:local
npm run build
```

`npm run dev:local`은 Vite와 로컬 인증 서버만 실행합니다. 회원/관리자 데이터는 `.local/auth/`에 저장되고 git에는 올라가지 않습니다.

## 비용 가능성이 있어 기본 차단되는 명령

```powershell
npm run auth:setup:aws
npm run deploy:aws
.\scripts\deploy.ps1
terraform apply
```

위 명령은 DynamoDB, Lambda, API Gateway, S3, CloudFront 같은 AWS 리소스를 만들거나 갱신할 수 있습니다. 그래서 기본값에서는 실패합니다.

정말 AWS 리소스를 만들 때만 다음처럼 명시적으로 허용합니다.

```powershell
$env:ALLOW_AWS_COSTS="1"
npm run auth:setup:aws
npm run deploy:aws
```

Terraform은 다음 값을 직접 넣어야 합니다.

```powershell
terraform apply -var allow_billable_resources=true
```

GitHub Actions 배포도 자동 push 실행을 제거했고, 수동 실행에서 `allow_aws_costs` 값을 `1`로 입력해야만 진행됩니다.
