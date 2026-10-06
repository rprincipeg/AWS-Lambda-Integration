# Contrato de infraestructura de André

## Contrato de nombres

| Nombre | Valor |
|---|---|
| `var.aws_region` | `us-east-1` |
| `var.project_name` | `image-processor` |
| `var.environment` | `dev` por defecto; cada integrante usa su propio entorno |
| `var.lambda_runtime` | `nodejs20.x` |
| `var.log_retention_days` | `14` |
| `local.name_prefix` | `${var.project_name}-${var.environment}` |
| `local.upload_function_name` | `${local.name_prefix}-upload` |
| `local.crop_function_name` | `${local.name_prefix}-crop` |
| `local.bucket_name` | `${local.name_prefix}-images-${random_id.bucket_suffix.hex}` |
| `local.bucket_arn` | `arn:aws:s3:::${local.bucket_name}` |
| `local.upload_prefix` / `local.processed_prefix` | `uploads/` / `processed/` |
| `local.private_subnet_ids` | lista con las dos subnets privadas |

## Recursos

| Dirección Terraform | Recurso |
|---|---|
| `aws_vpc.main` | VPC `10.0.0.0/16` |
| `aws_subnet.private_a` / `private_b` | `10.0.11.0/24` y `10.0.12.0/24` |
| `aws_vpc_endpoint.s3` | Endpoint gateway de S3 |
| `aws_security_group.upload_lambda` / `crop_lambda` | Security Groups de las Lambdas |
| `aws_s3_bucket.images` | Bucket de imágenes |
| `aws_sqs_queue.main` / `dlq` | Cola principal y DLQ |
| `aws_iam_role.upload_lambda` / `crop_lambda` | Roles de las Lambdas |
| `aws_iam_role_policy_attachment.*` | Políticas administradas |
| `aws_iam_role_policy.upload_s3` / `crop_permissions` | Permisos mínimos |

Los marcadores `env` y `suffix` del diagrama representan el entorno y el sufijo aleatorio.

## Convención de claves en S3

- Original: `uploads/{uuid}_{nombre}.{ext}`
- Procesada: `processed/{uuid}_{nombre}_circular.png`

## Límite de subida

El límite de subida es 4 MB por imagen. La invocación síncrona de Lambda admite 6 MB y el cuerpo viaja en base64, por lo que el tamaño efectivo se reduce. Para superar la limitación se requerirían presigned URLs de S3.

## Reglas de trabajo

Cada integrante prueba con su propio `environment` (`andre`, `bryan`, `renzo`). La demostración final usa `demo`.
