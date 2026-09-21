# Resumen ejecutivo de seguridad — ContratosStands

Auditoría de seguridad automatizada (skill `security-audit` de Cloudflare, perfil `standard`) sobre todo el repositorio.
Commit auditado: `de1ebbbc07019ab93031f8d9ab25e9bba1928df6` · Run 1 · **solo análisis de código (sin ejecución)**.

## Conteo general

| Categoría | Cantidad |
|---|---|
| Hallazgos confirmados | **28** |
| — Críticos | 0 |
| — Altos | 16 |
| — Medios | 11 |
| — Bajos | 1 |
| Pendientes de validación (sin severidad) | 13 |
| Descartados (falsos positivos documentados) | 2 |
| Unidades de cobertura del ledger | 43 |

> Nota: no se ejecutó código del objetivo (host Windows sin sandbox aislado). Lo que depende de ejecución o del entorno desplegado queda como **Pendiente de validación**, sin severidad.

## Prioridades de remediación (orden sugerido)

1. **Cerrar los endpoints anónimos**: `/api/upload`, `/api/gess/*` (sync/actualizar/mockup/listar), `/api/reniec/dni`, `/api/sunat/ruc`, `/api/kbservicios/*`, `/api/planogess/fetch` y `/api/reservas/crear` deben exigir sesión/permiso en el middleware y en el controlador.
2. **Arreglar la autorización de solicitudes**: derivar `userId`/`eventoId` de la sesión (no del query), y exigir permisos por área/rol en `revisar`, `orden-pago`, `reevaluar`, `modificar`, `detalle`, `historial` y `upload-doc`.
3. **Endurecer autenticación**: hash de contraseñas (Argon2/bcrypt), token de reset con CSPRNG, eliminar el secreto JWT de respaldo hardcodeado y forzar `JWT_SECRET` al arranque.
4. **Facturación/pagos**: exigir permiso `facturacion:*`, inspeccionar el resultado del gateway Niubiz antes de marcar pagado y añadir binding de propietario/evento.
5. **Infra y despliegue**: fijar TLS en el tramo CloudFront→ALB, restringir el ALB/WAF, no persistir el token de git en el host, no ejecutar como root, no usar `prisma db push` en producción y fijar actions por SHA.

## CRÍTICOS (0)

Sin hallazgos críticos confirmados. (Un verificador lo elevó temporalmente, pero se recalibró a HIGH porque el impacto demostrable exige una lectura previa de la base de datos.)

## ALTOS (16)

