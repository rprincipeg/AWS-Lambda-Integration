# Acuerdos del equipo

## 1. Arquitectura e infraestructura

La infraestructura se implementa con Terraform en la carpeta `infra/`.

- Terraform: `>= 1.11`
- Proveedor AWS: `~> 5.0`
- Región AWS: `us-east-1`
- Un único root module plano en `infra/`
- Un archivo `.tf` por responsabilidad
- Los entornos oficiales son `dev`, `qa` y `prod`
- El mismo código Terraform se utiliza en los tres entornos
- Los valores específicos de cada entorno se proporcionan mediante archivos `.tfvars`
- Cada entorno utiliza un estado remoto separado en S3
- El bucket del estado remoto se proporciona mediante la variable de entorno `TF_STATE_BUCKET`
- El nombre del bucket del estado remoto no se escribe en el repositorio

La arquitectura de red utiliza:

- VPC privada
- Dos subnets privadas
- Sin Internet Gateway
- Sin NAT Gateway
- Sin endpoints de interfaz
- Solo un Gateway Endpoint de S3

El versionado del bucket de imágenes está deshabilitado.

La alarma de la DLQ y SNS quedan fuera del alcance de esta fase.

---

## 2. Nombres de recursos

El patrón general de nombres es:

`image-processor-<entorno>[-<sandbox>]-...`

Donde:

- `<entorno>` puede ser `dev`, `qa` o `prod`
- `<sandbox>` es opcional y corresponde a un sandbox personal
- `env` y `suffix` del diagrama son marcadores, no nombres literales

| Recurso | Nombre |
|---|---|
| VPC | `image-processor-<entorno>[-<sandbox>]-vpc` |
| Subnet privada A | `image-processor-<entorno>[-<sandbox>]-subnet-private-a` |
| Subnet privada B | `image-processor-<entorno>[-<sandbox>]-subnet-private-b` |
| Route table A | `image-processor-<entorno>[-<sandbox>]-rt-private-a` |
| Route table B | `image-processor-<entorno>[-<sandbox>]-rt-private-b` |
| Endpoint S3 | `image-processor-<entorno>[-<sandbox>]-vpce-s3` |
| SG upload | `image-processor-<entorno>[-<sandbox>]-sg-upload-lambda` |
| SG crop | `image-processor-<entorno>[-<sandbox>]-sg-crop-lambda` |
| Bucket S3 | `image-processor-<entorno>[-<sandbox>]-images-<sufijo-aleatorio>` |
| Cola principal | `image-processor-<entorno>[-<sandbox>]-image-queue` |
| Cola DLQ | `image-processor-<entorno>[-<sandbox>]-image-dlq` |
| Lambda upload | `image-processor-<entorno>[-<sandbox>]-upload` |
| Lambda crop | `image-processor-<entorno>[-<sandbox>]-crop` |
| Rol upload | `image-processor-<entorno>[-<sandbox>]-upload-lambda-role` |
| Rol crop | `image-processor-<entorno>[-<sandbox>]-crop-lambda-role` |

No se deben cambiar estos nombres sin avisar al equipo porque Bryan y Renzo los utilizan como contrato desde sus archivos Terraform.

---

## 3. Contrato de variables

Todas estas variables se declaran en `infra/variables.tf`.

| Variable | Valor por defecto / regla |
|---|---|
| `var.aws_region` | `us-east-1` |
| `var.project_name` | `image-processor` |
| `var.environment` | Sin valor por defecto. Solo acepta `dev`, `qa` o `prod` |
| `var.sandbox` | `""`. Para pruebas personales usa nombres en minúsculas y números, hasta 12 caracteres |
| `var.lambda_runtime` | `nodejs20.x` |
| `var.log_retention_days` | `14` |
| `var.vpc_cidr` | `10.0.0.0/16`. Cambia por entorno |
| `var.bucket_force_destroy` | `false`. Cambia por entorno |
| `var.api_rate_limit` | `10000`. Cambia por entorno |
| `var.api_burst_limit` | `5000`. Cambia por entorno |
| `var.sqs_max_concurrency` | `5`. Cambia por entorno. Mínimo `2` |

`lambda_runtime` utiliza `nodejs20.x` por compatibilidad con el diagrama actual. AWS lo marca como deprecado desde el 30/04/2026, pero permite crear funciones con este runtime hasta el 29/07/2027. Puede cambiarse a `nodejs22.x`.

Ningún valor específico de un entorno debe escribirse directamente dentro de los recursos Terraform. Los valores que cambian entre entornos deben provenir de variables o de `local.name_prefix`.

