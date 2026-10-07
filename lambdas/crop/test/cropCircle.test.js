const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { cropCircle } = require("../src/cropCircle");

// Genera en memoria una imagen roja sólida del tamaño y formato indicados.
function redImage(width, height, format = "png") {
  return sharp({ create: { width, height, channels: 3, background: "#ff0000" } })[format]().toBuffer();
}

// Verifica que la salida sea un PNG de 40x40 con canal alfa.
async function assertCircularPng(output) {
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 40);
  assert.equal(metadata.height, 40);
  assert.equal(metadata.hasAlpha, true);
}

for (const [label, width, height] of [
  ["horizontal", 100, 60],
  ["vertical", 60, 100],
  ["cuadrada", 80, 80],
]) {
  test(`una imagen ${label} produce un PNG de 40x40 con alfa`, async () => {
    await assertCircularPng(await cropCircle(await redImage(width, height)));
  });
}

for (const format of ["jpeg", "webp", "gif"]) {
  test(`acepta entradas ${format}`, async () => {
    await assertCircularPng(await cropCircle(await redImage(100, 60, format)));
  });
}

test("la esquina queda transparente y el centro rojo opaco", async () => {
  const output = await cropCircle(await redImage(100, 60));
  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => {
    const index = (y * info.width + x) * 4;
    return { r: data[index], g: data[index + 1], b: data[index + 2], a: data[index + 3] };
  };

  assert.equal(pixel(0, 0).a, 0);
  assert.deepEqual(pixel(20, 20), { r: 255, g: 0, b: 0, a: 255 });
});

test("lanza un error si el buffer no es una imagen", async () => {
  await assert.rejects(cropCircle(Buffer.from("hola")));
});
