import { requireAwsCostOptIn } from "./require-aws-cost-opt-in.mjs";
import {
  CloudFrontClient,
  CreateDistributionCommand,
  CreateInvalidationCommand,
  CreateOriginAccessControlCommand,
  CreateResponseHeadersPolicyCommand,
  GetDistributionConfigCommand,
  GetResponseHeadersPolicyConfigCommand,
  ListDistributionsCommand,
  ListOriginAccessControlsCommand,
  ListResponseHeadersPoliciesCommand,
  UpdateDistributionCommand,
  UpdateResponseHeadersPolicyCommand,
} from "@aws-sdk/client-cloudfront";
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketOwnershipControlsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { Upload } from "@aws-sdk/lib-storage";
import { lookup as lookupMime } from "mime-types";
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative, sep } from "node:path";

requireAwsCostOptIn("AWS website deploy");

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-2";
const distDir = join(process.cwd(), "dist");
const distributionComment = "nfoifsb Minecraft server website";
const originId = "site-s3";
const playerApiOriginId = "minecraft-player-api";
const playerApiOriginDomainName = process.env.PLAYER_API_ORIGIN_DOMAIN || "minecraftserver1.tail16d543.ts.net";
const playerApiPathPattern = "/minecraft/*";
const cachePolicyOptimized = "658327ea-f89d-4fab-a63d-7e88639e58f6";
const cachePolicyDisabled = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";
const originRequestPolicyAllViewerExceptHostHeader = "b689b0a8-53d0-40ab-baf2-68738e2966ac";
const securityHeadersPolicyName = "nfoifsb-site-security-headers";
const siteDomain = process.env.SITE_DOMAIN || "";
const certificateArn = process.env.CERTIFICATE_ARN || "";

if (!existsSync(distDir)) {
  throw new Error("dist folder is missing. Run npm run build first.");
}

if ((siteDomain && !certificateArn) || (!siteDomain && certificateArn)) {
  throw new Error("Set both SITE_DOMAIN and CERTIFICATE_ARN, or leave both empty for the default CloudFront URL.");
}

const sts = new STSClient({ region });
const s3 = new S3Client({ region });
const cloudfront = new CloudFrontClient({ region: "us-east-1" });

function log(message) {
  process.stdout.write(`${message}\n`);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function getAccountId() {
  try {
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    return identity.Account;
  } catch (error) {
    throw new Error(
      "AWS credentials are not configured. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or run AWS SSO/config first.",
      { cause: error },
    );
  }
}

function bucketNameFor(accountId) {
  return (process.env.SITE_BUCKET || `nfoifsb-minecraft-site-${accountId}`).toLowerCase();
}

async function ensureBucket(bucket) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    log(`S3 bucket exists: ${bucket}`);
  } catch {
    const params = { Bucket: bucket };
    if (region !== "us-east-1") {
      params.CreateBucketConfiguration = { LocationConstraint: region };
    }
    await s3.send(new CreateBucketCommand(params));
    log(`Created S3 bucket: ${bucket}`);
  }

  await s3.send(
    new PutBucketOwnershipControlsCommand({
      Bucket: bucket,
      OwnershipControls: {
        Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }],
      },
    }),
  );

  await s3.send(
    new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true,
      },
    }),
  );
}

async function findOriginAccessControl(name) {
  let marker;
  do {
    const page = await cloudfront.send(new ListOriginAccessControlsCommand({ Marker: marker }));
    const items = page.OriginAccessControlList?.Items || [];
    const found = items.find((item) => item.Name === name);
    if (found) return found;
    marker = page.OriginAccessControlList?.NextMarker;
  } while (marker);
  return undefined;
}

async function ensureOriginAccessControl(bucket) {
  const name = `${bucket}-oac`;
  const existing = await findOriginAccessControl(name);
  if (existing?.Id) {
    log(`CloudFront OAC exists: ${existing.Id}`);
    return existing.Id;
  }

  const created = await cloudfront.send(
    new CreateOriginAccessControlCommand({
      OriginAccessControlConfig: {
        Name: name,
        Description: "Origin access control for nfoifsb Minecraft website",
        OriginAccessControlOriginType: "s3",
        SigningBehavior: "always",
        SigningProtocol: "sigv4",
      },
    }),
  );
  log(`Created CloudFront OAC: ${created.OriginAccessControl?.Id}`);
  return created.OriginAccessControl.Id;
}

function siteContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://mc-heads.net https://*.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self' https://api.mcstatus.io https://accounts.google.com https://*.execute-api.ap-northeast-1.amazonaws.com https://api.nfoifsb.kr https://minecraftserver1.tail16d543.ts.net",
    "frame-src https://accounts.google.com",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function securityHeadersPolicyConfig() {
  return {
    Name: securityHeadersPolicyName,
    Comment: "Security headers for nfoifsb Minecraft website",
    SecurityHeadersConfig: {
      ContentSecurityPolicy: {
        Override: true,
        ContentSecurityPolicy: siteContentSecurityPolicy(),
      },
      ContentTypeOptions: {
        Override: true,
      },
      FrameOptions: {
        Override: true,
        FrameOption: "DENY",
      },
      ReferrerPolicy: {
        Override: true,
        ReferrerPolicy: "strict-origin-when-cross-origin",
      },
      StrictTransportSecurity: {
        Override: true,
        AccessControlMaxAgeSec: 31536000,
        IncludeSubdomains: true,
        Preload: false,
      },
      XSSProtection: {
        Override: true,
        Protection: true,
        ModeBlock: true,
      },
    },
    CustomHeadersConfig: {
      Quantity: 3,
      Items: [
        {
          Header: "Permissions-Policy",
          Value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          Override: true,
        },
        {
          Header: "Cross-Origin-Opener-Policy",
          Value: "same-origin-allow-popups",
          Override: true,
        },
        {
          Header: "Cross-Origin-Resource-Policy",
          Value: "same-site",
          Override: true,
        },
      ],
    },
  };
}

async function findResponseHeadersPolicy(name) {
  let marker;
  do {
    const page = await cloudfront.send(new ListResponseHeadersPoliciesCommand({ Marker: marker, Type: "custom" }));
    const items = page.ResponseHeadersPolicyList?.Items || [];
    const found = items.find((item) => item.ResponseHeadersPolicy?.ResponseHeadersPolicyConfig?.Name === name);
    if (found?.ResponseHeadersPolicy?.Id) return found.ResponseHeadersPolicy.Id;
    marker = page.ResponseHeadersPolicyList?.NextMarker;
  } while (marker);
  return undefined;
}

async function ensureSecurityHeadersPolicy() {
  const existingId = await findResponseHeadersPolicy(securityHeadersPolicyName);
  if (existingId) {
    const current = await cloudfront.send(new GetResponseHeadersPolicyConfigCommand({ Id: existingId }));
    await cloudfront.send(
      new UpdateResponseHeadersPolicyCommand({
        Id: existingId,
        IfMatch: current.ETag,
        ResponseHeadersPolicyConfig: securityHeadersPolicyConfig(),
      }),
    );
    log(`Updated CloudFront response headers policy: ${existingId}`);
    return existingId;
  }

  const created = await cloudfront.send(
    new CreateResponseHeadersPolicyCommand({
      ResponseHeadersPolicyConfig: securityHeadersPolicyConfig(),
    }),
  );
  log(`Created CloudFront response headers policy: ${created.ResponseHeadersPolicy?.Id}`);
  return created.ResponseHeadersPolicy.Id;
}

async function findDistribution() {
  let marker;
  do {
    const page = await cloudfront.send(new ListDistributionsCommand({ Marker: marker }));
    const items = page.DistributionList?.Items || [];
    const found = items.find((item) => {
      const aliases = item.Aliases?.Items || [];
      return (siteDomain && aliases.includes(siteDomain)) || item.Comment === distributionComment;
    });
    if (found) return found;
    marker = page.DistributionList?.NextMarker;
  } while (marker);
  return undefined;
}