---

## 4. Contrato de locals

| Local | Valor |
|---|---|
| `local.name_prefix` | `${var.project_name}-${var.environment}` si no hay sandbox |
| `local.name_prefix` | `${var.project_name}-${var.environment}-${var.sandbox}` si hay sandbox |
| `local.upload_function_name` | `${local.name_prefix}-upload` |
| `local.crop_function_name` | `${local.name_prefix}-crop` |
| `local.bucket_name` | `${local.name_prefix}-images-${random_id.bucket_suffix.hex}` |
| `local.bucket_arn` | `arn:aws:s3:::${local.bucket_name}` |
| `local.upload_prefix` | `uploads/` |
| `local.processed_prefix` | `processed/` |
| `local.private_subnet_ids` | Lista con las dos subnets privadas |

`local.private_subnet_ids` se define junto con las subnets privadas.

---

## 5. Contrato de recursos Terraform

| Dirección en Terraform | Qué representa |
|---|---|
| `aws_vpc.main` | VPC basada en `var.vpc_cidr` |
| `aws_subnet.private_a` | Primera subnet privada |
| `aws_subnet.private_b` | Segunda subnet privada |
| `aws_vpc_endpoint.s3` | Gateway Endpoint de S3 |
| `aws_security_group.upload_lambda` | Security Group de upload-lambda |
| `aws_security_group.crop_lambda` | Security Group de crop-lambda |
| `aws_s3_bucket.images` | Bucket de imágenes |
| `aws_sqs_queue.main` | Cola SQS principal |
| `aws_sqs_queue.dlq` | Cola SQS de mensajes fallidos |
| `aws_iam_role.upload_lambda` | Rol IAM de upload-lambda |
| `aws_iam_role.crop_lambda` | Rol IAM de crop-lambda |
| `aws_iam_role_policy_attachment.upload_basic` | Permisos básicos de ejecución de upload-lambda |
| `aws_iam_role_policy_attachment.upload_vpc` | Permisos de VPC de upload-lambda |
| `aws_iam_role_policy_attachment.crop_basic` | Permisos básicos de ejecución de crop-lambda |
| `aws_iam_role_policy_attachment.crop_vpc` | Permisos de VPC de crop-lambda |
| `aws_iam_role_policy.upload_s3` | Permisos mínimos de S3 de upload-lambda |
| `aws_iam_role_policy.crop_permissions` | Permisos mínimos de S3 y SQS de crop-lambda |

---

## 6. Valores por entorno

| Variable | DEV | QA | PROD |
|---|---:|---:|---:|
| `vpc_cidr` | `10.0.0.0/16` | `10.1.0.0/16` | `10.2.0.0/16` |
| `bucket_force_destroy` | `true` | `true` | `false` |
| `api_rate_limit` | `20` | `100` | `10000` |
| `api_burst_limit` | `10` | `50` | `5000` |
| `sqs_max_concurrency` | `2` | `3` | `5` |
| `log_retention_days` | `14` | `14` | `14` |

Las subnets se calculan a partir de `vpc_cidr` mediante `cidrsubnet`.

En DEV:

- subnet privada A: `10.0.11.0/24`
- subnet privada B: `10.0.12.0/24`

---

## 7. Convención de claves en S3

Las imágenes originales utilizan:

`uploads/{uuid}_{nombre}.{ext}`

Las imágenes procesadas utilizan:

`processed/{uuid}_{nombre}_circular.png`

El nombre debe estar en minúsculas y utilizar únicamente:

- letras
- números
- punto
- guion
- guion bajo

---

## 8. Límite de subida

El límite de subida de imágenes es de **4 MB**.

La invocación síncrona de Lambda admite 6 MB y el cuerpo de la solicitud viaja en base64, lo que aumenta aproximadamente un 33 % el tamaño.

Por este motivo, el límite de 10 MB mostrado en el diagrama de API Gateway no se utiliza en esta implementación.

Una alternativa futura es utilizar presigned URLs de S3 para permitir cargas mayores.

---

## 9. Entornos y estado de Terraform

Existen tres entornos oficiales:

| Entorno | Rama | Propósito |
|---|---|---|
| DEV | `develop` | Integración del equipo |
| QA | `qa` | Validación formal |
| PROD | `main` | Entorno final |

Cada entorno utiliza un archivo de valores:

```text
infra/environments/dev.tfvars
infra/environments/qa.tfvars
infra/environments/prod.tfvars
