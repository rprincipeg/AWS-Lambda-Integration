/**
 * Extrae los objetos de S3 que hay que procesar a partir del body de un
 * registro de SQS. El body contiene la notificación de S3 en formato JSON.
 *
 * - Si el JSON es inválido lanza un Error, para que el registro falle y SQS lo
 *   reintente (y termine en la DLQ si sigue fallando).
 * - Si no hay arreglo Records (por ejemplo el mensaje s3:TestEvent que S3 envía
 *   al configurar la notificación) devuelve un arreglo vacío.
 * - Descarta las claves que no empiezan por uploadPrefix, como protección
 *   contra bucles de procesamiento.
 *
 * @param {string} sqsRecordBody Texto JSON del body del registro de SQS.
 * @param {{ uploadPrefix: string }} options Prefijo de las imágenes originales.
 * @returns {{ bucket: string, key: string }[]} Objetos a procesar.
 */
function extractObjects(sqsRecordBody, { uploadPrefix }) {
  let message;
  try {
    message = JSON.parse(sqsRecordBody);
  } catch (error) {
    throw new Error(`El body del mensaje de SQS no es un JSON válido: ${error.message}`);
  }

  if (!message || !Array.isArray(message.Records)) {
    return [];
  }

  return message.Records
    .map((record) => ({
      bucket: record.s3.bucket.name,
      key: decodeS3Key(record.s3.object.key),
    }))
    .filter(({ key }) => key.startsWith(uploadPrefix));
}

/**
 * Decodifica la clave de un objeto tal como llega en la notificación de S3:
 * codificada como URL y con los espacios reemplazados por "+".
 *
 * @param {string} key Clave codificada.
 * @returns {string} Clave decodificada.
 */
function decodeS3Key(key) {
  try {
    return decodeURIComponent(key.replace(/\+/g, " "));
  } catch (error) {
    throw new Error(`No se pudo decodificar la clave del objeto "${key}": ${error.message}`);
  }
}

module.exports = { extractObjects };
