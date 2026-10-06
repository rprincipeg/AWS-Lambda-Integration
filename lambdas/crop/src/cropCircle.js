const sharp = require("sharp");

// En Lambda la caché de sharp y los hilos extra no ayudan (cada invocación
// procesa imágenes distintas y hay pocos vCPU) y sí consumen memoria.
sharp.cache(false);
sharp.concurrency(1);

/**
 * Recorta una imagen en un círculo de size x size píxeles y la devuelve como
 * PNG con fondo transparente. Si el buffer no es una imagen válida, sharp lanza
 * su propio error y el registro de SQS se reporta como fallido.
 *
 * @param {Buffer} inputBuffer Imagen original (jpg, png, gif o webp).
 * @param {number} [size=40] Lado del cuadrado de salida, en píxeles.
 * @returns {Promise<Buffer>} PNG circular con canal alfa.
 */
async function cropCircle(inputBuffer, size = 40) {
  // Máscara circular blanca del mismo tamaño que la salida.
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/></svg>`
  );

  // animated: false toma solo el primer cuadro de GIF y WEBP animados;
  // limitInputPixels evita agotar los 512 MB de memoria con imágenes enormes.
  return sharp(inputBuffer, { animated: false, limitInputPixels: 50000000 })
    // Aplica la orientación EXIF (fotos de celular).
    .rotate()
    // Recorte centrado que llena todo el cuadrado.
    .resize(size, size, { fit: "cover", position: "centre" })
    // Garantiza que exista canal alfa para la transparencia.
    .ensureAlpha()
    // "dest-in" conserva solo lo que cae dentro del círculo; el resto queda transparente.
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

module.exports = { cropCircle };
