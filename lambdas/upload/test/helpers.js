// Utilidades compartidas por las pruebas: imágenes mínimas, S3 falso y eventos de API Gateway

// Solo la firma de cada formato, rellenada hasta 12 bytes (no hace falta una imagen completa)
const relleno = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(12)]);
const images = {
  png: relleno([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpeg: relleno([0xff, 0xd8, 0xff]),
  gif: Buffer.from("GIF89a000000"),
  webp: Buffer.from("RIFF0000WEBP"),
};

// S3 falso: guarda lo que le piden en "calls"; si fail es true, simula un error de AWS
function fakeS3({ fail = false } = {}) {
  return {
    calls: [],
    async send(cmd) {
      if (fail) throw new Error("Access Denied");
      this.calls.push(cmd.input);
      return {};
    },
  };
}

// Evento multipart como lo manda API Gateway: cuerpo en base64 e isBase64Encoded true
function multipartEvent(buffer, filename) {
  const boundary = "limite-de-prueba";
  const disposition = filename
    ? `form-data; name="file"; filename="${filename}"`
    : 'form-data; name="campo"';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: ${disposition}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: body.toString("base64"),
    isBase64Encoded: true,
  };
}

// Evento JSON: el cuerpo va como texto normal
function jsonEvent(payload) {
  return {
    headers: { "content-type": "application/json" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
    isBase64Encoded: false,
  };
}

module.exports = { images, fakeS3, multipartEvent, jsonEvent };