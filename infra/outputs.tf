output "vpc_id" {
  description = "ID de la VPC privada del proyecto."
  value       = aws_vpc.main.id
}
output "private_subnet_ids" {
  description = "IDs de las dos subnets privadas."
  value       = local.private_subnet_ids
}
output "upload_lambda_sg_id" {
  description = "ID del Security Group de upload-lambda."
  value       = aws_security_group.upload_lambda.id
}
output "crop_lambda_sg_id" {
  description = "ID del Security Group de crop-lambda."
  value       = aws_security_group.crop_lambda.id
}
output "bucket_name" {
  description = "Nombre del bucket S3 de imágenes."
  value       = aws_s3_bucket.images.bucket
}
output "bucket_arn" {
  description = "ARN del bucket S3 de imágenes."
  value       = aws_s3_bucket.images.arn
}
output "queue_url" {
  description = "URL de la cola SQS principal."
  value       = aws_sqs_queue.main.url
}
output "queue_arn" {
  description = "ARN de la cola SQS principal."
  value       = aws_sqs_queue.main.arn
}
output "dlq_url" {
  description = "URL de la cola SQS de mensajes fallidos."
  value       = aws_sqs_queue.dlq.url
}
output "dlq_arn" {
  description = "ARN de la cola SQS de mensajes fallidos."
  value       = aws_sqs_queue.dlq.arn
}
output "upload_role_arn" {
  description = "ARN del rol IAM de upload-lambda."
  value       = aws_iam_role.upload_lambda.arn
}
output "crop_role_arn" {
  description = "ARN del rol IAM de crop-lambda."
  value       = aws_iam_role.crop_lambda.arn
}
