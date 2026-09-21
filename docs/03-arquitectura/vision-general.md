# Visión general de la arquitectura (diagramas)

> Diagramas Mermaid de alto nivel. Detalle de despliegue AWS:
> [`../02-despliegue/arquitectura-aws.md`](../02-despliegue/arquitectura-aws.md).
> Estructura de carpetas: [`arquitectura.md`](./arquitectura.md). Modelo de datos:
> [`modelo-datos.md`](./modelo-datos.md). Integración SGC:
> [`../05-integraciones/integracion-sgc.md`](../05-integraciones/integracion-sgc.md).

## 1. Contexto — sistemas e integraciones

```mermaid
flowchart LR
  Cliente["Cliente / Expositor"] --> App["ContratosStands (Next.js)"]
  Areas["Áreas IIMP (Logística, Comunicación)"] --> App

  App -->|"API Bearer + Webhooks HMAC"| SGC["SGC — Sistema de Gestión de Contratos"]
  App -->|"tipos de evento · eventos · auspicios"| KB["KBServicios (IIMP)"]
  App -->|"plano X/Y · stands"| KBE["KBEventos / planogess (IIMP)"]
  App -->|"RUC / DNI"| Consultas["SUNAT / RENIEC"]
  App -->|"pagos"| Niubiz["Niubiz"]
  SM["Sistema de Montaje"] -->|"API M2M (x-api-key)"| App
```

## 2. Capas — Hexagonal (backend) + Fachada (frontend)

```mermaid
flowchart TB
  subgraph FE["Frontend (Client Components)"]
    Page["Pages / App Router"] --> Comp["Components (UI Kit IIMP)"]
    Comp --> Facade["Fachada de servicios<br/>(src/lib/client/api/services)"]
    Facade --> Internal["internalApi (fetch /api/*)"]
  end

  subgraph BE["Backend (Route Handlers)"]
    Route["app/api/**: createRouter()"] --> Ctrl["Controllers"]
    Ctrl --> Svc["Application Services (casos de uso)"]
    Svc --> Ports["Domain Ports (interfaces)"]
    Ports --> Adapters["Infrastructure Adapters<br/>(Prisma repositories / HTTP clients)"]
  end

  Internal --> Route
  Svc --> Domain["Domain Models (puro, sin framework)"]
```

## 3. Despliegue (AWS) — resumen

```mermaid
flowchart TB
  U["Usuario"] --> CF["CloudFront + WAF"]
  CF --> ALB["ALB (TLS)"]
  ALB --> ECS["ECS Fargate<br/>Next.js standalone"]
  ECS --> Aurora[("Aurora PostgreSQL")]
  ECS --> S3[("S3 documentos")]
  ECS --> EFS[("EFS uploads")]
  ECS --> SM["Secrets Manager"]
  ECR["ECR (imagen de revisión)"] -.-> ECS
  SGC["SGC"] -.->|webhooks HMAC| CF
```

## 4. Flujo de revisión → SGC (resumen)

```mermaid
flowchart LR
  Sol["Solicitud creada"] --> Log["Logística (local)"]
  Log --> Com["Comunicación (local)"]
  Com -->|aprueba| SGC["SGC: internal-review Legal → approval Gerencia"]
  SGC -->|"workflow.approved (active)"| Vig["Contrato VIGENTE"]
  Vig --> OP["Generar orden de pago"]
  SGC -->|"workflow.returned"| Sub["Subsanar (misma pieza, nuevo versionId)"]
```

## 5. Estados de la solicitud

```mermaid
stateDiagram-v2
  [*] --> pendiente: crear solicitud
  pendiente --> en_proceso: primera revisión
  en_proceso --> aprobado: logística + comunicación aprueban
  en_proceso --> rechazado: alguna rechaza
  rechazado --> pendiente: re-evaluación aprobada
  aprobado --> pendiente_pago: generar orden de pago (tras SGC Vigente)
  pendiente_pago --> pagado: confirmación de pago
```
