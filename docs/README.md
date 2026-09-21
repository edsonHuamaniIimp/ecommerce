# Documentación — ContratosStands

Índice de la documentación técnica y funcional del sistema de **reserva de stands**
del IIMP (PERUMIN, ProExplo, WMC, GESS).

Los documentos están agrupados por **contexto y tema**. El prefijo numérico indica el
orden de lectura recomendado.

## Grupos

| Carpeta | Contexto | Documentos |
|---|---|---|
| [`00-inicio/`](./00-inicio) | Negocio y alcance | `resumen-ejecutivo.md`, `requerimientos.md`, `flujos.md` |
| [`01-funcional/`](./01-funcional) | Funcionalidad implementada | `README.md` + un documento por módulo |
| [`02-despliegue/`](./02-despliegue) | Despliegue e infraestructura AWS | `despliegue.md`, `arquitectura-aws.md`, `aws-terraform.md`, `REGLAS-DESPLIEGUE.md`, `arquitectura-preview.html` |
| [`03-arquitectura/`](./03-arquitectura) | Arquitectura y estándares | `vision-general.md`, `arquitectura.md`, `stack-tecnologico.md`, `modelo-datos.md`, `convenciones-codigo.md` |
| [`04-api/`](./04-api) | Contrato y endpoints | `api-inventario.md`, `endpoints.md`, `openapi.yaml` |
| [`05-integraciones/`](./05-integraciones) | Sistemas externos | `integracion-sgc.md`, `api-sistema-montaje.md`, `guia-consumo-servicio-persona.md` |
| [`06-operacion/`](./06-operacion) | Operación y DevOps | `infraestructura-devops.md`, `pruebas-produccion.md` |
| [`07-seguridad/`](./07-seguridad) | Auditoría de seguridad | `run-1/`, `run-2/` |

## Detalle

### 00 — Inicio
| Documento | Contenido |
|---|---|
| [resumen-ejecutivo.md](./00-inicio/resumen-ejecutivo.md) | Qué es, alcance, estado, riesgos y traspaso |
| [requerimientos.md](./00-inicio/requerimientos.md) | Requerimientos funcionales y no funcionales |
| [flujos.md](./00-inicio/flujos.md) | Flujos de negocio y procesos técnicos |

### 01 — Funcional
| Documento | Contenido |
|---|---|
| [README.md](./01-funcional/README.md) | Visión general: módulos, actores, roles, estados |
| [01-publico-y-reservas.md](./01-funcional/01-publico-y-reservas.md) | Portal público, plano y reserva |
| [02-solicitudes-y-aprobaciones.md](./01-funcional/02-solicitudes-y-aprobaciones.md) | Solicitudes, pipeline de revisión y re-evaluación |
| [03-auspicios.md](./01-funcional/03-auspicios.md) | Auspicios (proxy a KBServicios) |
| [04-facturacion.md](./01-funcional/04-facturacion.md) | Facturación, cuotas y pagos Niubiz |
| [05-laboratorio-3d.md](./01-funcional/05-laboratorio-3d.md) | Editor de planos 3D (simple/macro) |
| [06-eventos-datos-y-stands.md](./01-funcional/06-eventos-datos-y-stands.md) | Eventos, datos del evento, stands/GESS/vinculación |
| [07-administracion.md](./01-funcional/07-administracion.md) | Roles, permisos, usuarios, perfil y auth |
| [08-integraciones.md](./01-funcional/08-integraciones.md) | SGC, Sistema de Montaje, entidades, RENIEC/SUNAT, KBServicios |

### 02 — Despliegue
| Documento | Contenido |
|---|---|
| [despliegue.md](./02-despliegue/despliegue.md) | Guía de despliegue por ambiente; unifica el antiguo borrador `docs/despliegue.md` |
| [arquitectura-aws.md](./02-despliegue/arquitectura-aws.md) | Decisión de arquitectura AWS (ECS Fargate + Aurora + ALB + CloudFront) |
| [aws-terraform.md](./02-despliegue/aws-terraform.md) | Terraform + convención de tags y flujo MCP |
| [REGLAS-DESPLIEGUE.md](./02-despliegue/REGLAS-DESPLIEGUE.md) | Gobernanza R1-R6 (prod con autorización explícita) |

### 03 — Arquitectura
| Documento | Contenido |
|---|---|
| [vision-general.md](./03-arquitectura/vision-general.md) | Diagramas Mermaid: contexto, capas, despliegue AWS, flujo SGC y estados |
| [arquitectura.md](./03-arquitectura/arquitectura.md) | Estructura completa de carpetas y capas |
| [stack-tecnologico.md](./03-arquitectura/stack-tecnologico.md) | Dependencias y versiones |
| [modelo-datos.md](./03-arquitectura/modelo-datos.md) | Modelo de datos (ER + diccionario) |
| [convenciones-codigo.md](./03-arquitectura/convenciones-codigo.md) | Reglas y estándares obligatorios |

### 04 — API
| Documento | Contenido |
|---|---|
| [api-inventario.md](./04-api/api-inventario.md) | Inventario **real** de endpoints (fuente: código) |
| [endpoints.md](./04-api/endpoints.md) | Contrato **propuesto** y convenciones REST |
| [openapi.yaml](./04-api/openapi.yaml) | Especificación OpenAPI 3.0 (fuente de verdad) |

### 05 — Integraciones
| Documento | Contenido |
|---|---|
| [integracion-sgc.md](./05-integraciones/integracion-sgc.md) | Integración con el SGC (cliente/consumidor) |
| [api-sistema-montaje.md](./05-integraciones/api-sistema-montaje.md) | Contrato consumido por el Sistema de Montaje |
| [guia-consumo-servicio-persona.md](./05-integraciones/guia-consumo-servicio-persona.md) | Guía del servicio REST externo de personas |

### 06 — Operación
| Documento | Contenido |
|---|---|
| [infraestructura-devops.md](./06-operacion/infraestructura-devops.md) | Variables, Docker, Nginx y CI/CD |
| [pruebas-produccion.md](./06-operacion/pruebas-produccion.md) | Data de prueba aislada (marcadores `TEST-`) |

### 07 — Seguridad
Ver [`07-seguridad/README.md`](./07-seguridad/README.md).

## Publicación en Confluence

El portal se genera desde esta carpeta con:

```bash
node scripts/publish-confluence.mjs --space CTRS
```

## Mantenimiento

- Al mover o renombrar un documento, actualizar su enlace aquí y en el `README.md` raíz.
- Las rutas citadas dentro de los informes de `07-seguridad/` son **históricas** (apuntan
  al commit auditado) y no se editan.
- La documentación funcional (`01-funcional/`) se actualiza al modificar módulos en el código.
