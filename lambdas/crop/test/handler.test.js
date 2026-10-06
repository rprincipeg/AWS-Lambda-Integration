const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { createHandler } = require("../src/handler");

const config = { uploadPrefix: "uploads/", processedPrefix: "processed/", size: 40 };

// S3 falso: Get devuelve los bytes guardados por clave (o lanza error si no
// existe) y Put guarda cmd.input para revisarlo después.
function fakeS3(objects) {
  const gets = [];
  const puts = [];
  return {
    gets,
    puts,
    async send(cmd) {
      if (cmd.constructor.name === "GetObjectCommand") {
        gets.push(cmd.input);
        const bytes = objects[cmd.input.Key];
        if (!bytes) {
          throw new Error("The specified key does not exist.");
        }
        return { Body: { transformToByteArray: async () => new Uint8Array(bytes) } };
      }
      if (cmd.constructor.name === "PutObjectCommand") {
        puts.push(cmd.input);
        return {};
      }
      throw new Error(`Comando inesperado: ${cmd.constructor.name}`);
    },
  };
}

// Arma un registro de SQS con la notificación de S3 de las claves indicadas.
function sqsRecord(messageId, ...keys) {
  return {
    messageId,
    body: JSON.stringify({
      Records: keys.map((key) => ({ s3: { bucket: { name: "images-bucket" }, object: { key } } })),
    }),
  };
}

let image;

beforeEach(async () => {
  // Silencia los logs del handler para que no ensucien la salida de las pruebas.
  mock.method(console, "log", () => {});
  mock.method(console, "error", () => {});
  image = await sharp({ create: { width: 100, height: 60, channels: 3, background: "#ff0000" } }).png().toBuffer();
});

afterEach(() => {
  mock.restoreAll();
});

test("procesa un registro válido y guarda el PNG en processed/", async () => {
  const s3 = fakeS3({ "uploads/3f2a_foto.png": image });
  const result = await createHandler({ s3, config })({ Records: [sqsRecord("m1", "uploads/3f2a_foto.png")] });

  assert.deepEqual(result, { batchItemFailures: [] });
  assert.equal(s3.puts.length, 1);
  const [put] = s3.puts;
  assert.equal(put.Bucket, "images-bucket");
  assert.equal(put.Key, "processed/3f2a_foto_circular.png");
  assert.equal(put.ContentType, "image/png");
  const metadata = await sharp(put.Body).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 40);
  assert.equal(metadata.height, 40);
});

test("el mensaje s3:TestEvent no llama a S3 ni falla", async () => {
  const s3 = fakeS3({});
  const body = JSON.stringify({ Service: "Amazon S3", Event: "s3:TestEvent", Bucket: "images-bucket" });
  const result = await createHandler({ s3, config })({ Records: [{ messageId: "m1", body }] });

  assert.deepEqual(result, { batchItemFailures: [] });
  assert.equal(s3.gets.length, 0);
  assert.equal(s3.puts.length, 0);
});

test("en un lote solo reporta el registro con la imagen corrupta", async () => {
  const s3 = fakeS3({
    "uploads/a_foto.png": image,
    "uploads/b_foto.png": Buffer.from("no es imagen"),
    "uploads/c_foto.png": image,
  });
  const result = await createHandler({ s3, config })({
    Records: [
      sqsRecord("m1", "uploads/a_foto.png"),
      sqsRecord("m2", "uploads/b_foto.png"),
      sqsRecord("m3", "uploads/c_foto.png"),
    ],
  });

  assert.deepEqual(result, { batchItemFailures: [{ itemIdentifier: "m2" }] });
  assert.deepEqual(
    s3.puts.map((put) => put.Key),
    ["processed/a_foto_circular.png", "processed/c_foto_circular.png"]
  );
});

test("un objeto inexistente solo hace fallar su registro", async () => {
  const s3 = fakeS3({ "uploads/a_foto.png": image });
  const result = await createHandler({ s3, config })({
    Records: [sqsRecord("m1", "uploads/no_existe.png"), sqsRecord("m2", "uploads/a_foto.png")],
  });

  assert.deepEqual(result, { batchItemFailures: [{ itemIdentifier: "m1" }] });
  assert.equal(s3.puts.length, 1);
});

test("ignora las claves fuera de uploads/ sin llamar a S3", async () => {
  const s3 = fakeS3({});
  const result = await createHandler({ s3, config })({
    Records: [sqsRecord("m1", "processed/a_foto_circular.png")],
  });

  assert.deepEqual(result, { batchItemFailures: [] });
  assert.equal(s3.gets.length, 0);
  assert.equal(s3.puts.length, 0);
});

test("un registro con dos objetos genera dos PutObject", async () => {
  const s3 = fakeS3({ "uploads/a_foto.png": image, "uploads/b_foto.png": image });
  const result = await createHandler({ s3, config })({
    Records: [sqsRecord("m1", "uploads/a_foto.png", "uploads/b_foto.png")],
  });

  assert.deepEqual(result, { batchItemFailures: [] });
  assert.deepEqual(
    s3.puts.map((put) => put.Key),
    ["processed/a_foto_circular.png", "processed/b_foto_circular.png"]
  );
});