| # | Título | Ubicación | Frontera / endpoint | Resultado establecido |
|---|---|---|---|---|
| 1 | Passwords stored and compared in plaintext | `src/infrastructure/persistence/auth-repository.ts:8` | AuthPrismaRepository.findByEmail | Source analysis shows the login code performs an exact string comparison against the stored value, so the stored value is directly usable as the password, and the seeded default 123456 is valid for ac |
| 2 | Profile self-update mass-assigns arbitrary UserRole columns | `src/infrastructure/persistence/auth-repository.ts:57` | AuthPrismaRepository.updatePerfil | Source analysis shows the unvalidated body reaches updateMany without an allowlist, so model fields supplied beyond the documented DTO are persisted onto the caller's own UserRole row, including roleI |
| 3 | Password reset token generated with Math.random() | `src/infrastructure/persistence/auth-repository.ts:68` | AuthPrismaRepository.setResetToken | Source analysis confirms the token is 32 base36 characters produced by Math.random(), which is not cryptographically secure, so token values are predictable in principle within their validity window. |
| 4 | Production container runs as root and read-write bind-mounts the host source tree | `docker-compose.prod.yml:52` | app service volumes | Source establishes root execution and a read-write host bind; container compromise can modify the host repository source used by future deployments. |
| 5 | Production container forces schema with prisma db push on every startup | `docker/entrypoint.sh:38` | gated migrations | Source shows db push executes on every production startup regardless of RUN_MIGRATIONS; the schema is force-synchronized to the deployed schema.prisma outside the migration history. |
| 6 | Any authenticated role can run arbitrary person-PII searches against the upstream person-search service | `src/infrastructure/external/entidades-client.ts:29` | POST /rest/searchpersonv00 | Source analysis establishes that the request passes the auth-only middleware and reaches the upstream person-search service through the server-side client, whose declared response type (PersonaResultD |
| 7 | Unauthenticated GESS stand-inventory disclosure across all events | `src/infrastructure/persistence/gess-repository.ts:14` | GessPrismaRepository.findAllPaginated | Source analysis establishes that the GET passes the middleware fall-through, the controller performs no auth check, and the repository returns the full GessStand row set for the caller-supplied evento |
| 8 | Unauthenticated update of any GessStand by id | `src/infrastructure/persistence/gess-repository.ts:57` | GessPrismaRepository.update | Source analysis establishes that the middleware lets the PATCH through and the repository updates the row selected solely by the attacker-supplied id. |
| 9 | Unauthenticated mockup generation resets GessStand state to disponible and clears empresa | `src/application/gess/gess-service.ts:132` | GessApplicationService.mockup upsert | Source analysis establishes that the handler runs unauthenticated and the service's update path forces estado: "disponible" and empresa: null on every matched stand. |
| 10 | Unauthenticated GESS import allows arbitrary stand creation/overwrite for any event | `src/application/gess/gess-service.ts:88` | GessApplicationService.sync upsert | Source analysis establishes that the controller forwards the body unauthenticated and the service creates/updates GessStand rows from the caller-supplied array for the caller-chosen event. |
| 11 | GitHub token embedded in git remote URL and persisted in host git config | `docker-compose.prod.yml:52` | EC2 host working copy | Source shows the remote URL contains the token; git's documented behavior persists that URL to .git/config, leaving the credential on disk until rotated. |
| 12 | Unauthenticated stand reservation blocks inventory and creates solicitudes | `src/application/reservas/reserva-service.ts:37` | stand state transition | Not executed (no OS-enforced sandbox on the audit host); the source trace deterministically shows a null session is not rejected and the stand update plus solicitud and revision creation run for the a |
| 13 | GET /api/solicitudes/detalle returns any solicitud by UUID to any solicitudes:view holder | `src/infrastructure/persistence/solicitudes-repository.ts:186` | detalle | Source analysis establishes that the request passes middleware (solicitudes:view) and reaches findUnique by id with no owner predicate, so the record of any owner is returned to any solicitudes:view h |
| 14 | GET /api/solicitudes/listar derives owner scope from the query string, exposing every solicitud in an event to any solicitudes:view holder | `src/infrastructure/persistence/solicitudes-repository.ts:152` | listar | Source analysis establishes that the request passes the solicitudes:view gate (middleware.ts:28) and reaches a Prisma findMany whose where clause contains only the event predicate when userId is omitt |
| 15 | POST /api/solicitudes/revisar accepts any area from any solicitudes:view holder, bypassing area-specific review permissions | `src/infrastructure/persistence/solicitudes-repository.ts:224` | crearOActualizarRevision | Source analysis establishes that after the getSession presence check the submitted area/estado are persisted by crearOActualizarRevision with the caller as reviewer and no permission comparison, so an |
| 16 | Internet-facing ALB is reachable directly and bypasses the CloudFront WAF | `terraform/modules/cloudfront/main.tf:182` | aws_cloudfront_distribution.main | Source and the prod plan show the ALB opened to 0.0.0.0/0 while WAF guards only CloudFront, so direct origin requests bypass all WAF rules. |

## MEDIOS (11)

| # | Título | Ubicación | Frontera / endpoint | Resultado establecido |
|---|---|---|---|---|
| 1 | Authorization trusts JWT claims with no revocation until 24h expiry | `src/lib/server/auth.ts:40` | signToken | Source analysis shows the gate verifies only the signature and reads permissions from the token, so revoked permissions remain effective until the 24h expiry. |
| 2 | Unescaped attacker input interpolated into HTML notification emails | `src/lib/server/email.ts:144` | buildReservaConfirmationEmail HTML table cell | Not executed (no OS-enforced sandbox on the audit host); the source trace deterministically shows the attacker-controlled razonSocial and documento strings are concatenated unescaped into the HTML bod |
| 3 | Unauthenticated, unbounded writes to the ErrorLog table | `src/lib/server/error-logger.ts:16` | prisma.errorLog.create | Source analysis establishes that the request passes the middleware fall-through, no session is required, and a row is inserted for every call; the table has no retention or cardinality bound. |
| 4 | Deploy workflow invokes a mutable third-party action tag while handing it production EC2 credentials | `.github/workflows/deploy.yml:124` | remote script executed by the action | Source establishes the mutable-tag reference and the secret inputs; no integrity binding to a reviewed commit exists, so the credentials are exposed to whatever code the tag points to at run time. |
| 5 | .gitignore omits .env.prod / .env.production despite production requiring them | `.env.prod.example:19` | secret template | No .gitignore rule matches .env.prod/.env.production, so a populated production secrets file would be tracked and pushed if staged. |
| 6 | GET /api/solicitudes/historial exposes any solicitud's reviewer history and justifications to any solicitudes:view holder | `src/infrastructure/persistence/solicitudes-repository.ts:381` | obtenerHistorial historial | Source analysis establishes that the middleware admits any solicitudes:view holder and the repository returns all Revision and RevisionHistorial rows for the supplied solicitudId with no owner predica |
| 7 | POST /api/solicitudes/orden-pago moves any solicitud into PENDIENTE_PAGO and creates an invoice without the facturacion permission | `src/infrastructure/persistence/solicitudes-repository.ts:363` | marcarOrdenPago | Source analysis establishes that the controller only asserts a session and then writes the estado and a Facturacion row keyed by the supplied id with no facturacion permission or owner predicate. |
| 8 | POST /api/solicitudes/reevaluar lets any solicitudes:view holder create a re-evaluation on any solicitud | `src/infrastructure/persistence/solicitudes-repository.ts:311` | atenderReevaluacionAprobacion | Source analysis establishes that the handler performs no owner/permission comparison and the repository creates a Reevaluacion linked to the supplied solicitudId, so any solicitudes:view holder can cr |
| 9 | POST /api/solicitudes/upload-doc attaches a document to any solicitud id without owner binding | `src/infrastructure/persistence/solicitudes-repository.ts:414` | crearDocumentoAdjunto | Source analysis establishes that the service never loads or owner-checks the solicitud and the repository inserts the SolicitudDocumento for the supplied id, so a document is attached to another owner |
| 10 | CloudFront forwards viewer traffic to the ALB origin over cleartext HTTP | `terraform/modules/cloudfront/main.tf:191` | custom_origin_config.origin_protocol_policy | Source fixes the origin protocol to HTTP-only, so edge-to-origin payloads are transported unencrypted. |
| 11 | Outbound integration clients disable TLS certificate verification process-wide | `src/infrastructure/external/planogess-client.ts:34` | PlanogessClient.fetchStands | Source analysis shows the clients set NODE_TLS_REJECT_UNAUTHORIZED="0" around the fetch, so peer certificate verification is disabled for that connection and a tampered response is accepted. |

## BAJOS (1)

| # | Título | Ubicación | Frontera / endpoint | Resultado establecido |
|---|---|---|---|---|
| 1 | Unauthenticated access to the internal KBServicios events proxy | `src/infrastructure/external/kbservicios-client.ts:8` | fetchApi | Not executed (no OS-enforced sandbox on the audit host); the source trace deterministically shows the anonymous request is gated by neither middleware nor the controller and reaches the fetchApi call  |

## Pendientes de validación (13) — sin severidad

Requieren una comprobación de entorno/runtime o un fixture local acotado para confirmarse o descartarse.

| # | Lead | Ubicación | Blocker principal |
|---|---|---|---|
| 1 | Authenticated auspicios caller can relay an unvalidated body to the privileged KBServicios saveauspicio endpoint | `src/app/api/auspicios/grabar/route.ts:17` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 2 | JWT signed/verified with a hardcoded fallback secret when JWT_SECRET is unset | `src/lib/server/auth.ts:41` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 3 | PATCH /api/facturacion/actualizar spreads an unvalidated body into the Prisma update | `src/infrastructure/persistence/facturacion-repository.ts:123` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 4 | Billing mutations addressed only by record id lack owner/event binding | `src/infrastructure/persistence/facturacion-repository.ts:141` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 5 | Niubizz payment confirmation ignores the gateway authorization result before marking a cuota paid | `src/infrastructure/persistence/facturacion-repository.ts:113` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 6 | Niubizz session creation reads any invoice's data by id with no owner/event binding | `src/application/facturacion/niubizz-service.ts:13` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 7 | POST /api/facturacion/pagar-cuota settles any installment by id with no owner/event binding | `src/infrastructure/persistence/facturacion-repository.ts:113` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 8 | TypeScript code generation interpolates stored layout fields without escaping | `src/application/planos/planos-service.ts:226` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 9 | Plano import persists layout values bypassing the create/layout schema constraints | `src/infrastructure/persistence/plano-repository.ts:388` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 10 | Unauthenticated RENIEC DNI lookup under the server-side operator token | `src/infrastructure/external/consultas-client.ts:9` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 11 | modificar ownership guard short-circuits when Solicitud.userId is null | `src/infrastructure/persistence/solicitudes-repository.ts:265` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 12 | Unauthenticated SUNAT RUC lookup under the server-side operator token | `src/infrastructure/external/consultas-client.ts:9` | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| 13 | Unauthenticated file upload with attacker-controlled extension into the public web root | `docker/nginx.conf:26` | no OS-enforced sandbox available on the audit host to execute target-controlled code |

## Descartados (2)

Se conservan para que futuras corridas no repitan la afirmación sin nueva evidencia.

- **Stored documentos URLs reach anchor href without scheme validation, but React neutralizes executable schemes** (`components.plano.documentos.unvalidated-scheme-to-href`): React 19.2.4's sanitizer is a real, source-verified control that blocks the javascript: scheme on href/src, the only executable sink on these paths; data: cannot top-level navigate in modern browsers and target=_blank implies noopener, so no attacker-controlled script execution or session-bearing di
- **Stored document url is not scheme-validated before rendering as an anchor href** (`solicitudes.upload-doc.unvalidated-url-to-href`): Refuted by a visible framework control: React DOM's production sanitizer converts javascript: hrefs to a throwing javascript: URL before setting the attribute (react-dom-client.production.js:1412-1416), there is no dangerouslySetInnerHTML or other raw-HTML sink in src, and browsers block top-level d

## Archivos relacionados

- `REPORT.es.md` — informe completo
- `FINDINGS-DETAIL.es.md` — detalle técnico de cada hallazgo confirmado
- `NEEDS-VALIDATION.es.md` — planes de validación de los pendientes
- `architecture.es.md` — mapa de arquitectura y fronteras de confianza
- `findings.json` / `coverage-ledger.json` — datos máquina-verificables
