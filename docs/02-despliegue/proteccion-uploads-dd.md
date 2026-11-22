# Protección de documentos de DD en `/uploads/*`

## Problema
Los documentos de empresas (DD) se descargaban sin sesión: bastaba conocer la URL.

## Solución
- `GET /uploads/*` clasifica el archivo según las tablas de DD (`dd-archivo-acceso-repository.ts`):
  - `ninguno` (logos, planos, imágenes): público, igual que antes.
  - `documento` (documento/versión del expediente): personal DD (admin, SIG, Legal, Matriz, Panel, DD_ADMIN), la **propia empresa**, o integración M2M (`x-api-key`).
  - `interno` (evidencias de matriz, informe legal): solo personal DD.
- Sin sesión → 401. Otra empresa / Comunicaciones → 403. Falla la consulta → 503 (deniega).
- Respuestas protegidas: `Cache-Control: private, no-store`. Todas: `X-Content-Type-Options: nosniff`.
- Apagado por defecto: `UPLOADS_PROTEGIDOS=true` lo enciende.

## Por qué hay flag
En producción `/uploads/*` pasa por CloudFront con `Managed-CachingOptimized`, que **no reenvía cookies**. Encender la protección sin cambiar CloudFront dejaría a todos sin acceso (la app nunca vería la sesión). Además, consumidores M2M descargan las URLs de DD con `x-api-key`.

## Orden de despliegue (prod)
1. `terraform apply` con `proteger_uploads = true`:
   - crea la política de cache `uploads-protegidos` (cookie `token` + header `x-api-key` en la clave de cache),
   - la asigna a `/uploads/*`,
   - inyecta `UPLOADS_PROTEGIDOS=true` en la tarea ECS (pasos 1 y 2 salen en el mismo apply; la app queda protegida al rotar la tarea).
2. Verificar: sin sesión 401 sobre un documento DD; con sesión de la empresa 200; otra empresa 403; logo público 200.
3. Avisar a los consumidores M2M: deben enviar `x-api-key` al descargar.

Rollback: `proteger_uploads = false` y apply.

## QA (EC2)
Tras desplegar la imagen, agregar `UPLOADS_PROTEGIDOS=true` a `/opt/ctrst-qa/app.env` y reiniciar `ctrst-qa-app`. Caddy no cachea, no requiere cambios.

## Tests
`src/lib/server/__tests__/uploads-acceso.test.ts`, `src/app/uploads/__tests__/route.test.ts`.
