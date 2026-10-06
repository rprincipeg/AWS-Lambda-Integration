aws_region           = "us-east-1"
project_name         = "image-processor"
environment          = "dev"
sandbox              = ""

lambda_runtime       = "nodejs20.x"
log_retention_days   = 14

vpc_cidr             = "10.0.0.0/16"
bucket_force_destroy = true

api_rate_limit       = 20
api_burst_limit      = 10

sqs_max_concurrency  = 2