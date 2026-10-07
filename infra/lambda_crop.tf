# Log group de crop-lambda. Se crea antes que la función para controlar su retención.
resource "aws_cloudwatch_log_group" "crop" {
  name              = "/aws/lambda/${local.crop_function_name}"
  retention_in_days = var.log_retention_days
}

# Comprime el paquete de crop-lambda. Antes de terraform plan o apply hay que
# ejecutar lambdas/crop/build.sh, que genera la carpeta build/ con los
# binarios de sharp para Linux x64.
data "archive_file" "crop" {
  type        = "zip"
  source_dir  = "${path.module}/../lambdas/crop/build"
  output_path = "${path.module}/build/crop.zip"
}

resource "aws_lambda_function" "crop" {
  function_name = local.crop_function_name
  role          = aws_iam_role.crop_lambda.arn
  handler       = "index.handler"
  runtime       = var.lambda_runtime
  # Debe coincidir con los binarios de sharp (linux-x64) que instala build.sh.
  architectures = ["x86_64"]
  memory_size   = 512
  timeout       = 60

  filename         = data.archive_file.crop.output_path
  source_code_hash = data.archive_file.crop.output_base64sha256

  environment {
    variables = {
      S3_BUCKET        = aws_s3_bucket.images.id
      UPLOAD_PREFIX    = local.upload_prefix
      PROCESSED_PREFIX = local.processed_prefix
      CROP_SIZE        = "40"
    }
  }

  # Corre en las subnets privadas; solo sale a S3 por el endpoint gateway.
  vpc_config {
    subnet_ids         = local.private_subnet_ids
    security_group_ids = [aws_security_group.crop_lambda.id]
  }

  depends_on = [
    aws_cloudwatch_log_group.crop,
    aws_iam_role_policy_attachment.crop_basic,
    aws_iam_role_policy_attachment.crop_vpc,
    aws_iam_role_policy.crop_permissions,
  ]
}

# Conecta la cola principal con crop-lambda. La lectura de SQS la hace el
# servicio Lambda (fuera de la VPC), no la función, por eso no hace falta un
# endpoint de SQS dentro de la VPC.
resource "aws_lambda_event_source_mapping" "crop_sqs" {
  event_source_arn = aws_sqs_queue.main.arn
  function_name    = aws_lambda_function.crop.arn
  batch_size       = 5
  enabled          = true

  # Permite que el handler devuelva batchItemFailures y que SQS solo
  # reintente los mensajes fallidos.
  function_response_types = ["ReportBatchItemFailures"]

  # Limita las ejecuciones en paralelo como protección de costos ante una
  # avalancha de imágenes; el valor cambia por entorno.
  scaling_config {
    maximum_concurrency = var.sqs_max_concurrency
  }

  # AWS valida los permisos de SQS del rol al crear el mapping.
  depends_on = [aws_iam_role_policy.crop_permissions]
}

output "crop_function_name" {
  description = "Nombre de la función Lambda que recorta las imágenes en círculo."
  value       = aws_lambda_function.crop.function_name
}
