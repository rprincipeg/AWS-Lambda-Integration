// Error con código HTTP: el handler lo usa para responder con el status correcto
class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Fábricas cortas para no repetir el código y el status en cada throw
function badRequest(msg = "La solicitud no es válida") {
  return new HttpError(400, "BAD_REQUEST", msg);
}

// payloadTooLarge: 413, "PAYLOAD_TOO_LARGE"
function payloadTooLarge(msg = "La imagen supera el tamaño máximo permitido") {
  return new HttpError(413, "PAYLOAD_TOO_LARGE", msg);
}

// unsupportedMediaType: 415, "UNSUPPORTED_MEDIA_TYPE"
function unsupportedMediaType(msg = "Solo se permiten imágenes jpg, png, gif o webp") {
  return new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", msg);
}

module.exports = { HttpError, badRequest, payloadTooLarge, unsupportedMediaType };