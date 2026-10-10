resource "aws_iam_role" "crop_lambda" {
  name               = "${local.name_prefix}-crop-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "crop_basic" {
  role       = aws_iam_role.crop_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "crop_vpc" {
  role       = aws_iam_role.crop_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "crop_permissions" {
  name = "${local.name_prefix}-crop-permissions"
  role = aws_iam_role.crop_lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["s3:GetObject"], Resource = "${local.bucket_arn}/uploads/*" },
      { Effect = "Allow", Action = ["s3:PutObject"], Resource = "${local.bucket_arn}/processed/*" },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"]
        Resource = aws_sqs_queue.main.arn
      }
    ]
  })
  # El Event Source Mapping usa estos permisos para leer y gestionar mensajes.
}
