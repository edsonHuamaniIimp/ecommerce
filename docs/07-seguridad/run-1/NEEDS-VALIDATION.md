# Needs Validation — ContratosStands (run 1)

Prioritized source-grounded leads with an exact unresolved fact. **No severity is assigned** and none of these is a confirmed vulnerability. Resolve each with the bounded local and/or owner-observed plan below; never send audit traffic to a deployment.

## Authenticated auspicios caller can relay an unvalidated body to the privileged KBServicios saveauspicio endpoint

**Fingerprint:** `auspicios/grabar/unvalidated-body-to-privileged-kbs`

**Description:** POST /api/auspicios/grabar requires a session plus the auspicios:view permission (middleware.ts:29 and route.ts:9-10), then forwards the caller-supplied JSON verbatim to the legacy KBServicios endpoint with the server-side x-api-key (route.ts:13-18). The sibling /api/auspicios/listar constrains the body to code/codeEvent (listar/route.ts:13-14), showing the authoring intent that the downstream contract is narrow, but grabar applies no schema. Whether the unchecked residual fields let a non-privileged caller change privileged auspicio state cannot be decided from the repository because the downstream /rest/saveauspicio contract is absent; the candidate therefore remains unvalidated.

**Claimed root cause:** grabar/route.ts parses the body with no Zod/DTO allowlist and passes JSON.stringify(body) unmodified to `${KBS_URL}/rest/saveauspicio` under the server-side KBSERVICIOS_API_KEY, unlike listar which validates code/codeEvent.

**Trace:**
- *( entrypoint )* `src/middleware.ts:29` — PROTECTED entry for /api/auspicios: Requests to /api/auspicios require authentication and the auspicios:view permission, so the caller is an authenticated internal-area user rather than anonymous.
- *( propagation )* `src/app/api/auspicios/grabar/route.ts:13` — POST handler body parsing: The raw request.json() value is taken with no schema parse or field allowlist.
- *( sink )* `src/app/api/auspicios/grabar/route.ts:17` — outbound fetch to KBServicios: JSON.stringify(body) is posted to ${KBS_URL}/rest/saveauspicio with the server-side x-api-key header, so all caller-controlled keys reach the privileged downstream service.

