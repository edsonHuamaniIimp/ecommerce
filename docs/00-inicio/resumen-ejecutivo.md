# Resumen Ejecutivo y Traspaso — ContratosStands (IIMP)

> **Estado:** Documento de traspaso v1.0
> **Fecha:** 2026-09-11
> **Audiencia:** Proveedor de software que asumirá el desarrollo y operación del sistema.
> **Autor:** Equipo de desarrollo — ContratosStands.

---

## 1. Qué es ContratosStands

**ContratosStands** es el sistema web del **Instituto de Ingenieros de Minas del Perú (IIMP)**
para la **reserva digital de stands** de sus eventos corporativos:
**PERUMIN, ProExplo, World Mining Congress (WMC) y GESS**.

Reemplaza un proceso semi-manual y dependiente de sistemas de escritorio
(**GeneXus + SAP/HANA**) donde las áreas de eventos/asociados ingresaban reservas
manualmente.

### 1.1 Rol del sistema en el ecosistema IIMP

| Sistema | Rol | Dueño |
|---|---|---|
| **ContratosStands** (este) | Handler de datos + procesador de reservas: plano interactivo, captura de reserva, flujo de aprobaciones, interoperabilidad | Equipo web (traspaso al proveedor) |
| **GeneXus / KBEventos / KBServicios** | Sistemas legados de eventos y exhibiciones; proveen plano (X/Y), auspicios y datos de stands | John Morón (IIMP) |
| **SAP / HANA** | Facturación y contabilidad (orden de venta, comprobantes, cuentas contables) | John Morón / Contabilidad |
| **servicio-persona** | Servicio REST institucional de personas (consulta/alta) | Sistemas IIMP |
| **multieventos (Niel)** | Sistema multi-evento con BD centralizada de empresas/personas (a compartir) | Niel |

**Principio de diseño:** el sistema **no implementa facturación ni contabilidad** —
esas capacidades permanecen en SAP y se consumen vía servicios (interoperabilidad).

---

## 2. Alcance del proyecto

### 2.1 Dentro de alcance

- Gestión y visualización de **eventos y subeventos** (relación padre–hijo).
- **Plano interactivo** de stands (2D grid e isométrico 3D; coordenadas X/Y desde servicio externo).
- **Reserva** de uno o varios stands (selección múltiple).
- Captura de **datos de empresa** y **datos de facturación** (factura/boleta, cuotas).
- **Flujo de aprobaciones por áreas** (Comunicación → Legal → Logística) con historial.
- **Documentos de solicitud** (single y multi-stand), subida por admin y cliente.
- **Re-evaluaciones** de solicitudes rechazadas.
- **Estados del stand** (disponible / en evaluación / reservado) y del proceso (pendiente → en proceso → aprobado/rechazado → pendiente de pago).
- **Dashboard** con KPIs y pipeline de aprobaciones.
- **Notificaciones por correo** (Resend) con plantilla HTML.
- **Gestión de roles y permisos** (admin, logistica, legal, comunicacion, cliente).
- **Auspicios** (proxy a KBServicios).
- **Interoperabilidad M2M** para contratos de stands y exhibidoras (API key).

### 2.2 Fuera de alcance (se interopera)

- **Facturación / contabilidad** → SAP (orden de venta, comprobantes, centro de costo, cuentas).
- **Fuente maestra de empresas/personas** → se consume del sistema de John y/o BD centralizada (pendiente de definir).
- Generación del servicio de coordenadas X/Y del plano → provisto por John (pendiente de entrega formal).

---

## 3. Estado actual del proyecto

### 3.1 Funcionalidades implementadas (al cierre de esta documentación)

