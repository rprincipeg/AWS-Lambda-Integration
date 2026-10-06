const { S3Client } = require("@aws-sdk/client-s3");
const { createHandler } = require("./src/handler");

// El cliente se crea fuera del handler para reutilizarlo entre invocaciones.
const s3 = new S3Client({});

// Configuración desde las variables de entorno, con valores por defecto.
const config = {
  uploadPrefix: process.env.UPLOAD_PREFIX || "uploads/",
  processedPrefix: process.env.PROCESSED_PREFIX || "processed/",
  size: Number(process.env.CROP_SIZE) || 40,
};

// Handler de la Lambda: "index.handler".
exports.handler = createHandler({ s3, config });
