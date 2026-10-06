#!/usr/bin/env bash
# Prepara el paquete de despliegue de crop-lambda para Lambda en Linux x64.
# Terraform comprime después la carpeta build/ resultante.
set -euo pipefail

# Trabaja siempre desde la carpeta del script, sin importar desde dónde se llame.
cd "$(dirname "$0")"

# Empieza desde una carpeta build/ limpia.
rm -rf build
mkdir build

# Copia solo lo necesario para ejecutar la Lambda (sin pruebas).
cp -r index.js src package.json package-lock.json build/

# Instala las dependencias de producción con los binarios de sharp para
# Linux x64 (glibc), aunque el script se ejecute en Windows o Mac.
cd build
npm install --omit=dev --cpu=x64 --os=linux --libc=glibc

# Comprueba que se descargaron los binarios nativos de sharp para Linux.
for package in node_modules/@img/sharp-linux-x64 node_modules/@img/sharp-libvips-linux-x64; do
  if [ ! -d "$package" ]; then
    echo "Error: no se encontró $package; el paquete no funcionará en Lambda." >&2
    exit 1
  fi
done

echo "Paquete listo en lambdas/crop/build"
