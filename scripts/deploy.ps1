param(
  [Parameter(Mandatory = $true)]
  [string]$Bucket,

  [Parameter(Mandatory = $true)]
  [string]$DistributionId
)

$ErrorActionPreference = "Stop"

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
