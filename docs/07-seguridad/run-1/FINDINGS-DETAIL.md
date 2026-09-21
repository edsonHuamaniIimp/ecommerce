# Findings Detail — ContratosStands (run 1)

Each confirmed finding of medium severity or higher, with source path, bounded reproduction (source-established; no target code was executed), observed result, conditions and remediation.

## HIGH — Any authenticated role can run arbitrary person-PII searches against the upstream person-search service

**Fingerprint:** `entidades/persona/pii-search-any-authenticated-role`

**Description:** The middleware protects /api/entidades by authentication only, with no permission field (middleware.ts:30), so every authenticated role including `cliente` (constants.ts:212) may call POST /api/entidades/persona. The controller takes an arbitrary documento or nombre and forwards it unmodified to the upstream person-search endpoint (entidades.controller.ts:7-18, entidades-client.ts:28-33), returning the full PersonaResultDTO record set (documento, nombres, fecha de nacimiento, correo, celular, direccion, etc., entidades.dto.ts:13-36). No ownership, scope or rate binding exists, so a low-trust authenticated user can enumerate PII for any natural person.

**Root cause:** The /api/entidades prefix is registered in middleware.ts:30 without a `permission`, and entidadesController.searchPerson performs no getSession/authorization check, passing attacker-controlled documento/nombre straight to the upstream PII service and returning the raw response.

**Intended behavior:** A person-PII lookup should require an explicit permission that binds the caller to the resource, or at minimum be limited to roles whose function needs it, instead of being available to every authenticated role including customers.

**Trace:**
- *( entrypoint )* `src/middleware.ts:30` — PROTECTED entry for /api/entidades: The route prefix is listed with no permission, so the middleware gate is satisfied by any valid session token.
- *( propagation )* `src/controllers/entidades.controller.ts:13` — entidadesController.searchPerson: The controller passes the attacker-supplied body directly to the upstream client with no permission or scope check.
- *( sink )* `src/infrastructure/external/entidades-client.ts:29` — POST /rest/searchpersonv00: The server-side request is issued to the legacy person-search service and its full PII list is returned to the caller.

**Evidence:**
- `src/middleware.ts:30` — { path: "/api/entidades" } has no permission, unlike /api/solicitudes, /api/facturacion, etc.
- `src/lib/shared/constants.ts:212` — The lowest-trust `cliente` role holds only eventos:datos, solicitudes:view, stands:plano, read/write:reservas, confirming entidades search is reachable by customers.
- `src/types/dto/entidades/entidades.dto.ts:13` — PersonaResultDTO lists the PII returned: documento, nombres/apellidos, fecha_nacimiento, correo, celular, direccion, empresa.
- `src/infrastructure/external/entidades-client.ts:3` — The upstream base URL is server-side (entidades-client.ts:3); the client attaches no caller credential and the search is made with the server's own network access.

**Conditions:**
- (authentication_level) A valid session cookie for any role, including `cliente`, is sufficient; no explicit permission is required.
- (environmental_dependency) The upstream person-search service must be reachable from the server for records to be returned.

**Attacker perspective:** An authenticated low-privilege customer who has selected an event and wants to harvest personal data of arbitrary people.

**Payloads / inputs:**
- `{"documento":"12345678"}`
- `{"nombre":"a"}`

**Bounded instructions:**
1. Log in as any role (e.g. the `cliente` role) and obtain a valid session cookie.
1. Send POST /api/entidades/persona with a JSON body containing an arbitrary documento or nombre.
1. Observe the returned ListInfoPersona records containing names, birth date, email, phone and address.

**Observed result:** Source analysis establishes that the request passes the auth-only middleware and reaches the upstream person-search service through the server-side client, whose declared response type (PersonaResultDTO) is returned verbatim to the caller; no user identity is forwarded to the upstream.

**Remediation:** Register /api/entidades with an explicit permission (e.g. a new entidades:search or reuse of solicitudes:upload) in PROTECTED, and require it in the searchPerson/searchEmpresa controllers; additionally consider rate limiting and reducing the returned PII to what the caller needs.

`src/middleware.ts`:
```
  { path: "/api/entidades", permission: "entidades:search" },
```
`src/controllers/entidades.controller.ts`:
```
async searchPerson(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!hasPermission(session, "entidades:search")) return error(API_ERROR_CODES.FORBIDDEN, "Prohibido", 403);
    const body = (await request.json()) as { documento?: string; nombre?: string };
    ...
```