**Evidence:**
- `src/app/api/auspicios/grabar/route.ts:6` — API_KEY is read from process.env.KBSERVICIOS_API_KEY and injected as x-api-key on the outbound call.
- `src/app/api/auspicios/grabar/route.ts:13` — const body = await request.json() with no validation before the downstream call.
- `src/app/api/auspicios/listar/route.ts:14` — The sibling listar endpoint requires code and codeEvent, evidencing that the downstream auspicio contract is field-scoped while grabar is not.
- `src/middleware.ts:29` — The strongest source-visible control is session + auspicios:view; no per-field or role-scope restriction exists.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- The downstream /rest/saveauspicio contract (accepted fields and which of them change privileged state beyond the caller's own auspicio) is not present anywhere in the repository, so the boundary violation cannot be established from source alone.
- Whether AUSPICIOS_API_URL/KBSERVICIOS_API_KEY are configured and what authorization KBServicios applies to unexpected fields are deployment facts.

**Resolution plan:**
- *Owner-observed:* An owner or operator of the KBServicios service confirms, from the /rest/saveauspicio contract or service configuration, which fields the endpoint accepts, whether unrecognized keys are ignored, and which accepted fields can change privileged auspicio state beyond the caller own auspicio; this is a documentation/configuration review and no request is sent to the running service.

---

## JWT signed/verified with a hardcoded fallback secret when JWT_SECRET is unset

**Fingerprint:** `auth.jwt.fallback-secret`

**Description:** The signing/verifying module falls back to the constant "dev-secret-cambiar-en-produccion" (auth.ts:9) and the event-selection path falls back to a different constant "dev-secret" (auth-service.ts:53). If the deployment does not set JWT_SECRET, tokens are signed with a publicly known key. .env.prod.example ships JWT_SECRET empty while Dockerfile.ecs bakes only a build-time placeholder, so whether the fallback is live is a deployment fact.

**Claimed root cause:** Hardcoded fallback secrets for HS256 signing/verification, plus a divergent fallback in seleccionarEvento, with no startup assertion that JWT_SECRET is configured.

**Trace:**
- *( entrypoint )* `src/app/api/auth/[...slug]/route.ts:10` — POST /api/auth/login: Issues a signed session token via signToken.
- *( propagation )* `src/lib/server/auth.ts:9` — SECRET initialization: Falls back to a hardcoded constant when process.env.JWT_SECRET is undefined.
- *( sink )* `src/lib/server/auth.ts:41` — signToken: Signs (and verifyToken verifies) with the resolved secret.

**Evidence:**
- `src/lib/server/auth.ts:9` — Hardcoded fallback secret used for all HS256 signing/verification.
- `src/application/auth/auth-service.ts:53` — Divergent fallback secret "dev-secret" in seleccionarEvento's jwtVerify.
- `.env.prod.example:29` — JWT_SECRET is shipped empty, so a missing value is plausible.
- `Dockerfile.ecs:37` — Bakes only a build-time placeholder JWT_SECRET.
- `docs/01-despliegue/arquitectura-aws.md:268` — Documents JWT_SECRET as coming from Secrets Manager, i.e. the real value is a deployment fact.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- the deployed JWT_SECRET value (and whether it is actually configured) is a deployment fact not visible in repository source

**Resolution plan:**
- *Local (bounded fixture):* In a controlled environment with an OS-enforced sandbox, launch the app with JWT_SECRET unset and unset/empty .env.prod, then sign a token with the hardcoded fallback constant and replay it against a protected route to confirm the fallback is used; do not execute target code on an unsandboxed host.
- *Owner-observed:* An owner inspects the ECS task definition or the resolved docker-compose .env.prod to confirm whether JWT_SECRET is set to a non-empty, strong value distinct from the Dockerfile.ecs build-time placeholder and the hardcoded fallback; this is a configuration inspection only, with no token presented to the running service.

---

## PATCH /api/facturacion/actualizar spreads an unvalidated body into the Prisma update

**Fingerprint:** `facturacion.actualizar.unvalidated-body-mass-assignment`

**Description:** The actualizar controller destructures only id out of the parsed JSON and forwards the remaining object, cast to a narrow type at compile time but never validated at runtime, through the application service into prisma.facturacion.update({ where: { id }, data }). Extra keys such as estado, solicitudId, montoTotal, moneda, modoPago or flgActivo therefore reach the ORM and are written. Exploitation still requires a principal that can pass the /api/facturacion facturacion:view gate, which no static non-admin role holds.

**Claimed root cause:** auth pattern: the controller performs an unchecked `as` cast of request.json() (no Zod/schema parse), the service signature types data as `{ tipo?: string }` but forwards it unchanged, and the repository passes the whole object to prisma.facturacion.update.

**Trace:**
- *( entrypoint )* `src/app/api/facturacion/[...slug]/route.ts:15` — PATCH actualizar dispatch: Slug router maps PATCH actualizar to facturacionController.actualizar.
- *( propagation )* `src/controllers/facturacion.controller.ts:53` — actualizar: const { id, ...data } = (await request.json()) as { id: string; tipo?: string } - a compile-time cast with no runtime validation.
- *( propagation )* `src/application/facturacion/facturacion-service.ts:22` — actualizar: data is typed { tipo?: string } but passed through to this.repo.actualizar(id, data, createdBy) unchanged.
- *( sink )* `src/infrastructure/persistence/facturacion-repository.ts:123` — actualizar: prisma.facturacion.update({ where: { id }, data }) writes every attacker-supplied key that matches a Facturacion column.

**Evidence:**
- `src/middleware.ts:21` — Only facturacion:view gates /api/facturacion, so the reachable caller set equals holders of that permission.
- `src/lib/shared/constants.ts:209` — facturacion:view is statically granted only to admin, leaving reachability of a non-admin principal unproven.
- `prisma/schema.prisma:412` — Facturacion update input admits estado, solicitudId, montoTotal, moneda, modoPago and flgActivo, the columns the unchecked object can overwrite.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- Whether any deployed or custom-created non-admin role holds facturacion:view is a database/deployment fact; no static non-admin role does.
- A concrete overwrite of a victim invoice requires a target Facturacion row id in the deployed database (data-state fact).

**Resolution plan:**
- *Local (bounded fixture):* Authenticate as a facturacion:view holder and send PATCH /api/facturacion/actualizar with body {"id":"<invoiceId>","estado":"pagado","montoTotal":1} ; then read the row back and confirm the unintended columns changed.
- *Owner-observed:* Confirm whether a non-admin role with facturacion:view is provisioned, since admin already holds admin:full and is not a privilege-escalation target.

---

## Billing mutations addressed only by record id lack owner/event binding

**Fingerprint:** `facturacion.agregar-cuota.actualizar.eliminar.eliminar-cuota.unbound-by-id`

**Description:** POST /api/facturacion/agregar-cuota, PATCH /api/facturacion/actualizar, DELETE /api/facturacion/eliminar and POST /api/facturacion/eliminar-cuota authenticate the caller with getSession() but then read/write the target Facturacion or FacturacionCuota strictly by the caller-supplied id, with no predicate binding the record to the caller's solicitud/empresa/event. The middleware requires only the facturacion:view permission for the whole /api/facturacion prefix, and the read path listar() does narrow by eventoId while the mutation paths do not. If any non-admin principal holds facturacion:view in the deployed role set, that principal can add or delete installments and soft-delete any invoice.

**Claimed root cause:** Repository mutation methods key only on the supplied id (findFirst/create/update/delete by facturacionId or id) with no owner or event predicate, while the sibling listar() read applies an eventoId predicate; controllers forward only the body/query id plus session.email.

**Trace:**
- *( entrypoint )* `src/app/api/facturacion/[...slug]/route.ts:10` — POST agregar-cuota dispatch: Slug router maps agregar-cuota, pagar-cuota and eliminar-cuota (POST) plus actualizar/eliminar to the facturacion controller.
- *( propagation )* `src/controllers/facturacion.controller.ts:37` — agregarCuota: getSession() then service.agregarCuota(facturacionId, ...) using the raw request body id with no ownership or event lookup.
- *( propagation )* `src/infrastructure/persistence/facturacion-repository.ts:93` — agregarCuota: prisma.facturacionCuota.create({ data: { facturacionId, numero, monto, fechaVencimiento } }) inserts an installment into any invoice id supplied by the caller.
- *( propagation )* `src/infrastructure/persistence/facturacion-repository.ts:123` — actualizar: prisma.facturacion.update({ where: { id }, data }) updates any invoice by id.
- *( propagation )* `src/infrastructure/persistence/facturacion-repository.ts:132` — eliminar: prisma.facturacion.update({ where: { id }, data: { flgActivo: false } }) soft-deletes any invoice by id.
- *( sink )* `src/infrastructure/persistence/facturacion-repository.ts:141` — eliminarCuota: prisma.facturacionCuota.delete({ where: { id: cuotaId } }) deletes any installment by id after a findUnique by the same id.

**Evidence:**
- `src/middleware.ts:21` — Only facturacion:view gates the entire /api/facturacion prefix; there is no per-record or per-owner scope.
- `src/lib/shared/constants.ts:209` — ROLES_PERMISSIONS grants facturacion:view to no static non-admin role: the admin list (lines 183-208) includes it while logistica, legal, comunicacion and cliente do not.
- `src/infrastructure/persistence/facturacion-repository.ts:10` — listar() demonstrates the intended event-scoping pattern (eventoId predicate) that the mutation methods omit.
- `prisma/schema.prisma:412` — Facturacion has solicitudId, tipo, estado, montoTotal, moneda, modoPago and flgActivo but no caller-owner column, so scope must derive from the parent solicitud/event.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- Whether any deployed or custom-created non-admin role holds facturacion:view is a database/deployment fact; src/lib/shared/constants.ts grants it statically only to admin, so a reachable non-admin principal is not established from source.
- Cross-owner effect requires a victim Facturacion/FacturacionCuota row belonging to another solicitud/event to exist in the deployed database (data-state fact).

**Resolution plan:**
- *Local (bounded fixture):* With a running app and seeded DB, issue a non-admin session whose role includes facturacion:view, then call POST /api/facturacion/agregar-cuota (and PATCH /actualizar, DELETE /eliminar, POST /eliminar-cuota) with the id of an invoice created by a different user and confirm the mutation succeeds.
- *Owner-observed:* Inspect the deployed role/permission tables to determine whether any non-admin role is granted facturacion:view and whether such a role can be created/assigned through roles:manage.

---

## Niubizz payment confirmation ignores the gateway authorization result before marking a cuota paid

**Fingerprint:** `facturacion.niubizz.confirmar.unverified-payment`

**Description:** confirmarPago awaits niubizzClient.autorizar(...) but never inspects the returned value, then unconditionally calls facturacionRepo.pagarCuota, which can move the installment, parent invoice and solicitud to PAGADO. It also builds the authorization key from cuota.respuesta_api, a field that detalle() never returns, and passes a fresh String(Date.now()) purchase number, so the authorization is not demonstrably bound to the invoice. Whether a declined authorization is distinguishable from a success depends on the external proxy's HTTP-status versus body semantics, which are not source-visible.

**Claimed root cause:** NiubizzApplicationService.confirmarPago discards the autorizar() result and proceeds to pagarCuota(); niubizz-client postJson() throws only on a non-2xx response and does not examine a success/failure field; the controller calls the flow without getSession().

**Trace:**
- *( entrypoint )* `src/app/api/facturacion/niubizz/confirmar/route.ts:3` — POST /api/facturacion/niubizz/confirmar: Route directly exports niubizzController.confirmarPago; access is governed only by the middleware /api/facturacion prefix gate.
- *( propagation )* `src/controllers/niubizz.controller.ts:33` — confirmarPago: Reads facturacionId and transactionToken from the body with no getSession() call and forwards them to the service.
- *( propagation )* `src/application/facturacion/niubizz-service.ts:44` — confirmarPago: await niubizzClient.autorizar({ key: cuotaPendiente.respuesta_api ?? "", amount, transactionToken, purchaseNumber: String(Date.now()) }) - the result is not assigned or inspected.
- *( propagation )* `src/application/facturacion/niubizz-service.ts:52` — confirmarPago: this.facturacionRepo.pagarCuota(cuotaPendiente.id, "niubizz", null) runs unconditionally and marks the installment paid.
- *( sink )* `src/infrastructure/persistence/facturacion-repository.ts:113` — pagarCuota cascade: The repository can cascade facturacion and solicitud to PAGADO once the last installment is marked.

**Evidence:**
- `src/infrastructure/external/niubizz-client.ts:29` — Only `if (!res.ok) throw` is checked; a 200 response with a failure body is returned to callers as-is and never inspected.
- `src/infrastructure/persistence/facturacion-repository.ts:82` — detalle() maps only id/numero/monto/fechaVencimiento/estado/comprobante, so respuesta_api is always undefined and the authorization key is the empty string.
- `src/domain/ports/facturacion-repository.ts:12` — The port's cuota shape omits respuesta_api, confirming the service reads a field that cannot be populated.
- `src/middleware.ts:21` — facturacion:view gates the prefix; no static non-admin role holds it (constants.ts:209).

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- Provider-side behavior is not source-visible: whether Niubizz/IIMP proxy returns a declined authorization as a non-2xx (which would throw and prevent pagarCuota) or as a 2xx body (which would be ignored and allow pagarCuota) cannot be established from the repository.
- Whether IIMP_PROXY_*/NIUBIZZ_* credentials are configured and the proxy is reachable in the deployment is a deployment fact.
- Whether any deployed non-admin role holds facturacion:view is a database/deployment fact.

**Resolution plan:**
- *Local (bounded fixture):* In an OS-enforced sandbox with the app running locally under NODE_ENV not production and no external network, seed one Facturacion with a pending cuota and POST /api/facturacion/niubizz/confirmar with a synthetic transactionToken; confirm that the local mock authorization result is discarded and the cuota is marked PAGADO, showing pagarCuota does not depend on the authorization result.
- *Owner-observed:* The owner provides the documented or previously captured behavior of the IIMP proxy niubiz.php get_authorization branch for a declined transaction (HTTP status and body shape), so it can be determined whether a decline arrives as a non-2xx status (which throws before pagarCuota) or as a 2xx body the code ignores; no live transaction is run.

---

## Niubizz session creation reads any invoice's data by id with no owner/event binding

**Fingerprint:** `facturacion.niubizz.sesion.missing-owner-event-binding`

**Description:** crearSesion checks only getSession() and then loads Facturacion.detalle(facturacionId), a findUnique keyed solely by id with no owner or event predicate. It reads the solicitante PII (nombre, apellidos, telefono) and returns a gateway sessionToken, amount and merchantId to the caller. A non-admin holder of facturacion:view could initiate a payment session for any invoice and learn the invoice's solicitante data and amount.

**Claimed root cause:** detalle() is findUnique({ where: { id } }) with no owner/event predicate, and crearSesion forwards the caller-supplied facturacionId straight into it before querying PII and calling the gateway.

**Trace:**
- *( entrypoint )* `src/app/api/facturacion/niubizz/sesion/route.ts:3` — POST /api/facturacion/niubizz/sesion: Route exports niubizzController.crearSesion; /api/facturacion is gated by facturacion:view in middleware.
- *( propagation )* `src/controllers/niubizz.controller.ts:15` — crearSesion: getSession() then reads facturacionId from the body and calls niubizzService.crearSesion(facturacionId).
- *( propagation )* `src/application/facturacion/niubizz-service.ts:10` — crearSesion: facturacionRepo.detalle(facturacionId) loads the invoice and its cuotas for any id.
- *( sink )* `src/application/facturacion/niubizz-service.ts:13` — crearSesion PII read: prisma.userRole.findFirst({ where: { email: fact.correoSolicitante } }) fetches the solicitante's nombre/apellidos/telefono and returns session data to the caller.

**Evidence:**
- `src/infrastructure/persistence/facturacion-repository.ts:61` — findUnique({ where: { id } }) with no owner/event predicate, unlike listar() which filters by eventoId.
- `src/middleware.ts:21` — facturacion:view is the only gate for the /api/facturacion prefix.
- `src/lib/shared/constants.ts:209` — No static non-admin role holds facturacion:view.
- `src/controllers/niubizz.controller.ts:20` — Response returns sessionToken, amount and merchantId for the requested invoice.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- Whether any deployed or custom-created non-admin role holds facturacion:view is a database/deployment fact.
- Reading a victim's PII/session requires a third-party Facturacion row and its solicitante user record to exist in the deployed database (data-state fact).

**Resolution plan:**
- *Local (bounded fixture):* Authenticate as a facturacion:view holder and call POST /api/facturacion/niubizz/sesion with another user's facturacionId, confirming the session token/amount and solicitante data are returned.
- *Owner-observed:* Verify whether any non-admin role holds facturacion:view and whether invoice ownership is expected to be enforced per solicitante.

---

## POST /api/facturacion/pagar-cuota settles any installment by id with no owner/event binding

**Fingerprint:** `facturacion.pagar-cuota.missing-owner-event-binding`

**Description:** pagarCuota authenticates only via getSession() and then updates the FacturacionCuota addressed by the request-body cuotaId to PAGADO with no predicate tying the installment to the caller's solicitud/empresa/event. When no pending installments remain it cascades the parent Facturacion and the Solicitud to PAGADO. Because the /api/facturacion prefix requires facturacion:view, a non-admin holder of that permission could settle another party's invoice.

**Claimed root cause:** pagarCuota performs findUnique/update keyed solely by the supplied cuotaId, and its cascade updates facturacion/solicitud by the parent id, with no owner or eventoId predicate; the read path listar() applies an eventoId filter that pagarCuota lacks.

**Trace:**
- *( entrypoint )* `src/app/api/facturacion/[...slug]/route.ts:11` — POST pagar-cuota dispatch: Slug router maps pagar-cuota to facturacionController.pagarCuota.
- *( propagation )* `src/controllers/facturacion.controller.ts:44` — pagarCuota: getSession() then service.pagarCuota(cuotaId, session.email, comprobante) using the raw body cuotaId.
- *( propagation )* `src/infrastructure/persistence/facturacion-repository.ts:102` — pagarCuota: prisma.facturacionCuota.update({ where: { id: cuotaId }, data: { estado: PAGADO } }) settles any installment by id.
- *( sink )* `src/infrastructure/persistence/facturacion-repository.ts:113` — pagarCuota cascade: When no pending installments remain, prisma.facturacion.update and prisma.solicitud.update set both to PAGADO for that parent record.

**Evidence:**
- `src/middleware.ts:21` — facturacion:view is the only gate for the /api/facturacion prefix.
- `src/lib/shared/constants.ts:209` — No static non-admin role holds facturacion:view.
- `src/infrastructure/persistence/facturacion-repository.ts:10` — listar() shows the intended evento/solicitud scoping that pagarCuota omits.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- Whether any deployed or custom-created non-admin role holds facturacion:view is a database/deployment fact.
- Reaching the PAGADO cascade requires a victim invoice with all installments settleable in the deployed database (data-state fact).

**Resolution plan:**
- *Local (bounded fixture):* As a facturacion:view holder, call POST /api/facturacion/pagar-cuota with a cuotaId belonging to a different solicitud and confirm the cuota and parent facturacion/solicitud change state.
- *Owner-observed:* Identify deployed non-admin roles holding facturacion:view and whether payment confirmation is expected to be scoped per solicitante.

---

## TypeScript code generation interpolates stored layout fields without escaping

**Fingerprint:** `planos.exportar-ts.unescaped-codegen`

**Description:** exportarTypeScript builds TypeScript source by raw template interpolation of plano.codigo, nombre, descripcion, tipos[].codigo/label/nombre/color, bloques[].bloqueId/tipoCodigo/tipologia and furniture fields. None of the interpolated values are escaped, and the validators bound length only, not characters, so a double quote or newline stored in a name/code/color can break out of the emitted string/identifier literals. The endpoint is gated by requireAdmin (laboratorio:manage or admin:full) and the generated string is returned as JSON, never evaluated in-repo; impact depends on a downstream consumer compiling the artifact.

**Claimed root cause:** The codegen template literals interpolate database-backed values directly and tsCodegenUtils provides no string/identifier escaping; toConstName only uppercases and replaces hyphens, leaving other characters untouched.

**Trace:**
- *( entrypoint )* `src/app/api/planos/[...slug]/route.ts:11` — GET exportar-ts dispatch: Slug router maps GET exportar-ts to planosController.exportarTs.
- *( propagation )* `src/controllers/planos.controller.ts:94` — exportarTs: requireAdmin() then reads id from the query and calls services.planos.exportarTypeScript(id).
- *( propagation )* `src/application/planos/planos-service.ts:157` — tipos codegen: `${t.codigo}: { w: ${t.w}, d: ${t.d}, h: ${t.h}, color: "${t.color}" },` interpolates codigo and color raw into emitted TS.
- *( propagation )* `src/application/planos/planos-service.ts:184` — items codegen: `{ id: "${b.bloqueId}", ... tipologia: "${b.tipologia ?? ...}", ... }` interpolates bloqueId/tipologia raw.
- *( sink )* `src/application/planos/planos-service.ts:226` — registry codegen: nombre: "${plano.nombre}", descripcion: "${plano.descripcion ?? ""}" interpolate stored free text raw into emitted TS.

**Evidence:**
- `src/lib/shared/utils/ts-codegen.ts:8` — toUnionType joins `"${c}"` with no escaping of quotes/backslashes/newlines.
- `src/validators/planos.validator.ts:22` — planoLayoutSchema constrains codigo/label/nombre/color by length only (z.string().min(1).max(...)), so quote and newline characters pass.
- `src/application/planos/planos-service.ts:154` — toConstName(plano.codigo) is likewise only uppercased with hyphens replaced, so an identifier can contain other injected characters.
- `src/controllers/planos.controller.ts:11` — requireAdmin restricts the endpoint to laboratorio:manage/admin:full holders.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- The generated string is returned as JSON and is not compiled or evaluated anywhere in this repository; whether and how a downstream tree compiles the copied artifact is a deployment/process fact.
- Whether any deployed or custom-created non-admin role holds laboratorio:manage (or admin:full) is a database/deployment fact; the statically privileged caller is already trusted for lab management.

**Resolution plan:**
- *Local (bounded fixture):* As a laboratorio:manage holder, store a plano whose nombre/descripcion/color contains a double quote and newline, call GET /api/planos/exportar-ts, then run the emitted string through tsc to show it is syntactically broken or contains injected statements.
- *Owner-observed:* Establish whether the generated artifact is copied into and compiled by the frontend build, and whether a non-admin principal can hold laboratorio:manage.

---

## Plano import persists layout values bypassing the create/layout schema constraints

**Fingerprint:** `planos.importar.unvalidated-layout`

**Description:** The importar path is gated by requireAdmin (laboratorio:manage or admin:full) but its Zod schema types tipos, bloques and furniture as z.unknown() and codigo as only z.string().min(1), then imports through repo.importar which calls guardarLayout directly, bypassing both planoLayoutSchema and the ^[a-z0-9-]+$ codigo regex enforced by crear(). Unvalidated values therefore reach the persisted layout and any subsequently emitted code. Whether this crosses a trust boundary depends on whether a non-admin holds laboratorio:manage and whether the persisted/emitted layout is consumed by a downstream build.

**Claimed root cause:** planoImportarSchema uses z.unknown() for tipos/bloques/furniture and omits the create/layout regexes, while PlanoPrismaRepository.importar persists via guardarLayout without re-validating the layout or codigo.

**Trace:**
- *( entrypoint )* `src/app/api/planos/[...slug]/route.ts:21` — POST importar dispatch: Slug router maps POST importar to planosController.importar; /api/planos is gated by laboratorio:view in middleware and requireAdmin inside the controller.
- *( propagation )* `src/controllers/planos.controller.ts:104` — importar: requireAdmin() then planoImportarSchema.parse(await request.json()) - the parsed body is cast `as never` and forwarded.
- *( propagation )* `src/validators/planos.validator.ts:54` — planoImportarSchema: tipos: z.array(z.unknown()), bloques: z.array(z.unknown()), furniture: z.array(z.unknown()).default([]), and codigo: z.string().min(1) without the create regex.
- *( sink )* `src/infrastructure/persistence/plano-repository.ts:388` — importar: this.guardarLayout(plano.id, { tipos: data.tipos, bloques: ..., furniture: ... }) persists the unchecked layout directly.

**Evidence:**
- `src/application/planos/planos-service.ts:31` — crear() enforces /^[a-z0-9-]+$/ which importar never applies.
- `src/application/planos/planos-service.ts:146` — importar() checks only that codigo/nombre exist and tipos/bloques are arrays, then delegates to the repository.
- `src/controllers/planos.controller.ts:11` — requireAdmin requires laboratorio:manage or admin:full, a privileged caller set.
- `src/lib/shared/constants.ts:183` — laboratorio:manage is listed only in the admin role's permissions.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- Whether any deployed or custom-created non-admin role holds laboratorio:manage (or admin:full) is a database/deployment fact; requireAdmin otherwise limits the caller to a fully trusted principal.
- Whether the persisted layout is later fed into a build/compile step (documented workflow reportedly copies artifacts into an external frontend tree) is not source-visible in this repository.

**Resolution plan:**
- *Local (bounded fixture):* Authenticate as a laboratorio:manage holder and POST /api/planos/importar with a codigo containing disallowed characters and tipos/bloques of arbitrary shape, then reload the plano and confirm the invalid values persisted.
- *Owner-observed:* Determine whether any non-admin role holds laboratorio:manage and whether an automated process consumes imported/exported plano artifacts in a compiled tree.

---

## Unauthenticated RENIEC DNI lookup under the server-side operator token

**Fingerprint:** `reniec/dni/unauth-paid-pii-lookup`

**Description:** GET /api/reniec/dni validates only the 8-digit format and then calls the external provider api.apis.net.pe with a server-side Bearer token. The route is absent from both PROTECTED and the public allowlists, so middleware lets anonymous callers through, and the controller never establishes a session. The claimed consequence is that an unauthenticated caller can drive operator-credentialed PII lookups and read returned identity data; that consequence depends on provider and deployment facts that source does not establish.

**Claimed root cause:** src/middleware.ts:50-72 lets /api/reniec through because no PROTECTED prefix matches; consultas.controller.ts:23-35 checks only an 8-digit pattern and calls consultasClient.consultarDni, which in consultas-client.ts:9-10 attaches Authorization: Bearer ${SUNAT_API_TOKEN} to the provider request.

**Trace:**
- *( entrypoint )* `src/middleware.ts:50` — PROTECTED prefix loop: No PROTECTED entry prefix-matches /api/reniec and it is not in the PUBLIC lists, so the request passes through to the route.
- *( propagation )* `src/app/api/reniec/[...slug]/route.ts:6` — GET dni dispatch: createRouter dispatches the anonymous GET to reniecController.consultarDni.
- *( propagation )* `src/controllers/consultas.controller.ts:26` — consultarDni format check: Only /^\d{8}$/ is enforced; no getSession or permission check precedes the provider call.
- *( sink )* `src/infrastructure/external/consultas-client.ts:9` — fetchAPI provider request: Issues GET to the fixed DNI URL with Authorization: Bearer ${SUNAT_API_TOKEN}; with the token unset the function throws before calling the provider.

**Evidence:**
- `src/middleware.ts:72` — Unmatched paths fall through to NextResponse.next().
- `src/lib/shared/constants.ts:30` — PUBLIC_API_ROUTES does not include /api/reniec.
- `src/controllers/consultas.controller.ts:26` — Only an 8-digit pattern is validated; no session check.
- `src/infrastructure/external/consultas-client.ts:3` — The operator token is read from SUNAT_API_TOKEN.
- `src/infrastructure/external/consultas-client.ts:24` — consultarDni targets the fixed api.apis.net.pe DNI URL.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- Whether SUNAT_API_TOKEN is provisioned in the deployed task is not source-visible; consultas-client.ts:8 throws before any provider call when it is unset.
- The provider response (whether api.apis.net.pe returns full identity data) and the provider-side authorization are external facts not present in the repository.

**Resolution plan:**
- *Local (bounded fixture):* In an OS-enforced sandbox with an allowlisted empty environment, run the /api/reniec/dni handler against a loopback stub for api.apis.net.pe using a dummy token and assert that an anonymous request with no Cookie reaches the handler and issues the Bearer request; use no external network.
- *Owner-observed:* An owner confirms whether SUNAT_API_TOKEN is configured and observes that an unauthenticated GET /api/reniec/dni?numero=<dummy 8 digits> from outside returns provider data (or 502 when the token is unset) with no token cookie present.

---

## modificar ownership guard short-circuits when Solicitud.userId is null

**Fingerprint:** `solicitudes.modificar.null-owner-bypass`

**Description:** solicitudesController.modificar guards with `if (detalle.userId && detalle.userId !== session.sub && !session.permissions.includes("admin:full"))` (solicitudes.controller.ts:94). Because the ownership comparison is gated on detalle.userId being truthy, a solicitud whose userId is null bypasses the check for every authenticated caller, who can then reset all of its revisions to pendiente (controller.ts:100-102). Solicitud.userId is nullable (schema.prisma:221) and /api/reservas/crear is absent from PROTECTED and the public lists, so the middleware falls through (middleware.ts:72) and reservaController.crear reads an optional session and passes userSub undefined, leading crearSolicitud to write userId: null (solicitudes-repository.ts:265). Null-owner rows are therefore producible, but whether an exploitable row exists in the deployed database — and whether it has completed revisions needed to pass the controller's all-revisions-non-pending guard (controller.ts:97) — is a data-state fact that cannot be established from source.

**Claimed root cause:** The authorization predicate is written as `detalle.userId && ...` instead of denying by default, so a null owner makes the entire ownership comparison vacuously pass; combined with a nullable Solicitud.userId and an unauthenticated reservation path that writes null owners, the deny-by-default invariant is not enforced.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:13` — POST modificar dispatch: Slug router maps POST /api/solicitudes/modificar to solicitudesController.modificar.
- *( propagation )* `src/controllers/solicitudes.controller.ts:94` — modificar ownership guard: if (detalle.userId && detalle.userId !== session.sub && !admin) — a null/falsy owner short-circuits the guard and admits any caller.
- *( propagation )* `src/controllers/solicitudes.controller.ts:101` — modificar revision reset: For each revision the controller calls services.solicitudes.revisar(..., estado: PENDIENTE), resetting the workflow of the target solicitud.
- *( propagation )* `src/controllers/reserva.controller.ts:15` — crear: userEmail/userSub are taken from an optional session (getSession() may return null) and forwarded to reservas.crear.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:265` — crearSolicitud: userId: userId ?? null — solicitudes created through the unauthenticated /api/reservas path persist a null owner.

**Evidence:**
- `prisma/schema.prisma:221` — Solicitud.userId is optional (String? @map("user_id")), so null owners are a valid stored state.
- `src/middleware.ts:72` — /api/reservas matches neither PROTECTED nor the public lists, so the middleware returns NextResponse.next() and the route is anonymous.
- `src/middleware.ts:28` — modificar itself is reachable by any solicitudes:view holder, including `cliente`.
- `src/controllers/solicitudes.controller.ts:97` — modificar refuses while any revision is pendiente, so a null-owner row must have completed its three reviews to be resettable — a data-state precondition.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- Existence of a Solicitud row with userId = NULL in the deployed database (and, per controller.ts:97, one whose revisions are all non-pending) is a data-state fact that cannot be observed from source.
- Whether any such null-owner row belongs to a distinct party (as opposed to an anonymous reservation) determines whether the bypass crosses a real ownership boundary; the repository does not record a creator for null-owner reservations.

**Resolution plan:**
- *Local (bounded fixture):* With a seeded database, insert a Solicitud with userId NULL and three non-pending revisions, then call POST /api/solicitudes/modificar as an unrelated authenticated user with that id and confirm the 403 guard is skipped and the revisions reset.
- *Owner-observed:* Query the deployed solicitud table for rows with user_id IS NULL that have completed revisions, and trace whether the public /api/reservas flow is used to create reservations for logged-out clients.

---

## Unauthenticated SUNAT RUC lookup under the server-side operator token

**Fingerprint:** `sunat.ruc.unauth-operator-credential-pii-lookup`

**Description:** GET /api/sunat/ruc validates only the 11-digit format and then calls the external provider api.apis.net.pe with a server-side Bearer token. The route is absent from both PROTECTED and the public allowlists, so middleware lets anonymous callers through, and the controller never establishes a session. The claimed consequence is that an unauthenticated caller can drive operator-credentialed RUC lookups and read returned business/PII data; that consequence depends on provider and deployment facts that source does not establish.

**Claimed root cause:** src/middleware.ts:50-72 lets /api/sunat through because no PROTECTED prefix matches; consultas.controller.ts:7-19 checks only an 11-digit pattern and calls consultasClient.consultarRuc, which in consultas-client.ts:9-10 attaches Authorization: Bearer ${SUNAT_API_TOKEN} to the provider request.

**Trace:**
- *( entrypoint )* `src/middleware.ts:50` — PROTECTED prefix loop: No PROTECTED entry prefix-matches /api/sunat and it is not in the PUBLIC lists, so the request passes through to the route.
- *( propagation )* `src/app/api/sunat/[...slug]/route.ts:6` — GET ruc dispatch: createRouter dispatches the anonymous GET to sunatController.consultarRuc.
- *( propagation )* `src/controllers/consultas.controller.ts:10` — consultarRuc format check: Only /^\d{11}$/ is enforced; no getSession or permission check precedes the provider call.
- *( sink )* `src/infrastructure/external/consultas-client.ts:9` — fetchAPI provider request: Issues GET to the fixed RUC URL with Authorization: Bearer ${SUNAT_API_TOKEN}; with the token unset the function throws before calling the provider.

**Evidence:**
- `src/middleware.ts:72` — Unmatched paths fall through to NextResponse.next().
- `src/lib/shared/constants.ts:30` — PUBLIC_API_ROUTES does not include /api/sunat.
- `src/controllers/consultas.controller.ts:10` — Only an 11-digit pattern is validated; no session check.
- `src/infrastructure/external/consultas-client.ts:3` — The operator token is read from SUNAT_API_TOKEN.
- `src/infrastructure/external/consultas-client.ts:21` — consultarRuc targets the fixed api.apis.net.pe RUC URL.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- Whether SUNAT_API_TOKEN is provisioned in the deployed task is not source-visible; consultas-client.ts:8 throws before any provider call when it is unset.
- The provider response (whether api.apis.net.pe returns full business/PII data) and the provider-side authorization are external facts not present in the repository.

**Resolution plan:**
- *Local (bounded fixture):* In an OS-enforced sandbox with an allowlisted empty environment, run the /api/sunat/ruc handler against a loopback stub for api.apis.net.pe using a dummy token and assert that an anonymous request with no Cookie reaches the handler and issues the Bearer request; use no external network.
- *Owner-observed:* An owner confirms whether SUNAT_API_TOKEN is configured and observes that an unauthenticated GET /api/sunat/ruc?numero=<dummy 11 digits> from outside returns provider data (or 502 when the token is unset) with no token cookie present.

---

## Unauthenticated file upload with attacker-controlled extension into the public web root

**Fingerprint:** `upload/unauth-extension-to-public-html`

**Description:** POST /api/upload accepts a multipart file with no authentication, derives the stored extension from the caller-supplied file name without an allowlist, and the default storage adapter writes the bytes into public/uploads. nginx serves /uploads/ from the same origin with extension-inferred content type and no nosniff or Content-Disposition. Depending on the active storage provider and serving layer, an anonymous caller can place active content (for example .html or .svg) that a victim's browser executes in the application origin.

**Claimed root cause:** src/middleware.ts leaves /api/upload ungated; src/app/api/upload/route.ts:17 derives the extension from file.name with no allowlist; src/lib/server/storage.ts:12-16 writes to public/uploads by default; docker/nginx.conf:26-30 serves /uploads/ with an extension-based content type and no nosniff or attachment header.

**Trace:**
- *( entrypoint )* `src/middleware.ts:50` — PROTECTED prefix loop: /api/upload matches no PROTECTED entry and is not public, so the anonymous request passes through.
- *( propagation )* `src/app/api/upload/route.ts:7` — POST handler: Reads formData(file) and processes the upload with no session check.
- *( propagation )* `src/lib/server/storage.ts:11` — localAdapter.upload: Writes the buffer to <cwd>/public/uploads/<timestamp>_<random>.<ext>, where ext came from the attacker file name.
- *( sink )* `docker/nginx.conf:26` — location /uploads/: Serves the stored file from /app/public with the mime type inferred from the extension and no X-Content-Type-Options or Content-Disposition.

**Evidence:**
- `src/middleware.ts:12` — No PROTECTED entry matches /api/upload.
- `src/lib/shared/constants.ts:30` — PUBLIC_API_ROUTES does not include /api/upload.
- `src/app/api/upload/route.ts:17` — Extension is file.name.split('.').pop() with no allowlist.
- `src/app/api/upload/route.ts:19` — Content type comes from file.type for the S3 branch.
- `src/lib/server/storage.ts:12` — Default adapter writes to public/uploads.
- `src/lib/server/storage.ts:52` — Provider is local unless STORAGE_PROVIDER=s3.
- `docker/nginx.conf:27` — Only expires and Cache-Control are set; no X-Content-Type-Options or Content-Disposition.
- `docker-compose.prod.yml:52` — The host repo is bind-mounted rw at /app so public/uploads persists and is served.

**Blockers:**
- no OS-enforced sandbox available on the audit host to execute target-controlled code
- The deployed STORAGE_PROVIDER (local vs s3) is not source-visible; the S3 branch returns a bucket/CDN URL and hard-codes public-read, which changes the origin from the app host to the bucket.
- Which serving layer fronts the app in the active deployment (EC2 nginx /app/public, Next static serving of public/, or CloudFront/S3) and therefore the exact response Content-Type are deployment facts not fully established by source.

**Resolution plan:**
- *Local (bounded fixture):* In an OS-enforced sandbox, invoke the POST handler with a bounded multipart fixture whose filename ends in .html and assert the returned path; then request it through the configured static handler and record the Content-Type and the absence of nosniff. Use no external network.
- *Owner-observed:* An owner confirms the deployed STORAGE_PROVIDER and observes that GET https://<host>/uploads/<random>.html returns Content-Type text/html with the uploaded bytes and without X-Content-Type-Options: nosniff or Content-Disposition: attachment.

---
