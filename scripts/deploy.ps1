param(
  [Parameter(Mandatory = $true)]
  [string]$Bucket,

  [Parameter(Mandatory = $true)]
  [string]$DistributionId
)

$ErrorActionPreference = "Stop"

if ($env:ALLOW_AWS_COSTS -ne "1") {
  throw "AWS deploy is blocked because it can create or update billable resources. Set ALLOW_AWS_COSTS=1 only when intentional."
}

npm run build

aws s3 sync .\dist "s3://$Bucket" --delete `
  --cache-control "public,max-age=31536000,immutable" `
  --exclude "index.html"

aws s3 cp .\dist\index.html "s3://$Bucket/index.html" `
  --cache-control "no-cache,no-store,must-revalidate" `
  --content-type "text/html"

aws cloudfront create-invalidation `
  --distribution-id $DistributionId `
  --paths "/*"
