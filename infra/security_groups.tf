resource "aws_security_group" "upload_lambda" {
  name        = "${local.name_prefix}-sg-upload-lambda"
  description = "Permite a upload-lambda comunicarse con S3 mediante el endpoint gateway."
  vpc_id      = aws_vpc.main.id

  egress {
    description     = "HTTPS hacia el endpoint gateway de S3"
    protocol        = "tcp"
    from_port       = 443
    to_port         = 443
    prefix_list_ids = [aws_vpc_endpoint.s3.prefix_list_id]
  }
}

resource "aws_security_group" "crop_lambda" {
  name        = "${local.name_prefix}-sg-crop-lambda"
  description = "Permite a crop-lambda comunicarse con S3 mediante el endpoint gateway."
  vpc_id      = aws_vpc.main.id

  egress {
    description     = "HTTPS hacia el endpoint gateway de S3"
    protocol        = "tcp"
    from_port       = 443
    to_port         = 443
    prefix_list_ids = [aws_vpc_endpoint.s3.prefix_list_id]
  }
}
