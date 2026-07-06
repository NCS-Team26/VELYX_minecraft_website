set -euo pipefail

BUCKET="menhera-minecraft-server-website"
REGION="ap-northeast-1"
ORIGIN_DOMAIN="$BUCKET.s3.$REGION.amazonaws.com"
OAC_NAME="$BUCKET-oac"
COMMENT="velyx.kr Minecraft server website"
ORIGIN_ID="s3-$BUCKET"
SID="AllowCloudFrontOACReadOnlyForVelyxWebsite"

echo "[1/5] Checking AWS account..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "ACCOUNT=$ACCOUNT_ID"

echo "[2/5] Ensuring CloudFront Origin Access Control..."
OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='$OAC_NAME'].Id | [0]" --output text 2>/dev/null || true)
if [ -z "$OAC_ID" ] || [ "$OAC_ID" = "None" ]; then
  cat > /tmp/oac-config.json <<JSON
{
  "Name": "$OAC_NAME",
  "Description": "OAC for $BUCKET",
  "SigningProtocol": "sigv4",
  "SigningBehavior": "always",
  "OriginAccessControlOriginType": "s3"
}
JSON
  OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config file:///tmp/oac-config.json --query 'OriginAccessControl.Id' --output text)
  echo "Created OAC: $OAC_ID"
else
  echo "Using existing OAC: $OAC_ID"
fi

echo "[3/5] Looking for existing CloudFront distribution..."
aws cloudfront list-distributions --output json > /tmp/cf-list.json
read -r DIST_ID DIST_DOMAIN <<EOF
$(python3 - <<PY
import json
origin_domain = "$ORIGIN_DOMAIN"
comment = "$COMMENT"
items = (json.load(open('/tmp/cf-list.json')).get('DistributionList') or {}).get('Items') or []
for d in items:
    origins = (d.get('Origins') or {}).get('Items') or []
    if d.get('Comment') == comment or any(o.get('DomainName') == origin_domain for o in origins):
        print(d.get('Id', ''), d.get('DomainName', ''))
        break
else:
    print('', '')
PY
)
EOF

if [ -z "$DIST_ID" ]; then
  CACHE_POLICY_ID=$(aws cloudfront list-cache-policies --type managed --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='Managed-CachingOptimized'].CachePolicy.Id | [0]" --output text)
  CALLER_REFERENCE="$BUCKET-$(date +%s)"
  cat > /tmp/cf-config.json <<JSON
{
  "CallerReference": "$CALLER_REFERENCE",
  "Aliases": {"Quantity": 0},
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "$ORIGIN_ID",
        "DomainName": "$ORIGIN_DOMAIN",
        "OriginPath": "",
        "CustomHeaders": {"Quantity": 0},
        "S3OriginConfig": {"OriginAccessIdentity": ""},
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10,
        "OriginShield": {"Enabled": false},
        "OriginAccessControlId": "$OAC_ID"
      }
    ]
  },
  "OriginGroups": {"Quantity": 0},
  "DefaultCacheBehavior": {
    "TargetOriginId": "$ORIGIN_ID",
    "TrustedSigners": {"Enabled": false, "Quantity": 0},
    "TrustedKeyGroups": {"Enabled": false, "Quantity": 0},
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
    },
    "SmoothStreaming": false,
    "Compress": true,
    "LambdaFunctionAssociations": {"Quantity": 0},
    "FunctionAssociations": {"Quantity": 0},
    "FieldLevelEncryptionId": "",
    "CachePolicyId": "$CACHE_POLICY_ID"
  },
  "CacheBehaviors": {"Quantity": 0},
  "CustomErrorResponses": {"Quantity": 0},
  "Comment": "$COMMENT",
  "Logging": {"Enabled": false, "IncludeCookies": false, "Bucket": "", "Prefix": ""},
  "PriceClass": "PriceClass_200",
  "Enabled": true,
  "ViewerCertificate": {"CloudFrontDefaultCertificate": true, "MinimumProtocolVersion": "TLSv1", "CertificateSource": "cloudfront"},
  "Restrictions": {"GeoRestriction": {"RestrictionType": "none", "Quantity": 0}},
  "WebACLId": "",
  "HttpVersion": "http2",
  "IsIPV6Enabled": true
}
JSON
  DIST_ID=$(aws cloudfront create-distribution --distribution-config file:///tmp/cf-config.json --query 'Distribution.Id' --output text)
  DIST_DOMAIN=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text)
  echo "Created distribution: $DIST_ID"
else
  echo "Using existing distribution: $DIST_ID"
fi

echo "[4/5] Updating S3 bucket policy for private CloudFront access..."
aws s3api get-bucket-policy --bucket "$BUCKET" --query Policy --output text > /tmp/existing-policy.json 2>/dev/null || true
python3 - <<PY
import json
bucket = "$BUCKET"
account = "$ACCOUNT_ID"
dist_id = "$DIST_ID"
sid = "$SID"
text = ''
try:
    text = open('/tmp/existing-policy.json', 'r', encoding='utf-8').read().strip()
except FileNotFoundError:
    pass
try:
    policy = json.loads(text) if text and text != 'None' else {"Version": "2012-10-17", "Statement": []}
except Exception:
    policy = {"Version": "2012-10-17", "Statement": []}
stmts = policy.get('Statement', [])
if isinstance(stmts, dict):
    stmts = [stmts]
stmts = [s for s in stmts if s.get('Sid') != sid]
stmts.append({
    "Sid": sid,
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": f"arn:aws:s3:::{bucket}/*",
    "Condition": {"StringEquals": {"AWS:SourceArn": f"arn:aws:cloudfront::{account}:distribution/{dist_id}"}}
})
policy['Statement'] = stmts
open('/tmp/bucket-policy.json', 'w', encoding='utf-8').write(json.dumps(policy, indent=2))
PY
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/bucket-policy.json

echo "[5/5] Creating cache invalidation..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*' --query 'Invalidation.Id' --output text || true
STATUS=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.Status' --output text)
echo "CODEX_CF_DISTRIBUTION_ID=$DIST_ID"
echo "CODEX_CF_DOMAIN=$DIST_DOMAIN"
echo "CODEX_CF_STATUS=$STATUS"
echo "CODEX_CF_URL=https://$DIST_DOMAIN/"
