aws_region           = "us-east-1"
project_name         = "image-processor"
environment          = "qa"
sandbox              = ""

lambda_runtime       = "nodejs20.x"
log_retention_days   = 14

vpc_cidr             = "10.1.0.0/16"
bucket_force_destroy = true

api_rate_limit       = 100
api_burst_limit      = 50

sqs_max_concurrency  = 3