# Data de prueba en producción — ContratosStands

> Guía para poblar data de prueba aislada (marcadores `TEST-`), ejecutar el
> flujo completo y dejar la base de datos limpia. La data de prueba **nunca**
> toca tablas maestras ni de dependencia (`maestra`, `role`, `plano`, etc.).

## 1. Prerequisitos

1. Migración `0003_add_sgc_integration_tables` aplicada (tablas `sgc_*`).
2. En `.env.prod` (dentro del servidor):

   ```env
   SGC_ENABLED=1
   SGC_MODE=mock
   SGC_AREA_CODE=EVENTOS
   SGC_CONTRACT_TYPE_CODE=AUSPICIO
   ```

3. Recrear contenedor si cambiaste el env:

   ```bash
   docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
   ```

## 2. Crear la data de prueba

```bash
docker exec ctrst-app npx tsx scripts/seed-prod-test.ts
```

El seed crea (todo con prefijo `TEST-`):

- EventoPadre `TEST` + Evento `999/999` + EventoMetadata.
- 5 stands `TEST-01`..`TEST-05` (estado disponible).
- 5 GessStands vinculados a bloques libres del plano GESS.
- 4 usuarios de prueba con roles existentes.

## 3. Cuentas de prueba

| Email | Rol | Contraseña | Uso en el flujo |
|---|---|---|---|
| `test.cliente@iimp.org.pe` | cliente | `test123` | Crea la solicitud desde el plano |
| `test.logistica@iimp.org.pe` | logistica | `test123` | Primera revisión |
| `test.comunicacion@iimp.org.pe` | comunicacion | `test123` | Segunda revisión (dispara el SGC) |
| `test.admin@iimp.org.pe` | admin | `test123` | Supervisión, facturación, alertas |

## 4. Data fake para los formularios

### Datos comerciales (paso "Datos" de la reserva)

| Campo | Valor fake |
|---|---|
| Razón social | Empresa Test SAC |
| RUC | `20999999991` |
| Tipo de documento | RUC |
| Comprobante | Boleta |
| Dirección fiscal | Av. Test 123, Lima |
| Persona de contacto | Test Contacto |
| Teléfono | `+51999999999` |
| Correo electrónico | `test.cliente@iimp.org.pe` |

### Documentos (paso "Documentos")

Subir cualquier PDF/DOCX pequeño. No se valida contenido, solo el upload.

### Otros datos útiles

- DNI fake: `99999999`
- Empresa para búsquedas SUNAT/RENIEC: usar RUC reales de prueba pública
  (ej. `20100039207`) solo si la prueba lo requiere; si no, datos sintéticos.

## 5. Flujo de prueba (happy path)

1. Login `test.cliente@iimp.org.pe` → selecciona evento `Evento de Pruebas 2026`.
2. Abre el plano → clic en el stand `TEST-01` → "Reservar".
3. Completa datos comerciales (tabla §4) → sube documento → enviar.
   - Resultado: stand pasa a `en_evaluacion`, se crea `Solicitud` + 2 revisiones
     pendientes (`logistica`, `comunicacion`).
4. Login `test.logistica@iimp.org.pe` → bandeja de solicitudes → revisar → **Aprobar**.
5. Login `test.comunicacion@iimp.org.pe` → revisar → **Aprobar**.
   - Resultado: se crea el expediente en el SGC (`sgc_expediente.estado_envio = creado`)
     y el panel SGC aparece en el detalle de la solicitud.
6. Panel SGC → ver detalle / reconciliar (con `SGC_MODE=mock` todo es local).
7. Webhooks: simular con `POST /api/integracion/sgc/webhook` (requiere firma HMAC
   con `SGC_WEBHOOK_SECRET`) o usar `POST /api/sgc/sincronizar`.

## 6. Limpiar la data de prueba

### 6.1 Dry-run (recomendado antes de borrar)

```bash
docker exec ctrst-app npx tsx scripts/cleanup-prod-test.ts
```

Muestra cuántos registros borraría sin borrar nada.

### 6.2 Borrar

```bash
docker exec ctrst-app npx tsx scripts/cleanup-prod-test.ts --yes
```

Borra en orden FK: solicitudes, revisiones, reevaluaciones, facturaciones,
expedientes y documentos SGC, webhooks SGC, reservas, stands, posiciones,
gess stands, evento, metadata, evento padre (si quedó sin eventos), usuarios
de prueba, alertas, error logs y auditoría de los actores test.

### 6.3 Verificar que quedó limpio

```bash
docker exec ctrst-db-prod psql -U ctrst -d contratos_stands -c \
"SELECT count(*) FROM gess_stand WHERE stand_code LIKE 'TEST-%';
 SELECT count(*) FROM evento WHERE tipo_evento = 999;
 SELECT count(*) FROM user_role WHERE email LIKE 'test.%';"
```

Los tres conteos deben ser `0`. Tablas maestras (`maestra`, `role`, `plano_*`)
nunca se tocan.

## 7. Reglas de seguridad

- Siempre dry-run antes de borrar.
- La limpieza solo borra data bajo el evento `TEST` y usuarios `test.*@iimp.org.pe`.
- No se borra el `EventoPadre TEST` si aún tiene eventos no TEST.
- El script es idempotente: ejecutarlo dos veces no rompe nada.
- Antes de la primera prueba en un ambiente con datos reales: backup
  (`pg_dump` de la BD).
- Los expedientes creados en el SGC real (si `SGC_MODE=real`) **no** se borran
  con la limpieza local: usar `SGC_MODE=mock` mientras se prueba.