| Área | Estado |
|---|---|
| Autenticación JWT (login, logout, session, middleware, roles) | ✅ Completo |
| Gestión de roles y permisos (5 roles, 21 permisos, 6 secciones) | ✅ Completo |
| Presala (grid de versiones de evento por vertical) | ✅ Completo |
| Dashboard con KPIs reales + pipeline de aprobaciones | ✅ Completo |
| Plano isométrico 3D interactivo (52 bloques, personas 3D, multi-select) | ✅ Completo |
| Plano grid 2D (selección, reserva) | ✅ Completo |
| Vinculación de stands desde API externa (KBEventos) | ✅ Completo |
| Gestión de stands (paginación, búsqueda, upload) | ✅ Completo |
| CRUD de eventos con selector de plano | ✅ Completo |
| Flujo completo de solicitudes de alquiler (3 pasos + IndexedDB draft) | ✅ Completo |
| Revisión por áreas con historial (`revision_historial`) | ✅ Completo |
| Re-evaluación (aprobar/rechazar, documentos propios) | ✅ Completo |
| Documentos multi-stand (admin + cliente) | ✅ Completo |
| Notificaciones por correo (Resend, plantilla HTML) | ✅ Completo |
| Baja lógica de solicitudes (`flgActivo`) | ✅ Completo |
| Orden de pago (`pendiente_pago`) | ✅ Completo |
| Vista "Mis solicitudes" (cliente) | ✅ Completo |
| Auspicios (proxy KBServicios: listar + grabar) | ✅ Completo |
| API M2M de contratos/exhibidoras (API key) | ✅ Completo |
| Facturación local (cuotas, pagos, Niubizz) | ✅ Completo |
| PostgreSQL + Prisma v7 + Docker (dev y prod) | ✅ Completo |
| CI/CD GitHub Actions + despliegue EC2 con Docker | ✅ Completo |

### 3.2 Pendientes conocidos

| # | Pendiente | Contexto / Bloqueo |
|---|---|---|
| 1 | **Integración SAP (facturación)** | El sistema debe interoperar con SAP/HANA vía servicios de John. No implementado. |
| 2 | **Migración a Auth0** | Hoy la autenticación es JWT propio con `jose`. Auth0 está previsto pero no integrado. |
| 3 | **Suite de tests** | No existen tests automatizados (Vitest está configurado pero sin specs). |
| 4 | **Planos PERUMIN/WMC/ProExplo** | Bloqueado: la API KBEventos solo tiene un evento con datos; el resto devuelve 404/datos parciales. |
| 5 | **Contrato de interoperabilidad** | Falta definir endpoints, request/response, formato X/Y y autenticación con el sistema de John. |
| 6 | **Fuente única de empresas** | Falta definir si se comparte la BD de Niel o se consume API de John. |
| 7 | **Responsabilidades por área** | Validaciones exactas de Logística y roles de Eventos/Asociados sin documentar (Mabel/José). |
| 8 | **Rotación de secretos** | Los secretos de desarrollo estuvieron en texto plano en `bitacora.md`; rotar antes de producción. |
| 9 | **Documentación OpenAPI sincronizada** | `docs/04-api/openapi.yaml` existe pero debe mantenerse sincronizado con la implementación real. |

### 3.3 Deuda técnica identificada

- Sin tests automatizados (unit/e2e).
- `docs/04-api/endpoints.md` describe el contrato propuesto; el inventario real está en `docs/04-api/api-inventario.md`.
- Tabla `aprobacion` y vista `/dashboard/reservas` marcadas como legacy.
- `next.config.ts` no define `output: "standalone"` (el runtime Docker usa `next start` con código montado); el workflow sube `.next/standalone/` que no se genera (no rompe el flujo, pero es inconsistente).
- Entorno de pruebas KBEventos apunta a `KBEventosPruebas`, no a producción.

---

## 4. Personas clave y contactos

