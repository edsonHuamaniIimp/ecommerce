# E2E de Debida Diligencia en QA

Prueba de integración de punta a punta (cliente, SIG, Comunicaciones y Legal) contra la API real.
Resultados y hallazgos en `docs/01-funcional/26-dd-smoke-e2e-qa.md`.

## Piezas

- `e2e-setup.mjs`: crea (idempotente) los usuarios `e2e-sig|com|legal@example.invalid`, 8 empresas `E2E EMPRESA A..H` y un usuario cliente por empresa. Las contraseñas de prueba están definidas en el script. Se ejecuta **dentro del contenedor de la app** (usa `pg` y `DATABASE_URL`).
- `e2e-run.mjs`: corre los escenarios T, A..H. Variables: `E2E_SOLO` (por ejemplo `A,B`) y `E2E_RESET=1` (borra primero los expedientes E2E).
- `ultima-corrida.txt`: salida de la última corrida.

## Precauciones

- **No correrlo contra la app que envía correos.** Las notificaciones por rol llegan a todos los usuarios con ese permiso (incluidos administradores reales). Se usó un contenedor temporal con la misma imagen y la misma base de datos, **sin** `RESEND_API_KEY` ni claves de Pusher:

  ```text
  docker run -d --name ctrst-e2e --network ctrst-qa-net --env-file /opt/ctrst-qa/app.env \
    -e RESEND_API_KEY= -e PUSHER_APP_ID= -e PUSHER_KEY= -e PUSHER_SECRET= -e PUSHER_CLUSTER= \
    -v /opt/ctrst-qa/uploads:/app/public/uploads <imagen-de-qa>
  ```

- Copiar `e2e-run.mjs` a `/app` del contenedor (necesita resolver `pg`) y ejecutar `node /app/e2e-run.mjs` con `docker exec -w /app`.
- Eliminar el contenedor al terminar (`docker rm -f ctrst-e2e`).
- Los pasos marcados `BYPASS` en la salida son atajos para seguir el flujo cuando un paso falla por un defecto conocido (ver el documento de hallazgos).
