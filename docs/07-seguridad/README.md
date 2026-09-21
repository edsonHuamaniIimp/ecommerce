# Auditoría de seguridad — ContratosStands

Resultados de las auditorías automatizadas (skill `security-audit`, perfil `standard`).
Solo análisis de código, sin ejecución de código del objetivo.

## Corridas

| Corrida | Alcance | Contenido |
|---|---|---|
| [`run-1/`](./run-1) | Repositorio completo | `REPORT`, `FINDINGS-DETAIL`, `NEEDS-VALIDATION`, `architecture`, `RESUMEN.es.md`, `findings.json`, `coverage-ledger.json`, `run-metadata.json` (en inglés y español) |
| [`run-2/`](./run-2) | Delta desde run 1: superficie SGC nueva + revalidación de hallazgos | `REPORT.es.md`, `findings.json`, `run-metadata.json` |

## Convenciones

- `run-1/` conserva las versiones en inglés y español; `run-2/` solo español.
- Los archivos `*.json` son los registros estructurados (fuente de verdad de la corrida).
- Las rutas de archivo citadas dentro de los informes son **históricas**: corresponden al
  commit auditado y no se actualizan al reorganizar `docs/`.
