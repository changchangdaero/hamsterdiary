output "state_bucket_name" {
  description = "Bucket to use in the main infra stack's S3 backend"
  value       = aws_s3_bucket.state.bucket
}
