#!/usr/bin/env bash
# Prepara el paquete de despliegue de upload-lambda en build/
set -euo pipefail

cd "$(dirname "$0")"

rm -rf build
mkdir build

cp -r index.js src package.json package-lock.json build/

cd build
npm ci --omit=dev

echo "Paquete listo en lambdas/upload/build"