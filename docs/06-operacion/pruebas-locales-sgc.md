# Pruebas locales de la integración SGC

> Objetivo: probar **todo el flujo** en local (modo `mock`, sin SGC real) y luego
> repetirlo en producción. Ver `docs/05-integraciones/integracion-sgc.md`.

## 1. Preparar el entorno (modo mock)

1. Pega en tu `.env` las variables de [`.env.sgc-local.example`](../../.env.sgc-local.example)
   (o cópialo: `copy .env.sgc-local.example .env` y ajusta).
2. Materializa las tablas `sgc_*`:
   ```bash
   npm run db:push
   ```
3. Arranca:
   ```bash
   npm run dev
   ```
   App en `http://localhost:3001`.

En modo mock el adaptador `SgcClient` es en memoria: crea expedientes, reserva/transfiere/confirma
documentos y sirve el detalle sin llamar a nadie.

## 2. Flujo a probar (happy path)

1. Login y crear/abrir una **solicitud** en `/dashboard/solicitudes`.
2. Revisar **Logística** → **Comunicación** (aprobar).
   - Al aprobar Comunicación se crea el expediente (mock) y el paso **"Legal (SGC)"** se activa.
3. En el modal/detalle, sección **"Revisión Legal (SGC)"**:
   - **Enviar contrato (v1) al SGC** (usa el documento del **admin**).
   - **Enviar anexos al SGC** (usa los documentos del **cliente**).
4. **Simular el workflow del SGC** con el simulador firmado (lee `.env` por su cuenta):
   ```bash
   npm run sgc:webhook -- <contractId> workflow.advanced
   npm run sgc:webhook -- <contractId> workflow.approved active
   ```
   - `<contractId>` lo obtienes del detalle (`GET /api/sgc/detalle?solicitudId=...`) o de Prisma Studio.
5. Verifica que **"Generar orden de pago"** queda habilitado solo tras `workflow.approved active`.
6. **Descargar contrato firmado**: el mock devuelve una URL `https://mock-sgc.local/...`
   (no abre; es esperado en mock).
7. Devuelto/subsanación:
   ```bash
   npm run sgc:webhook -- <contractId> workflow.returned
   ```
   → estado `Observado`; luego "subsanar" sobre el mismo `documentId`.

También puedes forzar el estado sin webhooks con `POST /api/sgc/sincronizar` (reconciliación),
que en mock refresca desde el expediente en memoria.

## 3. Cron / outbox en local

```bash
curl -X POST http://localhost:3001/api/cron/sgc-reconciliar -H "x-cron-secret: local-cron-secret"
```
Ejecuta reconciliación + reintento de `estadoEnvio=error` + despacho del outbox.

## 4. Pasar a producción

1. `SGC_MODE=real` + `SGC_API_URL`, `SGC_API_KEY` (los da el SGC), `SGC_AREA_CODE`,
   `SGC_CONTRACT_TYPE_CODE`, `SGC_WEBHOOK_SECRET`, `CRON_SECRET`.
2. Migrar BD: `npm run db:migrate:deploy`.
3. **Webhooks**: el SGC no entrega a `localhost`. En prod, el host (p. ej.
   `https://ecommerce.sistemasiimp.org.pe`) debe estar en la lista blanca del SGC.
   Mientras no haya webhooks, usa el **cron de reconciliación** (polling):
   configura los secrets de repo `SGC_RECONCILE_URL` y `SGC_CRON_SECRET`.
   Para probar webhooks antes, usa un túnel HTTPS (ngrok) y registra esa URL en el SGC.

Probar desde local contra el SGC real **sí es posible** (auth por `Bearer sgc_<clave>`, sin
restricción de IP); lo único que no llega a local son los webhooks.
