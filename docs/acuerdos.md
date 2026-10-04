# Acuerdos del equipo

## Nombres de recursos
| Recurso | Nombre |
|---|---|
| Bucket S3 | image-processor-env-images-suffix |
| Cola principal | image-processor-env-image-queue |
| Cola DLQ | image-processor-env-image-dlq |
| Rol upload | upload-lambda-role |
| Rol crop | crop-lambda-role |

## Prefijos de S3
- Originales: `uploads/`
- Procesadas: `processed/`

## Variables de entorno
- upload-lambda: `S3_BUCKET`, `UPLOAD_PREFIX`
- crop-lambda: `S3_BUCKET`, `PROCESSED_PREFIX`

## Salidas que expone la plataforma (3ro)
- IDs de las subnets privadas y de los Security Groups
- ARN del bucket, de la cola y de los roles

## Archivo de salida
- Formato: `nombre_circular.png` (40x40, PNG con transparencia)
