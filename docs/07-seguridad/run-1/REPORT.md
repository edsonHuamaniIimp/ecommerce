# Security Audit Report — ContratosStands (run 1)

## 1. Run summary

- **Target:** `C:/Proyectos/IIMP/ContratosStands`
- **Source ref:** `de1ebbbc07019ab93031f8d9ab25e9bba1928df6` (branch main; worktree dirty only by the untracked `.opencode/skills/security-audit/`)
- **Profile / scope:** `standard`, whole repository (`scope_paths: ["."]`)
- **Budget:** none set (null). Agents spent: ~26 subagents (4 reconnaissance, 8 hunters across 4 waves, 4 coverage critics, 6 candidate verifiers, 3 final record verifiers, 2 extraction agents).
- **Execution policy:** `sandboxed-source-and-local-only`. **No OS-enforced sandbox is available on this Windows host** (no network isolation, allowlisted env, read-only mounts, or resource limits), so **no target-controlled code was executed**. Every execution- or deployment-dependent claim is recorded as `needs_validation`.
- **Prior runs:** none — no compatible prior `coverage-ledger.json` or `findings.json` exists. This is run 1 and is partial by construction.
- **Deliverables:** `architecture.md`, `coverage-ledger.json`, `findings.json`, `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`.
- **Validation:** `findings.json` and `coverage-ledger.json` both pass their validators (run through the exported `validateDocument` functions because the bundled CLIs require POSIX `O_NOFOLLOW`/`O_NONBLOCK` that Windows does not provide).

## 2. Security posture

