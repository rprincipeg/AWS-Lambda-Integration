const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler } = require("../src/handler");
const { images, fakeS3, multipartEvent, jsonEvent } = require("./helpers");

const config = { bucket: "bucket-prueba", prefix: "uploads/", maxBytes: 100 };

// Arma un handler nuevo en cada prueba para que el S3 falso empiece vacío
function setup(s3Options) {
  const s3 = fakeS3(s3Options);
  const handler = createHandler({ s3, config, uuid: () => "id-fijo" });
  return { s3, handler };
}

// El body de la respuesta es texto: lo convertimos a objeto para revisarlo
const bodyOf = (res) => JSON.parse(res.body);

test("multipart con PNG válido responde 201 y guarda en uploads/", async () => {
  const { s3, handler } = setup();
  const res = await handler(multipartEvent(images.png, "Mi Foto.png"));

  assert.equal(res.statusCode, 201);
  assert.equal(s3.calls.length, 1);
  const put = s3.calls[0];
  assert.equal(put.Bucket, "bucket-prueba");
  assert.ok(put.Key.startsWith("uploads/"));
  assert.ok(put.Key.endsWith(".png"));
  assert.equal(put.ContentType, "image/png");
});

test("JSON con JPEG en base64 responde 201 y la clave termina en .jpg", async () => {
  const { handler } = setup();
  const res = await handler(jsonEvent({ data: images.jpeg.toString("base64"), filename: "foto.jpg" }));

  assert.equal(res.statusCode, 201);
  assert.ok(bodyOf(res).key.endsWith(".jpg"));
});

test("json con prefijo data URL responde 201 y la clave termina en .png", async () => {
  const { handler } = setup();
  const res = await handler(jsonEvent({ data: "data:image/png;base64," + images.png.toString("base64"), filename: "foto.png" }));

  assert.equal(res.statusCode, 201);
  assert.ok(bodyOf(res).key.endsWith(".png"));
});

test("texto con nombre foto.png responde 415 y no llega a S3", async () => {
  const { s3, handler } = setup();
  const res = await handler(multipartEvent(Buffer.from("hola, esto no es una imagen"), "foto.png"));

  assert.equal(res.statusCode, 415);
  assert.equal(bodyOf(res).error.code, "UNSUPPORTED_MEDIA_TYPE");
  assert.equal(s3.calls.length, 0);
});

test("multipart con imagen demasiado grande responde 413", async () => {
  const { handler } = setup();
  const res = await handler(multipartEvent(Buffer.concat([images.png, Buffer.alloc(200)]), "foto.png"));

  assert.equal(res.statusCode, 413);
  assert.equal(bodyOf(res).error.code, "PAYLOAD_TOO_LARGE");
});

test("multipart con S3 que falla responde 500", async () => {
  const { handler } = setup({ fail: true });
  const res = await handler(multipartEvent(images.png, "foto.png"));

  assert.equal(res.statusCode, 500);
  assert.equal(bodyOf(res).error.code, "INTERNAL_ERROR");
});

test("content-type desconocido responde 415", async () => {
  const { handler } = setup();
  const res = await handler({ headers: { "content-type": "text/plain" }, body: "hola" });

  assert.equal(res.statusCode, 415);
  assert.equal(bodyOf(res).error.code, "UNSUPPORTED_MEDIA_TYPE");
});

test("json con base64 inválido responde 400", async () => {
  const { handler } = setup();
  const res = await handler(jsonEvent({ data: "%%%%", filename: "foto.png" }));

  assert.equal(res.statusCode, 400);
  assert.equal(bodyOf(res).error.code, "BAD_REQUEST");
});

test("multipart con imagen vacía responde 400", async () => {
  const { handler } = setup();
  const res = await handler(multipartEvent(Buffer.alloc(0), "foto.png"));

  assert.equal(res.statusCode, 400);
  assert.equal(bodyOf(res).error.code, "BAD_REQUEST");
});

test("json inválido responde 400", async () => {
  const { handler } = setup();
  const res = await handler(jsonEvent("{ no es JSON }"));

  assert.equal(res.statusCode, 400);
  assert.equal(bodyOf(res).error.code, "BAD_REQUEST");
});

test("json con prefijo data URL y espacios responde 201", async () => {
  const { handler } = setup();
  const res = await handler(jsonEvent({ data: "data:image/png;base64, " + images.png.toString("base64") + " ", filename: "foto.png" }));

  assert.equal(res.statusCode, 201);
  assert.ok(bodyOf(res).key.endsWith(".png"));
});

test("multipart sin archivo responde 400", async () => {
  const { handler } = setup();
  const res = await handler(multipartEvent(Buffer.from("no hay archivo"), null));

  assert.equal(res.statusCode, 400);
  assert.equal(bodyOf(res).error.code, "BAD_REQUEST");
});

test("sanitizeNamme eliimina rutas como ../../etc/passwd", async () => {
  const { handler } = setup();
  const res = await handler(multipartEvent(images.png, "../../etc/passwd"));

  assert.equal(res.statusCode, 201);
  assert.ok(bodyOf(res).key.endsWith(".png"));
  assert.ok(!bodyOf(res).key.includes(".."));
});