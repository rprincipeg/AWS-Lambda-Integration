aws_region           = "us-east-1"
project_name         = "image-processor"
environment          = "prod"
sandbox              = ""

lambda_runtime       = "nodejs20.x"
log_retention_days   = 14

vpc_cidr             = "10.2.0.0/16"
bucket_force_destroy = false

api_rate_limit       = 10000
api_burst_limit      = 5000

sqs_max_concurrency  = 5