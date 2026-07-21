# Modelo de Datos — ContratosStands

> **Estado:** BORRADOR v0.1 — derivado del onboarding técnico. Motor de BD **por
> confirmar (PC)**. Se aplican los `lineamientos-bd` del proyecto.
> **Relacionado:** `docs/requerimientos.md`, `.opencode/reglas/lineamientos-bd`.

## 1. Alcance del modelo

- Se **persiste** solo el dominio propio del proceso de **reserva**.
- Se **consume** (no se duplica) la información transversal: **empresas/personas**
  (sistema de John / base centralizada de Niel) y la **configuración contable** (SAP).
- Multievento: relación **padre → evento (versión)**; todo se filtra por evento.

## 2. Convenciones aplicadas

- Identidad única (**PK obligatoria**) en toda entidad; integridad referencial (**FK**).
- Índices en campos de búsqueda/filtro: `eventoId`, `estado`, `empresaId`, `standId`.
- Campos de auditoría en toda tabla: `creadoEn`, `actualizadoEn`, `creadoPor`.
- Nomenclatura relacional (si se genera DDL a mano): `TB<T>_CTRST_<DESCRIPCION>`,
  `PK_<TABLA>`, `FK_<ORIG>_<DEST>`, `IDX_<TABLA>_<CAMPO>` (módulo sugerido: `CTRST`).
- Si se usa ORM, el modelo se define en código y la nomenclatura relacional es solo
  referencia para el mapeo/migraciones.

## 3. Diagrama entidad-relación (lógico)

```mermaid
erDiagram
    EVENTO_PADRE ||--o{ EVENTO : contiene
    EVENTO ||--o{ STAND : tiene
    EVENTO ||--o{ RESERVA : registra
    TIPO_STAND ||--o{ STAND : clasifica
    TIPO_STAND ||--o{ CONTRATO_PLANTILLA : define
    STAND ||--o| PLANO_POSICION : ubica
    RESERVA ||--|{ RESERVA_STAND : incluye
    STAND ||--o{ RESERVA_STAND : reservado_en
    RESERVA ||--o{ CUOTA : divide
    RESERVA ||--o{ APROBACION : pasa_por
    RESERVA ||--o| INTEROP_FACTURACION : interopera
    RESERVA }o--|| EMPRESA_REF : a_nombre_de

    EVENTO_PADRE {
        string id PK
        string codigo "PERUMIN|PROEXPLO|WMC|GESS"
        string vertical "proexplo|wmc|gess|perumin"
        string nombre
    }
    EVENTO {
        string id PK
        string eventoPadreId FK
        int tipoEvento "cod. tipo (payload plano)"
        int codigoEvento "cod. evento (payload plano)"
        string planoRef
        string anio
        string estado "draft|active|closed|cancelled"
    }
    TIPO_STAND {
        string id PK
        string eventoId FK
        string nombre "estandar|isla|preferencial"
        string medidas
        number montoBase
        string moneda
    }
    STAND {
        string id PK
        string eventoId FK
        string tipoStandId FK
        string numero
        number monto
        string tipoCamara
        string numeroCamara
        string estado "disponible|en_evaluacion|reservado"
    }
    PLANO_POSICION {
        string id PK
        string standId FK
        number x
        number y
    }
    RESERVA {
        string id PK
        string eventoId FK
        string empresaRef
        string tipoComprobante "factura|boleta"
        json datosFacturacion
        string estado "borrador|registrada|en_aprobacion|aprobada|enviada_facturacion|facturada|rechazada|cancelada"
        datetime creadoEn
    }
    RESERVA_STAND {
        string id PK
        string reservaId FK
        string standId FK
        string tipoStand
        number monto
    }
    CUOTA {
        string id PK
        string reservaId FK
        int numero
        number porcentaje
        number monto
        date fechaPago
    }
    APROBACION {
        string id PK
        string reservaId FK
        string area "legal|logistica|comunicacion"
        string estado "pendiente|aprobado|rechazado"
        string responsable
        string comentario
        datetime fecha
    }
    INTEROP_FACTURACION {
        string id PK
        string reservaId FK
        string ordenVenta
        string comprobante
        string estado "enviado|confirmado|error"
        json requestRef
        json responseRef
    }
    EMPRESA_REF {
        string id PK "id externo (John/Niel)"
        string razonSocial
        string ruc
    }
```

## 4. Diccionario de datos (entidades propias)

### 4.1 `evento_padre` (Maestra)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| codigo | string(20) | No | PERUMIN / PROEXPLO / WMC / GESS. |
| vertical | enum | No | proexplo/wmc/gess/perumin (alineado al UI Kit). |
| nombre | string(100) | No | Nombre visible. |

