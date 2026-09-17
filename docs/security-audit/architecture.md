# Architecture — ContratosStands

## 1. Product, principals, normal authority, protected resources

Web application for reserving exhibition stands at IIMP events (PERUMIN, ProExplo,
WMC, GESS). It is an orchestrator/handler in front of the legacy GeneXus/SAP(HANA)
system; invoicing and master company/person data stay in SAP/KBServicios. Source ref
`de1ebbc` (`main`), worktree dirty only by the untracked skill directory.

Principals, from lowest to highest trust:

- **Anonymous** — no session. By design: public pages (`/`, `/403`, `/presala`,
  `/auth/login`), public API prefixes `/api/auth/`, `/api/maestra/`, and exact
  routes `/api/exhibidoras`, `/api/stands/exhibidora`, `/api/stands/contrato`,
  `/api/planos/publico` (`src/lib/shared/constants.ts:16-36`).
- **M2M peer (Sistema de Montaje)** — shared `x-api-key` header
  (`src/lib/server/integracion-m2m.ts:10-16`). Reads exhibitor/stand/contract state.
- **`cliente`** — customer role; can read its own solicitudes and create
  reservations (`src/lib/shared/constants.ts:212`).
- **Internal areas `logistica` / `legal` / `comunicacion`** — review solicitudes
  (`src/lib/shared/constants.ts:209-211`, review order `:290-314`).
- **`admin`** — `admin:full` plus every permission; hard bypass in middleware
  (`src/middleware.ts:63`) and `hasPermission` (`src/lib/server/auth.ts:71`).
- **CI/workload operators** — GitHub Actions with EC2 SSH key + git token, AWS
  access keys (`deploy.yml`), and the ECS task IAM role.

Protected resources: contract/solicitud records and their documents, invoicing and
payment state, exhibitor/stand/plano data, user roles and permissions, PII lookups
(DNI/RUC), and the credentials used to reach external services.

## 2. Comparable baseline

The closest source-grounded comparable is a small multi-role Next.js BFF over a
legacy ESB: session-cookie JWT + per-route permission list, Prisma over PostgreSQL,
S3/EFS for uploads, an outbound payment gateway, and Terraform/ECS deployment. Such
apps typically still centralize authorization in one middleware/guard and store
password hashes (Argon2/bcrypt). Where this repository accepts a weaker trade-off
(no password hashing, authorization split between middleware and controllers), the
baseline is used for calibration only.

## 3. Stack, deployment paths, offline build/test limits

TypeScript strict, Next.js 16.2 App Router (Turbopack), React 19, Prisma 7 + pg,
Tailwind v4 + IIMP UI kit, Vitest. Auth is a **custom HS256 JWT**; `@auth0/nextjs-auth0`
is declared but not imported anywhere in `src/`.

Deployment modes (deterministic selection): **A)** EC2 + Docker Compose with nginx
+ supervisord, source mounted over `/app`, ports 80/443 (`Dockerfile`,
`docker-compose.prod.yml:27-68`); **B)** ECS Fargate + Aurora + ALB/CloudFront/WAF
(`Dockerfile.ecs`, `terraform/`), declared in docs but with no repo automation that
builds/pushes the image; **local** PostgreSQL only (`docker-compose.yml`).

Offline build/test: `npm test` (3 mocked Vitest specs), `npm run lint`,
`npx tsc --noEmit`, and `next build` with placeholder env are declared runnable.
No OS-enforced sandbox is available on this host, so **no target-controlled code was
executed** in this run; build/test commands are listed only as candidate checks and
the missing sandbox is a needs-validation blocker for any execution-dependent claim.

## 4. Entry surfaces and important source-to-sink paths

- ~60 route handlers under `src/app/api/**`, dispatched through a slug→action map
  (`src/lib/server/router.ts:27-52`). **No Server Actions exist.**
- Body/query parsing in `src/controllers/*`; Zod only on some routes.
- Sinks: Prisma (parameterized; one `$queryRawUnsafe` in
  `src/infrastructure/persistence/evento-repository.ts:7,83` with bound params),
  filesystem/S3 writes (`src/lib/server/storage.ts:10-47`), outbound fetches to
  KBServicios/Niubiz/SUNAT/Resend, email HTML built by string interpolation
  (`src/lib/server/email.ts`, `email-templates.ts`), and TypeScript code generation
  (`src/application/planos/planos-service.ts`, `src/lib/shared/utils/ts-codegen.ts`).
- Stored/derived copies: `GessStand.rawData` JSON, `Solicitud.documentos`,
  `SolicitudDocumento.url`, `ErrorLog`, audit/revision histories, plaintext
  `UserRole.password` and `resetToken`.

## 5. Trust boundaries and strongest source-visible control

| Boundary | Location | Strongest source-visible control |
|---|---|---|
| Edge/CDN/WAF | `terraform/modules/cloudfront/main.tf:74-249` | AWS managed rules + IP rate limit; no path/auth rules |
| Edge middleware | `src/middleware.ts:12-84` | HS256 JWT verify + prefix permission list; public prefixes bypass |
| Route handlers | `src/app/api/**` | Route-dependent: controller `getSession()`/`requireAdmin`, or nothing |
| M2M peer | `src/lib/server/integracion-m2m.ts` | Shared `x-api-key`; disabled when `NODE_ENV !== "production"` |
| Object/owner scope | repositories | Optional `userId`/`eventoId` filters; alerts are the only reliably owner-scoped data |
| Credential store | `src/application/auth/auth-service.ts:20-29`, `prisma/schema.prisma:125` | None: plaintext compare, default `123456`, `Math.random()` reset token |
| Workload/IAM | `terraform/modules/ecs/main.tf:387-449` | Single task role = execution role, broad S3/Secrets/EFS grants |

## 6. Starting paths

`src/middleware.ts`; `src/lib/server/{auth,integracion-m2m,router,storage,email}.ts`;
`src/controllers/*.controller.ts`; `src/application/**`; `src/infrastructure/**`;
`prisma/schema.prisma`; `docker/**`; `terraform/**`; `.github/workflows/deploy.yml`.

## 7. Prior coverage

No compatible prior `coverage-ledger.json`/`findings.json` exists for this repo.
This is run 1 and implies no prior coverage. The run is partial by construction.

## 8. Companion selection

Boundaries in scope that require companion blocks: browser-delivered uploads and
render of stored content (`CLIENT-SIDE.md`), session/JWT/CSRF/reset/API-key semantics
(`WEB-PROTOCOL-AND-AUTH.md`), cross-record read/write and stored-copy expansion
(`DATA-ISOLATION-AND-LIFECYCLE.md`), unauthenticated load/amplification
(`RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`), privileged CI/deploy
(`SUPPLY-CHAIN-AND-RELEASE.md`), and container/IAM/secret precedence
(`CLOUD-AND-DEPLOYMENT.md`). The native, AI/LLM, RPC, and desktop/mobile companions
were considered and excluded: no native/FFI code, no model/tool runtime, no
broker/RPC service, and no desktop/mobile client exist in the repository.
