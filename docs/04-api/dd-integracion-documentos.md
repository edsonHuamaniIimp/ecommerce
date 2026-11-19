# API externa DD - documentos por empresa

Consulta las empresas y todos sus expedientes de Debida Diligencia, incluyendo
todas las versiones de sus documentos base.

## Endpoint

```http
GET /api/integracion/dd/empresas/documentos
```

Autenticación M2M obligatoria fuera de local:

```http
x-api-key: <INTEGRACION_API_KEY>
```

## Parámetros

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `tipoDocumento` | Con `documento` | `RUC` o `RUT`. |
| `documento` | No, si se usa `razonSocial` | Documento exacto de la empresa. |
| `razonSocial` | No, si se usa `documento` | Coincidencia parcial, sin distinguir mayúsculas. |
| `page` | No | Página, desde `1`. Default `1`. |
| `perPage` | No | Registros por página, máximo `50`. Default `20`. |

Debe enviarse al menos `documento` o `razonSocial`. Si se envía `documento`,
también se exige `tipoDocumento`. Ambos filtros pueden combinarse.

## Ejemplos

Por RUC:

```bash
curl --get "https://ecommerce.sistemasiimp.org.pe/api/integracion/dd/empresas/documentos" \
  --data-urlencode "tipoDocumento=RUC" \
  --data-urlencode "documento=20609385023" \
  -H "x-api-key: $INTEGRACION_API_KEY"
```

Por RUT:

```bash
curl --get "https://ecommerce.sistemasiimp.org.pe/api/integracion/dd/empresas/documentos" \
  --data-urlencode "tipoDocumento=RUT" \
  --data-urlencode "documento=FR48305461063" \
  -H "x-api-key: $INTEGRACION_API_KEY"
```

Por razón social:

```bash
curl --get "https://ecommerce.sistemasiimp.org.pe/api/integracion/dd/empresas/documentos" \
  --data-urlencode "razonSocial=CORPORACION AIREX" \
  -H "x-api-key: $INTEGRACION_API_KEY"
```

## Respuesta

```json
{
  "success": true,
  "data": {
    "empresas": [
      {
        "id": "uuid",
        "ruc": "20609385023",
        "tipoDocumento": "RUC",
        "razonSocial": "CORPORACIÓN AIREX S.A.C.",
        "nombreComercial": "CORP. AIREX SAC",
        "pais": "PE",
        "estado": "activa",
        "expedientes": [
          {
            "id": "uuid",
            "codigo": "DD-2026-0497",
            "estado": "aprobada",
            "origen": "flujo_regular",
            "evento": {
              "id": "uuid",
              "nombre": "PERUMIN 2027",
              "anio": "2027"
            },
            "fechaEnvio": "2026-11-19T15:00:00.000Z",
            "fechaRevision": "2026-11-19T16:00:00.000Z",
            "fechaAprobacion": "2026-11-19T16:30:00.000Z",
            "fechaVencimiento": "2027-05-19T16:30:00.000Z",
            "documentos": [
              {
                "id": "uuid",
                "tipo": "ficha_ruc",
                "titulo": "Ficha RUC o identificación fiscal",
                "nombre": "ficha-ruc.pdf",
                "url": "/uploads/ficha-ruc.pdf",
                "estado": "aprobado",
                "observacion": null,
                "updatedAt": "2026-11-19T15:10:00.000Z",
                "versionActual": 2,
                "versiones": [
                  {
                    "id": "uuid-v1",
                    "version": 1,
                    "nombre": "ficha-ruc-inicial.pdf",
                    "url": "/uploads/ficha-ruc-inicial.pdf",
                    "creadoPor": "cliente@empresa.pe",
                    "createdAt": "2026-11-19T15:00:00.000Z"
                  },
                  {
                    "id": "uuid-v2",
                    "version": 2,
                    "nombre": "ficha-ruc.pdf",
                    "url": "/uploads/ficha-ruc.pdf",
                    "creadoPor": "cliente@empresa.pe",
                    "createdAt": "2026-11-19T15:10:00.000Z"
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "total": 1,
    "page": 1,
    "perPage": 20,
    "totalPages": 1
  }
}
```

Los documentos se devuelven con todas sus versiones. `versionActual` es la última
versión; si un documento antiguo no tiene historial de versiones, se devuelve una
versión sintética `1` a partir del documento actual.

Cada documento incluye:

- `tipo`: código interno (`ficha_ruc`, `poderes`, etc.).
- `titulo`: título legible del documento.
- `nombre`: nombre del archivo de la versión actual.
- `url`: URL de la versión actual.
- `versiones[]`: historial completo, con `version`, `nombre`, `url`, `creadoPor` y
  `createdAt`.

## Consideraciones

- Solo se devuelven documentos de Debida Diligencia. No se incluyen evidencias de
  matriz, contratos, facturas ni documentos de otros módulos.
- La búsqueda por razón social puede devolver varias empresas.
- Las URLs se devuelven tal como están guardadas; pueden ser relativas a la
  aplicación.
- `estado` del expediente corresponde al workflow DD (`borrador`, `en_revision`,
  `observada`, `aprobada`, `rechazada`).
- El endpoint no modifica datos.

## Errores

| HTTP | Código | Causa |
|---|---|---|
| `401` | `UNAUTHORIZED` | Falta o no coincide `x-api-key`. |
| `400` | `VALIDATION` | Faltan filtros, tipo de documento inválido o RUC mal formado. |
| `500` | `INTERNAL` | Error interno. |
