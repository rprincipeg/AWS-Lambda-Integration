const path = require("path");

// Detecta el tipo real de imagen por sus primeros bytes y no por el nombre
function detectImageType(buffer) {

  if (!buffer || buffer.length < 12) return null;
  const head = buffer.toString("ascii", 0, 6);
  const rear = buffer.toString("ascii", 8, 12);

  // JPEG: FF D8 FF
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
    return { mime: "image/png", ext: "png" };
  }

  // GIF: el texto de los bytes 0 a 6 es "GIF87a" o "GIF89a"
  if (head === "GIF87a" || head === "GIF89a") {
    return { mime: "image/gif", ext: "gif" };
  }

  // WEBP: texto "RIFF" en 0 a 4 Y texto "WEBP" en 8 a 12
  if (head.slice(0, 4) === "RIFF" && rear === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }

  return null; 
}

// Limpia el nombre del archivo para usarlo de forma segura en la clave de S3
function sanitizeName(filename) {
  let name = path.parse(filename || "").name; // quita la ruta y la extensión
  name = name.toLowerCase();
  name = name.replace(/[^a-z0-9._-]/g, "-"); // todo lo que no sea permitido pasa a guion
  name = name.replace(/-+/g, "-");           // "a---b" queda "a-b"
  name = name.slice(0, 60);                  // largo máximo
  name = name.replace(/^-+|-+$/g, "");       // quita guiones al inicio y al final
  return name || "imagen";
}

// Arma la clave final: uploads/{id}_{nombre}.{ext}
function buildKey({ prefix, id, name, ext }) {
  return `${prefix}${id}_${name}.${ext}`;
}

module.exports = { detectImageType, sanitizeName, buildKey };