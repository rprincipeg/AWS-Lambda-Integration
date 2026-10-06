#!/usr/bin/env bash
set -euo pipefail

# Uso:
#   bash scripts/tf.sh <entorno> <comando> [argumentos de Terraform]
#
# Ejemplos:
#   bash scripts/tf.sh dev plan
#   bash scripts/tf.sh dev apply
#   bash scripts/tf.sh qa plan
#   bash scripts/tf.sh prod plan
#   bash scripts/tf.sh sandbox:andre plan

usage() {
  echo "Uso: bash scripts/tf.sh <entorno> <comando> [argumentos de Terraform]"
  echo
  echo "Entornos:"
  echo "  dev"
  echo "  qa"
  echo "  prod"
  echo "  sandbox:<nombre>"
  echo
  echo "Ejemplos:"
  echo "  bash scripts/tf.sh dev plan"
  echo "  bash scripts/tf.sh qa apply"
  echo "  bash scripts/tf.sh prod plan"
  echo "  bash scripts/tf.sh sandbox:andre plan"
  exit 1
}

if [[ $# -lt 2 ]]; then
  usage
fi

ENVIRONMENT="$1"
COMMAND="$2"
shift 2

# El bucket remoto del estado nunca se guarda en el repositorio.
if [[ -z "${TF_STATE_BUCKET:-}" ]]; then
  echo "ERROR: Debes definir la variable de entorno TF_STATE_BUCKET."
  echo "Ejemplo:"
  echo "  export TF_STATE_BUCKET=<bucket-del-estado>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${INFRA_DIR}"

BACKEND_FILE=""
TFVARS_FILE=""
STATE_KEY=""
SANDBOX_NAME=""

case "$ENVIRONMENT" in
  dev)
    BACKEND_FILE="backend/dev.hcl"
    TFVARS_FILE="environments/dev.tfvars"
    STATE_KEY="dev/terraform.tfstate"
    ;;

  qa)
    BACKEND_FILE="backend/qa.hcl"
    TFVARS_FILE="environments/qa.tfvars"
    STATE_KEY="qa/terraform.tfstate"
    ;;

  prod)
    BACKEND_FILE="backend/prod.hcl"
    TFVARS_FILE="environments/prod.tfvars"
    STATE_KEY="prod/terraform.tfstate"
    ;;

  sandbox:*)
    SANDBOX_NAME="${ENVIRONMENT#sandbox:}"

    if [[ -z "$SANDBOX_NAME" ]]; then
      echo "ERROR: El sandbox debe tener un nombre."
      echo "Ejemplo: sandbox:andre"
      exit 1
    fi

    if [[ ! "$SANDBOX_NAME" =~ ^[a-z0-9]{1,12}$ ]]; then
      echo "ERROR: El nombre del sandbox debe contener solo minúsculas y números,"
      echo "con un máximo de 12 caracteres."
      exit 1
    fi

    BACKEND_FILE="backend/sandbox.hcl"
    TFVARS_FILE="environments/dev.tfvars"
    STATE_KEY="sandbox/${SANDBOX_NAME}/terraform.tfstate"
    ;;

  *)
    echo "ERROR: Entorno no válido: $ENVIRONMENT"
    echo "Valores permitidos: dev, qa, prod, sandbox:<nombre>"
    exit 1
    ;;
esac

# Para sandbox se utilizan los valores de DEV, pero con nombres y estado propios.
if [[ -n "$SANDBOX_NAME" ]]; then
  SANDBOX_ARGS=(-var "sandbox=${SANDBOX_NAME}")
else
  SANDBOX_ARGS=()
fi

echo "=========================================="
echo " Terraform - Image Processor"
echo "=========================================="
echo "Entorno:      $ENVIRONMENT"

if [[ -n "$SANDBOX_NAME" ]]; then
  echo "Sandbox:      $SANDBOX_NAME"
fi

echo "Variables:    $TFVARS_FILE"
echo "Backend:      $BACKEND_FILE"
echo "Estado:       $STATE_KEY"
echo "=========================================="

# Verificación de archivos necesarios.
if [[ ! -f "$BACKEND_FILE" ]]; then
  echo "ERROR: No existe el backend: $BACKEND_FILE"
  exit 1
fi

if [[ ! -f "$TFVARS_FILE" ]]; then
  echo "ERROR: No existe el archivo de variables: $TFVARS_FILE"
  exit 1
fi

# Antes de plan/apply/destroy verificamos si las Lambdas necesitan
# tener construido el contenido de build/.
if [[ "$COMMAND" == "plan" || "$COMMAND" == "apply" || "$COMMAND" == "destroy" ]]; then

  if [[ -f "../lambdas/upload/build.sh" && ! -d "../lambdas/upload/build" ]]; then
    echo "ERROR: Falta construir upload-lambda."
    echo "Ejecuta el build correspondiente antes de continuar."
    exit 1
  fi

  if [[ -f "../lambdas/crop/build.sh" && ! -d "../lambdas/crop/build" ]]; then
    echo "ERROR: Falta construir crop-lambda."
    echo "Ejecuta el build correspondiente antes de continuar."
    exit 1
  fi

fi

# Protección adicional para QA y PROD.
if [[ "$ENVIRONMENT" == "qa" || "$ENVIRONMENT" == "prod" ]]; then

  CURRENT_BRANCH="$(git branch --show-current)"
  CURRENT_COMMIT="$(git rev-parse --short HEAD)"

  echo
  echo "Rama actual:    $CURRENT_BRANCH"
  echo "Commit actual:  $CURRENT_COMMIT"
  echo

  EXPECTED_BRANCH="qa"

  if [[ "$ENVIRONMENT" == "prod" ]]; then
    EXPECTED_BRANCH="main"
  fi

  if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
    echo "ADVERTENCIA: El entorno $ENVIRONMENT debe desplegarse desde la rama $EXPECTED_BRANCH."
    echo "Rama actual: $CURRENT_BRANCH"
    echo

    read -r -p "¿Deseas continuar? Escribe 's' para continuar: " CONFIRM

    if [[ "$CONFIRM" != "s" ]]; then
      echo "Operación cancelada."
      exit 1
    fi
  fi

fi

# Protección especial para operaciones peligrosas en PROD.
if [[ "$ENVIRONMENT" == "prod" && "$COMMAND" == "destroy" ]]; then

  echo
  echo "ADVERTENCIA: estás intentando destruir PROD."
  echo

  read -r -p "Para confirmar escribe exactamente 'destruir prod': " CONFIRM

  if [[ "$CONFIRM" != "destruir prod" ]]; then
    echo "Operación cancelada."
    exit 1
  fi

fi

echo
echo "Inicializando Terraform..."

terraform init \
  -reconfigure \
  -input=false \
  -backend-config="$BACKEND_FILE" \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="key=$STATE_KEY"

echo
echo "Ejecutando: terraform $COMMAND"

# Comandos que necesitan explícitamente el archivo de variables.
case "$COMMAND" in
  plan|apply|destroy|import|refresh|console)
    terraform "$COMMAND" \
      -var-file="$TFVARS_FILE" \
      "${SANDBOX_ARGS[@]}" \
      "$@"
    ;;

  *)
    terraform "$COMMAND" \
      "${SANDBOX_ARGS[@]}" \
      "$@"
    ;;
esac
