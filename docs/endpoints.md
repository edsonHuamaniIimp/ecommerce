# Endpoints / Contrato de API — ContratosStands

> **Estado:** BORRADOR v0.1. La **fuente de verdad** del contrato es
> [`docs/openapi.yaml`](./openapi.yaml) (Swagger/OpenAPI 3.0). Este documento es la
> guía legible; ante discrepancias, prevalece el OpenAPI.

## 1. Documentación con Swagger/OpenAPI (obligatorio)

- Toda API del sistema se **documenta en `docs/openapi.yaml`** y se mantiene
  sincronizada con la implementación (Route Handlers de Next.js).
- Validar el spec en el editor con la extensión OpenAPI/Swagger, o online en
  [editor.swagger.io](https://editor.swagger.io) (pegar el contenido de `openapi.yaml`).
- **Servir Swagger UI** dentro de la app (propuesta, cuando se implemente la API):
  - Instalar: `npm install swagger-ui-react` y exponer el spec en una ruta, o
  - Usar `next-swagger-doc` para generar el spec desde anotaciones y renderizarlo en
    una ruta `app/api-docs`.
  - Servir el YAML como estático desde `public/openapi.yaml` para consumo por Swagger UI.

## 2. Convenciones

- **Base path:** `/api` (Route Handlers en `src/app/api/**/route.ts`).
- **Formato:** JSON (excepto descarga de contrato: `application/pdf`).
- **Validación:** toda entrada se valida con **Zod** en el backend (nunca confiar en el
  frontend). Errores de validación → `422` con `ApiError`.
- **Auth:** `Authorization: Bearer <JWT>` (esquema `bearerAuth`).
- **Errores:** cuerpo uniforme `ApiError { error, code, detalles[] }`.
- **Idempotencia:** las operaciones de interoperabilidad (facturación) deben ser
  idempotentes y reconciliables por `reservaId`.
- **Tipado estricto:** sin `any`; los tipos del cliente se derivan del OpenAPI.

## 3. Resumen de endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/eventos-padre` | Lista eventos padre (verticales). |
| GET | `/eventos?eventoPadreId=` | Lista versiones de un evento padre. |
| GET | `/eventos/{eventoId}/plano` | Stands con X/Y y estado (plano interactivo). |
| GET | `/eventos/{eventoId}/tipos-stand` | Tipos de stand (monto + contrato). |
| POST | `/reservas` | Registra reserva de 1..N stands. |
| GET | `/reservas` | Lista reservas (dashboard). |
| GET | `/reservas/{reservaId}` | Detalle de reserva. |
| GET | `/reservas/{reservaId}/contrato` | Descarga contrato (PDF) por tipo de stand. |
| POST | `/reservas/{reservaId}/aprobaciones` | Resolución de un área (Legal/Logística/Eventos). |
| POST | `/reservas/{reservaId}/facturacion` | Envía reserva a facturación (SAP/John). |
| POST | `/interop/facturacion/callback` | Callback con orden/comprobante y ocupados. |
| GET | `/empresas?q=` | Búsqueda de empresas (proxy a fuente única). |

## 4. Flujos cubiertos

- **Reserva:** `POST /reservas` → stand(s) a `en_evaluacion` → aprobaciones
  (`POST /reservas/{id}/aprobaciones`) → `POST /reservas/{id}/facturacion` →
  `POST /interop/facturacion/callback` → stand(s) a `reservado`.
- **Plano:** `GET /eventos/{id}/plano` devuelve X/Y + estado (blanco=disponible,
  plomo=en_evaluacion, verde=reservado + empresa).

## 5. Pendientes por confirmar (PC)

- **Contrato real de interoperabilidad** con el sistema de John (request/response,
  autenticación, formato de X/Y, campos de stand y de cámara).
- ¿El plano X/Y se consume del servicio de John o se persiste localmente?
- Fuente única de **empresas** (John / base centralizada de Niel) y su API.
- Estrategia de **eventos/subeventos** (uno vs. dos parámetros).

> Al cerrar cada punto (PC), actualizar **primero** `docs/openapi.yaml` y luego la
> implementación y este resumen.
