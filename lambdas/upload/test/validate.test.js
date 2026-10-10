const test = require("node:test");
const assert = require("node:assert/strict");
const { detectImageType, sanitizeName, buildKey } = require("../src/validate");

// Bytes mínimos de cada formato: solo la firma, rellenada hasta 12 bytes
const relleno = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(12)]);
const PNG = relleno([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = relleno([0xff, 0xd8, 0xff]);
const GIF = relleno("GIF89a");
const WEBP = relleno("RIFF0000WEBP");

test("detecta un PNG por su firma", () => {
  assert.deepEqual(detectImageType(PNG), { mime: "image/png", ext: "png" });
});

test("detecta un JPEG por su firma", () => {
  assert.deepEqual(detectImageType(JPEG), { mime: "image/jpeg", ext: "jpg" });
});

test("devuelve null para texto plano aunque se llame foto.png", () => {
  assert.equal(detectImageType(Buffer.from("hola, esto no es una imagen")), null);
});

test("detecta un GIF por su firma", () => {
  assert.deepEqual(detectImageType(GIF), { mime: "image/gif", ext: "gif" });
});

test("sanitizeName limpia espacios, mayúsculas y paréntesis", () => {
  assert.equal(sanitizeName("Mi Foto (1).PNG"), "mi-foto-1");
});

test("buildKey arma la clave con prefijo, id, nombre y extensión", () => {
  assert.equal(buildKey({ prefix: "uploads/", id: "abc", name: "foto", ext: "png" }), "uploads/abc_foto.png");
});

test("webp es detectado correctamente", () => {
  assert.deepEqual(detectImageType(WEBP), { mime: "image/webp", ext: "webp" });
});

test("buffer demasiado corto devuelve null", () => {
  assert.equal(detectImageType(Buffer.from([0x89, 0x50])), null);
});

test("sanitizeName devuelve 'imagen' si el nombre queda vacío", () => {
  assert.equal(sanitizeName("!!!.jpg"), "imagen");
});