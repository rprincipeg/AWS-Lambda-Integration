variable "aws_region" {
  description = "Región de AWS donde se desplegará la infraestructura."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nombre base del proyecto."
  type        = string
  default     = "image-processor"
}

variable "environment" {
  description = "Entorno oficial de despliegue. Solo puede ser dev, qa o prod."
  type        = string

  validation {
    condition     = contains(["dev", "qa", "prod"], var.environment)
    error_message = "El entorno debe ser uno de estos valores: dev, qa o prod."
  }
}

variable "sandbox" {
  description = "Nombre de un sandbox personal para pruebas; vacío en los entornos oficiales."
  type        = string
  default     = ""

  validation {
    condition     = can(regex("^[a-z0-9]{0,12}$", var.sandbox))
    error_message = "El sandbox debe estar vacío o contener solo minúsculas y números, con un máximo de 12 caracteres."
  }
}

variable "lambda_runtime" {
  description = "Runtime de Lambda. nodejs20.x está deprecado desde el 30/04/2026, aunque AWS permite crear funciones con este runtime hasta el 29/07/2027. Puede cambiarse a nodejs22.x."
  type        = string
  default     = "nodejs20.x"
}

variable "log_retention_days" {
  description = "Cantidad de días de retención de los grupos de logs."
  type        = number
  default     = 14
}

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC. Cambia según el entorno."
  type        = string
  default     = "10.0.0.0/16"
}

variable "bucket_force_destroy" {
  description = "Indica si Terraform puede vaciar el bucket antes de eliminarlo. En PROD debe ser false para proteger los datos."
  type        = bool
  default     = false
}

variable "api_rate_limit" {
  description = "Límite de solicitudes por segundo de la API HTTP de Bryan."
  type        = number
  default     = 10000
}

variable "api_burst_limit" {
  description = "Límite de ráfaga de solicitudes de la API HTTP de Bryan."
  type        = number
  default     = 5000
}

variable "sqs_max_concurrency" {
  description = "Máximo de ejecuciones simultáneas de la Lambda crop mediante el Event Source Mapping de SQS."
  type        = number
  default     = 5

  validation {
    condition     = var.sqs_max_concurrency >= 2 && var.sqs_max_concurrency <= 1000
    error_message = "sqs_max_concurrency debe estar entre 2 y 1000."
  }
}