This application exposes a large unauthenticated API surface and its authorization is split between a prefix-based edge middleware and inconsistent per-controller checks. The most serious, fully source-established problems are: anonymous file upload served same-origin as HTML; multiple anonymous state-changing endpoints (GESS sync/update/mockup, reservations, error-log ingest); systemic missing object-level authorization on solicitudes (any authenticated customer can read, review and re-evaluate any other customer's records); a billing path that marks quotas paid without inspecting the gateway result; plaintext password storage with a `123456` default; and a hardcoded JWT fallback secret.

## 3. Confirmed findings

**28 confirmed** — severity: high: 16, medium: 11, low: 1.

| Severity | Title | Affected boundary | Observed result (source-established) |
|---|---|---|---|
| HIGH | Any authenticated role can run arbitrary person-PII searches against the upstream person-search service | POST /rest/searchpersonv00 | Source analysis establishes that the request passes the auth-only middleware and reaches the upstream person-search service through the server-side client, whose declared response  |
| HIGH | GET /api/solicitudes/detalle returns any solicitud by UUID to any solicitudes:view holder | detalle | Source analysis establishes that the request passes middleware (solicitudes:view) and reaches findUnique by id with no owner predicate, so the record of any owner is returned to an |
| HIGH | GET /api/solicitudes/listar derives owner scope from the query string, exposing every solicitud in an event to any solicitudes:view holder | listar | Source analysis establishes that the request passes the solicitudes:view gate (middleware.ts:28) and reaches a Prisma findMany whose where clause contains only the event predicate  |
| HIGH | GitHub token embedded in git remote URL and persisted in host git config | EC2 host working copy | Source shows the remote URL contains the token; git's documented behavior persists that URL to .git/config, leaving the credential on disk until rotated. |
| HIGH | Internet-facing ALB is reachable directly and bypasses the CloudFront WAF | aws_cloudfront_distribution.main | Source and the prod plan show the ALB opened to 0.0.0.0/0 while WAF guards only CloudFront, so direct origin requests bypass all WAF rules. |
| HIGH | Password reset token generated with Math.random() | AuthPrismaRepository.setResetToken | Source analysis confirms the token is 32 base36 characters produced by Math.random(), which is not cryptographically secure, so token values are predictable in principle within the |
| HIGH | Passwords stored and compared in plaintext | AuthPrismaRepository.findByEmail | Source analysis shows the login code performs an exact string comparison against the stored value, so the stored value is directly usable as the password, and the seeded default 12 |
| HIGH | POST /api/solicitudes/revisar accepts any area from any solicitudes:view holder, bypassing area-specific review permissions | crearOActualizarRevision | Source analysis establishes that after the getSession presence check the submitted area/estado are persisted by crearOActualizarRevision with the caller as reviewer and no permissi |
| HIGH | Production container forces schema with prisma db push on every startup | gated migrations | Source shows db push executes on every production startup regardless of RUN_MIGRATIONS; the schema is force-synchronized to the deployed schema.prisma outside the migration history |
| HIGH | Production container runs as root and read-write bind-mounts the host source tree | app service volumes | Source establishes root execution and a read-write host bind; container compromise can modify the host repository source used by future deployments. |
| HIGH | Profile self-update mass-assigns arbitrary UserRole columns | AuthPrismaRepository.updatePerfil | Source analysis shows the unvalidated body reaches updateMany without an allowlist, so model fields supplied beyond the documented DTO are persisted onto the caller's own UserRole  |
| HIGH | Unauthenticated GESS import allows arbitrary stand creation/overwrite for any event | GessApplicationService.sync upsert | Source analysis establishes that the controller forwards the body unauthenticated and the service creates/updates GessStand rows from the caller-supplied array for the caller-chose |
| HIGH | Unauthenticated GESS stand-inventory disclosure across all events | GessPrismaRepository.findAllPaginated | Source analysis establishes that the GET passes the middleware fall-through, the controller performs no auth check, and the repository returns the full GessStand row set for the ca |
| HIGH | Unauthenticated mockup generation resets GessStand state to disponible and clears empresa | GessApplicationService.mockup upsert | Source analysis establishes that the handler runs unauthenticated and the service's update path forces estado: "disponible" and empresa: null on every matched stand. |
| HIGH | Unauthenticated stand reservation blocks inventory and creates solicitudes | stand state transition | Not executed (no OS-enforced sandbox on the audit host); the source trace deterministically shows a null session is not rejected and the stand update plus solicitud and revision cr |
| HIGH | Unauthenticated update of any GessStand by id | GessPrismaRepository.update | Source analysis establishes that the middleware lets the PATCH through and the repository updates the row selected solely by the attacker-supplied id. |
| MEDIUM | .gitignore omits .env.prod / .env.production despite production requiring them | secret template | No .gitignore rule matches .env.prod/.env.production, so a populated production secrets file would be tracked and pushed if staged. |
| MEDIUM | Authorization trusts JWT claims with no revocation until 24h expiry | signToken | Source analysis shows the gate verifies only the signature and reads permissions from the token, so revoked permissions remain effective until the 24h expiry. |
| MEDIUM | CloudFront forwards viewer traffic to the ALB origin over cleartext HTTP | custom_origin_config.origin_protocol_policy | Source fixes the origin protocol to HTTP-only, so edge-to-origin payloads are transported unencrypted. |
| MEDIUM | Deploy workflow invokes a mutable third-party action tag while handing it production EC2 credentials | remote script executed by the action | Source establishes the mutable-tag reference and the secret inputs; no integrity binding to a reviewed commit exists, so the credentials are exposed to whatever code the tag points |
| MEDIUM | GET /api/solicitudes/historial exposes any solicitud's reviewer history and justifications to any solicitudes:view holder | obtenerHistorial historial | Source analysis establishes that the middleware admits any solicitudes:view holder and the repository returns all Revision and RevisionHistorial rows for the supplied solicitudId w |
| MEDIUM | Outbound integration clients disable TLS certificate verification process-wide | PlanogessClient.fetchStands | Source analysis shows the clients set NODE_TLS_REJECT_UNAUTHORIZED="0" around the fetch, so peer certificate verification is disabled for that connection and a tampered response is |
| MEDIUM | POST /api/solicitudes/orden-pago moves any solicitud into PENDIENTE_PAGO and creates an invoice without the facturacion permission | marcarOrdenPago | Source analysis establishes that the controller only asserts a session and then writes the estado and a Facturacion row keyed by the supplied id with no facturacion permission or o |
| MEDIUM | POST /api/solicitudes/reevaluar lets any solicitudes:view holder create a re-evaluation on any solicitud | atenderReevaluacionAprobacion | Source analysis establishes that the handler performs no owner/permission comparison and the repository creates a Reevaluacion linked to the supplied solicitudId, so any solicitude |
| MEDIUM | POST /api/solicitudes/upload-doc attaches a document to any solicitud id without owner binding | crearDocumentoAdjunto | Source analysis establishes that the service never loads or owner-checks the solicitud and the repository inserts the SolicitudDocumento for the supplied id, so a document is attac |
| MEDIUM | Unauthenticated, unbounded writes to the ErrorLog table | prisma.errorLog.create | Source analysis establishes that the request passes the middleware fall-through, no session is required, and a row is inserted for every call; the table has no retention or cardina |
| MEDIUM | Unescaped attacker input interpolated into HTML notification emails | buildReservaConfirmationEmail HTML table cell | Not executed (no OS-enforced sandbox on the audit host); the source trace deterministically shows the attacker-controlled razonSocial and documento strings are concatenated unescap |
| LOW | Unauthenticated access to the internal KBServicios events proxy | fetchApi | Not executed (no OS-enforced sandbox on the audit host); the source trace deterministically shows the anonymous request is gated by neither middleware nor the controller and reache |

Full trace, reproduction and remediation for every confirmed finding are in `FINDINGS-DETAIL.md` (medium and above) and in `findings.json` (all verdicts).

## 4. Needs validation

**13 leads** with a source trace and an exact unresolved fact. None has a severity.

| Title | Boundary / trace | Exact blocker (first) |
|---|---|---|
| Authenticated auspicios caller can relay an unvalidated body to the privileged KBServicios saveauspicio endpoint | src/app/api/auspicios/grabar/route.ts:17 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| JWT signed/verified with a hardcoded fallback secret when JWT_SECRET is unset | src/lib/server/auth.ts:41 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| PATCH /api/facturacion/actualizar spreads an unvalidated body into the Prisma update | src/infrastructure/persistence/facturacion-repository.ts:123 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| Billing mutations addressed only by record id lack owner/event binding | src/infrastructure/persistence/facturacion-repository.ts:141 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| Niubizz payment confirmation ignores the gateway authorization result before marking a cuota paid | src/infrastructure/persistence/facturacion-repository.ts:113 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| Niubizz session creation reads any invoice's data by id with no owner/event binding | src/application/facturacion/niubizz-service.ts:13 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| POST /api/facturacion/pagar-cuota settles any installment by id with no owner/event binding | src/infrastructure/persistence/facturacion-repository.ts:113 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| TypeScript code generation interpolates stored layout fields without escaping | src/application/planos/planos-service.ts:226 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| Plano import persists layout values bypassing the create/layout schema constraints | src/infrastructure/persistence/plano-repository.ts:388 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| Unauthenticated RENIEC DNI lookup under the server-side operator token | src/infrastructure/external/consultas-client.ts:9 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| modificar ownership guard short-circuits when Solicitud.userId is null | src/infrastructure/persistence/solicitudes-repository.ts:265 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| Unauthenticated SUNAT RUC lookup under the server-side operator token | src/infrastructure/external/consultas-client.ts:9 | no OS-enforced sandbox available on the audit host to execute target-controlled code |
| Unauthenticated file upload with attacker-controlled extension into the public web root | docker/nginx.conf:26 | no OS-enforced sandbox available on the audit host to execute target-controlled code |

Details and safe resolution plans are in `NEEDS-VALIDATION.md`.

## 5. Hardening notes and positive patterns

Positive source-visible controls worth preserving: alerts are reliably owner-scoped (`alertas-service.ts`); the M2M key check fails closed when `INTEGRACION_API_KEY` is unset; declarated deployments pin `NODE_ENV=production`, so the `IS_LOCAL` bypass is unreachable there; the ECS entrypoint forbids `prisma db push`; and the harness/plan read paths were checked and found to have no SSRF or traversal sink.

- src/lib/server/integracion-m2m.ts:3-15: IS_LOCAL = NODE_ENV !== "production" is fail-open inference; mitigated because Dockerfile:11-12, Dockerfile.ecs:45 and docker-compose.prod.yml:43 pin NODE_ENV=production, but prefer an explicit positive flag and keep the key check in all environments.
- src/lib/server/integracion-m2m.ts:15: `enviada === clave` is not constant-time, and one global key authorizes exhibidoras/stands/contrato reads with no per-event or per-resource scope.
- src/application/auth/auth-service.ts:56-74: seleccionar-evento mints a token from request-body claims and can create Evento/EventoPadre rows (auth-repository.ts:28-47) with no events:create/events:manage check.
- src/controllers/auth.controller.ts:52: the seleccionar-evento cookie omits the Secure attribute that cookie.ts:9 applies to the login cookie.
- src/application/auth/auth-service.ts:102: the reset token is delivered in a URL query string and mailed, exposing it via Referer/history/logs.
- src/middleware.ts:12-36,72: the PROTECTED list is an allowlist and unmatched paths fall through with no edge check; make /api/** default-deny with an explicit public list.
- src/application/auth/auth-service.ts:23: string inequality is not constant-time; a hash verification would remove the timing oracle.
- solicitudes.modificar resets revisions with only solicitudes:view; require owner/reviewer permission and deny when the owner is absent.
- marcarOrdenPago derives montoTotal by stripping non-digits from medidas ('3x3'->33); use a typed price field with server validation.
- atenderReevaluacionAprobacion copies reevaluacion.documentos into solicitud.documentos without validating type or owner.
- notificar accepts an arbitrary `to` address and mails solicitud details; bind to the stored client email or a reviewer allowlist.
- solicitudes listar parses a `search` parameter that is never applied to the Prisma where clause; the declared filter is ineffective.
- /api/reservas/crear is in neither PROTECTED nor PUBLIC_API_ROUTES; add it explicitly to the protected gate or enforce a session.
- POST /api/planogess/fetch is anonymous and invokes the internal Planogess API with client-chosen event codes; add authentication and per-principal rate limiting.
- src/lib/server/storage.ts:21-48: any client can force outbound PUTs to the S3 endpoint with attacker-controlled content type and x-amz-acl: public-read; constrain content type and use private objects with signed delivery.
- src/infrastructure/external/planogess-client.ts:27-34: NODE_TLS_REJECT_UNAUTHORIZED is restored only on the success path; a rejected fetch leaves TLS verification disabled process-wide.
- GET /api/gess/listar exposes stand/empresa/rawData values and feeds id discovery for the unauthenticated write endpoints.
- src/lib/server/error-logger.ts: add schema-level length limits and a scheduled retention/cleanup job for error_log.
- src/infrastructure/external/entidades-client.ts: upstream calls carry no API key or binding, unlike the m2m/auspicios integrations.
- /api/auspicios/listar returns upstream data verbatim under a privileged key; validate and minimize the response.
- src/lib/server/integracion-m2m.ts:15: use timingSafeEqual plus per-integration keys with rotation/revocation.
- M2M controllers reflect raw exception messages to the caller on 500 (exhibidoras.controller.ts:26, stands-exhibidora.controller.ts:27).
- GET /api/exhibidoras returns the entire company directory with no pagination or rate limiting.
- confirmarPago lacks the getSession() defense-in-depth that its sibling crearSesion performs (niubizz.controller.ts:32 vs :12).
- planoLayoutSchema bounds only the length of label/nombre/color/bloqueId/tipoCodigo (planos.validator.ts:22-32); add charset restrictions to reduce codegen exposure.
- terraform/modules/ecs/main.tf:602-603: execution_role_arn and task_role_arn are the same IAM role; split execution and task roles.
- terraform/modules/ecs/main.tf:438-446: elasticfilesystem ClientMount/ClientWrite/ClientRootAccess on Resource ["*"]; scope to the file-system/access-point ARN.
- terraform/modules/ecs/main.tf:390-397: task role trust policy lacks aws:SourceAccount/aws:SourceArn conditions.
- terraform/modules/ecs/main.tf:337 + terraform/variables.tf:257: ECR image_tag_mutability="MUTABLE" with default tag "latest" enables build-to-promotion substitution; pin digests and immutable tags.
- .github/workflows/deploy.yml: actions/checkout, setup-node, upload/download-artifact and aws-actions/configure-aws-credentials are referenced by mutable major tags; pin to commit SHAs.
- .github/workflows/deploy.yml:136: `prisma migrate deploy || true` masks migration failure after deployment.
- .github/workflows/deploy.yml:16-17: the concurrency group is shared with pull_request runs and cancel-in-progress can cancel an in-flight production deploy.
- .github/workflows/deploy.yml:91-98: the deploy job lacks a protected GitHub `environment:` approval gate for production.
- docker/entrypoint.sh:16: `npm ci --include=dev` installs development dependencies into the production container.
- docker-compose.prod.yml:64: healthcheck uses `curl -fk` (TLS verification disabled), which can mask a broken certificate chain.
- Dockerfile/docker-compose.prod.yml: the container has no seccomp/read-only-root-filesystem/no-new-privileges restrictions; add if the root user cannot be removed.
- Add explicit middleware PROTECTED entries (or per-controller session checks) for /api/kbservicios and /api/sunat; docs/api-inventario.md:226 already notes pending per-endpoint permission hardening.
- No Content-Security-Policy or related security response headers are configured (next.config.ts, src/middleware.ts).
- The working tree contains a live-looking SUNAT_API_TOKEN in .env; confirm it was never pushed and rotate it if it was.
- Bound and rate-limit the unauthenticated /api/sunat and /api/kbservicios paths per principal to protect operator-owned upstream quota.
- Add a shared URL validator allowing only http/https (and same-origin relative paths) for documentos/imagenes in gess.validator.ts and reserva.validator.ts, render through a sanitized href helper, and add rel="noopener noreferrer" to target="_blank" anchors.
- Add an explicit owner/event predicate to all Facturacion mutations, or centralize billing authorization in one guard so list and mutation paths cannot disagree.
- Replace the `{id, ...data}` spread in PATCH /api/facturacion/actualizar with a Zod-validated whitelist and an explicit field pick.
- middleware.ts relies on an ordered prefix allowlist with no default-deny; any new /api prefix silently becomes anonymous. Add a default-deny for /api/** with an explicit public list.
- The GessStandDTO response contract models email/userId (gess-stand.dto.ts:14-15); project out PII unless a read permission explicitly grants it.
- /api/auth/ is a PUBLIC_API_PREFIX (constants.ts:25), so cookie-authenticated auth mutations rely solely on getSession() with no middleware-level Origin/CSRF check; add Origin/Referer validation for state-changing auth routes.

## 6. Rejected candidates (retained for future runs)

- `components.plano.documentos.unvalidated-scheme-to-href` — React 19.2.4's sanitizer is a real, source-verified control that blocks the javascript: scheme on href/src, the only executable sink on these paths; data: cannot top-level navigate in modern browsers and target=_blank implies noopener, so n
- `solicitudes.upload-doc.unvalidated-url-to-href` — Refuted by a visible framework control: React DOM's production sanitizer converts javascript: hrefs to a throwing javascript: URL before setting the attribute (react-dom-client.production.js:1412-1416), there is no dangerouslySetInnerHTML o

## 7. Coverage summary

Ledger: **43 units** — candidate: 37, covered: 6, deferred: 0, out_of_scope: 0.

Coverage was built over 4 hunting waves with 4 coverage critics (post-wave 1/2/3 and a final-clean pass). Every accepted critic proposal became a unit (wave 2: sunat, kbservicios, upload-doc, pagar-cuota; wave 3: facturacion CRUD, niubizz sesion, client render; wave 4: auth perfil, gess listar). The final-clean critic accepted no further high-value unit after wave 4.

**Exclusions / non-goals:** the native/binary, AI/LLM, RPC-broker and desktop/mobile companions do not apply to this repository (no native code, no model/tool runtime, no broker, no desktop/mobile client). Deployment-dependent controls (live `JWT_SECRET`, IAM/SG/WAF attachment, `.env.prod` presence, Niubiz proxy semantics, non-admin `facturacion:view` roles) are not source-visible and are represented as `needs_validation` rather than assumed.

**Coverage limitation:** as the skill states, a single standard run does not exhaust a target; repeated runs find more. This run is source-only and no target code was executed, which is the principal limitation.
