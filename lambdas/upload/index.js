const { S3Client } = require("@aws-sdk/client-s3");
const { v4: uuid } = require("uuid");
const { createHandler } = require("./src/handler");

// Falla al arrancar si falta el bucket: mejor un error claro que un 500 en cada petición
if (!process.env.S3_BUCKET) {
  throw new Error("Falta la variable de entorno S3_BUCKET");
}

const config = {
  bucket: process.env.S3_BUCKET,
  prefix: process.env.UPLOAD_PREFIX || "uploads/",
  maxBytes: Number(process.env.MAX_UPLOAD_BYTES || 4194304),
};

// Se crea una sola vez, fuera del handler, para reutilizarlo entre invocaciones
const s3 = new S3Client({});

exports.handler = createHandler({ s3, config, uuid });