# Procesador de imágenes en AWS

Arquitectura serverless que recibe imágenes por API, las guarda en S3 y genera una versión circular de 40x40 px con Lambda. Toda la infraestructura se define con Terraform y se despliega con el mismo código en tres entornos (dev, qa y prod), con las Lambdas aisladas en una VPC privada sin salida a internet.

## Tabla de contenidos

- [Características](#características)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Arquitectura](#arquitectura)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Despliegue](#despliegue)
- [Uso](#uso)
- [Reparto del equipo](#reparto-del-equipo)
- [Contribución](#contribución)
- [Documentación](#documentación)

## Características

- **Subida por API:** `POST /upload` acepta jpg, png, gif y webp de hasta 4 MB, como `multipart/form-data` o JSON con base64.
- **Recorte circular automático:** cada imagen se convierte en un PNG de 40x40 px con fondo transparente en `processed/`.
- **Procesamiento asíncrono con reintentos:** S3 avisa a una cola SQS; los mensajes que fallan 3 veces pasan a una cola de mensajes fallidos (DLQ).
- **Fallos parciales por lote:** si una imagen de un lote falla, solo se reintenta esa imagen.
- **Red aislada:** las Lambdas corren en subnets privadas sin NAT ni Internet Gateway y llegan a S3 por un endpoint gateway.
- **Tres entornos con el mismo código:** dev, qa y prod solo cambian en sus archivos de variables (límites de la API, concurrencia, CIDR de la VPC).
- **Mínimo privilegio:** cada Lambda tiene su propio rol IAM y su propio Security Group.

## Tecnologías utilizadas

- **AWS:** API Gateway (HTTP API v2), Lambda, S3, SQS, VPC con endpoint gateway de S3, IAM y CloudWatch Logs.
- **Infraestructura como código:** Terraform >= 1.11 con el proveedor `hashicorp/aws` ~> 5.0 y estado remoto en S3.
- **Lambdas:** Node.js 20 (runtime `nodejs20.x`), AWS SDK for JavaScript v3, busboy (upload-lambda) y sharp 0.33 (crop-lambda).
- **Pruebas:** test runner integrado de Node.js (`node:test`).

## Arquitectura

```mermaid
%%{
  init: {
    "theme": "base",
    "themeVariables": {
      "primaryColor": "#1e293b",
      "primaryTextColor": "#f8fafc",
      "primaryBorderColor": "#334155",
      "lineColor": "#94a3b8",
      "secondaryColor": "#0f172a",
      "tertiaryColor": "#1e293b",
      "background": "#0f172a",
      "mainBkg": "#1e293b",
      "nodeBorder": "#475569",
      "clusterBkg": "#0f172a",
      "titleColor": "#f8fafc",
      "edgeLabelBackground": "#1e293b",
      "fontFamily": "monospace"
    },
    "flowchart": { "curve": "basis", "padding": 20 }
  }
}%%

flowchart TD

  %% ── INTERNET ──────────────────────────────────────────────────────────────
  subgraph INTERNET["Internet"]
    CLIENT["Client\n---\nPOST /upload\nmultipart/form-data or JSON+base64\nMax size: 10 MB\nAllowed: jpg, png, gif, webp"]
  end

  %% ── AWS ACCOUNT ───────────────────────────────────────────────────────────
  subgraph AWS["AWS Account — Region: us-east-1"]

    %% ── EDGE SERVICES ─────────────────────────────────────────────────────
    subgraph EDGE["AWS Managed Edge Services — outside VPC"]

      APIGW["API Gateway HTTP API v2\n---\nRoute: POST /upload\nProtocol: HTTPS, TLS 1.2+\nPayload format: 2.0\nCORS: enabled\nStage: default, auto-deploy\nThrottling: 10,000 rps\nAccess logs to CloudWatch"]

      subgraph S3_SVC["Amazon S3 — Bucket: image-processor-env-images-suffix"]
        S3_UPLOADS["uploads/ prefix\n---\nStores: original images\nSSE: AES-256\nVersioning: DISABLED (fixed)\nLifecycle: expire after 30 days\nAccess: fully private\nOn ObjectCreated fires SQS notification"]
        S3_PROCESSED["processed/ prefix\n---\nStores: cropped circular PNGs\nSSE: AES-256\nOutput: 40x40 px, PNG, transparent bg\nLifecycle: expire after 90 days\nAccess: fully private"]
      end

      subgraph SQS_SVC["Amazon SQS"]
        SQS_QUEUE["Main Queue\n---\nName: image-processor-env-image-queue\nType: Standard\nVisibility timeout: 360 s (6x Lambda timeout)\nRetention: 1 day\nLong polling: 20 s\nMax receives before DLQ: 3"]
        SQS_DLQ["Dead-Letter Queue\n---\nName: image-processor-env-image-dlq\nRetention: 14 days\nCloudWatch alarm on any visible message"]
      end

    end

    %% ── VPC ────────────────────────────────────────────────────────────────
    subgraph VPC["VPC — CIDR: 10.0.0.0/16 — DNS resolution and hostnames enabled — No IGW, no NAT (fully isolated)"]

      %% ── PRIVATE SUBNETS ─────────────────────────────────────────────────
      subgraph PRIV_A["Private Subnet AZ-a — 10.0.11.0/24 — Route: S3 prefix list to vpce-s3 only (no 0.0.0.0/0)"]

        subgraph SG_UPLOAD["SG: sg-upload-lambda | Inbound: none | Outbound: TCP 443 to S3 prefix list (vpce-s3)"]
          LAMBDA_UPLOAD["upload-lambda\n---\nRuntime: nodejs20.x\nMemory: 256 MB — Timeout: 30 s\nHandler: index.handler\nEnv: S3_BUCKET, UPLOAD_PREFIX\nDeps: @aws-sdk/client-s3, busboy, uuid\nIAM: s3:PutObject on uploads/ only\nLogs: /aws/lambda/...-upload"]
        end

        subgraph SG_CROP["SG: sg-crop-lambda | Inbound: none | Outbound: TCP 443 to S3 prefix list (vpce-s3)"]
          LAMBDA_CROP["crop-lambda\n---\nRuntime: nodejs20.x\nMemory: 512 MB — Timeout: 60 s\nHandler: index.handler\nEnv: S3_BUCKET, PROCESSED_PREFIX\nDeps: @aws-sdk/client-s3, sharp 0.33\nCrop: resize 40x40 cover, SVG circle mask\nOutput: PNG with transparent alpha\nIAM: s3:GetObject uploads/, s3:PutObject processed/\nSQS: polled by Event Source Mapping (Lambda service, outside VPC)\nLogs: /aws/lambda/...-crop"]
        end

      end

      subgraph PRIV_B["Private Subnet AZ-b — 10.0.12.0/24 — Route: S3 prefix list to vpce-s3 only (no 0.0.0.0/0)"]
        LAMBDA_UPLOAD_B["upload-lambda replica AZ-b\n---\nIdentical config to AZ-a\nLambda auto-distributes ENIs\nacross both private subnets"]
        LAMBDA_CROP_B["crop-lambda replica AZ-b\n---\nIdentical config to AZ-a\nLambda auto-distributes ENIs\nacross both private subnets"]
      end

      %% ── VPC ENDPOINTS ───────────────────────────────────────────────────
      subgraph VPCE["VPC Endpoints — traffic stays on AWS backbone, never hits public internet"]

        VPCE_S3["S3 Gateway Endpoint\n---\nType: Gateway — free, no ENI\nService: com.amazonaws.us-east-1.s3\nInjected into private subnet route tables\nPolicy: s3:GetObject and s3:PutObject\nscoped to the images bucket only"]

      end

    end

    %% ── IAM ───────────────────────────────────────────────────────────────
    subgraph IAM["IAM — Least-Privilege Roles"]
      ROLE_UPLOAD["Role: upload-lambda-role\n---\nAWSLambdaBasicExecutionRole\nAWSLambdaVPCAccessExecutionRole\ns3:PutObject scoped to uploads/ only"]
      ROLE_CROP["Role: crop-lambda-role\n---\nAWSLambdaBasicExecutionRole\nAWSLambdaVPCAccessExecutionRole\ns3:GetObject on uploads/\ns3:PutObject on processed/\nsqs: ReceiveMessage, DeleteMessage\nGetQueueAttributes, ChangeMessageVisibility\n(used by the Event Source Mapping)"]
    end

    %% ── OBSERVABILITY ─────────────────────────────────────────────────────
    subgraph OBS["Observability — CloudWatch"]
      CW_UPLOAD["Log Group\n/aws/lambda/...-upload\nRetention: 14 days"]
      CW_CROP["Log Group\n/aws/lambda/...-crop\nRetention: 14 days"]
      CW_APIGW["Log Group\n/aws/apigateway/...\nRetention: 14 days\nFormat: JSON access log"]
      CW_ALARM["CloudWatch Alarm: dlq-messages-alarm\n---\nMetric: ApproximateNumberOfMessagesVisible\nNamespace: AWS/SQS\nPeriod: 60 s — Threshold: above 0\nAction: notify via SNS topic"]
    end

  end

  %% ── DATA FLOW ─────────────────────────────────────────────────────────────

  CLIENT -->|"1 - HTTPS POST /upload, TLS 1.2+, max 10 MB"| APIGW
  APIGW -->|"2 - Lambda Proxy Invoke, Payload 2.0"| LAMBDA_UPLOAD
  APIGW -->|"2 - replica invoke"| LAMBDA_UPLOAD_B

  LAMBDA_UPLOAD -->|"3 - s3:PutObject via S3 Gateway Endpoint"| VPCE_S3
  LAMBDA_UPLOAD_B -->|"3 - replica"| VPCE_S3
  VPCE_S3 -->|"writes to uploads/"| S3_UPLOADS

  S3_UPLOADS -->|"4 - S3 Event Notification, ObjectCreated, AWS internal network"| SQS_QUEUE

  SQS_QUEUE -->|"5 - ESM trigger (polling by Lambda service), batch size 5, ReportBatchItemFailures"| LAMBDA_CROP
  SQS_QUEUE -->|"5 - replica"| LAMBDA_CROP_B

  LAMBDA_CROP -->|"6 - s3:GetObject via S3 Gateway Endpoint"| VPCE_S3
  LAMBDA_CROP_B -->|"6 - replica"| VPCE_S3
  S3_UPLOADS -->|"reads from"| VPCE_S3

  LAMBDA_CROP -->|"7 - s3:PutObject, name_circular.png, 40x40 PNG"| VPCE_S3
  LAMBDA_CROP_B -->|"7 - replica"| VPCE_S3
  VPCE_S3 -->|"writes to processed/"| S3_PROCESSED

  SQS_QUEUE -->|"after 3 failed receives"| SQS_DLQ
  SQS_DLQ -.->|"triggers alarm"| CW_ALARM

  LAMBDA_UPLOAD -.->|"logs"| CW_UPLOAD
  LAMBDA_CROP -.->|"logs"| CW_CROP
  APIGW -.->|"access logs"| CW_APIGW

  LAMBDA_UPLOAD -.->|"assumes"| ROLE_UPLOAD
  LAMBDA_CROP -.->|"assumes"| ROLE_CROP

  %% ── STYLES ────────────────────────────────────────────────────────────────

  classDef clientNode fill:#0f172a,stroke:#6366f1,stroke-width:2px,color:#e0e7ff
  classDef edgeNode fill:#1e3a5f,stroke:#3b82f6,stroke-width:2px,color:#bfdbfe
  classDef lambdaNode fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#dcfce7
  classDef s3Node fill:#3b1f0f,stroke:#f97316,stroke-width:2px,color:#ffedd5
  classDef sqsNode fill:#4a1d96,stroke:#a78bfa,stroke-width:2px,color:#ede9fe
  classDef iamNode fill:#1f2937,stroke:#facc15,stroke-width:2px,color:#fef9c3
  classDef obsNode fill:#1f2937,stroke:#94a3b8,stroke-width:2px,color:#e2e8f0
  classDef vpceNode fill:#0c2340,stroke:#38bdf8,stroke-width:2px,color:#bae6fd

  class CLIENT clientNode
  class APIGW edgeNode
  class LAMBDA_UPLOAD,LAMBDA_CROP,LAMBDA_UPLOAD_B,LAMBDA_CROP_B lambdaNode
  class S3_UPLOADS,S3_PROCESSED s3Node
  class SQS_QUEUE,SQS_DLQ sqsNode
  class ROLE_UPLOAD,ROLE_CROP iamNode
  class CW_UPLOAD,CW_CROP,CW_APIGW,CW_ALARM obsNode
  class VPCE_S3 vpceNode
```
## Cambios realizados en el diagrama posteriores al análisis correspondiente
1. Eliminación de ambos NAT Gateways debido a sobrecostos e inutilidad porque no se necesita salir a internet.
2. Eliminamos el SQS Interface Endpoint por ser un costo innecesario. El costo escala por zona de disponibilidad...
3. El bucket uploads/ con versionado y expiración a 30 días está mal configurado. La regla de expiración solo afecta a la versión actual y deja un delete marker. Las versiones anteriores quedan para siempre y el almacenamiento crece sin límite.
## Estructura del repositorio

```text
.
├── api-gateway/         Documentación de la API (README.md)
├── docs/                Diagrama de arquitectura y acuerdos del equipo
├── infra/               Código Terraform (root module plano)
│   ├── backend/         Configuración del estado remoto por entorno
│   ├── environments/    Variables de cada entorno (*.tfvars)
│   └── scripts/tf.sh    Script para ejecutar Terraform en un entorno
└── lambdas/
    ├── upload/          upload-lambda: recibe la imagen y la guarda en uploads/
    └── crop/            crop-lambda: recorta la imagen y la guarda en processed/
```

## Requisitos previos

| Herramienta | Versión | Para qué |
|---|---|---|
| [Git](https://git-scm.com/) | cualquiera reciente | Clonar el repositorio; en Windows incluye Git Bash |
| Bash | Git Bash en Windows | Ejecutar `build.sh` y `infra/scripts/tf.sh` |
| [Node.js](https://nodejs.org/) y npm | Node.js >= 20 | Instalar dependencias, probar y empaquetar las Lambdas |
| [Terraform](https://developer.hashicorp.com/terraform/install) | >= 1.11 | Desplegar la infraestructura |
| [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) | 2.x | Credenciales y revisión de resultados en S3 y CloudWatch |

Además se necesita:

- Credenciales de AWS configuradas (`aws configure`) con permisos para crear los recursos en `us-east-1`.
- El nombre del bucket del estado remoto de Terraform. Se pide al equipo y **nunca se guarda en el repositorio**.

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/rprincipeg/AWS-Lambda-Integration.git
cd AWS-Lambda-Integration

# 2. Instalar las dependencias de cada Lambda
(cd lambdas/upload && npm ci)
(cd lambdas/crop && npm ci)

# 3. Ejecutar las pruebas
(cd lambdas/upload && npm test)
(cd lambdas/crop && npm test)
```

## Despliegue

Cada entorno se despliega desde su propia rama, con sus propias variables y su propio estado remoto:

| Entorno | Rama | Variables | Comando |
|---|---|---|---|
| dev | `develop` | `infra/environments/dev.tfvars` | `bash scripts/tf.sh dev apply` |
| qa | `qa` | `infra/environments/qa.tfvars` | `bash scripts/tf.sh qa apply` |
| prod | `main` | `infra/environments/prod.tfvars` | `bash scripts/tf.sh prod apply` |
| sandbox personal | cualquiera | `infra/environments/dev.tfvars` | `bash scripts/tf.sh sandbox:<nombre> apply` |

El sandbox sirve para que cada integrante pruebe sin afectar a los demás: usa los valores de dev, pero con nombres y estado propios (por ejemplo `image-processor-dev-renzo-crop`).

```bash
# 1. Empaquetar las Lambdas (crop-lambda descarga los binarios de sharp para Linux x64)
bash lambdas/upload/build.sh
bash lambdas/crop/build.sh

# 2. Indicar el bucket del estado remoto (solo en la sesión actual)
export TF_STATE_BUCKET=<bucket-del-estado>

# 3. Revisar y aplicar los cambios en el entorno elegido
cd infra
bash scripts/tf.sh dev plan
bash scripts/tf.sh dev apply
```

`tf.sh` comprueba que existan las carpetas `build/` de las Lambdas y pide confirmación si se intenta desplegar qa o prod desde una rama distinta de la suya.

Para eliminar un entorno de pruebas: `bash scripts/tf.sh sandbox:<nombre> destroy`.

## Uso

### 1. Obtener la URL de la API

```bash
cd infra
bash scripts/tf.sh dev output -raw upload_endpoint
```

El script muestra primero su encabezado y la salida de `terraform init`; la URL es la última línea. Cópiala en una variable:

```bash
export API=<url-de-upload_endpoint>
```

### 2. Subir una imagen

```bash
curl -i -X POST "$API" -F "file=@foto.png"
```

Respuesta esperada (`201`):

```json
{"message":"Imagen recibida","key":"uploads/3f2a..._foto.png","bucket":"image-processor-dev-images-..."}
```

Los demás códigos de respuesta y el envío en JSON con base64 están en [api-gateway/README.md](api-gateway/README.md).

### 3. Descargar la imagen recortada

Unos segundos después, crop-lambda guarda el resultado con el sufijo `_circular.png`:

```bash
export BUCKET=<bucket-de-la-respuesta>
aws s3 ls "s3://$BUCKET/processed/"
aws s3 cp "s3://$BUCKET/processed/3f2a..._foto_circular.png" resultado.png
```

### 4. Revisar los logs

```bash
aws logs tail /aws/lambda/image-processor-dev-upload --follow
aws logs tail /aws/lambda/image-processor-dev-crop --follow
```

En un sandbox el nombre incluye el sandbox, por ejemplo `/aws/lambda/image-processor-dev-renzo-crop`.

## Reparto del equipo

| Integrante | Responsabilidad | Ramas |
|---|---|---|
| Bryan Edwards | API Gateway y upload-lambda | feature/api-gateway, feature/upload-lambda |
| Renzo Principe | crop-lambda y Event Source Mapping | feature/crop-lambda |
| André Castañeda | Red, S3, SQS e IAM | feature/network, feature/storage-messaging, feature/iam |

## Contribución

### Ramas

El código se promueve por Pull Requests: sube de `develop` a `qa` y de `qa` a `main`. **Nadie hace push directo a estas tres ramas.**

| Rama | Entorno | Contenido |
|---|---|---|
| `develop` | DEV | Rama de integración y rama por defecto del repositorio. |
| `qa` | QA | Versiones de `develop` listas para probarse. |
| `main` | PROD | Solo versiones que ya pasaron QA. |

### Flujo de trabajo

1. Actualizar `develop` y crear una rama de trabajo desde ella (`feature/...`, `fix/...`, `docs/...`).
2. Hacer commits pequeños, uno por cambio lógico.
3. Ejecutar las pruebas (`npm test`) y, si se tocó Terraform, `terraform fmt` y `terraform validate`.
4. Subir la rama y abrir un Pull Request hacia `develop`.
5. Otro integrante lo revisa y aprueba antes del merge.
6. Para promover una versión se abre un Pull Request de `develop` a `qa` y, cuando QA está aprobado, de `qa` a `main`.

### Convención de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):
`tipo(alcance): descripción`

Tipos: feat, fix, docs, chore, refactor, test, ci.
Alcances sugeridos: network, storage-messaging, iam, api-gateway, upload-lambda, crop-lambda.

## Documentación

- Diagrama: [docs/arquitectura.mmd](docs/arquitectura.mmd)
- Acuerdos: [docs/acuerdos.md](docs/acuerdos.md)
- API de subida: [api-gateway/README.md](api-gateway/README.md)
