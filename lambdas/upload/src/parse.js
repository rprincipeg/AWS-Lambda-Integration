const busboy = require("busboy");
const { badRequest, payloadTooLarge, unsupportedMediaType } = require("./errors");

// Lee la petición de API Gateway (payload 2.0) y devuelve { buffer, filename }
async function parseRequest(event, { maxBytes }) {
  const headers = event.headers || {};
  const contentType = headers["content-type"] || "";

  if (!event.body) throw badRequest("La solicitud no tiene cuerpo");

  // API Gateway manda en base64 los cuerpos binarios (como el multipart)
  const raw = Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");

  let result;
  if (contentType.startsWith("multipart/form-data")) {
      result = await parseMultipart(raw, contentType, maxBytes);
  } else if (contentType.startsWith("application/json")) {
    result = parseJson(raw);
  } else {
    throw unsupportedMediaType("Usa multipart/form-data o application/json");
  }

  // Validaciones comunes a los dos formatos
  if (result.buffer.length === 0) throw badRequest("La imagen está vacía");
  if (result.buffer.length > maxBytes) throw payloadTooLarge();
  return result;
}

// Formato JSON: { "data": "<base64>", "filename": "foto.png" }
function parseJson(raw) {
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    throw badRequest("El cuerpo no es un JSON válido");
  }

  if (typeof payload.data !== "string" || payload.data === "") {
    throw badRequest("Falta el campo data con la imagen en base64");
  }

  // Quita el prefijo "data:image/png;base64," si el cliente lo manda
  const data = payload.data.replace(/^data:[^;]*;base64,/, "").replace(/\s/g, "");
  const buffer = Buffer.from(data, "base64");

  // Buffer.from ignora en silencio los caracteres inválidos: si al volver a
  // codificar no sale lo mismo, el base64 venía roto
  if (buffer.toString("base64") !== data) {
    throw badRequest("El campo data no es base64 válido");
  }

  return { buffer, filename: payload.filename || "imagen" };
}

// Formato multipart/form-data: busboy lee el cuerpo y nos entrega el primer archivo
function parseMultipart(raw, contentType, maxBytes) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = busboy({ headers: { "content-type": contentType }, limits: { files: 1, fileSize: maxBytes } });
    } catch {
      // busboy falla aquí si el content-type no trae el boundary
      return reject(badRequest("El cuerpo multipart no es válido"));
    }

    let file = null;
    let tooLarge = false;

    bb.on("file", (name, stream, info) => {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      // busboy corta el archivo al llegar a fileSize y avisa con "limit"
      stream.on("limit", () => { tooLarge = true; });
      stream.on("end", () => {
        file = { buffer: Buffer.concat(chunks), filename: info.filename || "imagen" };
      });
    });

    bb.on("error", () => reject(badRequest("El cuerpo multipart no es válido")));

    // "close" llega cuando busboy terminó de leer todo el cuerpo
    bb.on("close", () => {
      if (tooLarge) return reject(payloadTooLarge());
      if (!file) return reject(badRequest("No se envió ningún archivo"));
      resolve(file);
    });

    bb.end(raw);
  });
}

module.exports = { parseRequest };