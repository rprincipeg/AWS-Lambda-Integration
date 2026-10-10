const { test } = require("node:test");
const assert = require("node:assert/strict");
const { extractObjects } = require("../src/s3Event");

const options = { uploadPrefix: "uploads/" };

// Arma el body de SQS con una notificación de S3 para las claves indicadas.
function s3Body(...keys) {
  return JSON.stringify({
    Records: keys.map((key) => ({ s3: { bucket: { name: "images-bucket" }, object: { key } } })),
  });
}

test("devuelve el bucket y la clave de un evento normal", () => {
  assert.deepEqual(extractObjects(s3Body("uploads/abc_foto.png"), options), [
    { bucket: "images-bucket", key: "uploads/abc_foto.png" },
  ]);
});

test("decodifica la clave codificada como URL", () => {
  assert.deepEqual(extractObjects(s3Body("uploads/abc_mi+foto%281%29.png"), options), [
    { bucket: "images-bucket", key: "uploads/abc_mi foto(1).png" },
  ]);
});

test("devuelve un arreglo vacío con el mensaje s3:TestEvent", () => {
  const body = JSON.stringify({
    Service: "Amazon S3",
    Event: "s3:TestEvent",
    Time: "2026-10-06T00:00:00.000Z",
    Bucket: "images-bucket",
  });
  assert.deepEqual(extractObjects(body, options), []);
});

test("descarta las claves fuera de uploads/", () => {
  assert.deepEqual(extractObjects(s3Body("processed/abc_foto_circular.png", "otra/foto.png"), options), []);
});

test("lanza un error si el JSON es inválido", () => {
  assert.throws(() => extractObjects("{no es json", options), /no es un JSON válido/);
});

test("devuelve todos los objetos de un mensaje con varios Records", () => {
  assert.deepEqual(extractObjects(s3Body("uploads/a.png", "processed/b.png", "uploads/c.jpg"), options), [
    { bucket: "images-bucket", key: "uploads/a.png" },
    { bucket: "images-bucket", key: "uploads/c.jpg" },
  ]);
});
