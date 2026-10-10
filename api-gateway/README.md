# API de subida de imágenes

API HTTP (API Gateway v2) con una sola ruta, `POST /upload`, recibe una imagen y la guarda en S3 en `uploads/`. Y ahí la procesa la crop-lambda.

## URL

La URL cambia en cada entorno. Se obtiene después del `apply`:

```bash
cd infra
bash scripts/tf.sh dev output -raw upload_endpoint
```

Cambiar `dev` por `qa`, `prod` o `sandbox:<nombre>` según el entorno.

## Formas de enviar la imagen

### multipart/form-data

```bash
curl -i -X POST "$API" -F "file=@foto.png"
```

### JSON con la imagen en base64

El cuerpo se guarda en un archivo porque una imagen en base64 es demasiado larga para la línea de comandos:

```bash
printf '{"filename":"foto.png","data":"%s"}' "$(base64 -w0 foto.png)" > body.json
curl -i -X POST "$API" -H "content-type: application/json" --data-binary @body.json
```

El campo `data` acepta también el prefijo `data:image/png;base64,`.

## Respuestas

| Código | Cuándo | Cuerpo |
|---|---|---|
| 201 | La imagen se guardó | `{"message":"Imagen recibida","key":"uploads/...","bucket":"..."}` |
| 400 | Sin cuerpo, JSON inválido, base64 inválido, sin archivo o imagen vacía | `{"error":{"code":"BAD_REQUEST","message":"..."}}` |
| 413 | La imagen supera 4 MB | `{"error":{"code":"PAYLOAD_TOO_LARGE","message":"..."}}` |
| 415 | No es jpg, png, gif ni webp, o el content-type no es multipart ni JSON | `{"error":{"code":"UNSUPPORTED_MEDIA_TYPE","message":"..."}}` |
| 429 | Se superó el límite de peticiones del entorno | Respuesta del propio API Gateway |
| 500 | Error inesperado al guardar en S3 | `{"error":{"code":"INTERNAL_ERROR","message":"No se pudo guardar la imagen"}}` |

## Formatos permitidos

jpg, png, gif y webp. El tipo se detecta por la firma de los bytes del archivo, no por el nombre ni por el content-type que manda el cliente. Un archivo de texto renombrado a `foto.png` responde 415.

## Límite de tamaño: 4 MB

API Gateway acepta hasta 10 MB, pero la invocación síncrona de Lambda acepta como máximo 6 MB, y el base64 aumenta el tamaño un 33 %. Con 4 MB el evento queda por debajo de ese límite.

Los archivos de entre 4 MB y 10 MB pueden recibir un error del propio gateway en lugar del JSON de la Lambda, porque la petición no llega a ejecutarse.

## Límites de peticiones por entorno

La API es pública y no tiene autenticación, así que el throttling limita el costo en caso de abuso. Los valores están en `infra/environments/*.tfvars`.

| Entorno | Peticiones por segundo | Ráfaga |
|---|---|---|
| dev | 20 | 10 |
| qa | 100 | 50 |
| prod | 10000 | 5000 |

## Clave generada en S3

`uploads/{uuid}_{nombre}.{ext}`

- `uuid`: identificador aleatorio para que dos archivos con el mismo nombre no se pisen.
- `nombre`: el nombre original en minúsculas que no tiene ruta ni caracteres especiales, máximo 60 caracteres.
- `ext`: la extensión del tipo detectado, no la del nombre original.

## Logs

- Peticiones a la API: `/aws/apigateway/<prefijo>-api`, una línea JSON por petición.
- Ejecución de la Lambda: `/aws/lambda/<prefijo>-upload`.