async function syncDistributionDefaults(distributionId, bucket, oacId, responseHeadersPolicyId) {
  const current = await cloudfront.send(new GetDistributionConfigCommand({ Id: distributionId }));
  const config = current.DistributionConfig;
  const desiredDomainName = `${bucket}.s3.${region}.amazonaws.com`;
  const originItems = config.Origins?.Items || [];
  const existingOrigin = originItems.find((item) => item.Id === originId) || originItems[0] || {};
  const existingPlayerApiOrigin = originItems.find((item) => item.Id === playerApiOriginId) || {};
  const desiredOrigin = {
    Id: originId,
    DomainName: desiredDomainName,
    OriginPath: "",
    OriginAccessControlId: oacId,
    S3OriginConfig: {
      OriginAccessIdentity: "",
    },
  };
  for (const key of ["ConnectionAttempts", "ConnectionTimeout", "CustomHeaders", "OriginShield"]) {
    if (existingOrigin[key] !== undefined) desiredOrigin[key] = existingOrigin[key];
  }
  const desiredPlayerApiOrigin = playerApiOrigin(existingPlayerApiOrigin);
  const nextOrigins = [
    desiredOrigin,
    desiredPlayerApiOrigin,
    ...originItems.filter((item) => ![existingOrigin.Id, originId, playerApiOriginId].includes(item.Id)),
  ];
  const defaultCacheBehavior = {
    ...config.DefaultCacheBehavior,
    TargetOriginId: originId,
    ResponseHeadersPolicyId: responseHeadersPolicyId,
  };
  const cacheBehaviorItems = config.CacheBehaviors?.Items || [];
  const existingPlayerApiBehavior =
    cacheBehaviorItems.find((item) => item.PathPattern === playerApiPathPattern) || {};
  const desiredPlayerApiBehavior = playerApiCacheBehavior(existingPlayerApiBehavior, responseHeadersPolicyId);
  const nextCacheBehaviorItems = [
    desiredPlayerApiBehavior,
    ...cacheBehaviorItems.filter((item) => item.PathPattern !== playerApiPathPattern),
  ];

  const originChanged =
    existingOrigin.Id !== desiredOrigin.Id
    || existingOrigin.DomainName !== desiredOrigin.DomainName
    || existingOrigin.OriginAccessControlId !== desiredOrigin.OriginAccessControlId
    || existingOrigin.OriginPath !== desiredOrigin.OriginPath
    || existingOrigin.S3OriginConfig?.OriginAccessIdentity !== ""
    || stableStringify(existingPlayerApiOrigin) !== stableStringify(desiredPlayerApiOrigin);
  const behaviorChanged =
    config.DefaultCacheBehavior?.TargetOriginId !== defaultCacheBehavior.TargetOriginId
    || config.DefaultCacheBehavior?.ResponseHeadersPolicyId !== defaultCacheBehavior.ResponseHeadersPolicyId
    || stableStringify(existingPlayerApiBehavior) !== stableStringify(desiredPlayerApiBehavior);

  if (!originChanged && !behaviorChanged) {
    log("CloudFront distribution origins, API proxy, and security headers are already current");
    return;
  }

  config.Origins = {
    Quantity: nextOrigins.length,
    Items: nextOrigins,
  };
  config.DefaultCacheBehavior = defaultCacheBehavior;
  config.CacheBehaviors = {
    Quantity: nextCacheBehaviorItems.length,
    Items: nextCacheBehaviorItems,
  };

  await cloudfront.send(
    new UpdateDistributionCommand({
      Id: distributionId,
      IfMatch: current.ETag,
      DistributionConfig: config,
    }),
  );
  log("Updated CloudFront distribution origin/API proxy/security headers");
}

function playerApiOrigin(existingOrigin = {}) {
  const origin = {
    Id: playerApiOriginId,
    DomainName: playerApiOriginDomainName,
    OriginPath: "",
    CustomOriginConfig: {
      HTTPPort: 80,
      HTTPSPort: 443,
      OriginProtocolPolicy: "https-only",
      OriginSslProtocols: {
        Quantity: 1,
        Items: ["TLSv1.2"],
      },
      OriginReadTimeout: 30,
      OriginKeepaliveTimeout: 5,
    },
  };
  for (const key of ["ConnectionAttempts", "ConnectionTimeout", "CustomHeaders", "OriginShield"]) {
    if (existingOrigin[key] !== undefined) origin[key] = existingOrigin[key];
  }
  return origin;
}

