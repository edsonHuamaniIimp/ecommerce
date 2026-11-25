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

## Ronda 2 (adversarial)

- `ronda2-setup.mjs`: crea 30 empresas y usuarios `e2e-r01..r30@example.invalid` (una vez).
- `ronda2.mjs`: bloques V (vigencia), S (subsanación), X (seguridad), M (matriz) y N (casos con empresa propia). `E2E_SOLO=V,S` ejecuta solo algunos. Los casos de vigencia siembran por BD una DD importada clonada de QA.
- Resultados: `ultima-corrida-ronda2.txt` y `docs/01-funcional/27-dd-ronda2-adversarial-qa.md`.

## Ronda 6 (estado "Documentación recibida")

- `ronda6.mjs`: bloques B (primer envío y bloqueos), T y V (disparadores que inician la revisión), C (ciclos completos con subsanación y Legal) y L (listados). Usa empresas R70..R81 (crearlas con `E2E_TOTAL=81 node ronda2-setup.mjs`); cada corrida necesita empresas sin DD en el evento.
- Resultados: `docs/01-funcional/28-dd-ronda6-documentacion-recibida-qa.md`.
