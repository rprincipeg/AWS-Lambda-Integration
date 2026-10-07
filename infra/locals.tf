resource "random_id" "bucket_suffix" {
  byte_length = 4
}

locals {
  name_prefix          = var.sandbox == "" ? "${var.project_name}-${var.environment}" : "${var.project_name}-${var.environment}-${var.sandbox}"
  upload_function_name = "${local.name_prefix}-upload"
  crop_function_name   = "${local.name_prefix}-crop"
  bucket_name          = "${local.name_prefix}-images-${random_id.bucket_suffix.hex}"
  bucket_arn           = "arn:aws:s3:::${local.bucket_name}"
  upload_prefix        = "uploads/"
  processed_prefix     = "processed/"
}
