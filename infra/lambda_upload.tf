# Log group de la función: se crea antes que la Lambda para controlar la retención.
# Si Lambda lo creara sola, los logs se guardarían para siempre y se cobrarían.
resource "aws_cloudwatch_log_group" "upload" {
  name              = "/aws/lambda/${local.upload_function_name}"
  retention_in_days = var.log_retention_days
}

# Terraform comprime la carpeta build/ en un zip.
data "archive_file" "upload" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/upload/build"
  output_path = "${path.module}/build/upload.zip"
}

resource "aws_lambda_function" "upload" {
  function_name = local.upload_function_name
  role          = aws_iam_role.upload_lambda.arn
  handler       = "index.handler"
  runtime       = var.lambda_runtime
  architectures = ["x86_64"]
  memory_size   = 256
  timeout       = 30

  filename         = data.archive_file.upload.output_path
  source_code_hash = data.archive_file.upload.output_base64sha256

  environment {
    variables = {
      S3_BUCKET        = aws_s3_bucket.images.id
      UPLOAD_PREFIX    = local.upload_prefix
      MAX_UPLOAD_BYTES = "4194304"
    }
  }

  # Lambda crea sus interfaces de red en las dos subnets privadas (AZ-a y AZ-b)
  vpc_config {
    subnet_ids         = local.private_subnet_ids
    security_group_ids = [aws_security_group.upload_lambda.id]
  }

  # Primero el log group y los permisos del rol; sin los permisos de VPC,
  # la creación de la función falla porque Lambda no puede crear sus interfaces de red
  depends_on = [
    aws_cloudwatch_log_group.upload,
    aws_iam_role_policy_attachment.upload_basic,
    aws_iam_role_policy_attachment.upload_vpc,
    aws_iam_role_policy.upload_s3,
  ]
}

output "upload_function_name" {
  description = "Nombre de la función Lambda de subida."
  value       = aws_lambda_function.upload.function_name
}