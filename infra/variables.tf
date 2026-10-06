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
  description = "Entorno aislado de trabajo. Cada integrante debe usar un valor diferente."
  type        = string
  default     = "dev"
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