**Severity:** likelihood=high (The endpoint is reachable by any authenticated role and accepts unrestricted DNI/name queries with no rate limit, so exploitation is trivial for an existing low-privilege account.) · impact=high (Successful queries return full natural-person PII (document, names, birth date, email, phone, address), enabling mass personal-data harvesting through the server's upstream access.) · overall=high · confidence=high

---

## HIGH — GET /api/solicitudes/detalle returns any solicitud by UUID to any solicitudes:view holder

**Fingerprint:** `solicitudes.detalle.missing-owner-binding`

**Description:** solicitudesController.detalle parses a caller-supplied id and calls services.solicitudes.detalle(id) without any getSession-based ownership check (solicitudes.controller.ts:32-38), and the repository resolves it with prisma.solicitud.findUnique({ where: { id } }) with no owner or event predicate (solicitudes-repository.ts:185-199). The middleware gate for /api/solicitudes only requires solicitudes:view (middleware.ts:28), which the `cliente` role holds (constants.ts:212). Consequently any authenticated customer can read the full detail of any solicitud — including solicitante email, empresa, documents, revision history and facturacion identifiers — simply by supplying its UUID.

**Root cause:** The read is keyed solely on the client-supplied primary key with no predicate binding the record to the session subject, and the only authorization is the broad solicitudes:view permission that customers also hold.

**Intended behavior:** Reading a single solicitud must be bound to the authenticated subject: a `cliente` may only read a record whose userId equals session.sub (or whose event the reviewer is entitled to), returning NOT_FOUND/FORBIDDEN otherwise.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:7` — GET detalle dispatch: Slug router maps GET /api/solicitudes/detalle to solicitudesController.detalle; prefix gated by solicitudes:view.
- *( propagation )* `src/controllers/solicitudes.controller.ts:35` — detalle: const row = await services.solicitudes.detalle(id) — the caller-supplied id is used directly with no session and no owner comparison (the controller never calls getSession).
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:186` — detalle: prisma.solicitud.findUnique({ where: { id: solicitudId } }) resolves any record by primary key, returning the full mapped row.

**Evidence:**
- `src/middleware.ts:28` — Only solicitudes:view gates the /api/solicitudes prefix; there is no per-record ownership scope.
- `src/lib/shared/constants.ts:212` — The `cliente` role holds solicitudes:view, so customers reach the endpoint.
- `src/controllers/solicitudes.controller.ts:34` — solicitudesDetalleSchema.parse validates only that id is a UUID; nothing binds it to the caller.
- `src/infrastructure/persistence/solicitudes-repository.ts:191` — The include returns revisiones, reevaluaciones, docsAdjuntos and facturaciones, i.e. full contract detail for the selected record.

**Conditions:**
- (authentication_level) Any session carrying solicitudes:view (including the customer role) is sufficient.
- (data_state) The attacker must know or guess the target solicitud UUID; the unscoped listar endpoint makes those identifiers enumerable.

**Attacker perspective:** An authenticated customer who wants to read another company's solicitud detail.

**Payloads / inputs:**
- `GET /api/solicitudes/detalle?id=<victimSolicitudUuid>`

**Bounded instructions:**
1. Authenticate as any role holding solicitudes:view, e.g. `cliente`.
1. Obtain a target solicitud UUID (e.g. from the unscoped listar endpoint).
1. Call GET /api/solicitudes/detalle?id=<uuid> and read the returned record.

**Observed result:** Source analysis establishes that the request passes middleware (solicitudes:view) and reaches findUnique by id with no owner predicate, so the record of any owner is returned to any solicitudes:view holder.

**Remediation:** Require a session in detalle, load the record, and deny when the caller is a customer whose session.sub differs from the record's userId; alternatively scope the repository lookup by userId/eventoId for non-privileged callers.

`src/controllers/solicitudes.controller.ts`:
```
async detalle(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const url = new URL(request.url);
    const { id } = solicitudesDetalleSchema.parse({ id: url.searchParams.get("id") ?? "" });
    const row = await services.solicitudes.detalle(id);
    if (!row) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    const esInterno = session.permissions.some((p) => p.startsWith("solicitudes:review:") || p === "admin:full");
    if (!esInterno && row.userId && row.userId !== session.sub) {
      return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    }
    return success(row);
  }
```

**Severity:** likelihood=high (Any authenticated customer can call it and target identifiers are enumerable via the unscoped listar endpoint.) · impact=high (Returns another customer's full solicitud detail, including PII, documents and billing identifiers.) · overall=high · confidence=high

---

## HIGH — GET /api/solicitudes/listar derives owner scope from the query string, exposing every solicitud in an event to any solicitudes:view holder

**Fingerprint:** `solicitudes.listar.unscoped-owner-and-event`

**Description:** The listar controller reads userId and eventoId directly from the request query (solicitudes.controller.ts:15-21) and forwards them to the repository, which applies the owner predicate only when params.userId is truthy (solicitudes-repository.ts:152-154) and filters by the attacker-supplied eventoId (solicitudes-repository.ts:146-151). The middleware gate for /api/solicitudes requires only the broad solicitudes:view permission (middleware.ts:28), which the lowest-trust `cliente` role holds (constants.ts:212). Because the owner filter is conditional, a customer can simply omit userId (or point it at another user) and receive every solicitud for the event, including the solicitante email, empresa, document URLs and revision comments returned by mapRow. There is no server-side derivation of the subject from the session and no role distinction between internal reviewers (who may list the whole event) and customers (who must be limited to their own records).

**Root cause:** The controller takes the tenant/owner scope from client-controlled query parameters instead of the verified session, and the repository's owner predicate is applied only when userId is truthy rather than denying by default; middleware authorizes the whole prefix with a single blanket permission that customers also hold.

**Intended behavior:** Owner/tenant scope must be derived server-side: a `cliente` may only list solicitudes whose userId equals session.sub, regardless of query parameters, while reviewers/admins may be scoped by their event. The client must not be able to widen its own scope by omitting or overriding userId.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:6` — GET listar dispatch: The slug router maps GET /api/solicitudes/listar to solicitudesController.listar; the whole prefix is behind middleware.ts:28 (solicitudes:view).
- *( propagation )* `src/controllers/solicitudes.controller.ts:21` — listar: const userId = url.searchParams.get("userId") ?? undefined — the owner filter is taken verbatim from the query, with no getSession()/role check.
- *( propagation )* `src/controllers/solicitudes.controller.ts:15` — listar: eventoId is read from the query and parsed as a UUID, letting the caller choose any event.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:152` — listar: if (params.userId) { where.userId = params.userId } — the owner predicate is absent whenever userId is omitted, so the query returns all rows for the event.

**Evidence:**
- `src/middleware.ts:28` — { path: "/api/solicitudes", permission: "solicitudes:view" } — a single blanket permission for all read and write actions, held by customers.
- `src/lib/shared/constants.ts:212` — ROLES.CLIENTE holds solicitudes:view, so the lowest-trust role passes the middleware gate and can call listar.
- `src/infrastructure/persistence/solicitudes-repository.ts:146` — Event filtering is applied from params.eventoId (the query value) rather than from the session's eventoId claim.
- `src/middleware.ts:44` — /api/eventos/listar?presala=1 is a public exception, so real eventoId values are obtainable without authentication.
- `src/infrastructure/persistence/solicitudes-repository.ts:120` — mapRow returns email, empresa, documentos, docsAdjuntos URLs and revision comments, so the cross-owner list is a data disclosure, not just an id leak.

**Conditions:**
- (authentication_level) Any session whose JWT carries solicitudes:view, including the `cliente` role, is sufficient; no additional permission or role check is performed.
- (data_state) The target event must contain solicitudes belonging to other owners for the disclosure to include third-party data.

**Attacker perspective:** An authenticated low-privilege customer who wants to enumerate other companies' stand applications for an event.

**Payloads / inputs:**
- `GET /api/solicitudes/listar?eventoId=<eventoUuid>&page=1&per_page=50`
- `GET /api/solicitudes/listar?eventoId=<eventoUuid>&userId=<victimSub>`

**Bounded instructions:**
1. Log in as the `cliente` role and obtain a valid session cookie.
1. Obtain an eventoId from the public GET /api/eventos/listar?presala=1 response.
1. Call GET /api/solicitudes/listar with that eventoId and no userId, and read the returned solicitudes of other customers.

**Observed result:** Source analysis establishes that the request passes the solicitudes:view gate (middleware.ts:28) and reaches a Prisma findMany whose where clause contains only the event predicate when userId is omitted (solicitudes-repository.ts:146-154); the response therefore contains all solicitudes of that event, including those created by other users.

**Remediation:** Derive the owner scope from the session inside the controller: when the caller's role is `cliente` (or lacks an internal-review permission) force userId = session.sub and ignore the query value; only reviewers/admins whose session eventoId authorizes the event may receive an unscoped event listing. Additionally, make the repository predicate deny-by-default for non-privileged callers instead of conditionally applying it.

`src/controllers/solicitudes.controller.ts`:
```
async listar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const url = new URL(request.url);
    const parsed = solicitudesListarSchema.parse({ ... });
    const esInterno = session.permissions.some((p) => p.startsWith("solicitudes:review:") || p === "admin:full");
    const userId = esInterno ? (url.searchParams.get("userId") ?? undefined) : session.sub;
    const result = await services.solicitudes.listar({ ..., userId });
    return success(result);
  }
```

**Severity:** likelihood=high (The endpoint is reachable by any authenticated customer, the owner filter is optional, and the required eventoId is publicly discoverable; a single request enumerates the whole event's solicitudes.) · impact=high (Cross-customer disclosure of contract solicitud data (solicitante email, empresa, document URLs, review comments and state) enables competitive and personal-data harvesting.) · overall=high · confidence=high

---

## HIGH — GitHub token embedded in git remote URL and persisted in host git config

**Fingerprint:** `github.workflows.deploy.yml:ec2-git-token-persisted-in-git-config`

**Description:** The deploy script sets the EC2 working-copy remote to https://x-access-token:${{ secrets.EC2_GIT_TOKEN }}@github.com/iimp-projects/contratos-stands.git. Git stores remote URLs verbatim in .git/config, so the token is persisted in cleartext on the production host after every deploy and is also visible in process arguments and any config/command logging.

**Root cause:** A long-lived credential (EC2_GIT_TOKEN) is placed directly in the git remote URL instead of being supplied by an ephemeral credential helper or a scoped deploy key.

**Intended behavior:** Use a least-privilege, short-lived credential (deploy key or credential helper) and never persist tokens in the repository remote URL.

**Trace:**
- *( entrypoint )* `.github/workflows/deploy.yml:124` — deploy job remote script: git remote set-url origin https://x-access-token:${{ secrets.EC2_GIT_TOKEN }}@github.com/... — token placed in the remote URL.
- *( sink )* `docker-compose.prod.yml:52` — EC2 host working copy: The host repository (source bind-mounted into the app) retains .git/config with the credentialed remote URL.

**Evidence:**
- `.github/workflows/deploy.yml:124` — Token interpolated into the origin remote URL, which git writes verbatim to .git/config on the host.
- `scripts/deploy.sh:26` — The manual deploy script performs a plain git pull without a token, showing the credentialed remote is an automatable leftover rather than a requirement.

**Conditions:**
- (system_configuration) The deploy step runs on push to main whenever EC2_SECRETS are configured, writing the token-bearing remote on the production host.

**Attacker perspective:** Local or container-level attacker on the production EC2 host who can read the working-copy .git/config (the app container root user also bind-mounts this tree).

**Payloads / inputs:**
- `grep -R x-access-token /var/www/contratos-stands/.git/config`
- `git -C /var/www/contratos-stands remote -v`

**Bounded instructions:**
1. Static reproduction (no target execution performed): read .github/workflows/deploy.yml:124 and confirm the token is interpolated into the remote URL.
1. Deployment-time reproduction: after a deploy, read the host repository's .git/config and observe the token embedded in the origin URL.

**Observed result:** Source shows the remote URL contains the token; git's documented behavior persists that URL to .git/config, leaving the credential on disk until rotated.

**Remediation:** Authenticate git with a short-lived, least-privilege GitHub App token via a credential helper (or an SSH deploy key) and never embed credentials in the remote URL; scope and rotate EC2_GIT_TOKEN.

`.github/workflows/deploy.yml`:
```
            git remote set-url origin git@github.com:iimp-projects/contratos-stands.git
            git -c credential.helper='!f() { echo "username=x-access-token"; echo "password=$GIT_TOKEN"; }; f' -c credential.helper='cache --timeout=0' pull origin main
```

**Severity:** likelihood=medium (Any process, backup or root-equivalent actor on the EC2 host (including the root app container that bind-mounts the repo) can read the token from .git/config.) · impact=high (A GitHub token exposed on the deploy host grants repository read/write and, via workflows, further supply-chain access.) · overall=high · confidence=high

---

## HIGH — Internet-facing ALB is reachable directly and bypasses the CloudFront WAF

**Fingerprint:** `terraform.ecs:alb-origin-public-bypasses-waf`

**Description:** WAF is attached only to the CloudFront distribution, but the ALB security group allows 0.0.0.0/0 on ports 80 and 443 because restrict_alb_to_cloudfront defaults to false and the prod deployment profile does not enable it. The ALB is internal=false with public subnets, so clients can hit the origin directly and skip the CloudFront managed rules and IP rate limit.

**Root cause:** ALB ingress is opened to all IPs while the WAF is bound solely to CloudFront; the CloudFront-origin-facing prefix-list control is opt-in (default false) and absent from prod.tfvars and the valle/evento profiles.

**Intended behavior:** ALB ingress should be restricted to the AWS CloudFront origin-facing managed prefix list so all internet traffic traverses the WAF-protected distribution.

**Trace:**
- *( entrypoint )* `terraform/main.tf:201` — module.ecs invocation: restrict_alb_to_cloudfront is wired from the variable that defaults to false.
- *( propagation )* `terraform/modules/ecs/main.tf:461` — aws_security_group.alb ingress: cidr_blocks = var.restrict_alb_to_cloudfront ? [] : ["0.0.0.0/0"] — publicly open by default.
- *( sink )* `terraform/modules/cloudfront/main.tf:182` — aws_cloudfront_distribution.main: web_acl_id attaches the WAF to CloudFront only, so direct ALB requests are unfiltered.

**Evidence:**
- `terraform/variables.tf:367` — restrict_alb_to_cloudfront default = false.
- `terraform/prod.tfvars:9` — Prod var file does not set restrict_alb_to_cloudfront, and its documented usage combines prod.tfvars with perfiles/valle.tfvars.
- `terraform/perfiles/valle.tfvars:1` — The valle profile (documented prod profile) never sets restrict_alb_to_cloudfront, leaving the default false.
- `terraform/modules/ecs/main.tf:498` — aws_lb.main internal = false with public subnets, so the ALB is internet-facing.
- `terraform/modules/ecs/main.tf:474` — HTTPS ingress also opens 0.0.0.0/0 when the restriction is off.
- `terraform/perfiles/apertura.tfvars:25` — Only the apertura profile sets restrict_alb_to_cloudfront = true, showing the control exists but is not the default prod state.

**Conditions:**
- (network_routing) The ALB resides in public subnets and is internet-facing, so 0.0.0.0/0 ingress is directly reachable.
- (system_configuration) The prod plan artifact (terraform/plan-prod.json) shows the ALB security group with 0.0.0.0/0 on 80 and 443 and description 'HTTP publico'.

**Attacker perspective:** Unauthenticated internet client that knows or discovers the ALB DNS name.

**Payloads / inputs:**
- `curl -sk https://<alb-dns-name>/api/...  # direct to origin, no WAF`
- `High-rate request flood against the ALB to avoid the WAF IP rate-based rule.`

**Bounded instructions:**
1. Static reproduction (no target execution performed): read terraform/variables.tf:367 (default false), terraform/modules/ecs/main.tf:457-476 (0.0.0.0/0 when off), and terraform/modules/cloudfront/main.tf:182 (WAF on CloudFront only).
1. Inspect terraform/plan-prod.json: the module.ecs.aws_security_group.alb ingress lists 0.0.0.0/0 on 80 and 443 with description 'HTTP publico'.
1. Deployment-time reproduction: request the ALB DNS directly and observe responses that never traversed CloudFront/WAF.

**Observed result:** Source and the prod plan show the ALB opened to 0.0.0.0/0 while WAF guards only CloudFront, so direct origin requests bypass all WAF rules.

**Remediation:** Enable restrict_alb_to_cloudfront in the production profiles and set the default to true, so ALB ingress is limited to the CloudFront origin-facing prefix list.

`terraform/variables.tf`:
```
variable "restrict_alb_to_cloudfront" {
  description = "Permitir ingreso al ALB SOLO desde los rangos de CloudFront (prod). En qa = false para poder probar el ALB directo"
  type        = bool
  default     = true
}
```
`terraform/prod.tfvars`:
```
restrict_alb_to_cloudfront = true
```

**Severity:** likelihood=high (Direct ALB access requires only the origin DNS name, which is resolvable/discoverable, and the default/documented prod profile leaves it open.) · impact=high (Bypassing the WAF removes OWASP managed rules and the IP rate limit, enabling direct exploitation and volumetric abuse against the origin app, including the unprotected endpoints already found in this audit.) · overall=high · confidence=high

---

## HIGH — Password reset token generated with Math.random()

**Fingerprint:** `auth.reset-token.math-random`

**Description:** The password-reset token is built from Math.random(), a non-cryptographic PRNG, and mailed in a URL query string. Although the token is 32 characters, expiring and single-use, its values are not drawn from a CSPRNG.

**Root cause:** AuthApplicationService.requestReset builds the token as [...Array(32)].map(() => Math.random().toString(36)[2]).join("") and persists/mails it; no crypto.randomBytes/randomUUID is used.

**Intended behavior:** Recovery tokens must be generated from a cryptographically secure random source, expiring and single-use.

**Trace:**
- *( entrypoint )* `src/app/api/auth/[...slug]/route.ts:13` — POST /api/auth/reset-password: Dispatches the reset request to authController.requestReset.
- *( propagation )* `src/application/auth/auth-service.ts:99` — AuthApplicationService.requestReset: Generates the reset token with Math.random().
- *( sink )* `src/infrastructure/persistence/auth-repository.ts:68` — AuthPrismaRepository.setResetToken: Persists the token and its 30-minute expiry on the user row.

**Evidence:**
- `src/application/auth/auth-service.ts:99` — Math.random()-derived 32-character reset token.
- `src/application/auth/auth-service.ts:102` — Token embedded in the emailed reset URL as a query parameter.
- `src/infrastructure/persistence/auth-repository.ts:73` — Token accepted only while resetTokenExpires >= now (30-minute window).
- `src/infrastructure/persistence/auth-repository.ts:79` — Token cleared after a successful reset (single-use).

**Conditions:**
- (authentication_level) The reset-request endpoint is anonymously reachable.
- (timing_dependency) The token is valid for a 30-minute window and can be used once.

**Attacker perspective:** An anonymous attacker who can trigger a reset for a victim email and then interact with the reset URL, or who can predict the PRNG output.

**Payloads / inputs:**
- `POST /api/auth/reset-password {"email":"victim@iimp.org.pe"}`

**Bounded instructions:**
1. Request a password reset for the victim account.
1. Derive or guess the non-CSPRNG token within the 30-minute validity window.
1. Submit POST /api/auth/reset-password/confirm with the token and a chosen password.

**Observed result:** Source analysis confirms the token is 32 base36 characters produced by Math.random(), which is not cryptographically secure, so token values are predictable in principle within their validity window.

**Remediation:** Replace Math.random() with a CSPRNG (crypto.randomBytes/randomUUID) and store only a hash of the reset token.

**Severity:** likelihood=medium (Exploitation requires predicting/observing the PRNG output within a short window, but the source provides no CSPRNG guarantee.) · impact=high (A guessed or predicted reset token allows setting a new password and taking over the account.) · overall=high · confidence=high

---

## HIGH — Passwords stored and compared in plaintext

**Fingerprint:** `auth.login.plaintext-password-storage`

**Description:** Login verifies the submitted password with a direct string equality against a cleartext password column, and accounts are created/seeded with cleartext values (fixed default "123456"). No password hashing (Argon2/bcrypt/scrypt/PBKDF2) or constant-time comparison exists anywhere in src, so any read of the user_role table yields reusable credentials.

**Root cause:** The UserRole.password column stores cleartext and AuthApplicationService.login compares it with `!==`; AuthPrismaRepository.updatePassword and prisma/seed.ts write cleartext, and no hashing utility exists in the codebase.

**Intended behavior:** Passwords must be salted, one-way hashed, and verified with a constant-time comparison; password changes and resets must re-hash.

**Trace:**
- *( entrypoint )* `src/app/api/auth/[...slug]/route.ts:10` — POST /api/auth/login: Slug router dispatches the login action to authController.login.
- *( propagation )* `src/application/auth/auth-service.ts:23` — AuthApplicationService.login: Compares userRoles[0].password !== dto.password against the stored value.
- *( sink )* `src/infrastructure/persistence/auth-repository.ts:8` — AuthPrismaRepository.findByEmail: Selects the cleartext password column used for the comparison.

**Evidence:**
- `src/application/auth/auth-service.ts:23` — Plaintext equality comparison of the supplied password.
- `prisma/schema.prisma:125` — password String @default("123456") @db.VarChar(100) — cleartext default credential.
- `prisma/seed.ts:49` — Test users are created with cleartext passwords such as admin123/cliente123.
- `src/infrastructure/persistence/auth-repository.ts:79` — updatePassword writes the new password verbatim (no hashing).

**Conditions:**
- (authentication_level) The login endpoint is reachable anonymously (public /api/auth/ prefix).
- (data_state) At least one account row exists; seeded and account-creation flows use the cleartext default 123456.

**Attacker perspective:** An anonymous attacker who obtains any copy of the user_role table (DB read, backup, SQL injection elsewhere, error dump) or a legitimate account holder.

**Payloads / inputs:**
- `POST /api/auth/login {"email":"cliente@iimp.org.pe","password":"cliente123"}`

**Bounded instructions:**
1. Read the password column value for a target account from user_role.
1. Submit it verbatim to POST /api/auth/login.

**Observed result:** Source analysis shows the login code performs an exact string comparison against the stored value, so the stored value is directly usable as the password, and the seeded default 123456 is valid for accounts whose password was never changed.

**Remediation:** Introduce a password hashing utility (Argon2id or bcrypt) and use it on account creation, profile/password updates and seed data; verify with a constant-time hash comparison and migrate/force-reset existing cleartext credentials.

**Severity:** likelihood=high (Plaintext storage plus a fixed default makes credential recovery trivial for anyone who reaches the stored data or guesses the default.) · impact=high (Full account takeover for any harvested row, including the seeded admin, and password-reuse exposure for all users; exploitation requires a read of the cleartext column, so the demonstrated impact does not meet the critical anchor (no takeover is established from source alone).) · overall=high · confidence=high

---

## HIGH — POST /api/solicitudes/revisar accepts any area from any solicitudes:view holder, bypassing area-specific review permissions

**Fingerprint:** `solicitudes.revisar.missing-area-permission`

**Description:** solicitudesController.revisar performs only a session check and then writes the review supplied in the body (solicitudes.controller.ts:40-45). The validator constrains area to the three enum values but performs no permission check (solicitudes.validator.ts:15-20), and REVISION_AREA_PERMISSIONS (constants.ts:302-306), which maps each area to its solicitudes:review:<area> permission, is referenced only in the client component solicitud-review.tsx:44 to hide buttons. The middleware gate for /api/solicitudes is the broad solicitudes:view permission (middleware.ts:28), held by `cliente` (constants.ts:212). A customer can therefore POST an approval/rejection for any area of any solicitud, driving estado transitions (computeEstadoSolicitud), triggering SGC expediente creation when legal is approved (solicitudes-service.ts:43-45) and generating reviewer alerts.

**Root cause:** The server trusts the area field and the mere presence of a session; the area-to-permission map exists but is never enforced on the write path, so any solicitudes:view holder can act as any review area.

**Intended behavior:** Recording a review must require the permission mapped to the submitted area (REVISION_AREA_PERMISSIONS[area] or admin:full) so that, for example, only a legal reviewer can approve the legal step.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:11` — POST revisar dispatch: Slug router maps POST /api/solicitudes/revisar to solicitudesController.revisar.
- *( propagation )* `src/controllers/solicitudes.controller.ts:41` — revisar: const session = await getSession(); the session is only checked for existence — no hasPermission/role check against the submitted area.
- *( propagation )* `src/validators/solicitudes.validator.ts:17` — solicitudesRevisarSchema: area is zod.enum(REVISION_AREAS) and estado is zod.enum(RESULTADOS_APROBACION); the attacker chooses both freely.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:224` — crearOActualizarRevision: prisma.revision.update/create persists the chosen estado for the chosen area, recording the caller email as the reviewer, with no authorization predicate.

**Evidence:**
- `src/middleware.ts:28` — Only solicitudes:view gates /api/solicitudes, so any customer passes.
- `src/lib/shared/constants.ts:302` — REVISION_AREA_PERMISSIONS defines solicitudes:review:comunicacion / legal / logistica, but no server file imports/references it.
- `src/components/solicitudes/solicitud-review.tsx:44` — The only reference to REVISION_AREA_PERMISSIONS is client-side, proving the permission is enforced only in the UI.
- `src/application/solicitudes/solicitudes-service.ts:43` — A legal approval triggers sgcIntegracion.crearExpedienteDesdeSolicitud, showing the business impact of unauthorized area actions.
- `src/lib/shared/constants.ts:212` — The `cliente` role holds solicitudes:view, hence the reachable caller includes customers.

**Conditions:**
- (authentication_level) Any valid session carrying solicitudes:view is sufficient; no area permission is checked.
- (authorization_role) The intended per-area permissions (solicitudes:review:*) are never required by the server.

**Attacker perspective:** An authenticated customer or any user holding only solicitudes:view who wants to force approval/rejection of a solicitud.

**Payloads / inputs:**
- `POST /api/solicitudes/revisar {"solicitudId":"<uuid>","area":"legal","estado":"aprobado","comentario":"ok"}`
- `POST /api/solicitudes/revisar {"solicitudId":"<uuid>","area":"logistica","estado":"rechazado"}`

**Bounded instructions:**
1. Authenticate as a holder of solicitudes:view (e.g. the `cliente` role).
1. POST /api/solicitudes/revisar with a target solicitudId and any area/estado combination.
1. Observe that the revision is recorded under the caller's email and the solicitud state/alerts/SGC flow advance.

**Observed result:** Source analysis establishes that after the getSession presence check the submitted area/estado are persisted by crearOActualizarRevision with the caller as reviewer and no permission comparison, so any solicitudes:view holder can act for any area.

**Remediation:** After parsing, require the permission mapped to body.area (REVISION_AREA_PERMISSIONS[body.area]) or admin:full before calling services.solicitudes.revisar; enforce the same check against the database permission source for critical transitions.

`src/controllers/solicitudes.controller.ts`:
```
const body = solicitudesRevisarSchema.parse(await request.json());
    const required = REVISION_AREA_PERMISSIONS[body.area as keyof typeof REVISION_AREA_PERMISSIONS];
    if (!session.permissions.includes(required) && !session.permissions.includes("admin:full")) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para revisar esta area", 403);
    }
    return success(await services.solicitudes.revisar({ ...body, reviewerEmail: session.email }));
```

**Severity:** likelihood=high (Trivial to invoke with any customer session and a single POST; no knowledge of internal roles is required.) · impact=high (Unauthorized approvals/rejections corrupt the review workflow, record the attacker as reviewer, and can trigger downstream SGC contract-expediente creation.) · overall=high · confidence=high

---

## HIGH — Production container forces schema with prisma db push on every startup

**Fingerprint:** `docker.entrypoint.sh:prisma-db-push-in-production-startup`

**Description:** docker/entrypoint.sh executes `npx prisma db push --skip-generate` inside the wait-for-PostgreSQL loop whenever DATABASE_URL is set, before gated `prisma migrate deploy`. In the EC2/Compose production path (Dockerfile ENTRYPOINT entrypoint.sh plus .env.prod) this reconciles the live database to schema.prisma on every container start, bypassing reviewed migrations and able to alter or drop schema/data without a migration record.

**Root cause:** `prisma db push` is used for a connectivity wait and is not gated by the migration flags; only `prisma migrate deploy` is gated by FIRST_RUN/RUN_MIGRATIONS.

**Intended behavior:** Production schema changes should occur only through reviewed migrations (`prisma migrate deploy`); `db push` must never run against a production database.

**Trace:**
- *( entrypoint )* `docker/entrypoint.sh:21` — wait-for-PostgreSQL block: if [ -n "${DATABASE_URL}" ] — the db push loop is entered whenever DATABASE_URL is present.
- *( propagation )* `docker/entrypoint.sh:24` — startup loop (30 iterations): npx prisma db push --skip-generate executes on every startup/retry.
- *( sink )* `docker/entrypoint.sh:38` — gated migrations: prisma migrate deploy runs only when FIRST_RUN or RUN_MIGRATIONS=true, so db push can change schema before any reviewed migration applies.

**Evidence:**
- `docker/entrypoint.sh:24` — Unconditional `db push` inside the wait loop, capped only by 30 iterations, not by any environment flag.
- `Dockerfile:55` — ENTRYPOINT points at docker/entrypoint.sh, so this runs in the production Docker/Compose image.
- `docker-compose.prod.yml:40` — Production app service loads .env.prod, which supplies DATABASE_URL and NODE_ENV=production.
- `.env.prod.example:20` — DATABASE_URL is a required production setting, so the db push branch is always entered.

**Conditions:**
- (data_state) Impact on data depends on live schema drift: an incompatible schema.prisma can cause db push to alter or drop columns/values without a migration record.
- (environmental_dependency) Applies to the EC2 Docker Compose deployment using Dockerfile + docker/entrypoint.sh; the ECS path uses Dockerfile.ecs + docker/entrypoint-ecs.sh.

**Attacker perspective:** Not attacker-triggered; any container restart or redeploy (or an operator pushing a schema change) executes the statement against production data.

**Payloads / inputs:**
- `npx prisma db push --skip-generate (as run by docker/entrypoint.sh:24)`

**Bounded instructions:**
1. Static reproduction (no target execution performed): read docker/entrypoint.sh lines 21-38 and confirm db push is inside the DATABASE_URL branch while migrate deploy is gated separately.
1. Deployment-time reproduction: start the production container with DATABASE_URL set and observe prisma db push running on the live database.

**Observed result:** Source shows db push executes on every production startup regardless of RUN_MIGRATIONS; the schema is force-synchronized to the deployed schema.prisma outside the migration history.

**Remediation:** Remove prisma db push from the production entrypoint; gate all schema mutation behind reviewed `prisma migrate deploy`.

`docker/entrypoint.sh`:
```
if [ -n "${DATABASE_URL}" ]; then
    echo "⏳  Esperando PostgreSQL..."
    for i in $(seq 1 30); do
        if npx prisma db execute --stdin <<< 'SELECT 1' >/dev/null 2>&1; then
            echo "✅  PostgreSQL listo."
            break
        fi
        sleep 2
    done
fi
```

**Severity:** likelihood=high (Runs on every production container start with DATABASE_URL present; no flag prevents it.) · impact=high (db push can perform destructive schema/data changes outside migration review and record, risking production data loss and divergence from the migration history.) · overall=high · confidence=high

---

## HIGH — Production container runs as root and read-write bind-mounts the host source tree

**Fingerprint:** `docker-compose.prod.yml:root-container-rw-binds-host-source`

**Description:** The production image declares no USER, supervisord runs as root, and docker-compose.prod.yml bind-mounts `.:/app` read-write. A compromise of the internet-facing Next.js/nginx processes therefore yields root within the container and write access to the host repository source, enabling code tampering that affects subsequent deploys.

**Root cause:** No non-root user is set for the runtime image, and the application directory is a read-write bind mount of the host working tree rather than an immutable, read-only artifact.

**Intended behavior:** Run the workload as a dedicated unprivileged UID and mount application code read-only (or bake it into the image) so container compromise cannot modify host source.

**Trace:**
- *( entrypoint )* `Dockerfile:6` — runtime image: FROM node:20-bookworm-slim with no USER directive, so the container process runs as root.
- *( propagation )* `docker/supervisord.conf:3` — supervisord: user=root supervises node and nginx, all running as root.
- *( sink )* `docker-compose.prod.yml:52` — app service volumes: - .:/app mounts the host repository read-write into the root container.

**Evidence:**
- `Dockerfile:55` — ENTRYPOINT into a root image that installs nginx/supervisor and never drops privileges.
- `docker/supervisord.conf:3` — user=root for the supervisor controlling the app and nginx.
- `docker-compose.prod.yml:52` — .:/app — default read-write bind of the host working tree (only /etc/letsencrypt is flagged :ro).

**Conditions:**
- (system_configuration) Applies to the EC2 Docker Compose deployment; the ECS image (Dockerfile.ecs) instead runs as USER nextjs with baked-in code.

**Attacker perspective:** Remote attacker who achieves code execution in the Next.js server or nginx process inside the production container.

**Payloads / inputs:**
- `id  # -> uid=0(root)`
- `echo 'malicious' >> /app/src/<any-file>  # writes the host working tree`

**Bounded instructions:**
1. Static reproduction (no target execution performed): confirm Dockerfile has no USER, supervisord.conf:3 sets user=root, and docker-compose.prod.yml:52 mounts .:/app without :ro.
1. Deployment-time reproduction: after accessing the container, run `id` and write to a file under /app, then observe the change on the host working tree.

**Observed result:** Source establishes root execution and a read-write host bind; container compromise can modify the host repository source used by future deployments.

**Remediation:** Add a non-root user to the Dockerfile, run supervisord/programs as that user, and mount the source read-only (or bake code into the image).

`docker-compose.prod.yml`:
```
    volumes:
      - .:/app:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

**Severity:** likelihood=medium (Depends on a separate container-compromise primitive, but the app is internet-facing and runs many third-party dependencies.) · impact=high (Root in the container plus a read-write host source mount allows tampering with application code and persistence across restarts and deploys.) · overall=high · confidence=high

---

## HIGH — Profile self-update mass-assigns arbitrary UserRole columns

**Fingerprint:** `auth.perfil.update-mass-assignment`

**Description:** PATCH /api/auth/perfil binds the write to the session email but forwards the raw JSON body, typed only at compile time as PerfilUpdateRequestDTO, into prisma.userRole.updateMany. Any additional JSON keys that exist on the UserRole model (userId, roleId, email, password, resetToken, resetTokenExpires) are written, enabling self privilege escalation and identity manipulation.

**Root cause:** authController.updatePerfil assigns await request.json() to a PerfilUpdateRequestDTO with no runtime validation, AuthApplicationService passes it through, and AuthPrismaRepository.updatePerfil runs updateMany({ where: { email }, data }) with the attacker-controlled object; Prisma's UncheckedUpdateManyInput accepts any valid UserRole column.

**Intended behavior:** A profile self-update must validate the body against a server-side allowlist and write only profile fields; identity, credential and authorization columns must never be reachable from the request.

**Trace:**
- *( entrypoint )* `src/app/api/auth/[...slug]/route.ts:17` — PATCH /api/auth/perfil: Slug router dispatches the profile update to authController.updatePerfil.
- *( propagation )* `src/controllers/auth.controller.ts:64` — authController.updatePerfil: Assigns await request.json() to PerfilUpdateRequestDTO with no Zod/runtime parse.
- *( propagation )* `src/application/auth/auth-service.ts:91` — AuthApplicationService.updatePerfil: Forwards the object unchanged to repo.updatePerfil(session.email, dto).
- *( sink )* `src/infrastructure/persistence/auth-repository.ts:57` — AuthPrismaRepository.updatePerfil: prisma.userRole.updateMany({ where: { email }, data }) with the unvalidated object.

**Evidence:**
- `src/types/dto/auth/perfil-update-request.dto.ts:1` — PerfilUpdateRequestDTO is a compile-time interface with no runtime enforcement.
- `src/controllers/auth.controller.ts:64` — Raw JSON cast to the DTO; no parse or field allowlist.
- `src/infrastructure/persistence/auth-repository.ts:57` — updateMany spreads the incoming object as Prisma data.
- `prisma/schema.prisma:124` — UserRole exposes email, password (line 125), roleId (line 123), resetToken/resetTokenExpires (lines 132-133) — all writable columns.

**Conditions:**
- (authentication_level) Any authenticated role, including cliente, can call PATCH /api/auth/perfil.
- (data_state) Escalation to a privileged role requires knowing a role id; identity takeover requires a target email.

**Attacker perspective:** An authenticated low-privilege user (e.g. cliente) updating their own profile.

**Payloads / inputs:**
- `PATCH /api/auth/perfil {"nombre":"x","roleId":"<admin-role-uuid>"}`
- `PATCH /api/auth/perfil {"email":"victim@iimp.org.pe","password":"chosen-password"}`

**Bounded instructions:**
1. Authenticate and obtain the session cookie.
1. Send PATCH /api/auth/perfil with DTO fields plus extra UserRole columns such as roleId, password or email.
1. Reuse the escalated session or log in with the altered identity.

**Observed result:** Source analysis shows the unvalidated body reaches updateMany without an allowlist, so model fields supplied beyond the documented DTO are persisted onto the caller's own UserRole row, including roleId/password/userId/email.

**Remediation:** Parse the request with a strict Zod allowlist (only nombre/apellidos/telefono/tipoUsuarioId/idEmpresa/nombreEmpresa), build an explicit data object from validated fields, and never forward the raw body to Prisma; treat role/credential columns as server-only.

**Severity:** likelihood=medium (Any authenticated user can attempt it, though escalating to admin needs knowledge of a role id.) · impact=high (Writing roleId/password/userId/email on the caller's row enables privilege escalation and account-identity manipulation.) · overall=high · confidence=high

---

## HIGH — Unauthenticated GESS import allows arbitrary stand creation/overwrite for any event

**Fingerprint:** `gess/sync/unauth-import-authority-expansion`

**Description:** POST /api/gess/sync is not covered by the middleware (middleware.ts:72) and gessController.sync performs no authentication or authorization (gess.controller.ts:39-48). It forwards the caller-supplied eventoId (any string) and seleccionadas array to gessService.sync, which upserts GessStand rows with caller-controlled uid, tipoStand, estado, empresa, pabellon and rawData (gess-service.ts:61-98). An anonymous caller can inject or overwrite stand inventory for any event, expanding their authority beyond any authorized data set.

**Root cause:** The /api/gess route is missing from both PROTECTED and the public lists, the sync controller never calls getSession, and the service accepts arbitrary eventoId plus caller-supplied rows without validating authority or event binding.

**Intended behavior:** A bulk import must enforce authentication, an import permission, and event binding, and should not let the caller choose which event's data is written.

**Trace:**
- *( entrypoint )* `src/middleware.ts:72` — middleware fall-through: /api/gess/sync is allowed anonymously because no prefix matches it.
- *( propagation )* `src/controllers/gess.controller.ts:39` — gessController.sync: The handler takes body.eventoId/seleccionadas directly and calls services.gess.sync with no session or permission check.
- *( sink )* `src/application/gess/gess-service.ts:88` — GessApplicationService.sync upsert: For each caller row the service updates or creates a GessStand with attacker-controlled fields under the chosen eventoId.

**Evidence:**
- `src/application/gess/gess-service.ts:62` — rows come from body.seleccionadas when non-empty, i.e. entirely attacker-controlled.
- `src/application/gess/gess-service.ts:79` — The persisted data object maps caller fields directly into standApiId/standCode/tipoStand/estado/empresa/rawData.
- `src/infrastructure/persistence/gess-repository.ts:51` — create/update go straight to prisma.gessStand with no authorization predicate.
- `src/app/api/gess/[...slug]/route.ts:9` — POST maps the `sync` slug to gessController.sync with no guard wrapper.

**Conditions:**
- (data_state) Creating rows always succeeds for a valid eventoId relation; overwriting requires matching (eventoId, standApiId) rows.

**Attacker perspective:** An anonymous internet client.

**Payloads / inputs:**
- `{"eventoId":"<any-evento-id>","tipoEvento":0,"codigoEvento":0,"seleccionadas":[{"uid":"ATTACKER-1","tipo":"PREFERENCIAL","status":"reservado","company":"Attacker SA"}]}`

**Bounded instructions:**
1. Send POST /api/gess/sync with an arbitrary eventoId and a seleccionadas array, without a session cookie.
1. Query GET /api/gess/listar?eventoId=... to confirm the injected stand rows were persisted.

**Observed result:** Source analysis establishes that the controller forwards the body unauthenticated and the service creates/updates GessStand rows from the caller-supplied array for the caller-chosen event.

**Remediation:** Protect the /api/gess family with authentication and an imports permission, derive eventoId from the session instead of the body where possible, and validate the imported rows against a schema.

`src/middleware.ts`:
```
  { path: "/api/gess", permission: "stands:manage" },
```
`src/controllers/gess.controller.ts`:
```
async sync(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const body = syncGessSchema.parse(await request.json());
    return success(await services.gess.sync(body.eventoId, body.tipoEvento, body.codigoEvento, body.seleccionadas));
  }
```

**Severity:** likelihood=high (Anonymous and unconditional; a single crafted request is enough.) · impact=high (Arbitrary creation/overwrite of stand inventory for any event undermines data integrity and any downstream reservation logic that trusts gess_stand.) · overall=high · confidence=high

---

## HIGH — Unauthenticated GESS stand-inventory disclosure across all events

**Fingerprint:** `gess.listar.unauth-stand-inventory-disclosure`

**Description:** GET /api/gess/listar is not covered by any middleware gate (middleware.ts:72); gessController.listar performs no session check and accepts any eventoId or bloqueId (gess.controller.ts:8-31). The repository runs prisma.gessStand.findMany({ where: { eventoId } }) with no `select`, returning every column including empresa, email, userId and rawData (gess-repository.ts:14-20; schema.prisma:181-212). Because the public /api/eventos/listar?presala=1 endpoint exposes real eventoIds, an anonymous client can enumerate stand inventory (exhibitor company and email, internal userId, raw upstream data) for any event.

**Root cause:** The /api/gess route family is absent from the middleware authorization list, the listar controller never authenticates the caller or binds the event to the session, and the repository returns the full row without a field projection.

**Intended behavior:** A stand-inventory read should be authenticated/authorized by the middleware gate and bound to the caller's event scope, and should expose only the fields the caller is entitled to see.

**Trace:**
- *( entrypoint )* `src/middleware.ts:72` — middleware fall-through: /api/gess/listar is neither protected nor public, so it is reachable without a session.
- *( propagation )* `src/controllers/gess.controller.ts:10` — gessController.listar: eventoId and bloqueId are read from the query and used with no session or permission check.
- *( sink )* `src/infrastructure/persistence/gess-repository.ts:14` — GessPrismaRepository.findAllPaginated: findMany without a select returns all GessStand columns, including empresa, email, userId and rawData.

**Evidence:**
- `src/infrastructure/persistence/gess-repository.ts:32` — findByBloque likewise returns a full row for any bloqueId with no authorization.
- `prisma/schema.prisma:194` — GessStand exposes email, userId and rawData columns that the unauthenticated response includes.
- `src/middleware.ts:44` — The presala exception makes /api/eventos/listar?presala=1 public, providing real eventoIds for enumeration.
- `src/app/api/gess/[...slug]/route.ts:6` — GET maps the `listar` slug to gessController.listar with no guard.

**Conditions:**
- (data_state) Stand rows must exist for the queried eventoId for data to be returned.

**Attacker perspective:** An anonymous internet client.

**Payloads / inputs:**
- `GET /api/gess/listar?eventoId=<id>&per_page=100`
- `GET /api/gess/listar?bloqueId=<bloqueId>`

**Bounded instructions:**
1. Obtain a real eventoId from the public GET /api/eventos/listar?presala=1 endpoint.
1. Request GET /api/gess/listar?eventoId=<id> without a session cookie.
1. Observe the returned stand rows including empresa, email, userId and rawData.

**Observed result:** Source analysis establishes that the GET passes the middleware fall-through, the controller performs no auth check, and the repository returns the full GessStand row set for the caller-supplied eventoId.

**Remediation:** Add /api/gess to PROTECTED with a suitable permission, require getSession and bind eventoId to the session in listar, and project only the fields the caller needs (excluding email/userId/rawData).

`src/middleware.ts`:
```
  { path: "/api/gess", permission: "stands:plano" },
```
`src/infrastructure/persistence/gess-repository.ts`:
```
prisma.gessStand.findMany({
        where: where as never,
        select: { id: true, standApiId: true, standCode: true, tipoStand: true, estado: true, bloqueId: true },
        orderBy: { standCode: "asc" },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
      })
```

**Severity:** likelihood=high (Anonymous, unrestricted by id, and eventoIds are available from a public endpoint.) · impact=high (Discloses exhibitor company names, contact email, internal userId and raw upstream data for arbitrary events.) · overall=high · confidence=high

---

## HIGH — Unauthenticated mockup generation resets GessStand state to disponible and clears empresa

**Fingerprint:** `gess/mockup/unauth-stand-state-reset`

**Description:** POST /api/gess/mockup is not covered by any middleware gate (middleware.ts:72) and gessController.mockup performs no session or permission check (gess.controller.ts:50-59). After resolving the event's planos, gessService.mockup upserts each bloque's stand forcing estado: "disponible" and empresa: null (gess-service.ts:124-145, specifically :132-133). An anonymous caller who supplies an existing eventoId (with tipoEvento/codigoEvento) can therefore reset live stand state and detach the company attached to each stand.

**Root cause:** The /api/gess family has no middleware protection and the mockup handler has no authorization check, while the generator unconditionally overwrites estado/empresa on existing rows matched by (eventoId, bloqueId).

**Intended behavior:** A demo data generator is a privileged administrative action; it must require authorization and must not downgrade existing production stand state.

**Trace:**
- *( entrypoint )* `src/middleware.ts:72` — middleware fall-through: /api/gess/mockup is neither protected nor public, so it is reachable anonymously.
- *( propagation )* `src/controllers/gess.controller.ts:50` — gessController.mockup: The handler validates that eventoId/tipoEvento/codigoEvento are present but never authenticates or authorizes the caller.
- *( sink )* `src/application/gess/gess-service.ts:132` — GessApplicationService.mockup upsert: Each matched stand is updated with estado: "disponible" and empresa: null (line 133), overwriting live values.

**Evidence:**
- `src/application/gess/gess-service.ts:124` — The loop calls findByStandApiId(eventoId, b.bloqueId) and then repo.update(exists.id, data) for existing stands.
- `src/application/gess/gess-service.ts:133` — data.empresa is hard-coded to null, clearing any company currently linked to the stand.
- `src/app/api/gess/[...slug]/route.ts:10` — POST maps the `mockup` slug to gessController.mockup with no guard.

**Conditions:**
- (data_state) Real effect requires existing GessStand rows for the targeted event/bloques; the planos must resolve for tipoEvento/codigoEvento.

**Attacker perspective:** An anonymous internet client.

**Payloads / inputs:**
- `{"eventoId":"<existing-evento-id>","tipoEvento":1,"codigoEvento":1}`

**Bounded instructions:**
1. Send POST /api/gess/mockup with an existing eventoId and valid tipoEvento/codigoEvento, without a session cookie.
1. Re-read the affected stands (e.g. via GET /api/gess/listar) to observe estado reset to disponible and empresa cleared.

**Observed result:** Source analysis establishes that the handler runs unauthenticated and the service's update path forces estado: "disponible" and empresa: null on every matched stand.

**Remediation:** Require authentication plus an administrative permission for mockup (and the whole /api/gess family), and gate demo generation behind a non-production environment check so it cannot overwrite live state.

`src/middleware.ts`:
```
  { path: "/api/gess", permission: "stands:manage" },
```
`src/controllers/gess.controller.ts`:
```
async mockup(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!hasPermission(session, "stands:manage")) return error(API_ERROR_CODES.FORBIDDEN, "Prohibido", 403);
    ...
```

**Severity:** likelihood=high (The endpoint is anonymous and deterministic; only an existing eventoId and event codes are needed.) · impact=high (Live stand state and company linkage are silently reset, corrupting reservation/occupancy data for the targeted event.) · overall=high · confidence=high

---

## HIGH — Unauthenticated stand reservation blocks inventory and creates solicitudes

**Fingerprint:** `reservas/crear/unauth-stand-block-and-solicitud`

**Description:** POST /api/reservas/crear calls getSession() but discards a null result, so an anonymous caller proceeds. The service marks each requested stand as en_evaluacion, records the caller e-mail/user, then creates a solicitud with three review records, alert rows, and confirmation e-mails. The route is not protected by middleware, so an unauthenticated attacker can block stand inventory and inject bogus solicitudes into the review workflow.

**Root cause:** reserva.controller.ts:10 obtains the session but never returns 401 when it is null; it forwards session?.email and session?.sub (undefined) into services.reservas.crear, and reserva-service.ts:27-43 and 52-59 apply the state transition and create the solicitud regardless. No PROTECTED prefix matches /api/reservas in middleware.ts.

**Intended behavior:** Creating a reservation mutates shared stand state and starts an approval workflow; it must require an authenticated owner (and the write:reservas permission) before any state change.

**Trace:**
- *( entrypoint )* `src/middleware.ts:50` — PROTECTED prefix loop: No PROTECTED entry matches /api/reservas and it is not public, so the anonymous request falls through at line 72.
- *( propagation )* `src/app/api/reservas/[...slug]/route.ts:6` — POST crear dispatch: createRouter dispatches the anonymous POST to reservaController.crear.
- *( propagation )* `src/controllers/reserva.controller.ts:10` — crear: getSession() is called but its null result is not rejected; the request continues with session?.email and session?.sub undefined.
- *( sink )* `src/application/reservas/reserva-service.ts:37` — stand state transition: gessRepo.update sets the stand estado to en_evaluacion, stores the caller e-mail/user and optional documentos, and then lines 52-59 create the solicitud and three review records.

**Evidence:**
- `src/controllers/reserva.controller.ts:10` — Session is read but never rejected when null.
- `src/controllers/reserva.controller.ts:15` — session?.email and session?.sub default to undefined for anonymous callers.
- `src/application/reservas/reserva-service.ts:38` — ESTADOS_STAND.EN_EVALUACION is assigned to the stand.
- `src/application/reservas/reserva-service.ts:52` — crearSolicitud plus three crearRevisionInicial calls create the workflow record.
- `src/application/reservas/reserva-service.ts:106` — Admin notification e-mail is sent from the unauthenticated flow.
- `src/lib/shared/constants.ts:212` — cliente is the role expected to create reservations (write:reservas); that permission is never enforced.

**Conditions:**
- (authentication_level) anonymous: no token cookie is required.
- (data_state) the attacker must submit stand identifiers that exist and are not already blocked; enumerable GessStand ids make this practical.

**Attacker perspective:** Unauthenticated HTTP client.

**Payloads / inputs:**
- `POST /api/reservas/crear body {"standIds":["<existing-stand-id>"],"datos":{"razonSocial":"x","tipoDocumento":"DNI","numeroDocumento":"1","email":"a@b.com"}} with no Cookie header`

**Bounded instructions:**
1. Issue the POST with no token cookie.
1. Observe that getSession() returns null but the controller still calls services.reservas.crear.
1. Observe that the stand row is updated to en_evaluacion and a solicitud with comunicacion, legal, and logistica revision rows is created.

**Observed result:** Not executed (no OS-enforced sandbox on the audit host); the source trace deterministically shows a null session is not rejected and the stand update plus solicitud and revision creation run for the anonymous caller.

**Remediation:** Reject null sessions in reservaController.crear with a 401 and enforce write:reservas, then re-check owner/event scope in the service before mutating stands; add /api/reservas to the middleware PROTECTED list and make /api deny by default.

**Severity:** likelihood=high (the endpoint is reachable anonymously and the reservation ids are ordinary request values.) · impact=high (an anonymous actor can remove stands from availability for every other client and inject bogus solicitudes and e-mails into a shared review workflow.) · overall=high · confidence=high

---

## HIGH — Unauthenticated update of any GessStand by id

**Fingerprint:** `gess/actualizar/unauth-arbitrary-id-update`

**Description:** PATCH /api/gess/actualizar is dispatched through the [...slug] router (gess/[...slug]/route.ts:12-14) but /api/gess appears in neither PROTECTED nor the public lists, so the middleware allows it anonymously (middleware.ts:72). gessController.actualizar performs no session check (gess.controller.ts:33-37); it parses updateGessStandSchema (which accepts any id plus estado/documentos/imagenes/bloqueId, gess.validator.ts:3-9) and calls services.gess.actualizarStand, which calls repo.update(id, data) -> prisma.gessStand.update({ where: { id } }) with no owner or event predicate (gess-repository.ts:56-59). An anonymous caller can therefore modify any stand's state, documents or images across all events.

**Root cause:** The /api/gess route family is absent from the middleware authorization list and the controller/repository apply no authentication, permission, or event/owner predicate, so a client-supplied id is written directly.

**Intended behavior:** Updating a GESS stand must require the caller to be authenticated and authorized for that event, and the update must be bound to the caller's scope; arbitrary id writes by anonymous clients must be denied.

**Trace:**
- *( entrypoint )* `src/middleware.ts:72` — middleware fall-through: /api/gess matches no PROTECTED prefix and no public list, so the request proceeds unauthenticated.
- *( propagation )* `src/controllers/gess.controller.ts:33` — gessController.actualizar: The handler parses the body with updateGessStandSchema and calls services.gess.actualizarStand with no getSession/authorization check.
- *( sink )* `src/infrastructure/persistence/gess-repository.ts:57` — GessPrismaRepository.update: prisma.gessStand.update({ where: { id }, data }) writes the attacker-selected record with no owner/evento predicate.

**Evidence:**
- `src/validators/gess.validator.ts:3` — updateGessStandSchema accepts id, bloqueId, documentos, imagenes and estado with no event/ownership field.
- `src/application/gess/gess-service.ts:57` — actualizarStand forwards the parsed object (including attacker-chosen estado/documentos/imagenes) to the repository.
- `src/app/api/gess/[...slug]/route.ts:12` — PATCH maps the `actualizar` slug to gessController.actualizar without any wrapper guard.
- `prisma/schema.prisma:181` — GessStand rows hold estado, empresa, documentos, imagenes and rawData that the unauthenticated update can rewrite.

**Conditions:**
- (data_state) The target GessStand id must exist for the update to persist (Prisma throws otherwise); ids are discoverable via the unauthenticated listar endpoint.

**Attacker perspective:** An anonymous internet client.

**Payloads / inputs:**
- `{"id":"<gessStand.id>","estado":"reservado","documentos":["https://attacker.example/x"]}`

**Bounded instructions:**
1. Obtain a GessStand id from the unauthenticated GET /api/gess/listar?eventoId=... response.
1. Send PATCH /api/gess/actualizar with that id and arbitrary estado/documentos/imagenes, without any session cookie.

**Observed result:** Source analysis establishes that the middleware lets the PATCH through and the repository updates the row selected solely by the attacker-supplied id.

**Remediation:** Add /api/gess to the middleware PROTECTED list with an appropriate permission (and event binding), and require getSession plus an event/owner-scoped predicate in actualizarStand/the repository.

`src/middleware.ts`:
```
  { path: "/api/gess", permission: "stands:manage" },
```
`src/controllers/gess.controller.ts`:
```
async actualizar(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const body = updateGessStandSchema.parse(await request.json());
    return success(await services.gess.actualizarStand(body.id, body, session.eventoId));
  }
```

**Severity:** likelihood=high (The route is anonymous and accepts any id; no secret or account is needed.) · impact=high (Integrity of the stand inventory, including reservation-relevant estado, empresa and documentos, can be rewritten for arbitrary records and events.) · overall=high · confidence=high

---

## MEDIUM — .gitignore omits .env.prod / .env.production despite production requiring them

**Fingerprint:** `gitignore:.env.prod-not-ignored`

**Description:** .gitignore excludes .env, .env.local, the *.local variants and *.pem/*.key, but has no rule matching .env.prod or .env.production. Deployment docs and docker-compose.prod.yml require a populated .env.prod containing DB_PASSWORD and JWT_SECRET in the working tree, so these production secrets can be accidentally committed.

**Root cause:** The env-file ignore patterns enumerate `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local` and `.env*.local`, none of which match the `.env.prod` name actually used by the project.

**Intended behavior:** Every secret-bearing environment file used by the project, including .env.prod and .env.production, must be excluded from version control.

**Trace:**
- *( entrypoint )* `.gitignore:34` — variables de entorno block: Ignore list starts at .env but never includes .env.prod/.env.production.
- *( propagation )* `docker-compose.prod.yml:41` — app service env_file: Production service requires .env.prod in the working tree.
- *( sink )* `.env.prod.example:19` — secret template: Template documents DB_PASSWORD and JWT_SECRET that the real .env.prod will hold.

**Evidence:**
- `.gitignore:39` — .env*.local matches only files ending in .local; .env.prod and .env.production do not match any earlier line.
- `docs/01-despliegue/despliegue.md:81` — Deployment instructions require a populated .env.prod with real DB_PASSWORD/JWT_SECRET in the working tree.
- `.env.prod.example:20` — DATABASE_URL/DB_PASSWORD and JWT_SECRET are the secret contents at risk.

**Conditions:**
- (system_configuration) Materializes only once an operator creates a real .env.prod from the example; the current tracked tree contains only .env.example and .env.prod.example.

**Attacker perspective:** Opportunistic or careless committer whose local .env.prod is staged by a broad git add and pushed to the remote.

**Payloads / inputs:**
- `git add .env.prod && git commit -m 'config' && git push`

**Bounded instructions:**
1. Static reproduction (no target execution performed): apply the .gitignore patterns to the string '.env.prod' — no pattern matches.
1. Verify with `git check-ignore -v .env.prod .env.production` in the repository root; both names are unignored.

**Observed result:** No .gitignore rule matches .env.prod/.env.production, so a populated production secrets file would be tracked and pushed if staged.

**Remediation:** Add explicit ignore rules for all production env files before any real .env.prod exists.

`.gitignore`:
```
# variables de entorno
.env
.env.local
.env.*.local
.env.prod
.env.production
.env.prod.*
!.env.prod.example
```

**Severity:** likelihood=medium (Requires a real .env.prod to be created and staged, which the documented workflow makes routine; no secret is currently committed.) · impact=high (A committed .env.prod exposes the production database password and JWT signing secret, enabling full data access and session forgery.) · overall=medium · confidence=high

---

## MEDIUM — Authorization trusts JWT claims with no revocation until 24h expiry

**Fingerprint:** `authz.jwt.claims-only-no-revocation`

**Description:** Middleware and hasPermission authorize solely from signed JWT claims. Permission/role changes in the database (roles.controller -> role-repository.updatePermisos/addUser/removeUser) do not invalidate issued tokens, and hasDBPermission (the only DB-backed check) is called at a single endpoint. A revoked or demoted principal keeps access for up to the 24h token lifetime.

**Root cause:** The middleware gate calls hasPermission(payload, permission), which reads payload.permissions/payload.roles only; there is no denylist, session version or app-wide DB permission check, and tokens expire only after 24h.

**Intended behavior:** Authorization must reflect current server-side role/permission state, or revocation must take effect within a bounded short window.

**Trace:**
- *( entrypoint )* `src/middleware.ts:58` — middleware PROTECTED prefix loop: Rejects only when hasPermission(payload, route.permission) is false, using claims from the token.
- *( propagation )* `src/lib/server/auth.ts:70` — hasPermission: Reads payload.permissions and payload.roles from the JWT, with no database lookup.
- *( sink )* `src/lib/server/auth.ts:40` — signToken: Issues a 24h token whose claims cannot be revoked before expiry.

**Evidence:**
- `src/lib/server/auth.ts:70` — hasPermission returns payload.permissions.includes(...) || payload.roles.includes(admin).
- `src/middleware.ts:58` — The authorization gate consumes only the verified claims.
- `src/lib/server/auth.ts:40` — Tokens are set to expire after 24h with no shorter revalidation window.
- `src/controllers/solicitudes.controller.ts:54` — hasDBPermission is imported and used at exactly this one endpoint; no other route re-checks the database.
- `src/infrastructure/persistence/role-repository.ts:29` — Role permissions are mutated in the database independently of issued tokens.

**Conditions:**
- (authorization_role) An administrator changes permissions (updatePermisos/addUser/removeUser) for the principal.
- (timing_dependency) The affected principal keeps using the token within its 24h lifetime.

**Attacker perspective:** A user whose permission or role was just revoked, or a terminated account, still holding a valid session cookie.

**Payloads / inputs:**
- `GET /api/facturacion/... with the previously issued token cookie`

**Bounded instructions:**
1. Obtain a token while holding a permission.
1. Have an administrator revoke the permission or remove the account.
1. Continue calling routes protected by that permission with the same cookie.

**Observed result:** Source analysis shows the gate verifies only the signature and reads permissions from the token, so revoked permissions remain effective until the 24h expiry.

**Remediation:** Use short-lived access tokens with refresh plus a server-side session/token version or denylist checked on each request, and apply DB-backed permission checks to sensitive routes rather than trusting claims alone.

**Severity:** likelihood=medium (Requires a prior legitimate grant and a subsequent role/permission change, which is a normal administrative operation.) · impact=high (Revoked or demoted principals retain full access to protected functionality for up to 24h.) · overall=medium · confidence=high

---

## MEDIUM — CloudFront forwards viewer traffic to the ALB origin over cleartext HTTP

**Fingerprint:** `terraform.cloudfront:origin-http-only-cleartext`

**Description:** The CloudFront distribution's custom origin sets origin_protocol_policy = "http-only", so CloudFront terminates TLS at the edge and relays requests to the internet-facing ALB over plaintext HTTP on port 80, exposing session JWTs, PII and payment-related data to interception between CloudFront and the origin despite an available ALB HTTPS listener.

**Root cause:** The origin protocol policy is hardcoded to http-only even though the ALB provisions an HTTPS listener when enable_https is true (it is true in prod).

**Intended behavior:** CloudFront should reach the origin over HTTPS (origin_protocol_policy = "https-only") using the ALB's TLS listener and a validated certificate.

**Trace:**
- *( entrypoint )* `terraform/modules/cloudfront/main.tf:184` — aws_cloudfront_distribution.main origin: Origin is the internet-facing ALB DNS name.
- *( propagation )* `terraform/modules/cloudfront/main.tf:188` — custom_origin_config: http_port 80 / https_port 443 declared, protocol then forced to http-only.
- *( sink )* `terraform/modules/cloudfront/main.tf:191` — custom_origin_config.origin_protocol_policy: origin_protocol_policy = "http-only" — CloudFront uses port 80 to the origin.

**Evidence:**
- `terraform/modules/cloudfront/main.tf:191` — Explicit http-only origin protocol despite viewer_protocol_policy = redirect-to-https for clients.
- `terraform/modules/ecs/main.tf:550` — An ALB HTTPS listener exists (enable_https true in prod), so the cleartext origin hop is a choice, not a constraint.
- `terraform/modules/ecs/main.tf:534` — Comments acknowledge the http-only origin design (ALB must forward, not redirect, to avoid a loop).

**Conditions:**
- (network_routing) CloudFront connects to the ALB's public DNS over port 80, so the hop crosses networks where plaintext HTTP can be observed.

**Attacker perspective:** Network-positioned adversary (or a compromised intermediate) on the path between a CloudFront edge and the ALB/region.

**Payloads / inputs:**
- `Passive capture of plaintext HTTP requests/responses on the CloudFront-to-ALB hop.`

**Bounded instructions:**
1. Static reproduction (no target execution performed): read terraform/modules/cloudfront/main.tf:191 and confirm origin_protocol_policy = "http-only".
1. Deployment-time reproduction: inspect the deployed origin's traffic and confirm requests arrive at the ALB port 80 without TLS.

**Observed result:** Source fixes the origin protocol to HTTP-only, so edge-to-origin payloads are transported unencrypted.

**Remediation:** Set the origin protocol policy to https-only and point CloudFront at the ALB's TLS listener with the validated certificate.

`terraform/modules/cloudfront/main.tf`:
```
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
```

**Severity:** likelihood=medium (Requires a network position on the CloudFront-to-origin path; the hop is not authenticated by mutual TLS.) · impact=medium (Interception reveals session tokens, PII and commercial data in transit, but the attacker cannot trivially rewrite responses on an encrypted viewer leg.) · overall=medium · confidence=high

---

## MEDIUM — Deploy workflow invokes a mutable third-party action tag while handing it production EC2 credentials

**Fingerprint:** `github.workflows.deploy.yml:ssh-action-mutable-tag-with-prod-secrets`

**Description:** The CD deploy job in .github/workflows/deploy.yml invokes appleboy/ssh-action@v1.2.2, a movable version tag rather than a pinned commit, and supplies it with the production host, SSH private key and git token. Whatever code that tag resolves to at run time executes on the GitHub runner with those secrets, and the job runs automatically on every push to main without a protected environment.

**Root cause:** The third-party action is referenced by a mutable semver tag (v1.2.2) instead of an immutable full commit SHA, so its content can be changed after review and is not integrity-bound.

**Intended behavior:** Third-party actions that receive production credentials must be pinned to a full commit SHA (or vendored) and the deploy job must be gated by a protected GitHub Environment.

**Trace:**
- *( entrypoint )* `.github/workflows/deploy.yml:113` — deploy job — Deploy via SSH step: uses: appleboy/ssh-action@v1.2.2 — action resolved from a mutable tag.
- *( propagation )* `.github/workflows/deploy.yml:117` — with: key/host/username: Production secrets EC2_SSH_KEY, EC2_HOST, EC2_USERNAME and EC2_GIT_TOKEN are passed into the mutable action.
- *( sink )* `.github/workflows/deploy.yml:124` — remote script executed by the action: The action runs a remote script that consumes EC2_GIT_TOKEN, so moving the tag yields execution with the production deploy credential.

**Evidence:**
- `.github/workflows/deploy.yml:113` — uses: appleboy/ssh-action@v1.2.2 — tag reference, not a 40-char commit SHA.
- `.github/workflows/deploy.yml:117` — key: ${{ secrets.EC2_SSH_KEY }} — production SSH private key exposed to the action.
- `.github/workflows/deploy.yml:96` — Deploy job condition runs on push to refs/heads/main with no environment protection or approval gate.

**Conditions:**
- (system_configuration) Deploy job runs automatically on push to main; no GitHub Environment protection is declared in source, so a moved upstream tag is consumed without human review.

**Attacker perspective:** Supply-chain attacker able to move the v1.2.2 tag in (or compromise) the upstream appleboy/ssh-action repository.

**Payloads / inputs:**
- `Re-point the appleboy/ssh-action v1.2.2 tag to an attacker-controlled commit that exfiltrates the with: inputs.`

**Bounded instructions:**
1. Static reproduction (no target execution performed): inspect .github/workflows/deploy.yml, confirm line 113 resolves the action from tag v1.2.2 rather than a SHA, and confirm lines 115-124 pass EC2_SSH_KEY and EC2_GIT_TOKEN into that action.
1. Deployment-time replay: move the upstream tag to attacker code and push any commit to main; the deploy job then runs the moved code with the production secrets.

**Observed result:** Source establishes the mutable-tag reference and the secret inputs; no integrity binding to a reviewed commit exists, so the credentials are exposed to whatever code the tag points to at run time.

**Remediation:** Pin all third-party actions to full commit SHAs (e.g. appleboy/ssh-action@<40-hex-sha>) and require reviewer approval via a protected GitHub Environment for the deploy job.

`.github/workflows/deploy.yml`:
```
        uses: appleboy/ssh-action@<immutable-40-char-commit-sha> # v1.2.2
```

**Severity:** likelihood=low (Requires the upstream maintainer (or a compromise of the upstream repo) to move the tag; no evidence of that has occurred.) · impact=high (Successful substitution yields the EC2 SSH private key and a long-lived GitHub token, enabling arbitrary production code execution and repository access.) · overall=medium · confidence=high

---

## MEDIUM — GET /api/solicitudes/historial exposes any solicitud's reviewer history and justifications to any solicitudes:view holder

**Fingerprint:** `solicitudes.historial.missing-session-and-owner`

**Description:** Authentication for /api/solicitudes is supplied by middleware, which requires a valid JWT with solicitudes:view (middleware.ts:28); the candidate's 'missing session' wording is therefore inaccurate for the end-to-end path. The real defect is the missing per-record owner binding: solicitudesController.historial reads the id from the query and calls repo.obtenerHistorial(id) with no session, permission or ownership check (solicitudes.controller.ts:159-163), and obtenerHistorial queries prisma.revision.findMany / prisma.revisionHistorial.findMany using only { where: { solicitudId } } (solicitudes-repository.ts:374-384). Any `cliente` (constants.ts:212) can thus read the review history of any solicitud, including reviewer emails (createdBy/updatedBy) and previous justifications (comentarioAnterior).

**Root cause:** The history repository methods filter exclusively by the caller-supplied solicitudId and the controller neither authenticates the subject against the record nor restricts the endpoint to reviewers; the only control is the blanket solicitudes:view permission shared by customers.

**Intended behavior:** A history endpoint that returns reviewer identities and justifications must require an entitled reviewer (area permission or admin) and/or bind the record to the caller; customers must only see history for their own solicitudes.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:8` — GET historial dispatch: Slug router maps GET /api/solicitudes/historial to solicitudesController.historial.
- *( propagation )* `src/controllers/solicitudes.controller.ts:163` — historial: const { revisiones, historial } = await services.solicitudes.repo.obtenerHistorial(gessStandId) — the query id is passed straight through; there is no session or ownership check in the handler.
- *( propagation )* `src/infrastructure/persistence/solicitudes-repository.ts:376` — obtenerHistorial revisiones: prisma.revision.findMany({ where: { solicitudId }, select: { ..., createdBy, updatedBy, comentario } }) returns reviewer identity and comments for any solicitud id.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:381` — obtenerHistorial historial: prisma.revisionHistorial.findMany({ where: { solicitudId } }) returns estadoAnterior/comentarioAnterior/motivo/createdBy for any solicitud id.

**Evidence:**
- `src/middleware.ts:28` — The endpoint is authenticated (contrary to the 'missing session' framing) but only by the broad solicitudes:view permission.
- `src/lib/shared/constants.ts:212` — The `cliente` role holds solicitudes:view and can therefore reach historial.
- `src/controllers/solicitudes.controller.ts:160` — Only the id query parameter is validated; no session, role or owner check is performed.
- `prisma/schema.prisma:331` — RevisionHistorial stores createdBy (reviewer) and comentarioAnterior (justification), which are returned to the caller.

**Conditions:**
- (authentication_level) A valid session with solicitudes:view (including the customer role) is required and sufficient; the endpoint is not anonymous.
- (data_state) A target solicitud with prior reviews/history must exist; solicitud UUIDs are enumerable through the unscoped listar endpoint.

**Attacker perspective:** An authenticated customer who wants to inspect the review trail and reviewer identities of another company's application.

**Payloads / inputs:**
- `GET /api/solicitudes/historial?id=<victimSolicitudUuid>`

**Bounded instructions:**
1. Authenticate as any role holding solicitudes:view, e.g. `cliente`.
1. Obtain a target solicitud UUID.
1. Call GET /api/solicitudes/historial?id=<uuid> and read the returned revision/historial items containing usuario (reviewer email) and justifications.

**Observed result:** Source analysis establishes that the middleware admits any solicitudes:view holder and the repository returns all Revision and RevisionHistorial rows for the supplied solicitudId with no owner predicate.

**Remediation:** Require a reviewer permission (solicitudes:review:* or admin:full) for historial and, when exposing it to customers, first verify that the solicitud belongs to session.sub; do not rely on the blanket solicitudes:view permission for reviewer-only data.

`src/controllers/solicitudes.controller.ts`:
```
async historial(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    const gessStandId = new URL(request.url).searchParams.get("id");
    if (!gessStandId) return error(API_ERROR_CODES.VALIDATION, "id requerido", 400);
    const detalle = await services.solicitudes.detalle(gessStandId);
    if (!detalle) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    const esRevisor = session.permissions.some((p) => p.startsWith("solicitudes:review:") || p === "admin:full");
    if (!esRevisor && detalle.userId !== session.sub) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos", 403);
    }
    ...
  }
```

**Severity:** likelihood=high (Reachable by any customer and only requires a solicitud UUID, which is enumerable via listar.) · impact=medium (Discloses internal reviewer identities, prior states and justifications for another owner's solicitud; sensitive process metadata rather than credentials.) · overall=medium · confidence=high

---

## MEDIUM — Outbound integration clients disable TLS certificate verification process-wide

**Fingerprint:** `tls.external-clients.cert-verification-disabled`

**Description:** Both the KBServicios and Planogess clients set process.env.NODE_TLS_REJECT_UNAUTHORIZED="0" immediately before fetch and reset it to "1" afterwards. The toggle is process-global and covers every TLS connection made during the window; it is skipped on any thrown fetch (no try/finally), leaving verification disabled until another call resets it. The configured endpoints are HTTPS.

**Root cause:** The clients mutate the global NODE_TLS_REJECT_UNAUTHORIZED environment flag instead of configuring verification per connection, and they are singletons in services.ts, so any in-flight or failed call runs with peer verification disabled.

**Intended behavior:** Outbound TLS clients must verify the peer certificate; any relaxation must be an explicit, per-connection configuration, never a process-global toggle.

**Trace:**
- *( entrypoint )* `src/infrastructure/external/kbservicios-client.ts:7` — fetchApi: Sets process.env.NODE_TLS_REJECT_UNAUTHORIZED="0" before the outbound call.
- *( propagation )* `src/infrastructure/external/kbservicios-client.ts:8` — fetchApi -> fetch(BASE_URL): Performs the HTTPS request with verification disabled process-wide.
- *( sink )* `src/infrastructure/external/planogess-client.ts:34` — PlanogessClient.fetchStands: Same global toggle; the reset at line 34 is unreachable if the fetch at line 28 throws.

**Evidence:**
- `src/infrastructure/external/kbservicios-client.ts:7` — Disables certificate verification before fetch.
- `src/infrastructure/external/kbservicios-client.ts:14` — Re-enables verification only after a successful fetch (no finally).
- `src/infrastructure/external/planogess-client.ts:27` — Repeats the global disable for the Planogess client.
- `src/lib/server/services.ts:29` — Both clients are constructed as module-level singletons shared process-wide.
- `.env.prod.example:25` — PLANOGESS_API_URL and KBSERVICIOS_URL point at HTTPS endpoints (https://secure2.iimp.org:8443).

**Conditions:**
- (system_configuration) The external endpoints are HTTPS (secure2.iimp.org:8443).
- (network_routing) An attacker can intercept or redirect the app's outbound connection to those endpoints.

**Attacker perspective:** An on-path network attacker between the application host and secure2.iimp.org.

**Payloads / inputs:**
- `Serve a self-signed or otherwise invalid certificate for secure2.iimp.org:8443`

**Bounded instructions:**
1. Position on the network path of the KBServicios/Planogess calls.
1. Present a certificate that would normally fail validation and return a forged response.

**Observed result:** Source analysis shows the clients set NODE_TLS_REJECT_UNAUTHORIZED="0" around the fetch, so peer certificate verification is disabled for that connection and a tampered response is accepted.

**Remediation:** Remove the global NODE_TLS_REJECT_UNAUTHORIZED toggle and keep certificate verification enabled; if a legacy endpoint uses a private CA, pin that CA per-request or per-agent instead of disabling verification globally.

**Severity:** likelihood=low (Exploitation requires a network position on the outbound path to the integration servers.) · impact=high (Man-in-the-middle tampering can alter event/stand/planogess data ingested by the application without detection.) · overall=medium · confidence=high

---

## MEDIUM — POST /api/solicitudes/orden-pago moves any solicitud into PENDIENTE_PAGO and creates an invoice without the facturacion permission

**Fingerprint:** `solicitudes.orden-pago.missing-facturacion-permission`

**Description:** solicitudesController.ordenPago performs only a session check and calls repo.marcarOrdenPago(solicitudId) with the body id (solicitudes.controller.ts:150-156). marcarOrdenPago sets the solicitud estado to PENDIENTE_PAGO and creates or updates a Facturacion record with a computed montoTotal (solicitudes-repository.ts:349-371). The only gate is the solicitudes:view permission on /api/solicitudes (middleware.ts:28); the facturacion:view permission that guards /api/facturacion (middleware.ts:21) is never required here. Any `cliente` (constants.ts:212) can therefore push any solicitud into the billing pipeline and mint an invoice.

**Root cause:** The billing-state transition is exposed under the general solicitudes prefix and the controller checks only for a session; no facturacion permission or ownership binding is applied.

**Intended behavior:** Transitioning a solicitud into a billing state and creating a Facturacion record must require an explicit facturacion permission (or admin:full), as the dedicated /api/facturacion endpoints do.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:17` — POST orden-pago dispatch: Slug router maps POST /api/solicitudes/orden-pago to solicitudesController.ordenPago.
- *( propagation )* `src/controllers/solicitudes.controller.ts:151` — ordenPago: Only `const session = await getSession()` and a presence check are performed; the body solicitudId is then forwarded with no permission or ownership check.
- *( propagation )* `src/infrastructure/persistence/solicitudes-repository.ts:350` — marcarOrdenPago: prisma.solicitud.update sets estado = PENDIENTE_PAGO for the supplied id.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:363` — marcarOrdenPago: prisma.facturacion.create({ data: { solicitudId, tipo: MANUAL, montoTotal, moneda } }) creates the invoice for any target solicitud.

**Evidence:**
- `src/middleware.ts:28` — solicitudes:view is the only gate for /api/solicitudes, which serves orden-pago.
- `src/middleware.ts:21` — The dedicated billing endpoints require facturacion:view, confirming that billing actions are meant to be permission-restricted.
- `src/lib/shared/constants.ts:212` — The `cliente` role holds solicitudes:view and therefore reaches orden-pago.
- `src/infrastructure/persistence/solicitudes-repository.ts:368` — The created Facturacion record uses a montoTotal derived from the stand data, so the caller influences financial records.

**Conditions:**
- (authentication_level) Any session with solicitudes:view is sufficient; the customer role qualifies.
- (system_configuration) The solicitud must be in a state the repository does not otherwise restrict; marcarOrdenPago performs no state guard.

**Attacker perspective:** An authenticated customer who wants to force another solicitud into the billing pipeline or create an invoice.

**Payloads / inputs:**
- `POST /api/solicitudes/orden-pago {"solicitudId":"<victimSolicitudUuid>"}`

**Bounded instructions:**
1. Authenticate as any holder of solicitudes:view.
1. Obtain a target solicitud UUID.
1. POST /api/solicitudes/orden-pago and observe the estado change to pendiente_pago and the new Facturacion row.

**Observed result:** Source analysis establishes that the controller only asserts a session and then writes the estado and a Facturacion row keyed by the supplied id with no facturacion permission or owner predicate.

**Remediation:** Require facturacion:view (or admin:full, optionally validated against the DB) in ordenPago, and verify that the solicitud belongs to the caller when the caller is a customer; alternatively move the action under /api/facturacion.

`src/controllers/solicitudes.controller.ts`:
```
async ordenPago(request: Request): Promise<NextResponse> {
    const session = await getSession();
    if (!session) return error(API_ERROR_CODES.UNAUTHORIZED, "No autorizado", 401);
    if (!session.permissions.includes("facturacion:view") && !session.permissions.includes("admin:full")) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permisos de facturacion", 403);
    }
    const raw = await request.json() as { solicitudId: string };
    ...
  }
```

**Severity:** likelihood=high (A single POST from any customer session is enough; no billing role is required.) · impact=medium (Integrity of the billing pipeline is compromised (arbitrary solicitudes moved to pending payment and invoices created), though no direct funds are moved by this call.) · overall=medium · confidence=high

---

## MEDIUM — POST /api/solicitudes/reevaluar lets any solicitudes:view holder create a re-evaluation on any solicitud

**Fingerprint:** `solicitudes.reevaluar.missing-owner-and-permission`

**Description:** solicitudesController.reevaluar checks only for a session, then verifies there is no pending re-evaluation and calls repo.crearReevaluacion with the attacker-supplied solicitudId, motivo and documentos (solicitudes.controller.ts:106-119). There is no ownership check, no permission check beyond solicitudes:view, and no existence check on the solicitud beyond a foreign-key write. The stored documentos are later copied into Solicitud.documentos on approval (solicitudes-repository.ts:310-312), so a customer can inject arbitrary document URLs and workflow state into another owner's solicitud.

**Root cause:** The re-evaluation creation path forwards the caller-supplied solicitudId, motivo and documentos straight to the repository, which creates the row keyed only on that id, with no session-derived owner/permission binding.

**Intended behavior:** Creating a re-evaluation should be restricted to the solicitud's owner (session.sub) or an entitled reviewer, and should validate the target's existence and state.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:14` — POST reevaluar dispatch: Slug router maps POST /api/solicitudes/reevaluar to solicitudesController.reevaluar.
- *( propagation )* `src/controllers/solicitudes.controller.ts:115` — reevaluar: await services.solicitudes.repo.crearReevaluacion(raw.solicitudId, PENDIENTE, raw.motivo ?? null, raw.documentos ?? [], session.email) — only the session email is used; no ownership/permission check.
- *( propagation )* `src/infrastructure/persistence/solicitudes-repository.ts:286` — crearReevaluacion: prisma.reevaluacion.create({ data: { solicitudId, estado, motivo, documentos, createdBy } }) writes for any existing solicitud id.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:311` — atenderReevaluacionAprobacion: On approval the attacker-supplied documentos array is copied into solicitud.documentos, persisting it into the victim record.

**Evidence:**
- `src/middleware.ts:28` — The /api/solicitudes prefix requires only solicitudes:view.
- `src/lib/shared/constants.ts:212` — The `cliente` role holds solicitudes:view, so customers can call reevaluar.
- `src/controllers/solicitudes.controller.ts:112` — The only gate besides the session is tieneReevaluacionPendiente; no owner or area check is present.
- `src/infrastructure/persistence/solicitudes-repository.ts:287` — documentos is stored as caller-supplied JSON with no validation.

**Conditions:**
- (authentication_level) Any session with solicitudes:view is sufficient.
- (data_state) The target solicitud must exist and not already have a pending re-evaluation.

**Attacker perspective:** An authenticated customer who wants to tamper with another party's solicitud workflow or inject documents into it.

**Payloads / inputs:**
- `POST /api/solicitudes/reevaluar {"solicitudId":"<victimUuid>","motivo":"re-evaluacion","documentos":["https://attacker.example/x.pdf"]}`

**Bounded instructions:**
1. Authenticate as any holder of solicitudes:view.
1. Obtain a target solicitud UUID without a pending re-evaluation.
1. POST /api/solicitudes/reevaluar and observe that the reevaluacion row is created for that solicitud with the caller as createdBy.

**Observed result:** Source analysis establishes that the handler performs no owner/permission comparison and the repository creates a Reevaluacion linked to the supplied solicitudId, so any solicitudes:view holder can create re-evaluations for other owners.

**Remediation:** Load the solicitud, require that either session.sub equals its userId or the caller holds an internal review/admin permission, and validate that the solicitud exists and is in a re-evaluable state before creating the reevaluacion.

`src/controllers/solicitudes.controller.ts`:
```
const detalle = await services.solicitudes.detalle(raw.solicitudId);
    if (!detalle) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    const esRevisor = session.permissions.some((p) => p.startsWith("solicitudes:review:") || p === "admin:full");
    if (!esRevisor && detalle.userId !== session.sub) {
      return error(API_ERROR_CODES.FORBIDDEN, "No puedes re-evaluar solicitudes de otro usuario", 403);
    }
```

**Severity:** likelihood=high (Reachable from any customer session with a known/enumerable solicitud UUID and a single POST.) · impact=medium (Allows cross-owner workflow tampering and injection of attacker-chosen document URLs into another party's solicitud record.) · overall=medium · confidence=high

---

## MEDIUM — POST /api/solicitudes/upload-doc attaches a document to any solicitud id without owner binding

**Fingerprint:** `solicitudes.upload-doc.missing-owner-binding`

**Description:** solicitudesController.uploadDocumento requires a session and then calls services.solicitudes.uploadDocumento with the caller-supplied solicitudId and url (solicitudes.controller.ts:200-213). The application service computes only whether the caller is admin/upload and sets the new document's userId accordingly, then calls repo.crearDocumentoAdjunto without ever verifying that the target solicitud belongs to the caller (solicitudes-service.ts:84-98), and the repository creates the row keyed only on the supplied solicitudId (solicitudes-repository.ts:413-417). The sibling modificar path (controller.ts:94) and eliminarDocumento (service.ts:105-110) do enforce ownership, demonstrating the intended invariant. Any `cliente` (constants.ts:212) can therefore attach arbitrary document URLs to another customer's solicitud.

**Root cause:** uploadDocumento authorizes only that a session exists and derives the document's userId from the caller, but never checks the parent solicitud's owner (or the caller's reviewer scope) before creating the child record.

**Intended behavior:** The service must load the solicitud and deny the write unless the caller is the owner (session.sub equals Solicitud.userId) or holds an internal upload/review permission, mirroring the checks used by modificar and eliminarDocumento.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:18` — POST upload-doc dispatch: Slug router maps POST /api/solicitudes/upload-doc to solicitudesController.uploadDocumento.
- *( propagation )* `src/controllers/solicitudes.controller.ts:206` — uploadDocumento: The controller forwards raw.solicitudId and raw.url to services.solicitudes.uploadDocumento after only a session presence check; it never loads the solicitud.
- *( propagation )* `src/application/solicitudes/solicitudes-service.ts:92` — uploadDocumento: isAdmin is computed from permissions and used only to null out the document's userId; the solicitudId is passed to the repository unverified.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:414` — crearDocumentoAdjunto: prisma.solicitudDocumento.create({ data: { solicitudId, url, nombre, uploadedBy, userId } }) inserts the document into any solicitud id.

**Evidence:**
- `src/middleware.ts:28` — Only solicitudes:view gates /api/solicitudes, so any customer can call upload-doc.
- `src/lib/shared/constants.ts:212` — The `cliente` role holds solicitudes:view.
- `src/application/solicitudes/solicitudes-service.ts:107` — eliminarDocumento enforces doc.userId === userSub (or admin), showing that ownership binding is expected in this feature.
- `src/controllers/solicitudes.controller.ts:94` — modificar enforces the owner check that uploadDocumento omits.

**Conditions:**
- (authentication_level) Any session with solicitudes:view suffices.
- (data_state) A target solicitud id must exist; ids are enumerable through the unscoped listar endpoint.

**Attacker perspective:** An authenticated customer who wants to attach documents to another company's solicitud or tamper with its file list.

**Payloads / inputs:**
- `POST /api/solicitudes/upload-doc {"solicitudId":"<victimUuid>","url":"https://attacker.example/contracto.pdf","nombre":"contrato.pdf"}`

**Bounded instructions:**
1. Authenticate as any holder of solicitudes:view.
1. Obtain a target solicitud UUID.
1. POST /api/solicitudes/upload-doc and then load the victim's solicitud detail to observe the injected document.

**Observed result:** Source analysis establishes that the service never loads or owner-checks the solicitud and the repository inserts the SolicitudDocumento for the supplied id, so a document is attached to another owner's record.

**Remediation:** In uploadDocumento, load the solicitud and require ownership (session.sub equals Solicitud.userId) unless the caller holds an internal upload/review permission; reject with FORBIDDEN/NOT_FOUND otherwise.

`src/application/solicitudes/solicitudes-service.ts`:
```
async uploadDocumento(params: {...}): Promise<Record<string, unknown>> {
    const sol = await this.repo.detalle(params.solicitudId);
    if (!sol) throw new DomainError("Solicitud no encontrada", API_ERROR_CODES.NOT_FOUND, 404);
    const isAdmin = params.userPermissions.includes("admin:full") || params.userPermissions.includes("solicitudes:upload");
    if (!isAdmin && sol.userId !== params.userSub) {
      throw new DomainError("No puedes adjuntar documentos a solicitudes de otro usuario", API_ERROR_CODES.FORBIDDEN, 403);
    }
    return this.repo.crearDocumentoAdjunto(params.solicitudId, params.url, params.nombre, isAdmin ? null : params.userSub, params.userEmail);
  }
```

**Severity:** likelihood=high (A single POST from any customer session attaches a document; target ids are enumerable.) · impact=medium (Cross-owner integrity violation of the document set used in the review workflow and shown to the owner and reviewers; it does not by itself expose data.) · overall=medium · confidence=high

---

## MEDIUM — Unauthenticated, unbounded writes to the ErrorLog table

**Fingerprint:** `errors/log/unauth-unbounded-errorlog-insert`

**Description:** POST /api/errors/log is not covered by any PROTECTED prefix or public list, so the middleware falls through to NextResponse.next() (middleware.ts:72) and the route is anonymous. The handler accepts message/stack/digest/url/metadata, treats the session as optional (route.ts:21), and inserts a row with no per-field length cap, deduplication, rate limit or retention policy (error-logger.ts:16); the ErrorLog model stores unbounded String/Json columns (schema.prisma:398-410). An anonymous client can therefore grow the table without limit, and nginx only weakly bounds a single request at 50M (nginx.conf:17) without bounding cardinality.

**Root cause:** /api/errors is absent from PROTECTED and the public lists, the route never rejects a missing session, and neither the route nor errorLogger.log enforces size, dedup, rate or retention limits.

**Intended behavior:** An append-only error store that can be reached without authentication must at least bound per-record size and total cardinality/retention, or be restricted to authenticated clients; the current design provides neither.

**Trace:**
- *( entrypoint )* `src/middleware.ts:72` — middleware fall-through: /api/errors matches no PROTECTED entry or public list, so the request proceeds unauthenticated.
- *( propagation )* `src/app/api/errors/log/route.ts:21` — optional session: getSession().catch(() => null) is used only to attach an optional userId; the handler does not require a session.
- *( sink )* `src/lib/server/error-logger.ts:16` — prisma.errorLog.create: Caller-controlled strings/JSON are persisted with no length, dedup, rate or retention enforcement.

**Evidence:**
- `src/middleware.ts:12` — PROTECTED contains no /api/errors entry, and PUBLIC_API_ROUTES/PUBLIC_API_PREFIXES do not list it either.
- `src/app/api/errors/log/route.ts:17` — The only input check is that message is truthy; stack, digest, url and metadata are unbounded.
- `prisma/schema.prisma:398` — ErrorLog fields message/stack/digest/url are unbounded String and metadata is unbounded Json.
- `docker/nginx.conf:17` — client_max_body_size 50M limits a single request body only; it does not bound the number of records or retention.

**Conditions:**
- (network_routing) The route must be internet-reachable (Next.js App Router handler served by nginx), which the deployment exposes.
- (data_state) Sustained impact requires repeated requests to accumulate rows; a single request already creates attacker-controlled rows.

**Attacker perspective:** An anonymous internet client with no account.

**Payloads / inputs:**
- `{"message":"<large repeated string>","metadata":{"k":"<arbitrary>"}}`

**Bounded instructions:**
1. Send POST /api/errors/log with an arbitrary message (and optional stack/url/metadata) without a session cookie.
1. Repeat the request to accumulate rows.

**Observed result:** Source analysis establishes that the request passes the middleware fall-through, no session is required, and a row is inserted for every call; the table has no retention or cardinality bound.

**Remediation:** Either require authentication for /api/errors/log or, if it must remain open for client error capture, enforce a max body/message length, drop server-authoritative or oversized fields, apply per-IP rate limiting and a retention/rollover policy on error_log.

`src/app/api/errors/log/route.ts`:
```
if (typeof body.message !== "string" || body.message.length > 2000) {
    return error(API_ERROR_CODES.VALIDATION, "message invalido", 400);
  }
  const stack = typeof body.stack === "string" ? body.stack.slice(0, 8000) : undefined;
  // plus per-IP rate limiting and scheduled error_log retention
```

**Severity:** likelihood=high (The endpoint is anonymous and unconditional; any client can trigger inserts at will.) · impact=medium (The demonstrated effect is unbounded storage growth and data pollution in error_log (and of any dashboard reading it), with potential availability/storage exhaustion; nginx caps an individual body but not the number of rows.) · overall=medium · confidence=high

---

## MEDIUM — Unescaped attacker input interpolated into HTML notification emails

**Fingerprint:** `email/templates/unescaped-html-interpolation`

**Description:** The reservation flow accepts unauthenticated, unbounded string fields (razonSocial, tipoDocumento, numeroDocumento) and interpolates them verbatim into HTML email bodies. The admin notification built by buildAdminNotificacionEmail embeds them into a table cell and the subject, and the client confirmation email does the same. No HTML escaping or output encoding is applied anywhere between the request and the Resend `html` field, so an anonymous submitter can inject markup into the email that IIMP administrators receive, enabling spoofed content and links inside a message that appears to originate from the platform.

**Root cause:** buildReservaConfirmationEmail and buildAdminNotificacionEmail in src/lib/server/email.ts concatenate request-derived strings directly into HTML template literals without escaping, and buildRevisionEmail in src/lib/server/email-templates.ts interpolates opts.mensaje the same way; no escaping helper is applied on the path.

**Intended behavior:** Any value derived from a caller should be HTML-encoded (or assembled through a context-aware template that escapes) before it is placed in an HTML email body or subject, so injected markup stays inert text.

**Trace:**
- *( entrypoint )* `src/app/api/reservas/[...slug]/route.ts:6` — POST /api/reservas/crear dispatch: createRouter maps the anonymous POST to reservaController.crear; the route is not in PROTECTED, so an unauthenticated caller reaches it.
- *( propagation )* `src/controllers/reserva.controller.ts:12` — reservaRequestSchema.parse(raw): The caller body is parsed by reservaRequestSchema, whose razonSocial/tipoDocumento/numeroDocumento are unbounded z.string() values copied into the reserva request.
- *( propagation )* `src/application/reservas/reserva-service.ts:95` — emailData construction: request.datos.razonSocial and the composed documento string are placed into emailData and passed to both email builders.
- *( sink )* `src/lib/server/email.ts:144` — buildReservaConfirmationEmail HTML table cell: emailData.razonSocial is concatenated into an HTML table cell; lines 143 and 145 also interpolate standCodes and documento, and the admin builder repeats the same raw values.

**Evidence:**
- `src/lib/server/email.ts:144` — Razon social interpolated raw into the confirmation HTML body.
- `src/lib/server/email.ts:178` — Admin notification interpolates the same attacker-supplied razonSocial raw.
- `src/lib/server/email.ts:180` — Attacker-supplied emailCliente interpolated raw into the admin email.
- `src/application/reservas/reserva-service.ts:108` — The admin notification is sent to ADMIN_EMAIL when it differs from the contact address (reserva-service.ts:106-108).
- `src/validators/reserva.validator.ts:6` — razonSocial/tipoDocumento/numeroDocumento accepted as unbounded strings.
- `src/lib/server/email-templates.ts:22` — opts.mensaje interpolated raw in the personalizado template (reviewer-supplied path).

**Conditions:**
- (authentication_level) anonymous: /api/reservas is not in the middleware PROTECTED list, so no session is required.
- (user_interaction) an administrator must open the delivered notification email for the injected markup to render.
- (third_party_dependency) delivery depends on RESEND_API_KEY being configured; the HTML is submitted to Resend as-is.

**Attacker perspective:** Unauthenticated network client submitting a stand reservation.

**Payloads / inputs:**
- `POST /api/reservas/crear body {"standIds":["<existing-stand-id>"],"datos":{"razonSocial":"<b>IIMP</b><a href=\"https://evil.example\">Ver contrato</a>","tipoDocumento":"DNI","numeroDocumento":"12345678","email":"attacker@example.com"}} with no Cookie header`

**Bounded instructions:**
1. Send POST /api/reservas/crear with the payload above and no token cookie.
1. Observe that reservaRequestSchema.parse accepts the markup as a plain string and that no escaping is applied.
1. Follow the value from reserva-service.ts:95 into buildAdminNotificacionEmail and into the html field handed to Resend; it appears inside the HTML table cell unencoded.

**Observed result:** Not executed (no OS-enforced sandbox on the audit host); the source trace deterministically shows the attacker-controlled razonSocial and documento strings are concatenated unescaped into the HTML body sent to ADMIN_EMAIL, so the admin notification contains attacker markup rather than inert text.

**Remediation:** HTML-escape every caller-derived value at the interpolation point (one escapeHtml helper used by buildReservaConfirmationEmail, buildAdminNotificacionEmail, and buildRevisionEmail), or move the templates to a context-aware auto-escaping renderer; add a regression test asserting that '<' is emitted as &lt; in the admin body.

**Severity:** likelihood=high (the reservation endpoint is unauthenticated and the injected fields have no length or charset constraints, so a single request is sufficient.) · impact=medium (attacker-controlled HTML and links render inside a notification email recipients trust as platform-originated; impact is content and link spoofing (phishing), not code execution.) · overall=medium · confidence=high

---
