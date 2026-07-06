output "bucket_name" {
  value       = aws_s3_bucket.site.bucket
  description = "S3 bucket that receives the built dist files."
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.site.id
  description = "CloudFront distribution ID for cache invalidation."
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.site.domain_name
  description = "Public CloudFront URL. Use this until the custom domain is connected."
}

output "custom_domain_note" {
  value = var.certificate_arn == "" ? "No certificate ARN supplied. Use the CloudFront domain or add an ACM us-east-1 certificate for www.velyx.kr." : "Create a CNAME at Gabia: www -> ${aws_cloudfront_distribution.site.domain_name}"
}
