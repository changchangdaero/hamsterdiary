variable "aws_region" {
  description = "Region for the Terraform state bucket"
  type        = string
  default     = "ap-northeast-2"
}

variable "state_bucket_prefix" {
  description = "State bucket name prefix; the AWS account ID is appended to keep it globally unique"
  type        = string
  default     = "hami-tfstate"
}
