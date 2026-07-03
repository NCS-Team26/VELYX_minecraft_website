variable "aws_region" {
  description = "AWS region for the S3 bucket."
  type        = string
  default     = "ap-northeast-2"
}

variable "allow_billable_resources" {
  description = "Set true only when you intentionally allow Terraform to create or update billable AWS resources."
  type        = bool
  default     = false
}

variable "site_domain" {
  description = "Optional custom domain for the website. Keep nfoifsb.kr for Minecraft and use www.nfoifsb.kr for the website."
  type        = string
  default     = "www.nfoifsb.kr"
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN in us-east-1 for site_domain. Leave empty to use the CloudFront default domain."
  type        = string
  default     = ""
}

variable "bucket_name" {
  description = "Optional globally unique S3 bucket name. Leave empty to generate one."
  type        = string
  default     = ""
}
