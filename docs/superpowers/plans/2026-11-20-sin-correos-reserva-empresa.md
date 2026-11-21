# Sin correos para reservas de pabellones internacionales — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** suprimir todos los correos transaccionales de las solicitudes creadas desde `/dashboard/reservar-empresa` (`tipo = reserva_empresa`), sin alterar alertas internas, estados, SGC, contratos ni facturación.

**Architecture:** una política compartida `permiteCorreosSolicitud(tipoSolicitud)` se aplica en cada disparador de correo del flujo. Para facturación se agrega `tipoSolicitud` a las filas que hoy solo conocen `solicitudId`, evitando consultas adicionales por correo. No hay migración de base de datos.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Prisma, servicios de aplicación existentes.

**Spec:** requisito directo del usuario del 2026-11-20; no existe un spec formal adicional. El alcance vinculante es la sección “Alcance” de este documento.

---

## Alcance

Aplica únicamente a solicitudes con:

```ts
tipo === TIPOS_SOLICITUD.RESERVA_EMPRESA
```

Creadas desde:

```text
/dashboard/reservar-empresa
```

Debe suprimirse **todo correo** generado por el ciclo de vida de esas solicitudes:

- creación de la reserva;
- observación del Asociado;
- notificación manual de revisión;
- devolución/rechazo del SGC;
- observación del contrato por el SGC;
- aprobación del SGC;
- comprobante fiscal adjuntado;
- factura disponible notificada por el SIE;
- recordatorios de facturación.

También deben suprimirse los correos internos (Asociado, administración, receptores configurados).

**No se suprime:**

- alertas in-app (`crearAlertaReserva`, `crearAlertaRevision`, `crearAlertaRol`);
- cambios de estado, contrato, SGC, orden de pago o facturación;
- correos de autenticación, credenciales, recuperación, registro o Debida Diligencia, porque no pertenecen al ciclo de la solicitud;
- comportamiento de solicitudes regulares (`tipo` distinto de `reserva_empresa`).

## Global Constraints

- Usar `TIPOS_SOLICITUD.RESERVA_EMPRESA`; nunca el string literal.
- La política debe ser una función compartida y testeada.
- En solicitudes de pabellones internacionales no debe ejecutarse `enviarEmailPlantilla` ni `sendEmail`.
- Las alertas in-app y los efectos de negocio deben seguir ejecutándose.
- No agregar columnas ni migraciones.
- No tocar los archivos de Debida Diligencia que otra sesión tiene sin commitear.
- Cada tarea debe terminar con test, `tsc`, ESLint y commit de los archivos de esa tarea solamente.
- Si un fixture existente falla por el nuevo campo `tipoSolicitud`, actualizarlo; no volver el campo opcional.
- Los correos de cuentas/seguridad fuera del flujo no se modifican.

## Review Focus

- Un disparador de correo del flujo queda sin política y sigue enviando: mitigado con inventario y auditoría final de todas las llamadas a `enviarEmailPlantilla`.
- Se suprime por error un correo de una solicitud regular: mitigado con tests de regresión que mantienen los envíos normales.
- Las alertas in-app se suprimen junto con el correo: mitigado con asserts de alertas en los tests.
- La facturación pierde el tipo de solicitud al mapear Prisma a dominio: mitigado haciendo obligatorio `tipoSolicitud` y actualizando fixtures.
- El SGC sigue enviando correos de contrato observado o aprobación por una ruta no cubierta: mitigado con tests específicos de `sgc-webhook-service` y `contrato-observado`.

## Inventario de correos afectados

| Disparador | Archivo actual | Plantilla(s) | Tratamiento |
|---|---|---|---|
| Creación de reserva | `src/application/reservas/reserva-service.ts:694` | `reserva-confirmacion`, `reserva-admin` | No enviar |
| Observación del Asociado | `src/application/solicitudes/solicitudes-service.ts:371` | `documentos-observados` | No enviar |
| Notificación manual de revisión | `src/application/solicitudes/solicitudes-service.ts:229` | `revision-resultado` | No enviar |
| Devolución/rechazo SGC al cliente | `src/application/sgc-integracion/notificar-devolucion.ts:35` | `documentos-observados` | No enviar |
| Contrato observado por SGC a internos | `src/application/sgc-integracion/contrato-observado.ts:154` | `sgc-contrato-observado` | No enviar |
| Aprobación SGC al cliente | `src/application/sgc-integracion/sgc-webhook-service.ts:212` | `revision-resultado` | No enviar |
| Comprobante fiscal adjuntado | `src/application/facturacion/facturacion-service.ts:222` | `comprobante-pago` | No enviar |
| Factura disponible del SIE | `src/application/facturacion-iimp/notificacion-factura-service.ts:86` | `facturacion-factura-disponible` | No enviar |
| Recordatorio sin solicitud | `src/application/facturacion/recordatorios-facturacion-service.ts:135` | `facturacion-recordatorio-solicitud` | No enviar |
| Recordatorio de documentos | `src/application/facturacion/recordatorios-facturacion-service.ts:144` | `facturacion-recordatorio-documentos` | No enviar |

