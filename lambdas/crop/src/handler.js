const { GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { extractObjects } = require("./s3Event");
const { buildProcessedKey } = require("./keys");
const { cropCircle } = require("./cropCircle");

/**
 * Crea el handler de la Lambda. Recibe el cliente S3 por parámetro para poder
 * inyectar uno falso en las pruebas.
 *
 * Procesa cada registro de SQS por separado: si uno falla, se agrega a
 * batchItemFailures y los demás siguen. Con ReportBatchItemFailures, SQS solo
 * reintenta los fallidos (y tras 3 intentos terminan en la DLQ).
 *
 * @param {{ s3: { send: Function }, config: { uploadPrefix: string, processedPrefix: string, size: number } }} deps
 * @returns {(event: { Records: object[] }) => Promise<{ batchItemFailures: { itemIdentifier: string }[] }>}
 */
function createHandler({ s3, config }) {
  const { uploadPrefix, processedPrefix, size } = config;

  return async function handler(event) {
    const batchItemFailures = [];

    for (const record of event.Records) {
      // Clave en proceso, para identificar el objeto en el log de error.
      let currentKey;
      try {
        const objects = extractObjects(record.body, { uploadPrefix });

        for (const { bucket, key } of objects) {
          currentKey = key;
          const startedAt = Date.now();

          const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
          const input = Buffer.from(await response.Body.transformToByteArray());
          const output = await cropCircle(input, size);

          const processedKey = buildProcessedKey(key, { uploadPrefix, processedPrefix });
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: processedKey,
              Body: output,
              ContentType: "image/png",
              ServerSideEncryption: "AES256",
            })
          );

          console.log(`Procesado ${key} -> ${processedKey} en ${Date.now() - startedAt} ms`);
        }
      } catch (error) {
        // Se registra la clave y el mensaje, nunca el contenido de la imagen.
        console.error(
          `Error en el mensaje ${record.messageId} (objeto: ${currentKey ?? "desconocido"}): ${error.message}`
        );
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }

    return { batchItemFailures };
  };
}

module.exports = { createHandler };