function playerApiCacheBehavior(existingBehavior = {}, responseHeadersPolicyId) {
  const behavior = {
    ...existingBehavior,
    PathPattern: playerApiPathPattern,
    TargetOriginId: playerApiOriginId,
    ViewerProtocolPolicy: "redirect-to-https",
    AllowedMethods: {
      Quantity: 7,
      Items: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
      CachedMethods: {
        Quantity: 3,
        Items: ["GET", "HEAD", "OPTIONS"],
      },
    },
    Compress: true,
    CachePolicyId: cachePolicyDisabled,
    OriginRequestPolicyId: originRequestPolicyAllViewerExceptHostHeader,
    ResponseHeadersPolicyId: responseHeadersPolicyId,
  };
  delete behavior.ForwardedValues;
  return behavior;
}

async function ensureDistribution(bucket, oacId, responseHeadersPolicyId) {
  const existing = await findDistribution();
  if (existing?.Id) {
    log(`CloudFront distribution exists: ${existing.Id}`);
    await syncDistributionDefaults(existing.Id, bucket, oacId, responseHeadersPolicyId);
    return existing;
  }

  const created = await cloudfront.send(
    new CreateDistributionCommand({
      DistributionConfig: {
        CallerReference: `${distributionComment}-${Date.now()}`,
        Comment: distributionComment,
        Enabled: true,
        IsIPV6Enabled: true,
        DefaultRootObject: "index.html",
        PriceClass: "PriceClass_200",
        Aliases: siteDomain ? { Quantity: 1, Items: [siteDomain] } : { Quantity: 0 },
        Origins: {
          Quantity: 2,
          Items: [
            {
              Id: originId,
              DomainName: `${bucket}.s3.${region}.amazonaws.com`,
              OriginAccessControlId: oacId,
              S3OriginConfig: {
                OriginAccessIdentity: "",
              },
            },
            playerApiOrigin(),
          ],
        },
        DefaultCacheBehavior: {
          TargetOriginId: originId,
          ViewerProtocolPolicy: "redirect-to-https",
          AllowedMethods: {
            Quantity: 3,
            Items: ["GET", "HEAD", "OPTIONS"],
            CachedMethods: {
              Quantity: 2,
              Items: ["GET", "HEAD"],
            },
          },
          Compress: true,
          CachePolicyId: cachePolicyOptimized,
          ResponseHeadersPolicyId: responseHeadersPolicyId,
        },
        CacheBehaviors: {
          Quantity: 1,
          Items: [playerApiCacheBehavior({}, responseHeadersPolicyId)],
        },
        CustomErrorResponses: {
          Quantity: 2,
          Items: [
            {
              ErrorCode: 403,
              ResponseCode: "200",
              ResponsePagePath: "/index.html",
              ErrorCachingMinTTL: 0,
            },
            {
              ErrorCode: 404,
              ResponseCode: "200",
              ResponsePagePath: "/index.html",
              ErrorCachingMinTTL: 0,
            },
          ],
        },
        Restrictions: {
          GeoRestriction: {
            RestrictionType: "none",
            Quantity: 0,
          },
        },
        ViewerCertificate: {
          ...(certificateArn
            ? {
                ACMCertificateArn: certificateArn,
                SSLSupportMethod: "sni-only",
                MinimumProtocolVersion: "TLSv1.2_2021",
              }
            : {
                CloudFrontDefaultCertificate: true,
              }),
        },
      },
    }),
  );

  log(`Created CloudFront distribution: ${created.Distribution?.Id}`);
  return created.Distribution;
}