Fuera de alcance: `auth-service`, `empresa-service`, `usuarios-service`, `solicitud-cuenta-service` y `debida-diligencia-notificacion`, salvo que en el futuro se invoquen desde este flujo.

## File Structure

**Crear**

- `src/lib/shared/utils/correos-solicitud.ts` — política única de correos por tipo de solicitud.
- `src/lib/shared/utils/__tests__/correos-solicitud.test.ts` — tests de la política.
- `src/application/sgc-integracion/__tests__/contrato-observado.test.ts` — regresión del aviso interno de contrato observado por SGC.

**Modificar**

- `src/application/reservas/reserva-service.ts` — creación.
- `src/application/solicitudes/solicitudes-service.ts` — observación del Asociado y notificación manual.
- `src/application/sgc-integracion/notificar-devolucion.ts` — devolución/rechazo SGC.
- `src/application/sgc-integracion/contrato-observado.ts` — correo interno de contrato observado.
- `src/application/sgc-integracion/sgc-webhook-service.ts` — aprobación SGC.
- `src/domain/ports/facturacion-repository.ts` — `tipoSolicitud` en filas de facturación y recordatorios.
- `src/types/dto/facturacion/recordatorio-candidato.dto.ts` — `tipoSolicitud` para validar ids obsoletos antes de enviar.
- `src/infrastructure/persistence/facturacion-repository.ts` — mapeo de `solicitud.tipo`.
- `src/application/facturacion/facturacion-service.ts` — correo de comprobante.
- `src/application/facturacion-iimp/notificacion-factura-service.ts` — correo de factura disponible.
- `src/application/facturacion/recordatorios-facturacion-service.ts` — exclusión y supresión de recordatorios.
- Tests de esas áreas y fixtures de `FacturacionRow` / `RecordatorioCandidatoRow`.
- `.opencode/reglas/flujo-pabellones-internacionales/SKILL.md` — regla operativa de no correos.

---

### Task 1: Política compartida de correos

**Files:**
- Create: `src/lib/shared/utils/correos-solicitud.ts`
- Test: `src/lib/shared/utils/__tests__/correos-solicitud.test.ts`

**Interfaces:**
- Produces: `permiteCorreosSolicitud(tipoSolicitud: string | null | undefined): boolean`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, it } from "vitest";
import { TIPOS_SOLICITUD } from "@/lib/shared/constants";
import { permiteCorreosSolicitud } from "../correos-solicitud";

