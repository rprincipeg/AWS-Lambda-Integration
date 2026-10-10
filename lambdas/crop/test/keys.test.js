const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildProcessedKey } = require("../src/keys");

const prefixes = { uploadPrefix: "uploads/", processedPrefix: "processed/" };

test("cambia el prefijo y la extensión por _circular.png", () => {
  assert.equal(buildProcessedKey("uploads/3f2a_foto.png", prefixes), "processed/3f2a_foto_circular.png");
});

test("usa el nombre completo cuando la clave no tiene extensión", () => {
  assert.equal(buildProcessedKey("uploads/3f2a_foto", prefixes), "processed/3f2a_foto_circular.png");
});

test("solo quita la extensión final en nombres con varios puntos", () => {
  assert.equal(buildProcessedKey("uploads/a_foto.v2.jpg", prefixes), "processed/a_foto.v2_circular.png");
});