async function allowCloudFrontRead(bucket, accountId, distributionId) {
  const distributionArn = `arn:aws:cloudfront::${accountId}:distribution/${distributionId}`;
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AllowCloudFrontServicePrincipalReadOnly",
        Effect: "Allow",
        Principal: { Service: "cloudfront.amazonaws.com" },
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${bucket}/*`,
        Condition: {
          StringEquals: {
            "AWS:SourceArn": distributionArn,
          },
        },
      },
    ],
  };

  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify(policy),
    }),
  );
}

function walkFiles(root, dir = root) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stats = statSync(path);
    return stats.isDirectory() ? walkFiles(root, path) : [path];
  });
}

function objectKey(root, file) {
  return relative(root, file).split(sep).join("/");
}

function cacheControl(key) {
  if (key.endsWith(".html")) return "no-cache,no-store,must-revalidate";
  if (/^assets\/.+-[A-Za-z0-9_-]+\.(css|js)$/.test(key)) {
    return "public,max-age=31536000,immutable";
  }
  return "public,max-age=3600";
}

function contentType(file) {
  if (extname(file).toLowerCase() === ".js") return "text/javascript; charset=utf-8";
  return lookupMime(file) || "application/octet-stream";
}

function localEtag(file) {
  return createHash("md5").update(readFileSync(file)).digest("hex");
}

async function listRemoteKeys(bucket) {
  const keys = new Set();
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const item of page.Contents || []) keys.add(item.Key);
    token = page.NextContinuationToken;
  } while (token);
  return keys;
}

async function uploadDist(bucket) {
  const files = walkFiles(distDir);
  const localKeys = new Set(files.map((file) => objectKey(distDir, file)));

  for (const file of files) {
    const key = objectKey(distDir, file);
    const stats = statSync(file);
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: key,
        Body: createReadStream(file),
        ContentLength: stats.size,
        ContentType: contentType(file),
        CacheControl: cacheControl(key),
        Metadata: {
          "local-md5": localEtag(file),
        },
      },
    });
    await upload.done();
    log(`Uploaded ${key}`);
  }

  const remoteKeys = await listRemoteKeys(bucket);
  const staleKeys = [...remoteKeys].filter((key) => !localKeys.has(key));
  for (let index = 0; index < staleKeys.length; index += 1000) {
    const batch = staleKeys.slice(index, index + 1000);
    if (batch.length) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      );
      log(`Deleted ${batch.length} stale objects`);
    }
  }
}

async function invalidate(distributionId) {
  const invalidation = await cloudfront.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `deploy-${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: ["/*"],
        },
      },
    }),
  );
  log(`Created invalidation: ${invalidation.Invalidation?.Id}`);
}

async function main() {
  const accountId = await getAccountId();
  const bucket = bucketNameFor(accountId);

  log(`AWS account: ${accountId}`);
  log(`AWS region: ${region}`);

  await ensureBucket(bucket);
  const oacId = await ensureOriginAccessControl(bucket);
  const responseHeadersPolicyId = await ensureSecurityHeadersPolicy();
  const distribution = await ensureDistribution(bucket, oacId, responseHeadersPolicyId);
  await allowCloudFrontRead(bucket, accountId, distribution.Id);
  await uploadDist(bucket);
  await invalidate(distribution.Id);

  const output = {
    bucket,
    distributionId: distribution.Id,
    cloudfrontDomainName: distribution.DomainName,
    responseHeadersPolicyId,
    url: `https://${distribution.DomainName}`,
    customDomain: siteDomain
      ? {
          domain: siteDomain,
          dnsForGabia: {
            type: "CNAME",
            host: siteDomain.replace(".nfoifsb.kr", ""),
            value: distribution.DomainName,
          },
        }
      : null,
    note: "Keep nfoifsb.kr as the Minecraft server address. Use the CloudFront URL first, or set SITE_DOMAIN/CERTIFICATE_ARN for www.nfoifsb.kr.",
  };

  writeFileSync("deploy-output.json", `${JSON.stringify(output, null, 2)}\n`);
  log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(`Deploy failed: ${error.message}`);
  if (error.cause?.name) {
    console.error(`Cause: ${error.cause.name}`);
  }
  process.exit(1);
});