describe("permiteCorreosSolicitud", () => {
  it("bloquea correos para reserva_empresa", () => {
    expect(permiteCorreosSolicitud(TIPOS_SOLICITUD.RESERVA_EMPRESA)).toBe(false);
  });

  it("permite correos regulares y tipos desconocidos", () => {
    expect(permiteCorreosSolicitud(null)).toBe(true);
    expect(permiteCorreosSolicitud(undefined)).toBe(true);
    expect(permiteCorreosSolicitud("regular")).toBe(true);
    expect(permiteCorreosSolicitud("otro")).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

```powershell
npx vitest run src/lib/shared/utils/__tests__/correos-solicitud.test.ts
```

Resultado esperado: falla porque el módulo no existe.

- [ ] **Step 3: Crear la implementación mínima**

```ts
import { TIPOS_SOLICITUD } from "@/lib/shared/constants";

/**
 * Las reservas administrativas de pabellones internacionales no envían correos:
 * el IIMP gestiona la comunicación manualmente. Las alertas in-app no se afectan.
 */
export function permiteCorreosSolicitud(tipoSolicitud: string | null | undefined): boolean {
  return tipoSolicitud !== TIPOS_SOLICITUD.RESERVA_EMPRESA;
}
```

- [ ] **Step 4: Ejecutar test, tipos y lint**

```powershell
npx vitest run src/lib/shared/utils/__tests__/correos-solicitud.test.ts
npx tsc --noEmit
npx eslint src/lib/shared/utils/correos-solicitud.ts src/lib/shared/utils/__tests__/correos-solicitud.test.ts
```

Resultado esperado: todo pasa.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/shared/utils/correos-solicitud.ts src/lib/shared/utils/__tests__/correos-solicitud.test.ts
git commit -m "feat(notificaciones): agrega politica de correos por tipo de solicitud"
```

---

### Task 2: Suprimir correos al crear la reserva

**Files:**
- Modify: `src/application/reservas/reserva-service.ts`
- Test: `src/application/reservas/__tests__/reserva-service.test.ts`

**Interfaces:**
- Consumes: `permiteCorreosSolicitud` de Task 1.
- Relevant input: `crearAdministrativa` pasa `tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA` a `crear`.

- [ ] **Step 1: Agregar el test de regresión al test existente de reserva administrativa**

En `src/application/reservas/__tests__/reserva-service.test.ts`, dentro del test `"marca como reserva_empresa la solicitud creada desde la reserva administrativa"`, antes del `crearAdministrativa`:

```ts
vi.mocked(enviarEmailPlantilla).mockClear();
```

Después de `expect(res.estadoPago).toBe(ESTADOS_PAGO_SOLICITUD.PENDIENTE_PAGO);`:

```ts
expect(enviarEmailPlantilla).not.toHaveBeenCalled();
```

El test existente `"notifica a los receptores internos configurados"` debe seguir pasando para una solicitud regular.

- [ ] **Step 2: Ejecutar el test para verificar que falla**

```powershell
npx vitest run src/application/reservas/__tests__/reserva-service.test.ts -t "marca como reserva_empresa"
```

Resultado esperado: falla porque actualmente se envían `reserva-confirmacion` y `reserva-admin`.

- [ ] **Step 3: Aplicar la política en la creación**

Agregar el import en `reserva-service.ts`:

```ts
import { permiteCorreosSolicitud } from "@/lib/shared/utils/correos-solicitud";
```

Cambiar la condición del bloque de correos:

```ts
if (contactEmail && permiteCorreosSolicitud(request.tipo)) {
```

Mantener intacto el resto del bloque; solo cambia la condición de entrada.

- [ ] **Step 4: Ejecutar test, tipos y lint**

```powershell
npx vitest run src/application/reservas/__tests__/reserva-service.test.ts
npx tsc --noEmit
npx eslint src/application/reservas/reserva-service.ts src/application/reservas/__tests__/reserva-service.test.ts
```

- [ ] **Step 5: Commit**

```powershell
git add src/application/reservas/reserva-service.ts src/application/reservas/__tests__/reserva-service.test.ts
git commit -m "fix(reservas): suprime correos al crear reservas de pabellones internacionales"
```

---

### Task 3: Suprimir correos del Asociado y notificación manual

**Files:**
- Modify: `src/application/solicitudes/solicitudes-service.ts`
- Test: `src/application/solicitudes/__tests__/solicitudes-service-sgc.test.ts`

**Interfaces:**
- Consumes: `permiteCorreosSolicitud`.
- `revisar` ya carga `detalleActual` y `detalle`; usar `detalle.tipo`.

- [ ] **Step 1: Agregar test de observación del Asociado sin correo**

Agregar en `solicitudes-service-sgc.test.ts`:

```ts
it("no envia correo al observar una reserva_empresa", async () => {
  const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.OBSERVADO);
  repo.detalle = vi.fn().mockResolvedValue(detalleMultistand({
    tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
    estadoSolicitud: ESTADOS_SOLICITUD.OBSERVADO,
    email: "cliente@empresa.pe",
    userId: "user-1",
    docsAdjuntos: [{
      id: "doc-1",
      url: "/uploads/doc-1.pdf",
      nombre: "doc-1.pdf",
      userId: "user-1",
      uploadedBy: "cliente@empresa.pe",
      categoria: TIPOS_DOCUMENTO_SOLICITUD.ANEXO,
      requisito: ANEXOS_KEYS.FICHA_RUC,
      estado: ESTADOS_DOCUMENTO_SOLICITUD.ACTIVO,
      createdAt: new Date("2026-11-20T10:00:00.000Z"),
    }],
  }));
  repo.observarDocumentos = vi.fn().mockResolvedValue(1);
  const svc = new SolicitudesApplicationService(repo, sgcMock());
  vi.mocked(enviarEmailPlantilla).mockClear();

  await svc.revisar({
    solicitudId: "sol-1",
    area: REVISION_AREAS.ASOCIADO,
    estado: RESULTADOS_APROBACION.OBSERVADO,
    comentario: "Corrige la ficha RUC",
    documentosObservados: ["doc-1"],
    reviewerEmail: "asociado@iimp.org.pe",
  });

  expect(enviarEmailPlantilla).not.toHaveBeenCalled();
});
```

Agregar también el test de notificación manual:

```ts
vi.mock("@/lib/server/auth", () => ({
  hasDBPermission: vi.fn(async () => true),
}));

it("no envia correo manual para reserva_empresa", async () => {
  const repo = repoMock(REVISION_AREAS.ASOCIADO, RESULTADOS_APROBACION.PENDIENTE);
  repo.detalle = vi.fn().mockResolvedValue(detalleMultistand({
    tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
    email: "cliente@empresa.pe",
    userId: "user-1",
  }));
  const svc = new SolicitudesApplicationService(repo);
  vi.mocked(enviarEmailPlantilla).mockClear();

  await svc.notificarCliente(
    {
      solicitudId: "sol-1",
      to: "cliente@empresa.pe",
      modo: "manual",
      idioma: "es",
    },
    {
      sub: "admin-1",
      email: "admin@iimp.org.pe",
      name: "Admin",
      roles: ["admin"],
      permissions: [PERMISSIONS.ADMIN_FULL],
    },
  );

  expect(enviarEmailPlantilla).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

```powershell
npx vitest run src/application/solicitudes/__tests__/solicitudes-service-sgc.test.ts -t "no envia correo al observar una reserva_empresa"
```

- [ ] **Step 3: Aplicar guardas en `solicitudes-service.ts`**

Agregar el import:

```ts
import { permiteCorreosSolicitud } from "@/lib/shared/utils/correos-solicitud";
```

En `notificarCliente`, inmediatamente después de obtener `detalle`:

```ts
if (!permiteCorreosSolicitud(detalle.tipo)) return;
```

En la rama de observación de `revisar`, cambiar la condición del correo:

```ts
if (detalle.email && permiteCorreosSolicitud(detalle.tipo)) {
```

No mover ni eliminar la creación de alertas.

- [ ] **Step 4: Ejecutar test, tipos y lint**

```powershell
npx vitest run src/application/solicitudes/__tests__/solicitudes-service-sgc.test.ts
npx tsc --noEmit
npx eslint src/application/solicitudes/solicitudes-service.ts src/application/solicitudes/__tests__/solicitudes-service-sgc.test.ts
```

- [ ] **Step 5: Commit**

```powershell
git add src/application/solicitudes/solicitudes-service.ts src/application/solicitudes/__tests__/solicitudes-service-sgc.test.ts
git commit -m "fix(solicitudes): suprime correos del asociado para reservas de pabellones"
```

---

### Task 4: Suprimir correos del SGC

**Files:**
- Modify: `src/application/sgc-integracion/notificar-devolucion.ts`
- Modify: `src/application/sgc-integracion/contrato-observado.ts`
- Modify: `src/application/sgc-integracion/sgc-webhook-service.ts`
- Test: `src/application/sgc-integracion/__tests__/sgc-webhook-service.test.ts`
- Test: `src/application/sgc-integracion/__tests__/contrato-observado.test.ts` (crear)

**Interfaces:**
- Consumes: `permiteCorreosSolicitud`.
- `detalle.tipo` está disponible en las tres rutas.

- [ ] **Step 1: Agregar test de aprobación SGC sin correo**

En `sgc-webhook-service.test.ts`, agregar un test con el mismo setup del test `"deberia notificar al cliente en su idioma cuando el SGC aprueba (activo)"`, pero cambiando el detalle a:

```ts
tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
```

y terminando con:

```ts
expect(enviarEmailPlantilla).not.toHaveBeenCalled();
```

El test existente de aprobación regular debe quedar sin cambios.

- [ ] **Step 2: Agregar test de devolución SGC sin correo**

En el test existente de devolución, duplicar el escenario con el detalle incluyendo:

```ts
tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
```

y verificar:

```ts
expect(vi.mocked(solicitudes.crearAlertaReserva)).toHaveBeenCalled();
expect(enviarEmailPlantilla).not.toHaveBeenCalled();
```

- [ ] **Step 3: Crear test del aviso interno de contrato observado**

```ts
import { describe, expect, it, vi } from "vitest";
import { TIPOS_SOLICITUD } from "@/lib/shared/constants";
import { notificarContratoObservadoSgc } from "../contrato-observado";
import { enviarEmailPlantilla } from "@/lib/server/email";

vi.mock("@/lib/server/email", () => ({
  enviarEmailPlantilla: vi.fn().mockResolvedValue(true),
}));

describe("notificarContratoObservadoSgc", () => {
  it("no envia correo interno para reserva_empresa", async () => {
    const solicitudes = {
      detalle: vi.fn().mockResolvedValue({
        tipo: TIPOS_SOLICITUD.RESERVA_EMPRESA,
        standCode: "BLOQUE-868",
        empresa: "REPRESENTACIONES PERUVIAN TRADING S.A.",
      }),
      crearAlertaRevision: vi.fn().mockResolvedValue(undefined),
    };

    await notificarContratoObservadoSgc({
      solicitudId: "sol-1",
      resultado: {
        aplica: true,
        auto: false,
        yaRegenerado: false,
        error: null,
        observacion: {
          title: "Contrato",
          message: "Corrige el contrato",
          status: "open",
          requiresDocumentChange: true,
        },
      },
      solicitudes: solicitudes as never,
      configuracion: {
        obtenerNotificacionesSolicitudes: vi.fn().mockResolvedValue(["admin@iimp.org.pe"]),
      } as never,
    });

    expect(solicitudes.crearAlertaRevision).toHaveBeenCalled();
    expect(enviarEmailPlantilla).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Ejecutar tests para verificar que fallan**

```powershell
npx vitest run src/application/sgc-integracion/__tests__/sgc-webhook-service.test.ts src/application/sgc-integracion/__tests__/contrato-observado.test.ts
```

- [ ] **Step 5: Aplicar guardas**

En `notificar-devolucion.ts`:

```ts
if (detalle.email && permiteCorreosSolicitud(detalle.tipo)) {
```

En `contrato-observado.ts`, después de crear la alerta y antes de calcular destinatarios:

```ts
if (!permiteCorreosSolicitud(detalle.tipo)) return;
```

En `sgc-webhook-service.ts`, en `notificarAprobacion`, después de obtener `detalle`:

```ts
if (!detalle?.email || !permiteCorreosSolicitud(detalle.tipo)) return;
```

Agregar el import de `permiteCorreosSolicitud` en los tres archivos.

- [ ] **Step 6: Ejecutar tests, tipos y lint**

```powershell
npx vitest run src/application/sgc-integracion/__tests__/sgc-webhook-service.test.ts src/application/sgc-integracion/__tests__/contrato-observado.test.ts
npx tsc --noEmit
npx eslint src/application/sgc-integracion/notificar-devolucion.ts src/application/sgc-integracion/contrato-observado.ts src/application/sgc-integracion/sgc-webhook-service.ts src/application/sgc-integracion/__tests__/sgc-webhook-service.test.ts src/application/sgc-integracion/__tests__/contrato-observado.test.ts
```

- [ ] **Step 7: Commit**

```powershell
git add src/application/sgc-integracion/notificar-devolucion.ts src/application/sgc-integracion/contrato-observado.ts src/application/sgc-integracion/sgc-webhook-service.ts src/application/sgc-integracion/__tests__/sgc-webhook-service.test.ts src/application/sgc-integracion/__tests__/contrato-observado.test.ts
git commit -m "fix(sgc): suprime correos de reservas de pabellones internacionales"
```

---

### Task 5: Propagar el tipo de solicitud a facturación

**Files:**
- Modify: `src/domain/ports/facturacion-repository.ts`
- Modify: `src/infrastructure/persistence/facturacion-repository.ts`
- Test fixtures:
  - `src/application/facturacion/__tests__/facturacion-service.test.ts`
  - `src/application/pagos/__tests__/pagos-service.test.ts`
  - `src/application/facturacion-iimp/__tests__/notificacion-factura-service.test.ts`
  - `src/application/facturacion/__tests__/recordatorios-facturacion-service.test.ts`

**Interfaces:**
- Produces: `FacturacionRow.tipoSolicitud: string | null`
- Produces: `RecordatorioCandidatoRow.tipoSolicitud: string | null`

- [ ] **Step 1: Agregar los campos a los tipos de dominio**

En `facturacion-repository.ts`:

```ts
export interface FacturacionRow {
  id: string;
  solicitudId: string;
  tipo: string;
  /** Tipo de la solicitud (`reserva_empresa` = no envia correos). */
  tipoSolicitud: string | null;
  // ...
}

export interface RecordatorioCandidatoRow {
  facturacionId: string;
  solicitudId: string;
  /** Tipo de la solicitud (`reserva_empresa` = no envia correos). */
  tipoSolicitud: string | null;
  // ...
}
```

- [ ] **Step 2: Mapear `solicitud.tipo` en Prisma**

En `src/infrastructure/persistence/facturacion-repository.ts`:

```ts
interface FacturacionRaw {
  // ...
  solicitud: {
    tipo: string | null;
    email: string | null;
    // ...
  };
}

const SOLICITUD_SELECT = {
  tipo: true,
  email: true,
  // ...
};

// dentro de toRow:
tipoSolicitud: r.solicitud.tipo,
```

En `listarCandidatosRecordatorio`, dentro del objeto devuelto:

```ts
tipoSolicitud: row.tipoSolicitud,
```

- [ ] **Step 3: Actualizar fixtures para que compile**

En los fixtures `FacturacionRow` de `facturacion-service.test.ts` y `pagos-service.test.ts` agregar:

```ts
tipoSolicitud: null,
```

En `notificacion-factura-service.test.ts`, en `FACTURACION`:

```ts
tipoSolicitud: null,
```

En `recordatorios-facturacion-service.test.ts`, en `candidato()`:

```ts
tipoSolicitud: null,
```

- [ ] **Step 4: Ejecutar tipos y tests de dominio/mappers**

```powershell
npx tsc --noEmit
npx vitest run src/application/facturacion/__tests__/facturacion-service.test.ts src/application/pagos/__tests__/pagos-service.test.ts src/application/facturacion-iimp/__tests__/notificacion-factura-service.test.ts src/application/facturacion/__tests__/recordatorios-facturacion-service.test.ts
```

Resultado esperado: compila y pasan los tests existentes.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/ports/facturacion-repository.ts src/infrastructure/persistence/facturacion-repository.ts src/application/facturacion/__tests__/facturacion-service.test.ts src/application/pagos/__tests__/pagos-service.test.ts src/application/facturacion-iimp/__tests__/notificacion-factura-service.test.ts src/application/facturacion/__tests__/recordatorios-facturacion-service.test.ts
git commit -m "feat(facturacion): propaga el tipo de solicitud a las filas de facturacion"
```

---

### Task 6: Suprimir correos de facturación

**Files:**
- Modify: `src/application/facturacion/facturacion-service.ts`
- Modify: `src/application/facturacion-iimp/notificacion-factura-service.ts`
- Modify: `src/application/facturacion/recordatorios-facturacion-service.ts`
- Tests:
  - `src/application/facturacion/__tests__/facturacion-service.test.ts`
  - `src/application/facturacion-iimp/__tests__/notificacion-factura-service.test.ts`
  - `src/application/facturacion/__tests__/recordatorios-facturacion-service.test.ts`

**Interfaces:**
- Consumes: `FacturacionRow.tipoSolicitud`, `RecordatorioCandidatoRow.tipoSolicitud`.
- Consumes: `permiteCorreosSolicitud`.

- [ ] **Step 1: Agregar test de comprobante fiscal sin correo**

En `facturacion-service.test.ts`, agregar:

```ts
it("no envia comprobante-pago para una reserva_empresa", async () => {
  const repo = mockRepo();
  vi.mocked(repo.facturacionDeCuota).mockResolvedValue({
    ...sampleRow,
    tipoSolicitud: TIPOS_SOLICITUD.RESERVA_EMPRESA,
  });
  const svc = crearSvc(repo);

  await svc.adjuntarComprobanteFiscal(
    "c1",
    { tipo: "factura", numero: "F001-1234", url: "/uploads/f001.pdf" },
    "facturacion@iimp.org.pe",
  );

  expect(enviarEmailPlantilla).not.toHaveBeenCalled();
});
```

Agregar `TIPOS_SOLICITUD` al import de constantes del test.

- [ ] **Step 2: Agregar test de factura disponible sin correo**

En `notificacion-factura-service.test.ts`, agregar:

```ts
it("no avisa al cliente cuando la solicitud es reserva_empresa", async () => {
  const m = mocks();
  vi.mocked(m.facturacion.detalle).mockResolvedValue({
    ...FACTURACION,
    tipoSolicitud: TIPOS_SOLICITUD.RESERVA_EMPRESA,
  });

  await servicio(m).registrar({ ...BASE, fechaEmision: "2026-11-05" });

  expect(enviarEmailPlantilla).not.toHaveBeenCalled();
});
```

Agregar `TIPOS_SOLICITUD` al import.

- [ ] **Step 3: Agregar test de recordatorios excluidos**

En `recordatorios-facturacion-service.test.ts`, agregar:

```ts
it("excluye reservas_empresa de candidatos y no envia correo", async () => {
  const { svc } = crearSvc([
    candidato({ tipoSolicitud: TIPOS_SOLICITUD.RESERVA_EMPRESA }),
  ]);

  const listado = await svc.listarCandidatos();
  expect(listado.sinSolicitud).toHaveLength(0);

  const resultado = await svc.enviar(
    { tipo: RECORDATORIOS_FACTURACION.SIN_SOLICITUD, facturacionIds: ["f1"] },
    "facturacion@iimp.org.pe",
  );

  expect(resultado.enviados).toBe(0);
  expect(enviarEmailPlantilla).not.toHaveBeenCalled();
});
```

Agregar `TIPOS_SOLICITUD` al import.

- [ ] **Step 4: Ejecutar tests para verificar que fallan**

```powershell
npx vitest run src/application/facturacion/__tests__/facturacion-service.test.ts src/application/facturacion-iimp/__tests__/notificacion-factura-service.test.ts src/application/facturacion/__tests__/recordatorios-facturacion-service.test.ts -t "reserva_empresa"
```

- [ ] **Step 5: Aplicar guardas**

`facturacion-service.ts`:

```ts
import { permiteCorreosSolicitud } from "@/lib/shared/utils/correos-solicitud";

if (fact.correoSolicitante && permiteCorreosSolicitud(fact.tipoSolicitud)) {
```

`notificacion-factura-service.ts`:

```ts
import { permiteCorreosSolicitud } from "@/lib/shared/utils/correos-solicitud";

if (
  estadoPago !== ESTADOS_PAGO_EXTERNO.ANULADA &&
  facturacion.correoSolicitante &&
  permiteCorreosSolicitud(facturacion.tipoSolicitud)
) {
```

`recordatorios-facturacion-service.ts`:

```ts
import { permiteCorreosSolicitud } from "@/lib/shared/utils/correos-solicitud";

const rows = (await this.repo.listarCandidatosRecordatorio())
  .filter((row) => row.cuotasPendientes > 0 && permiteCorreosSolicitud(row.tipoSolicitud));
```

En `enviar`, endurecer la validación del candidato:

```ts
if (!candidato || !permiteCorreosSolicitud(candidato.tipoSolicitud)) {
  fallidos += 1;
  detalle.push({ facturacionId, ok: false, error: "La empresa ya no cumple el criterio del recordatorio" });
  continue;
}
```

- [ ] **Step 6: Ejecutar tests, tipos y lint**

```powershell
npx vitest run src/application/facturacion/__tests__/facturacion-service.test.ts src/application/facturacion-iimp/__tests__/notificacion-factura-service.test.ts src/application/facturacion/__tests__/recordatorios-facturacion-service.test.ts
npx tsc --noEmit
npx eslint src/application/facturacion/facturacion-service.ts src/application/facturacion-iimp/notificacion-factura-service.ts src/application/facturacion/recordatorios-facturacion-service.ts src/application/facturacion/__tests__/facturacion-service.test.ts src/application/facturacion-iimp/__tests__/notificacion-factura-service.test.ts src/application/facturacion/__tests__/recordatorios-facturacion-service.test.ts
```

- [ ] **Step 7: Commit**

```powershell
git add src/application/facturacion/facturacion-service.ts src/application/facturacion-iimp/notificacion-factura-service.ts src/application/facturacion/recordatorios-facturacion-service.ts src/application/facturacion/__tests__/facturacion-service.test.ts src/application/facturacion-iimp/__tests__/notificacion-factura-service.test.ts src/application/facturacion/__tests__/recordatorios-facturacion-service.test.ts
git commit -m "fix(facturacion): suprime correos de reservas de pabellones internacionales"
```

---

### Task 7: Auditoría, regla operativa y verificación final

**Files:**
- Modify: `.opencode/reglas/flujo-pabellones-internacionales/SKILL.md`
- Audit: todos los `enviarEmailPlantilla` del repositorio.

- [ ] **Step 1: Documentar la regla**

Agregar una sección en `.opencode/reglas/flujo-pabellones-internacionales/SKILL.md`:

```md
## 13. Correos

- Las solicitudes `tipo = reserva_empresa` **no envían correos** al cliente ni a receptores internos.
- La supresión aplica a creación, observación del Asociado, observaciones/devoluciones/aprobaciones del SGC, contrato observado, facturación, comprobantes y recordatorios.
- Usar `permiteCorreosSolicitud(tipoSolicitud)` antes de cualquier `enviarEmailPlantilla`.
- No suprimir alertas in-app ni efectos de negocio.
- Los correos de cuenta, seguridad y Debida Diligencia quedan fuera de esta regla.
```

- [ ] **Step 2: Auditar todas las llamadas de correo**

```powershell
Get-ChildItem -Recurse -File src -Filter *.ts |
  Select-String -Pattern 'enviarEmailPlantilla\(' |
  Select-Object Path, LineNumber, Line
```

Revisar que cada llamada perteneciente al flujo tenga `permiteCorreosSolicitud` o que esté justificada como fuera de alcance. Las llamadas de `auth`, `empresa`, `usuarios`, `solicitud-cuenta` y Debida Diligencia no se tocan.

- [ ] **Step 3: Ejecutar la suite focalizada completa**

```powershell
npx vitest run src/lib/shared/utils/__tests__/correos-solicitud.test.ts src/application/reservas/__tests__/reserva-service.test.ts src/application/solicitudes/__tests__/solicitudes-service-sgc.test.ts src/application/sgc-integracion/__tests__/sgc-webhook-service.test.ts src/application/sgc-integracion/__tests__/contrato-observado.test.ts src/application/facturacion/__tests__/facturacion-service.test.ts src/application/facturacion-iimp/__tests__/notificacion-factura-service.test.ts src/application/facturacion/__tests__/recordatorios-facturacion-service.test.ts src/application/pagos/__tests__/pagos-service.test.ts
npx tsc --noEmit
npx eslint src/application src/lib/shared/utils/correos-solicitud.ts src/domain/ports/facturacion-repository.ts src/infrastructure/persistence/facturacion-repository.ts
```

- [ ] **Step 4: Ejecutar suite completa**

```powershell
npx vitest run
```

Si la suite completa tiene un timeout ajeno al cambio, reintentar una vez y registrar el resultado; no ocultar fallos.

- [ ] **Step 5: Commit**

```powershell
git add .opencode/reglas/flujo-pabellones-internacionales/SKILL.md
git commit -m "docs(sgc): documenta la supresion de correos de pabellones internacionales"
```

---

## Acceptance Matrix

| Caso | Cliente | Internos | Alertas in-app | Estado/SGC/Facturación |
|---|---:|---:|---:|---:|
| Creación `reserva_empresa` | No correo | No correo | Sí | Sin cambio |
| Asociado observa | No correo | No correo | Sí | Sin cambio |
| Notificación manual | No correo | No correo | Sí | Sin cambio |
| SGC devuelve/rechaza | No correo | No correo | Sí | Sin cambio |
| SGC observa contrato | No correo | No correo | Sí | Sin cambio |
| SGC aprueba | No correo | No correo | Sí | Sin cambio |
| Comprobante fiscal | No correo | No correo | N/A | Sin cambio |
| Factura disponible SIE | No correo | No correo | N/A | Sin cambio |
| Recordatorios | No correo | N/A | N/A | Sin cambio |
| Solicitud regular | Sí | Sí | Sí | Sin cambio |

## Verification Checklist

- [ ] `permiteCorreosSolicitud` tiene tests de bloqueo y de no-regresión.
- [ ] Creación de reserva administrativa no llama a `enviarEmailPlantilla`.
- [ ] Observación del Asociado crea alerta pero no correo.
- [ ] Notificación manual no envía correo para `reserva_empresa`.
- [ ] SGC devolución/rechazo crea alerta pero no correo.
- [ ] SGC contrato observado crea alerta pero no correo interno.
- [ ] SGC aprobación no envía correo.
- [ ] Comprobante, factura disponible y recordatorios no envían correo.
- [ ] Solicitudes regulares conservan todos sus correos.
- [ ] `tsc`, ESLint y suite focalizada pasan.
- [ ] No se agregó migración ni se modificó la base de datos.
- [ ] No se tocaron archivos de Debida Diligencia de otra sesión.

## Rollback

Revertir los commits de la implementación restaura el comportamiento anterior de correos. No hay cambios de esquema ni datos que revertir.