### 4.2 `evento` (Maestra)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| eventoPadreId | FK | No | → evento_padre. |
| tipoEvento | int | No | Código de tipo (payload del plano). |
| codigoEvento | int | No | Código de evento (payload del plano). |
| planoRef | string | Sí | Referencia/URL del plano. |
| anio | string(4) | No | Año/versión. |
| estado | enum | No | draft/active/closed/cancelled. |

### 4.3 `tipo_stand` (Maestra)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| eventoId | FK | No | → evento. |
| nombre | string(50) | No | estandar/isla/preferencial. |
| medidas | string(50) | Sí | Dimensiones. |
| montoBase | number | No | Precio base del tipo. |
| moneda | string(3) | No | USD/PEN. |

### 4.4 `stand` (Transaccional)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| eventoId | FK | No | → evento. |
| tipoStandId | FK | No | → tipo_stand. |
| numero | string(20) | No | Número visible del stand. |
| monto | number | No | Monto del stand. |
| tipoCamara | string(20) | Sí | Campo de cámara (tipo). |
| numeroCamara | string(20) | Sí | Campo de cámara (número). |
| estado | enum | No | disponible/en_evaluacion/reservado. |

Índice sugerido: `IDX_STAND_EVENTO_ESTADO (eventoId, estado)`.

### 4.5 `plano_posicion` (Transaccional)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| standId | FK | No | → stand. |
| x | number | No | Coordenada X (relativa/responsive). |
| y | number | No | Coordenada Y (relativa/responsive). |

> Origen de X/Y: servicio de John **(PC)**; puede consumirse sin persistir.

### 4.6 `reserva` (Transaccional)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| eventoId | FK | No | → evento. |
| empresaRef | string | No | Id externo de empresa (John/Niel). |
| tipoComprobante | enum | No | factura/boleta. |
| datosFacturacion | json | No | Razón social/RUC o nombre/doc/dirección, correo. |
| responsablePago | json | Sí | Nombre, teléfono, correo. |
| estado | enum | No | Ciclo de vida (ver requerimientos §8.5). |
| creadoEn/actualizadoEn/creadoPor | audit | No | Auditoría. |

Restricción sugerida: evitar doble reserva activa del mismo `standId` por evento.

### 4.7 `reserva_stand` (Transaccional)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| reservaId | FK | No | → reserva. |
| standId | FK | No | → stand. |
| tipoStand | string | No | Snapshot del tipo al reservar. |
| monto | number | No | Snapshot del monto. |

### 4.8 `cuota` (Transaccional)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| reservaId | FK | No | → reserva. |
| numero | int | No | N.º de cuota. |
| porcentaje | number | No | % de la cuota (suma = 100). |
| monto | number | No | Monto prorrateado. |
| fechaPago | date | Sí | Fecha comprometida. |

### 4.9 `aprobacion` (Transaccional)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| reservaId | FK | No | → reserva. |
| area | enum | No | legal/logistica/comunicacion. |
| estado | enum | No | pendiente/aprobado/rechazado. |
| responsable | string | Sí | Usuario que resuelve. |
| comentario | string | Sí | Observación. |
| fecha | datetime | Sí | Fecha de resolución. |

### 4.10 `interop_facturacion` (Control)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| reservaId | FK | No | → reserva. |
| ordenVenta | string | Sí | N.º orden de venta (SAP). |
| comprobante | string | Sí | N.º factura/boleta (SAP). |
| estado | enum | No | enviado/confirmado/error. |
| requestRef / responseRef | json | Sí | Trazabilidad del intercambio. |

### 4.11 `audit_log` (Log)
| Campo | Tipo | Nulo | Descripción |
| --- | --- | --- | --- |
| id | id/uuid | No | PK. |
| tipo | enum | No | reserva/aprobacion/interop/error/seguridad. |
| entidad | string | Sí | Entidad afectada + id. |
| actor | string | Sí | Usuario/servicio. |
| mensaje | string | No | Detalle. |
| metadata | json | Sí | Contexto. |
| creadoEn | datetime | No | Timestamp. |

## 5. Entidades consumidas (externas, no persistidas como maestra)

- **`empresa` / `persona_contacto`** — origen: sistema de John o base centralizada de
  Niel. Se consume por API; a lo sumo se cachea `empresaRef` en `reserva`.
- **Configuración contable** (centro de costo, cuentas contables, tipos de afectación,
  tasas) — origen: **SAP**. Fuera de este sistema.

## 6. Pendientes (PC)

- Confirmar **motor de BD** (relacional vs. documental) y ORM.
- Confirmar **fuente única** de empresas/personas y estrategia de sincronización.
- Confirmar si `plano_posicion` se persiste o solo se consume del servicio de John.
- Definir reglas de unicidad/bloqueo para prevenir doble reserva (concurrencia).
