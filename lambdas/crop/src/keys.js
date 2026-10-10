/**
 * Construye la clave de salida en processed/ a partir de la clave original.
 * Quita uploadPrefix al inicio y la extensión final, y agrega "_circular.png".
 * La extensión solo se busca en el nombre del archivo, no en las carpetas.
 *
 * Ejemplo: "uploads/3f2a_foto.png" -> "processed/3f2a_foto_circular.png".
 *
 * @param {string} uploadKey Clave del objeto original.
 * @param {{ uploadPrefix: string, processedPrefix: string }} options Prefijos de entrada y salida.
 * @returns {string} Clave del PNG procesado.
 */
function buildProcessedKey(uploadKey, { uploadPrefix, processedPrefix }) {
  const relativeKey = uploadKey.startsWith(uploadPrefix)
    ? uploadKey.slice(uploadPrefix.length)
    : uploadKey;

  const lastSlash = relativeKey.lastIndexOf("/");
  const lastDot = relativeKey.lastIndexOf(".");
  const base = lastDot > lastSlash ? relativeKey.slice(0, lastDot) : relativeKey;

  return `${processedPrefix}${base}_circular.png`;
}

module.exports = { buildProcessedKey };