| Persona | Rol | Responsabilidad |
|---|---|---|
| **Edson Huamani** | Desarrollo web (IIMP) | Autor del sistema; interlocutor técnico del traspaso. |
| **John Morón Huertas** | Facturación/SAP (IIMP) | Dueño de GeneXus, SAP/HANA y SAT. Debe entregar servicio de plano X/Y, APIs de empresas/eventos y endpoints de facturación. |
| **José** | Dirección (IIMP) | Impulsa migración a la nube y retiro gradual del escritorio. |
| **Mabel** | Negocio (IIMP) | Referente para validaciones del área de Logística. |
| **Niel** | Sistemas (IIMP) | Sistema multieventos con BD centralizada de empresas/personas. |

> ⚠️ **Importante:** el conocimiento operativo está concentrado en Edson y John.
> Este traspaso debe incluir sesiones de transferencia con ambos.

---

## 5. Accesos e infraestructura (sin credenciales)

| Recurso | Ubicación / referencia |
|---|---|
| Repositorio de código | Git institucional (IIMP) |
| Base de datos | PostgreSQL 16 (Docker local / EC2 producción) |
| API KBEventos (planogess) | `https://secure2.iimp.org:8443/KBEventosPruebas/rest/planogess` (pruebas) |
| KBServicios IIMP | `https://secure2.iimp.org:8443/KBServiciosIIMPJavaEnvironment` |
| Servicio-persona | `https://secure2.iimp.org:8443/servicio-persona/api` |
| Producción web | `ecommerce.sistemasiimp.org.pe` (Nginx + Let's Encrypt) |
| CI/CD | GitHub Actions (secrets: `EC2_*`, `AWS_*`) |
| Almacenamiento de archivos | Local (`public/uploads`) en dev; S3 en producción |
| Correo transaccional | Resend |

> **Credenciales:** se entregan por canal seguro aparte (gestor de secretos).
> Las variables requeridas están documentadas en `docs/06-operacion/infraestructura-devops.md`.

---

## 6. Riesgos del traspaso

| Riesgo | Impacto | Mitigación sugerida |
|---|---|---|
| Dependencia de servicios de John no formalizados | Alto — bloquea plano y facturación | Cerrar contrato de interoperabilidad antes de continuar |
| Conocimiento concentrado en 2 personas | Alto | Sesiones de transferencia grabadas + documentación (este portal) |
| Datos fragmentados (CIEMAS, BD Niel, GeneXus, SAP) | Medio | Definir fuente única por entidad |
| Secretos expuestos en documentación histórica | Alto | Rotar todas las credenciales de dev/QA antes de producción |
| Sin tests automatizados | Medio | Priorizar suite de pruebas en el primer sprint del proveedor |
| Bloqueo de API KBEventos (1 evento con datos) | Medio | Coordinar con John la carga de eventos restantes |

---

## 7. Próximos pasos recomendados (onboarding del proveedor)

1. **Leer este portal completo** (orden sugerido: 01 → 12).
2. **Levantar el entorno local** siguiendo `11 · Despliegue` e `10 · Infraestructura`.
3. **Sesión de transferencia técnica** con Edson (arquitectura, decisiones, deuda).
4. **Sesión de transferencia funcional** con John (interoperabilidad SAP, plano X/Y).
5. **Rotar credenciales** y configurar gestor de secretos.
6. **Definir backlog inicial**: tests, integración SAP, Auth0, planos restantes.

---

## 8. Documentación relacionada en este portal

| # | Documento |
|---|---|
| 01 | Requerimientos y Alcance |
| 02 | Arquitectura de Software |
| 03 | Stack Tecnológico |
| 04 | Modelo de Datos |
| 05 | API — Inventario de Endpoints |
| 06 | API — Contrato y Convenciones |
| 07 | Guía de Consumo — Servicio Persona |
| 08 | Flujos de Negocio |
| 09 | Integración — Sistema de Montaje |
| 10 | Infraestructura, Docker y CI/CD |
| 11 | Despliegue |
| 12 | Convenciones de Código y Reglas |
| A1 | Anexo — OpenAPI 3.0 (YAML) |
