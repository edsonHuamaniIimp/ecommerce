# Detalle de hallazgos â€” ContratosStands (run 1)

Cada hallazgo confirmado de severidad media o superior, con ruta de origen, reproducciÃ³n acotada (establecida por el cÃ³digo fuente; no se ejecutÃ³ cÃ³digo del objetivo), resultado observado, condiciones y remediaciÃ³n.

## HIGH â€” Cualquier rol autenticado puede ejecutar bÃºsquedas arbitrarias de PII de personas contra el servicio upstream de bÃºsqueda de personas

**Fingerprint:** `entidades/persona/pii-search-any-authenticated-role`

**DescripciÃ³n:** El middleware protege /api/entidades Ãºnicamente mediante autenticaciÃ³n, sin campo de permiso (middleware.ts:30), por lo que todo rol autenticado, incluido `cliente` (constants.ts:212), puede llamar a POST /api/entidades/persona. El controlador toma un documento o nombre arbitrario y lo reenvÃ­a sin modificar al endpoint upstream de bÃºsqueda de personas (entidades.controller.ts:7-18, entidades-client.ts:28-33), devolviendo el conjunto completo de registros PersonaResultDTO (documento, nombres, fecha de nacimiento, correo, celular, direccion, etc., entidades.dto.ts:13-36). No existe ninguna vinculaciÃ³n de propiedad, alcance ni lÃ­mite de tasa, por lo que un usuario autenticado de baja confianza puede enumerar PII de cualquier persona natural.

**Causa raÃ­z:** El prefijo /api/entidades estÃ¡ registrado en middleware.ts:30 sin un `permission`, y entidadesController.searchPerson no realiza ninguna comprobaciÃ³n de getSession/autorizaciÃ³n, pasando documento/nombre controlados por el atacante directamente al servicio upstream de PII y devolviendo la respuesta sin procesar.

**Comportamiento esperado:** Una consulta de PII de personas deberÃ­a requerir un permiso explÃ­cito que vincule al llamador con el recurso o, como mÃ­nimo, limitarse a los roles cuya funciÃ³n lo necesite, en lugar de estar disponible para todo rol autenticado, incluidos los clientes.

**Traza:**
- *( entrypoint )* `src/middleware.ts:30` â€” Entrada PROTECTED para /api/entidades: El prefijo de ruta figura sin permiso, por lo que la barrera del middleware la satisface cualquier token de sesiÃ³n vÃ¡lido.
- *( propagation )* `src/controllers/entidades.controller.ts:13` â€” entidadesController.searchPerson: El controlador pasa el body proporcionado por el atacante directamente al cliente upstream sin comprobaciÃ³n de permiso ni de alcance.
- *( sink )* `src/infrastructure/external/entidades-client.ts:29` â€” POST /rest/searchpersonv00: La solicitud del lado del servidor se emite al servicio heredado de bÃºsqueda de personas y su lista completa de PII se devuelve al llamador.

**Evidencia:**
- `src/middleware.ts:30` â€” { path: "/api/entidades" } no tiene permiso, a diferencia de /api/solicitudes, /api/facturacion, etc.
- `src/lib/shared/constants.ts:212` â€” El rol `cliente`, de menor confianza, solo posee eventos:datos, solicitudes:view, stands:plano, read/write:reservas, lo que confirma que la bÃºsqueda en entidades es alcanzable por los clientes.
- `src/types/dto/entidades/entidades.dto.ts:13` â€” PersonaResultDTO enumera la PII devuelta: documento, nombres/apellidos, fecha_nacimiento, correo, celular, direccion, empresa.
- `src/infrastructure/external/entidades-client.ts:3` â€” La URL base upstream es del lado del servidor (entidades-client.ts:3); el cliente no adjunta ninguna credencial del llamador y la bÃºsqueda se realiza con el propio acceso de red del servidor.

**Condiciones:**
- (authentication_level) Una cookie de sesiÃ³n vÃ¡lida de cualquier rol, incluido `cliente`, es suficiente; no se requiere un permiso explÃ­cito.
- (environmental_dependency) El servicio upstream de bÃºsqueda de personas debe ser alcanzable desde el servidor para que se devuelvan registros.

**Perspectiva del atacante:** Un cliente autenticado de bajo privilegio que ha seleccionado un evento y quiere recolectar datos personales de personas arbitrarias.

**Payloads / entradas:**
- `{"documento":"12345678"}`
- `{"nombre":"a"}`

**Instrucciones acotadas:**
1. Iniciar sesiÃ³n con cualquier rol (p. ej. el rol `cliente`) y obtener una cookie de sesiÃ³n vÃ¡lida.
1. Enviar POST /api/entidades/persona con un body JSON que contenga un documento o nombre arbitrario.
1. Observar los registros ListInfoPersona devueltos que contienen nombres, fecha de nacimiento, correo, telÃ©fono y direcciÃ³n.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que la solicitud pasa el middleware de solo autenticaciÃ³n y llega al servicio upstream de bÃºsqueda de personas a travÃ©s del cliente del lado del servidor, cuyo tipo de respuesta declarado (PersonaResultDTO) se devuelve tal cual al llamador; no se reenvÃ­a ninguna identidad de usuario al upstream.

**RemediaciÃ³n:** Registrar /api/entidades con un permiso explÃ­cito (p. ej. un nuevo entidades:search o la reutilizaciÃ³n de solicitudes:upload) en PROTECTED, y exigirlo en los controladores searchPerson/searchEmpresa; ademÃ¡s, considerar limitaciÃ³n de tasa y reducir la PII devuelta a lo que el llamador necesite.

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

**Severidad:** likelihood=high (El endpoint es alcanzable por cualquier rol autenticado y acepta consultas de DNI/nombre sin restricciones y sin lÃ­mite de tasa, por lo que la explotaciÃ³n es trivial para una cuenta existente de bajo privilegio.) Â· impact=high (Las consultas exitosas devuelven PII completa de personas naturales (documento, nombres, fecha de nacimiento, correo, telÃ©fono, direcciÃ³n), lo que permite la recolecciÃ³n masiva de datos personales mediante el acceso upstream del servidor.) Â· overall=high Â· confidence=high

---

## HIGH â€” GET /api/solicitudes/detalle devuelve cualquier solicitud por UUID a cualquier portador de solicitudes:view

**Fingerprint:** `solicitudes.detalle.missing-owner-binding`

**DescripciÃ³n:** solicitudesController.detalle analiza un id proporcionado por el llamador y llama a services.solicitudes.detalle(id) sin ninguna comprobaciÃ³n de propiedad basada en getSession (solicitudes.controller.ts:32-38), y el repositorio lo resuelve con prisma.solicitud.findUnique({ where: { id } }) sin predicado de propietario ni de evento (solicitudes-repository.ts:185-199). La barrera del middleware para /api/solicitudes solo requiere solicitudes:view (middleware.ts:28), permiso que posee el rol `cliente` (constants.ts:212). En consecuencia, cualquier cliente autenticado puede leer el detalle completo de cualquier solicitud â€”incluidos el correo del solicitante, la empresa, los documentos, el historial de revisiones y los identificadores de facturaciÃ³nâ€” simplemente proporcionando su UUID.

**Causa raÃ­z:** La lectura se basa Ãºnicamente en la clave primaria proporcionada por el cliente, sin ningÃºn predicado que vincule el registro con el sujeto de la sesiÃ³n, y la Ãºnica autorizaciÃ³n es el permiso amplio solicitudes:view, que los clientes tambiÃ©n poseen.

**Comportamiento esperado:** La lectura de una solicitud individual debe estar vinculada al sujeto autenticado: un `cliente` solo deberÃ­a poder leer un registro cuyo userId sea igual a session.sub (o cuyo evento el revisor tenga derecho a ver), devolviendo NOT_FOUND/FORBIDDEN en caso contrario.

**Traza:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:7` â€” Despacho GET detalle: El enrutador de slug mapea GET /api/solicitudes/detalle a solicitudesController.detalle; el prefijo estÃ¡ protegido por solicitudes:view.
- *( propagation )* `src/controllers/solicitudes.controller.ts:35` â€” detalle: const row = await services.solicitudes.detalle(id) â€” el id proporcionado por el llamador se usa directamente sin sesiÃ³n ni comparaciÃ³n de propietario (el controlador nunca llama a getSession).
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:186` â€” detalle: prisma.solicitud.findUnique({ where: { id: solicitudId } }) resuelve cualquier registro por clave primaria, devolviendo la fila mapeada completa.

**Evidencia:**
- `src/middleware.ts:28` â€” Solo solicitudes:view protege el prefijo /api/solicitudes; no hay alcance de propiedad por registro.
- `src/lib/shared/constants.ts:212` â€” El rol `cliente` posee solicitudes:view, por lo que los clientes alcanzan el endpoint.
- `src/controllers/solicitudes.controller.ts:34` â€” solicitudesDetalleSchema.parse solo valida que id sea un UUID; nada lo vincula al llamador.
- `src/infrastructure/persistence/solicitudes-repository.ts:191` â€” El include devuelve revisiones, reevaluaciones, docsAdjuntos y facturaciones, es decir, el detalle completo del contrato para el registro seleccionado.

**Condiciones:**
- (authentication_level) Cualquier sesiÃ³n que lleve solicitudes:view (incluido el rol de cliente) es suficiente.
- (data_state) El atacante debe conocer o adivinar el UUID de la solicitud objetivo; el endpoint listar sin alcance hace que esos identificadores sean enumerables.

**Perspectiva del atacante:** Un cliente autenticado que quiere leer el detalle de la solicitud de otra empresa.

**Payloads / entradas:**
- `GET /api/solicitudes/detalle?id=<victimSolicitudUuid>`

**Instrucciones acotadas:**
1. Autenticarse con cualquier rol que posea solicitudes:view, p. ej. `cliente`.
1. Obtener el UUID de una solicitud objetivo (p. ej. desde el endpoint listar sin alcance).
1. Llamar a GET /api/solicitudes/detalle?id=<uuid> y leer el registro devuelto.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que la solicitud pasa el middleware (solicitudes:view) y llega a findUnique por id sin predicado de propietario, por lo que el registro de cualquier propietario se devuelve a cualquier portador de solicitudes:view.

**RemediaciÃ³n:** Exigir una sesiÃ³n en detalle, cargar el registro y denegar cuando el llamador sea un cliente cuyo session.sub difiera del userId del registro; alternativamente, acotar la consulta del repositorio por userId/eventoId para los llamadores no privilegiados.

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

**Severidad:** likelihood=high (Cualquier cliente autenticado puede llamarlo y los identificadores objetivo son enumerables mediante el endpoint listar sin alcance.) Â· impact=high (Devuelve el detalle completo de la solicitud de otro cliente, incluidos PII, documentos e identificadores de facturaciÃ³n.) Â· overall=high Â· confidence=high

---

## HIGH â€” GET /api/solicitudes/listar deriva el alcance de propietario desde la cadena de consulta, exponiendo cada solicitud de un evento a cualquier portador de solicitudes:view

**Fingerprint:** `solicitudes.listar.unscoped-owner-and-event`

**DescripciÃ³n:** El controlador listar lee userId y eventoId directamente de la consulta de la solicitud (solicitudes.controller.ts:15-21) y los reenvÃ­a al repositorio, que aplica el predicado de propietario solo cuando params.userId es veraz (solicitudes-repository.ts:152-154) y filtra por el eventoId proporcionado por el atacante (solicitudes-repository.ts:146-151). La barrera del middleware para /api/solicitudes solo requiere el permiso amplio solicitudes:view (middleware.ts:28), que posee el rol `cliente`, de menor confianza (constants.ts:212). Debido a que el filtro de propietario es condicional, un cliente puede simplemente omitir userId (o apuntarlo a otro usuario) y recibir todas las solicitudes del evento, incluidos el correo del solicitante, la empresa, las URL de documentos y los comentarios de revisiÃ³n devueltos por mapRow. No existe derivaciÃ³n del sujeto en el lado del servidor a partir de la sesiÃ³n ni distinciÃ³n de roles entre revisores internos (que pueden listar todo el evento) y clientes (que deben limitarse a sus propios registros).

**Causa raÃ­z:** El controlador toma el alcance de inquilino/propietario de parÃ¡metros de consulta controlados por el cliente en lugar de la sesiÃ³n verificada, y el predicado de propietario del repositorio se aplica solo cuando userId es veraz en vez de denegar por defecto; el middleware autoriza todo el prefijo con un Ãºnico permiso general que los clientes tambiÃ©n poseen.

**Comportamiento esperado:** El alcance de propietario/inquilino debe derivarse en el lado del servidor: un `cliente` solo deberÃ­a poder listar las solicitudes cuyo userId sea igual a session.sub, independientemente de los parÃ¡metros de consulta, mientras que los revisores/administradores pueden estar acotados por su evento. El cliente no debe poder ampliar su propio alcance omitiendo o sobrescribiendo userId.

**Traza:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:6` â€” Despacho GET listar: El enrutador de slug mapea GET /api/solicitudes/listar a solicitudesController.listar; todo el prefijo estÃ¡ detrÃ¡s de middleware.ts:28 (solicitudes:view).
- *( propagation )* `src/controllers/solicitudes.controller.ts:21` â€” listar: const userId = url.searchParams.get("userId") ?? undefined â€” el filtro de propietario se toma tal cual de la consulta, sin comprobaciÃ³n de getSession()/rol.
- *( propagation )* `src/controllers/solicitudes.controller.ts:15` â€” listar: eventoId se lee de la consulta y se analiza como UUID, lo que permite al llamador elegir cualquier evento.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:152` â€” listar: if (params.userId) { where.userId = params.userId } â€” el predicado de propietario estÃ¡ ausente siempre que se omite userId, por lo que la consulta devuelve todas las filas del evento.

**Evidencia:**
- `src/middleware.ts:28` â€” { path: "/api/solicitudes", permission: "solicitudes:view" } â€” un Ãºnico permiso general para todas las acciones de lectura y escritura, que poseen los clientes.
- `src/lib/shared/constants.ts:212` â€” ROLES.CLIENTE posee solicitudes:view, por lo que el rol de menor confianza pasa la barrera del middleware y puede llamar a listar.
- `src/infrastructure/persistence/solicitudes-repository.ts:146` â€” El filtrado por evento se aplica desde params.eventoId (el valor de la consulta) en lugar de la afirmaciÃ³n eventoId de la sesiÃ³n.
- `src/middleware.ts:44` â€” /api/eventos/listar?presala=1 es una excepciÃ³n pÃºblica, por lo que los valores reales de eventoId se pueden obtener sin autenticaciÃ³n.
- `src/infrastructure/persistence/solicitudes-repository.ts:120` â€” mapRow devuelve correo, empresa, documentos, URL de docsAdjuntos y comentarios de revisiÃ³n, por lo que la lista entre propietarios es una divulgaciÃ³n de datos, no solo una fuga de ids.

**Condiciones:**
- (authentication_level) Cualquier sesiÃ³n cuyo JWT lleve solicitudes:view, incluido el rol `cliente`, es suficiente; no se realiza ninguna comprobaciÃ³n adicional de permiso ni de rol.
- (data_state) El evento objetivo debe contener solicitudes que pertenezcan a otros propietarios para que la divulgaciÃ³n incluya datos de terceros.

**Perspectiva del atacante:** Un cliente autenticado de bajo privilegio que quiere enumerar las solicitudes de stand de otras empresas para un evento.

**Payloads / entradas:**
- `GET /api/solicitudes/listar?eventoId=<eventoUuid>&page=1&per_page=50`
- `GET /api/solicitudes/listar?eventoId=<eventoUuid>&userId=<victimSub>`

**Instrucciones acotadas:**
1. Iniciar sesiÃ³n con el rol `cliente` y obtener una cookie de sesiÃ³n vÃ¡lida.
1. Obtener un eventoId a partir de la respuesta pÃºblica de GET /api/eventos/listar?presala=1.
1. Llamar a GET /api/solicitudes/listar con ese eventoId y sin userId, y leer las solicitudes devueltas de otros clientes.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que la solicitud pasa la barrera solicitudes:view (middleware.ts:28) y llega a un Prisma findMany cuyo where contiene solo el predicado de evento cuando se omite userId (solicitudes-repository.ts:146-154); por lo tanto, la respuesta contiene todas las solicitudes de ese evento, incluidas las creadas por otros usuarios.

**RemediaciÃ³n:** Derivar el alcance de propietario desde la sesiÃ³n dentro del controlador: cuando el rol del llamador sea `cliente` (o carezca de un permiso de revisiÃ³n interna), forzar userId = session.sub e ignorar el valor de la consulta; solo los revisores/administradores cuya sesiÃ³n autorice el evento por eventoId pueden recibir un listado sin alcance del evento. AdemÃ¡s, hacer que el predicado del repositorio deniegue por defecto para los llamadores no privilegiados en lugar de aplicarlo condicionalmente.

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

**Severidad:** likelihood=high (El endpoint es alcanzable por cualquier cliente autenticado, el filtro de propietario es opcional y el eventoId requerido es pÃºblicamente descubrible; una sola solicitud enumera todas las solicitudes del evento.) Â· impact=high (La divulgaciÃ³n entre clientes de datos de solicitudes de contrato (correo del solicitante, empresa, URL de documentos, comentarios de revisiÃ³n y estado) permite la recolecciÃ³n competitiva y de datos personales.) Â· overall=high Â· confidence=high

---

## HIGH â€” Token de GitHub incrustado en la URL del remoto de git y persistido en la configuraciÃ³n git del host

**Fingerprint:** `github.workflows.deploy.yml:ec2-git-token-persisted-in-git-config`

**DescripciÃ³n:** El script de despliegue establece el remoto de la copia de trabajo de EC2 en https://x-access-token:${{ secrets.EC2_GIT_TOKEN }}@github.com/iimp-projects/contratos-stands.git. Git almacena las URL de los remotos tal cual en .git/config, por lo que el token se persiste en texto claro en el host de producciÃ³n despuÃ©s de cada despliegue y tambiÃ©n es visible en los argumentos de proceso y en cualquier registro de configuraciÃ³n/comandos.

**Causa raÃ­z:** Se coloca una credencial de larga duraciÃ³n (EC2_GIT_TOKEN) directamente en la URL del remoto de git en lugar de suministrarla mediante un credential helper efÃ­mero o una deploy key con alcance limitado.

**Comportamiento esperado:** Usar una credencial de menor privilegio y corta duraciÃ³n (deploy key o credential helper) y nunca persistir tokens en la URL del remoto del repositorio.

**Traza:**
- *( entrypoint )* `.github/workflows/deploy.yml:124` â€” script remoto del job deploy: git remote set-url origin https://x-access-token:${{ secrets.EC2_GIT_TOKEN }}@github.com/... â€” token colocado en la URL del remoto.
- *( sink )* `docker-compose.prod.yml:52` â€” copia de trabajo del host EC2: El repositorio del host (cÃ³digo fuente montado por bind en la app) conserva .git/config con la URL del remoto con credenciales.

**Evidencia:**
- `.github/workflows/deploy.yml:124` â€” Token interpolado en la URL del remoto origin, que git escribe tal cual en .git/config en el host.
- `scripts/deploy.sh:26` â€” El script de despliegue manual realiza un git pull simple sin token, lo que demuestra que el remoto con credenciales es un remanente automatizable y no un requisito.

**Condiciones:**
- (system_configuration) El paso de despliegue se ejecuta al hacer push a main siempre que EC2_SECRETS estÃ© configurado, escribiendo el remoto con token en el host de producciÃ³n.

**Perspectiva del atacante:** Un atacante local o a nivel de contenedor en el host EC2 de producciÃ³n que puede leer el .git/config de la copia de trabajo (el usuario root del contenedor de la app tambiÃ©n monta por bind este Ã¡rbol).

**Payloads / entradas:**
- `grep -R x-access-token /var/www/contratos-stands/.git/config`
- `git -C /var/www/contratos-stands remote -v`

**Instrucciones acotadas:**
1. ReproducciÃ³n estÃ¡tica (no se ejecutÃ³ el objetivo): leer .github/workflows/deploy.yml:124 y confirmar que el token estÃ¡ interpolado en la URL del remoto.
1. ReproducciÃ³n en el momento del despliegue: tras un despliegue, leer el .git/config del repositorio del host y observar el token incrustado en la URL de origin.

**Resultado observado:** El cÃ³digo fuente muestra que la URL del remoto contiene el token; el comportamiento documentado de git persiste esa URL en .git/config, dejando la credencial en disco hasta que se rote.

**RemediaciÃ³n:** Autenticar git con un token de GitHub App de corta duraciÃ³n y menor privilegio mediante un credential helper (o una deploy key SSH) y nunca incrustar credenciales en la URL del remoto; limitar el alcance y rotar EC2_GIT_TOKEN.

`.github/workflows/deploy.yml`:
```
            git remote set-url origin git@github.com:iimp-projects/contratos-stands.git
            git -c credential.helper='!f() { echo "username=x-access-token"; echo "password=$GIT_TOKEN"; }; f' -c credential.helper='cache --timeout=0' pull origin main
```

**Severidad:** likelihood=medium (Cualquier proceso, copia de seguridad o actor con privilegios equivalentes a root en el host EC2 (incluido el contenedor de la app que corre como root y monta el repositorio por bind) puede leer el token desde .git/config.) Â· impact=high (Un token de GitHub expuesto en el host de despliegue otorga lectura/escritura del repositorio y, a travÃ©s de los workflows, mayor acceso a la cadena de suministro.) Â· overall=high Â· confidence=high

---

## HIGH â€” El ALB expuesto a internet es alcanzable directamente y elude el WAF de CloudFront

**Fingerprint:** `terraform.ecs:alb-origin-public-bypasses-waf`

**DescripciÃ³n:** El WAF se adjunta solo a la distribuciÃ³n de CloudFront, pero el security group del ALB permite 0.0.0.0/0 en los puertos 80 y 443 porque restrict_alb_to_cloudfront tiene como valor predeterminado false y el perfil de despliegue de producciÃ³n no lo habilita. El ALB tiene internal=false con subredes pÃºblicas, por lo que los clientes pueden acceder directamente al origen y omitir las reglas administradas de CloudFront y el lÃ­mite de tasa por IP.

**Causa raÃ­z:** El ingreso al ALB se abre a todas las IP mientras el WAF estÃ¡ vinculado Ãºnicamente a CloudFront; el control de prefix-list orientado al origen de CloudFront es opcional (default false) y estÃ¡ ausente de prod.tfvars y de los perfiles valle/evento.

**Comportamiento esperado:** El ingreso al ALB deberÃ­a restringirse a la prefix list administrada orientada al origen de AWS CloudFront, de modo que todo el trÃ¡fico de internet atraviese la distribuciÃ³n protegida por WAF.

**Traza:**
- *( entrypoint )* `terraform/main.tf:201` â€” invocaciÃ³n de module.ecs: restrict_alb_to_cloudfront se cablea desde la variable cuyo valor predeterminado es false.
- *( propagation )* `terraform/modules/ecs/main.tf:461` â€” aws_security_group.alb ingress: cidr_blocks = var.restrict_alb_to_cloudfront ? [] : ["0.0.0.0/0"] â€” abierto pÃºblicamente por defecto.
- *( sink )* `terraform/modules/cloudfront/main.tf:182` â€” aws_cloudfront_distribution.main: web_acl_id adjunta el WAF solo a CloudFront, por lo que las solicitudes directas al ALB no se filtran.

**Evidencia:**
- `terraform/variables.tf:367` â€” restrict_alb_to_cloudfront default = false.
- `terraform/prod.tfvars:9` â€” El archivo de variables de producciÃ³n no establece restrict_alb_to_cloudfront, y su uso documentado combina prod.tfvars con perfiles/valle.tfvars.
- `terraform/perfiles/valle.tfvars:1` â€” El perfil valle (perfil de producciÃ³n documentado) nunca establece restrict_alb_to_cloudfront, dejando el valor predeterminado false.
- `terraform/modules/ecs/main.tf:498` â€” aws_lb.main internal = false con subredes pÃºblicas, por lo que el ALB estÃ¡ expuesto a internet.
- `terraform/modules/ecs/main.tf:474` â€” El ingreso HTTPS tambiÃ©n abre 0.0.0.0/0 cuando la restricciÃ³n estÃ¡ desactivada.
- `terraform/perfiles/apertura.tfvars:25` â€” Solo el perfil apertura establece restrict_alb_to_cloudfront = true, lo que muestra que el control existe pero no es el estado predeterminado de producciÃ³n.

**Condiciones:**
- (network_routing) El ALB reside en subredes pÃºblicas y estÃ¡ expuesto a internet, por lo que el ingreso desde 0.0.0.0/0 es directamente alcanzable.
- (system_configuration) El artefacto del plan de producciÃ³n (terraform/plan-prod.json) muestra el security group del ALB con 0.0.0.0/0 en 80 y 443 y la descripciÃ³n 'HTTP publico'.

**Perspectiva del atacante:** Un cliente de internet no autenticado que conoce o descubre el nombre DNS del ALB.

**Payloads / entradas:**
- `curl -sk https://<alb-dns-name>/api/...  # direct to origin, no WAF`
- `High-rate request flood against the ALB to avoid the WAF IP rate-based rule.`

**Instrucciones acotadas:**
1. ReproducciÃ³n estÃ¡tica (no se ejecutÃ³ el objetivo): leer terraform/variables.tf:367 (default false), terraform/modules/ecs/main.tf:457-476 (0.0.0.0/0 cuando estÃ¡ desactivado) y terraform/modules/cloudfront/main.tf:182 (WAF solo en CloudFront).
1. Inspeccionar terraform/plan-prod.json: el ingress de module.ecs.aws_security_group.alb lista 0.0.0.0/0 en 80 y 443 con la descripciÃ³n 'HTTP publico'.
1. ReproducciÃ³n en el momento del despliegue: solicitar el DNS del ALB directamente y observar respuestas que nunca atravesaron CloudFront/WAF.

**Resultado observado:** El cÃ³digo fuente y el plan de producciÃ³n muestran el ALB abierto a 0.0.0.0/0 mientras el WAF protege solo CloudFront, por lo que las solicitudes directas al origen eluden todas las reglas del WAF.

**RemediaciÃ³n:** Habilitar restrict_alb_to_cloudfront en los perfiles de producciÃ³n y establecer el valor predeterminado en true, de modo que el ingreso al ALB se limite a la prefix list orientada al origen de CloudFront.

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

**Severidad:** likelihood=high (El acceso directo al ALB solo requiere el nombre DNS del origen, que es resoluble/descubrible, y el perfil de producciÃ³n predeterminado/documentado lo deja abierto.) Â· impact=high (Eludir el WAF elimina las reglas administradas OWASP y el lÃ­mite de tasa por IP, lo que permite explotaciÃ³n directa y abuso volumÃ©trico contra la app de origen, incluidos los endpoints desprotegidos ya encontrados en esta auditorÃ­a.) Â· overall=high Â· confidence=high

---

## HIGH â€” Token de restablecimiento de contraseÃ±a generado con Math.random()

**Fingerprint:** `auth.reset-token.math-random`

**DescripciÃ³n:** El token de restablecimiento de contraseÃ±a se construye a partir de Math.random(), un PRNG no criptogrÃ¡fico, y se envÃ­a por correo en una cadena de consulta de URL. Aunque el token tiene 32 caracteres, expira y es de un solo uso, sus valores no se extraen de un CSPRNG.

**Causa raÃ­z:** AuthApplicationService.requestReset construye el token como [...Array(32)].map(() => Math.random().toString(36)[2]).join("") y lo persiste/envÃ­a por correo; no se usa crypto.randomBytes/randomUUID.

**Comportamiento esperado:** Los tokens de recuperaciÃ³n deben generarse a partir de una fuente aleatoria criptogrÃ¡ficamente segura, con expiraciÃ³n y de un solo uso.

**Traza:**
- *( entrypoint )* `src/app/api/auth/[...slug]/route.ts:13` â€” POST /api/auth/reset-password: Despacha la solicitud de restablecimiento a authController.requestReset.
- *( propagation )* `src/application/auth/auth-service.ts:99` â€” AuthApplicationService.requestReset: Genera el token de restablecimiento con Math.random().
- *( sink )* `src/infrastructure/persistence/auth-repository.ts:68` â€” AuthPrismaRepository.setResetToken: Persiste el token y su expiraciÃ³n de 30 minutos en la fila del usuario.

**Evidencia:**
- `src/application/auth/auth-service.ts:99` â€” Token de restablecimiento de 32 caracteres derivado de Math.random().
- `src/application/auth/auth-service.ts:102` â€” Token incrustado en la URL de restablecimiento enviada por correo como parÃ¡metro de consulta.
- `src/infrastructure/persistence/auth-repository.ts:73` â€” El token se acepta solo mientras resetTokenExpires >= now (ventana de 30 minutos).
- `src/infrastructure/persistence/auth-repository.ts:79` â€” El token se borra tras un restablecimiento exitoso (un solo uso).

**Condiciones:**
- (authentication_level) El endpoint de solicitud de restablecimiento es alcanzable de forma anÃ³nima.
- (timing_dependency) El token es vÃ¡lido durante una ventana de 30 minutos y puede usarse una vez.

**Perspectiva del atacante:** Un atacante anÃ³nimo que puede desencadenar un restablecimiento para el correo de una vÃ­ctima y luego interactuar con la URL de restablecimiento, o que puede predecir la salida del PRNG.

**Payloads / entradas:**
- `POST /api/auth/reset-password {"email":"victim@iimp.org.pe"}`

**Instrucciones acotadas:**
1. Solicitar un restablecimiento de contraseÃ±a para la cuenta vÃ­ctima.
1. Derivar o adivinar el token no CSPRNG dentro de la ventana de validez de 30 minutos.
1. Enviar POST /api/auth/reset-password/confirm con el token y una contraseÃ±a elegida.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente confirma que el token consta de 32 caracteres base36 producidos por Math.random(), que no es criptogrÃ¡ficamente seguro, por lo que los valores del token son predecibles en principio dentro de su ventana de validez.

**RemediaciÃ³n:** Reemplazar Math.random() por un CSPRNG (crypto.randomBytes/randomUUID) y almacenar solo un hash del token de restablecimiento.

**Severidad:** likelihood=medium (La explotaciÃ³n requiere predecir/observar la salida del PRNG dentro de una ventana corta, pero el cÃ³digo fuente no ofrece ninguna garantÃ­a de CSPRNG.) Â· impact=high (Un token de restablecimiento adivinado o predicho permite establecer una nueva contraseÃ±a y tomar el control de la cuenta.) Â· overall=high Â· confidence=high

---

## HIGH â€” ContraseÃ±as almacenadas y comparadas en texto plano

**Fingerprint:** `auth.login.plaintext-password-storage`

**DescripciÃ³n:** El inicio de sesiÃ³n verifica la contraseÃ±a enviada con una comparaciÃ³n directa de igualdad de cadenas contra una columna de contraseÃ±a en texto claro, y las cuentas se crean/llenan con valores en texto claro (valor predeterminado fijo "123456"). No existe ningÃºn hash de contraseÃ±as (Argon2/bcrypt/scrypt/PBKDF2) ni comparaciÃ³n de tiempo constante en ningÃºn lugar de src, por lo que cualquier lectura de la tabla user_role arroja credenciales reutilizables.

**Causa raÃ­z:** La columna UserRole.password almacena texto claro y AuthApplicationService.login la compara con `!==`; AuthPrismaRepository.updatePassword y prisma/seed.ts escriben texto claro, y no existe ninguna utilidad de hashing en el cÃ³digo base.

**Comportamiento esperado:** Las contraseÃ±as deben salarse, hashearse de forma unidireccional y verificarse con una comparaciÃ³n de tiempo constante; los cambios y restablecimientos de contraseÃ±a deben volver a aplicar el hash.

**Traza:**
- *( entrypoint )* `src/app/api/auth/[...slug]/route.ts:10` â€” POST /api/auth/login: El enrutador de slug despacha la acciÃ³n de inicio de sesiÃ³n a authController.login.
- *( propagation )* `src/application/auth/auth-service.ts:23` â€” AuthApplicationService.login: Compara userRoles[0].password !== dto.password contra el valor almacenado.
- *( sink )* `src/infrastructure/persistence/auth-repository.ts:8` â€” AuthPrismaRepository.findByEmail: Selecciona la columna de contraseÃ±a en texto claro usada para la comparaciÃ³n.

**Evidencia:**
- `src/application/auth/auth-service.ts:23` â€” ComparaciÃ³n de igualdad en texto plano de la contraseÃ±a suministrada.
- `prisma/schema.prisma:125` â€” password String @default("123456") @db.VarChar(100) â€” credencial predeterminada en texto claro.
- `prisma/seed.ts:49` â€” Los usuarios de prueba se crean con contraseÃ±as en texto claro como admin123/cliente123.
- `src/infrastructure/persistence/auth-repository.ts:79` â€” updatePassword escribe la nueva contraseÃ±a tal cual (sin hashing).

**Condiciones:**
- (authentication_level) El endpoint de inicio de sesiÃ³n es alcanzable de forma anÃ³nima (prefijo pÃºblico /api/auth/).
- (data_state) Existe al menos una fila de cuenta; los flujos de seed y de creaciÃ³n de cuentas usan el valor predeterminado en texto claro 123456.

**Perspectiva del atacante:** Un atacante anÃ³nimo que obtiene cualquier copia de la tabla user_role (lectura de BD, copia de seguridad, inyecciÃ³n SQL en otro punto, volcado de errores) o un titular de cuenta legÃ­timo.

**Payloads / entradas:**
- `POST /api/auth/login {"email":"cliente@iimp.org.pe","password":"cliente123"}`

**Instrucciones acotadas:**
1. Leer el valor de la columna password de una cuenta objetivo en user_role.
1. Enviarlo tal cual a POST /api/auth/login.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente muestra que el cÃ³digo de inicio de sesiÃ³n realiza una comparaciÃ³n exacta de cadenas contra el valor almacenado, por lo que el valor almacenado es directamente utilizable como contraseÃ±a, y el valor predeterminado de seed 123456 es vÃ¡lido para las cuentas cuya contraseÃ±a nunca se cambiÃ³.

**RemediaciÃ³n:** Introducir una utilidad de hashing de contraseÃ±as (Argon2id o bcrypt) y usarla en la creaciÃ³n de cuentas, las actualizaciones de perfil/contraseÃ±a y los datos de seed; verificar con una comparaciÃ³n de hash de tiempo constante y migrar/forzar el restablecimiento de las credenciales en texto claro existentes.

**Severidad:** likelihood=high (El almacenamiento en texto plano mÃ¡s un valor predeterminado fijo hacen que la recuperaciÃ³n de credenciales sea trivial para cualquiera que alcance los datos almacenados o adivine el valor predeterminado.) Â· impact=high (Toma de control total de la cuenta para cualquier fila recolectada, incluido el admin del seed, y exposiciÃ³n por reutilizaciÃ³n de contraseÃ±as para todos los usuarios; la explotaciÃ³n requiere una lectura de la columna en texto claro, por lo que el impacto demostrado no alcanza el ancla critical (no se establece toma de control solo a partir del cÃ³digo fuente).) Â· overall=high Â· confidence=high

---

## HIGH â€” POST /api/solicitudes/revisar acepta cualquier Ã¡rea de cualquier portador de solicitudes:view, eludiendo los permisos de revisiÃ³n especÃ­ficos de cada Ã¡rea

**Fingerprint:** `solicitudes.revisar.missing-area-permission`

**DescripciÃ³n:** solicitudesController.revisar realiza solo una comprobaciÃ³n de sesiÃ³n y luego escribe la revisiÃ³n suministrada en el body (solicitudes.controller.ts:40-45). El validador restringe area a los tres valores del enum pero no realiza ninguna comprobaciÃ³n de permiso (solicitudes.validator.ts:15-20), y REVISION_AREA_PERMISSIONS (constants.ts:302-306), que mapea cada Ã¡rea a su permiso solicitudes:review:<area>, solo se referencia en el componente de cliente solicitud-review.tsx:44 para ocultar botones. La barrera del middleware para /api/solicitudes es el permiso amplio solicitudes:view (middleware.ts:28), que posee `cliente` (constants.ts:212). Por lo tanto, un cliente puede enviar una aprobaciÃ³n/rechazo para cualquier Ã¡rea de cualquier solicitud, impulsando transiciones de estado (computeEstadoSolicitud), desencadenando la creaciÃ³n de expedientes SGC cuando se aprueba el Ã¡rea legal (solicitudes-service.ts:43-45) y generando alertas para los revisores.

**Causa raÃ­z:** El servidor confÃ­a en el campo area y en la mera presencia de una sesiÃ³n; el mapa de Ã¡rea a permiso existe pero nunca se aplica en la ruta de escritura, por lo que cualquier portador de solicitudes:view puede actuar como cualquier Ã¡rea de revisiÃ³n.

**Comportamiento esperado:** Registrar una revisiÃ³n debe requerir el permiso mapeado al Ã¡rea enviada (REVISION_AREA_PERMISSIONS[area] o admin:full), de modo que, por ejemplo, solo un revisor legal pueda aprobar el paso legal.

**Traza:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:11` â€” Despacho POST revisar: El enrutador de slug mapea POST /api/solicitudes/revisar a solicitudesController.revisar.
- *( propagation )* `src/controllers/solicitudes.controller.ts:41` â€” revisar: const session = await getSession(); la sesiÃ³n solo se comprueba por su existencia â€” ninguna comprobaciÃ³n de hasPermission/rol contra el Ã¡rea enviada.
- *( propagation )* `src/validators/solicitudes.validator.ts:17` â€” solicitudesRevisarSchema: area es zod.enum(REVISION_AREAS) y estado es zod.enum(RESULTADOS_APROBACION); el atacante elige ambos libremente.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:224` â€” crearOActualizarRevision: prisma.revision.update/create persiste el estado elegido para el Ã¡rea elegida, registrando el correo del llamador como revisor, sin ningÃºn predicado de autorizaciÃ³n.

**Evidencia:**
- `src/middleware.ts:28` â€” Solo solicitudes:view protege /api/solicitudes, por lo que cualquier cliente pasa.
- `src/lib/shared/constants.ts:302` â€” REVISION_AREA_PERMISSIONS define solicitudes:review:comunicacion / legal / logistica, pero ningÃºn archivo del servidor lo importa/referencia.
- `src/components/solicitudes/solicitud-review.tsx:44` â€” La Ãºnica referencia a REVISION_AREA_PERMISSIONS estÃ¡ en el cliente, lo que demuestra que el permiso solo se aplica en la UI.
- `src/application/solicitudes/solicitudes-service.ts:43` â€” Una aprobaciÃ³n legal desencadena sgcIntegracion.crearExpedienteDesdeSolicitud, lo que muestra el impacto de negocio de acciones de Ã¡rea no autorizadas.
- `src/lib/shared/constants.ts:212` â€” El rol `cliente` posee solicitudes:view, por lo que el llamador alcanzable incluye a los clientes.

**Condiciones:**
- (authentication_level) Cualquier sesiÃ³n vÃ¡lida que lleve solicitudes:view es suficiente; no se comprueba ningÃºn permiso de Ã¡rea.
- (authorization_role) Los permisos previstos por Ã¡rea (solicitudes:review:*) nunca son exigidos por el servidor.

**Perspectiva del atacante:** Un cliente autenticado o cualquier usuario que solo posea solicitudes:view y quiera forzar la aprobaciÃ³n/rechazo de una solicitud.

**Payloads / entradas:**
- `POST /api/solicitudes/revisar {"solicitudId":"<uuid>","area":"legal","estado":"aprobado","comentario":"ok"}`
- `POST /api/solicitudes/revisar {"solicitudId":"<uuid>","area":"logistica","estado":"rechazado"}`

**Instrucciones acotadas:**
1. Autenticarse como portador de solicitudes:view (p. ej. el rol `cliente`).
1. Enviar POST /api/solicitudes/revisar con un solicitudId objetivo y cualquier combinaciÃ³n de area/estado.
1. Observar que la revisiÃ³n se registra bajo el correo del llamador y que avanzan el estado de la solicitud, las alertas y el flujo SGC.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que, tras la comprobaciÃ³n de presencia de getSession, el area/estado enviados se persisten mediante crearOActualizarRevision con el llamador como revisor y sin comparaciÃ³n de permisos, por lo que cualquier portador de solicitudes:view puede actuar para cualquier Ã¡rea.

**RemediaciÃ³n:** Tras el parseo, exigir el permiso mapeado a body.area (REVISION_AREA_PERMISSIONS[body.area]) o admin:full antes de llamar a services.solicitudes.revisar; aplicar la misma comprobaciÃ³n contra la fuente de permisos de la base de datos para las transiciones crÃ­ticas.

`src/controllers/solicitudes.controller.ts`:
```
const body = solicitudesRevisarSchema.parse(await request.json());
    const required = REVISION_AREA_PERMISSIONS[body.area as keyof typeof REVISION_AREA_PERMISSIONS];
    if (!session.permissions.includes(required) && !session.permissions.includes("admin:full")) {
      return error(API_ERROR_CODES.FORBIDDEN, "Sin permiso para revisar esta area", 403);
    }
    return success(await services.solicitudes.revisar({ ...body, reviewerEmail: session.email }));
```

**Severidad:** likelihood=high (Trivial de invocar con cualquier sesiÃ³n de cliente y un solo POST; no se requiere conocer roles internos.) Â· impact=high (Aprobaciones/rechazos no autorizados corrompen el flujo de revisiÃ³n, registran al atacante como revisor y pueden desencadenar la creaciÃ³n posterior de expedientes de contrato SGC.) Â· overall=high Â· confidence=high

---

## HIGH â€” El contenedor de producciÃ³n fuerza el esquema con prisma db push en cada arranque

**Fingerprint:** `docker.entrypoint.sh:prisma-db-push-in-production-startup`

**DescripciÃ³n:** docker/entrypoint.sh ejecuta `npx prisma db push --skip-generate` dentro del bucle de espera de PostgreSQL siempre que DATABASE_URL estÃ© establecida, antes del `prisma migrate deploy` condicionado. En la ruta de producciÃ³n EC2/Compose (ENTRYPOINT del Dockerfile entrypoint.sh mÃ¡s .env.prod), esto reconcilia la base de datos en vivo con schema.prisma en cada arranque del contenedor, eludiendo las migraciones revisadas y pudiendo alterar o eliminar esquema/datos sin registro de migraciÃ³n.

**Causa raÃ­z:** `prisma db push` se usa para una espera de conectividad y no estÃ¡ condicionado por los flags de migraciÃ³n; solo `prisma migrate deploy` estÃ¡ condicionado por FIRST_RUN/RUN_MIGRATIONS.

**Comportamiento esperado:** Los cambios de esquema en producciÃ³n deben ocurrir solo mediante migraciones revisadas (`prisma migrate deploy`); `db push` nunca debe ejecutarse contra una base de datos de producciÃ³n.

**Traza:**
- *( entrypoint )* `docker/entrypoint.sh:21` â€” bloque de espera de PostgreSQL: if [ -n "${DATABASE_URL}" ] â€” el bucle de db push se entra siempre que DATABASE_URL estÃ© presente.
- *( propagation )* `docker/entrypoint.sh:24` â€” bucle de arranque (30 iteraciones): npx prisma db push --skip-generate se ejecuta en cada arranque/reintento.
- *( sink )* `docker/entrypoint.sh:38` â€” migraciones condicionadas: prisma migrate deploy se ejecuta solo cuando FIRST_RUN o RUN_MIGRATIONS=true, por lo que db push puede cambiar el esquema antes de que se aplique cualquier migraciÃ³n revisada.

**Evidencia:**
- `docker/entrypoint.sh:24` â€” `db push` incondicional dentro del bucle de espera, limitado solo por 30 iteraciones, no por ningÃºn flag de entorno.
- `Dockerfile:55` â€” ENTRYPOINT apunta a docker/entrypoint.sh, por lo que esto se ejecuta en la imagen de producciÃ³n de Docker/Compose.
- `docker-compose.prod.yml:40` â€” El servicio de la app de producciÃ³n carga .env.prod, que aporta DATABASE_URL y NODE_ENV=production.
- `.env.prod.example:20` â€” DATABASE_URL es una configuraciÃ³n de producciÃ³n obligatoria, por lo que la rama de db push siempre se entra.

**Condiciones:**
- (data_state) El impacto sobre los datos depende de la deriva del esquema en vivo: un schema.prisma incompatible puede hacer que db push altere o elimine columnas/valores sin registro de migraciÃ³n.
- (environmental_dependency) Aplica al despliegue EC2 Docker Compose que usa Dockerfile + docker/entrypoint.sh; la ruta ECS usa Dockerfile.ecs + docker/entrypoint-ecs.sh.

**Perspectiva del atacante:** No es desencadenado por un atacante; cualquier reinicio del contenedor o redespliegue (o un operador que empuja un cambio de esquema) ejecuta la sentencia contra los datos de producciÃ³n.

**Payloads / entradas:**
- `npx prisma db push --skip-generate (as run by docker/entrypoint.sh:24)`

**Instrucciones acotadas:**
1. ReproducciÃ³n estÃ¡tica (no se ejecutÃ³ el objetivo): leer docker/entrypoint.sh lÃ­neas 21-38 y confirmar que db push estÃ¡ dentro de la rama de DATABASE_URL mientras migrate deploy estÃ¡ condicionado por separado.
1. ReproducciÃ³n en el momento del despliegue: iniciar el contenedor de producciÃ³n con DATABASE_URL establecida y observar prisma db push ejecutÃ¡ndose sobre la base de datos en vivo.

**Resultado observado:** El cÃ³digo fuente muestra que db push se ejecuta en cada arranque de producciÃ³n independientemente de RUN_MIGRATIONS; el esquema se fuerza a sincronizarse con el schema.prisma desplegado fuera del historial de migraciones.

**RemediaciÃ³n:** Eliminar prisma db push del entrypoint de producciÃ³n; condicionar toda mutaciÃ³n de esquema a `prisma migrate deploy` revisado.

`docker/entrypoint.sh`:
```
if [ -n "${DATABASE_URL}" ]; then
    echo "â³  Esperando PostgreSQL..."
    for i in $(seq 1 30); do
        if npx prisma db execute --stdin <<< 'SELECT 1' >/dev/null 2>&1; then
            echo "âœ…  PostgreSQL listo."
            break
        fi
        sleep 2
    done
fi
```

**Severidad:** likelihood=high (Se ejecuta en cada arranque del contenedor de producciÃ³n con DATABASE_URL presente; ningÃºn flag lo impide.) Â· impact=high (db push puede realizar cambios destructivos de esquema/datos fuera de la revisiÃ³n y el registro de migraciones, con riesgo de pÃ©rdida de datos de producciÃ³n y divergencia respecto al historial de migraciones.) Â· overall=high Â· confidence=high

---

## HIGH â€” El contenedor de producciÃ³n se ejecuta como root y monta el Ã¡rbol de cÃ³digo del host en lectura-escritura

**Fingerprint:** `docker-compose.prod.yml:root-container-rw-binds-host-source`

**DescripciÃ³n:** La imagen de producciÃ³n no declara ningÃºn USER, supervisord se ejecuta como root, y docker-compose.prod.yml monta `.:/app` en lectura-escritura. Por lo tanto, un compromiso de los procesos de Next.js/nginx expuestos a internet otorga root dentro del contenedor y acceso de escritura al cÃ³digo fuente del repositorio del host, lo que permite la manipulaciÃ³n del cÃ³digo que afecta a los despliegues posteriores.

**Causa raÃ­z:** No se establece ningÃºn usuario no-root para la imagen de runtime, y el directorio de la aplicaciÃ³n es un bind mount de lectura-escritura del Ã¡rbol de trabajo del host en lugar de un artefacto inmutable de solo lectura.

**Comportamiento previsto:** Ejecutar la carga de trabajo con un UID sin privilegios dedicado y montar el cÃ³digo de la aplicaciÃ³n en solo lectura (o incorporarlo a la imagen) para que un compromiso del contenedor no pueda modificar el cÃ³digo fuente del host.

**Rastreo:**
- *( entrypoint )* `Dockerfile:6` â€” runtime image: FROM node:20-bookworm-slim sin directiva USER, por lo que el proceso del contenedor se ejecuta como root.
- *( propagation )* `docker/supervisord.conf:3` â€” supervisord: user=root supervisa node y nginx, todos ejecutÃ¡ndose como root.
- *( sink )* `docker-compose.prod.yml:52` â€” app service volumes: - .:/app monta el repositorio del host en lectura-escritura dentro del contenedor root.

**Evidencia:**
- `Dockerfile:55` â€” ENTRYPOINT hacia una imagen root que instala nginx/supervisor y nunca reduce privilegios.
- `docker/supervisord.conf:3` â€” user=root para el supervisor que controla la app y nginx.
- `docker-compose.prod.yml:52` â€” .:/app â€” bind de lectura-escritura por defecto del Ã¡rbol de trabajo del host (solo /etc/letsencrypt estÃ¡ marcado como :ro).

**Condiciones:**
- (system_configuration) Aplica al despliegue EC2 Docker Compose; la imagen ECS (Dockerfile.ecs) en cambio se ejecuta como USER nextjs con el cÃ³digo incorporado.

**Perspectiva del atacante:** Atacante remoto que logra ejecuciÃ³n de cÃ³digo en el servidor Next.js o en el proceso nginx dentro del contenedor de producciÃ³n.

**Payloads / entradas:**
- `id  # -> uid=0(root)`
- `echo 'malicious' >> /app/src/<any-file>  # writes the host working tree`

**Instrucciones acotadas:**
1. ReproducciÃ³n estÃ¡tica (no se ejecutÃ³ nada contra el objetivo): confirmar que el Dockerfile no tiene USER, que supervisord.conf:3 establece user=root y que docker-compose.prod.yml:52 monta .:/app sin :ro.
1. ReproducciÃ³n en tiempo de despliegue: tras acceder al contenedor, ejecutar `id` y escribir en un archivo bajo /app, luego observar el cambio en el Ã¡rbol de trabajo del host.

**Resultado observado:** El cÃ³digo fuente establece la ejecuciÃ³n como root y un bind del host en lectura-escritura; un compromiso del contenedor puede modificar el cÃ³digo fuente del repositorio del host que usan los despliegues futuros.

**RemediaciÃ³n:** Agregar un usuario no-root al Dockerfile, ejecutar supervisord/los programas como ese usuario, y montar el cÃ³digo fuente en solo lectura (o incorporar el cÃ³digo a la imagen).

`docker-compose.prod.yml`:
```
    volumes:
      - .:/app:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

**Severity:** likelihood=medium (Depende de una primitiva separada de compromiso del contenedor, pero la app estÃ¡ expuesta a internet y ejecuta muchas dependencias de terceros.) Â· impact=high (Root en el contenedor mÃ¡s un montaje del cÃ³digo fuente del host en lectura-escritura permite manipular el cÃ³digo de la aplicaciÃ³n y persistir entre reinicios y despliegues.) Â· overall=high Â· confidence=high

---

## HIGH â€” La autoactualizaciÃ³n de perfil asigna de forma masiva columnas UserRole arbitrarias

**Fingerprint:** `auth.perfil.update-mass-assignment`

**DescripciÃ³n:** PATCH /api/auth/perfil vincula la escritura al email de la sesiÃ³n pero reenvÃ­a el cuerpo JSON sin procesar, tipado solo en tiempo de compilaciÃ³n como PerfilUpdateRequestDTO, hacia prisma.userRole.updateMany. Cualquier clave JSON adicional que exista en el modelo UserRole (userId, roleId, email, password, resetToken, resetTokenExpires) se escribe, lo que permite autoescalada de privilegios y manipulaciÃ³n de identidad.

**Causa raÃ­z:** authController.updatePerfil asigna await request.json() a un PerfilUpdateRequestDTO sin validaciÃ³n en tiempo de ejecuciÃ³n, AuthApplicationService lo deja pasar, y AuthPrismaRepository.updatePerfil ejecuta updateMany({ where: { email }, data }) con el objeto controlado por el atacante; UncheckedUpdateManyInput de Prisma acepta cualquier columna UserRole vÃ¡lida.

**Comportamiento previsto:** Una autoactualizaciÃ³n de perfil debe validar el cuerpo contra una allowlist del lado del servidor y escribir solo campos de perfil; las columnas de identidad, credenciales y autorizaciÃ³n nunca deben ser alcanzables desde la solicitud.

**Rastreo:**
- *( entrypoint )* `src/app/api/auth/[...slug]/route.ts:17` â€” PATCH /api/auth/perfil: El enrutador Slug despacha la actualizaciÃ³n de perfil a authController.updatePerfil.
- *( propagation )* `src/controllers/auth.controller.ts:64` â€” authController.updatePerfil: Asigna await request.json() a PerfilUpdateRequestDTO sin parseo Zod/runtime.
- *( propagation )* `src/application/auth/auth-service.ts:91` â€” AuthApplicationService.updatePerfil: ReenvÃ­a el objeto sin cambios a repo.updatePerfil(session.email, dto).
- *( sink )* `src/infrastructure/persistence/auth-repository.ts:57` â€” AuthPrismaRepository.updatePerfil: prisma.userRole.updateMany({ where: { email }, data }) con el objeto sin validar.

**Evidencia:**
- `src/types/dto/auth/perfil-update-request.dto.ts:1` â€” PerfilUpdateRequestDTO es una interfaz de tiempo de compilaciÃ³n sin cumplimiento en tiempo de ejecuciÃ³n.
- `src/controllers/auth.controller.ts:64` â€” JSON sin procesar casteado al DTO; sin parseo ni allowlist de campos.
- `src/infrastructure/persistence/auth-repository.ts:57` â€” updateMany propaga el objeto entrante como data de Prisma.
- `prisma/schema.prisma:124` â€” UserRole expone email, password (lÃ­nea 125), roleId (lÃ­nea 123), resetToken/resetTokenExpires (lÃ­neas 132-133) â€” todas columnas escribibles.

**Condiciones:**
- (authentication_level) Cualquier rol autenticado, incluido cliente, puede llamar a PATCH /api/auth/perfil.
- (data_state) La escalada a un rol privilegiado requiere conocer un id de rol; la toma de identidad requiere un email objetivo.

**Perspectiva del atacante:** Un usuario autenticado de bajo privilegio (p. ej. cliente) que actualiza su propio perfil.

**Payloads / entradas:**
- `PATCH /api/auth/perfil {"nombre":"x","roleId":"<admin-role-uuid>"}`
- `PATCH /api/auth/perfil {"email":"victim@iimp.org.pe","password":"chosen-password"}`

**Instrucciones acotadas:**
1. Autenticarse y obtener la cookie de sesiÃ³n.
1. Enviar PATCH /api/auth/perfil con los campos del DTO mÃ¡s columnas UserRole adicionales como roleId, password o email.
1. Reutilizar la sesiÃ³n escalada o iniciar sesiÃ³n con la identidad alterada.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente muestra que el cuerpo sin validar llega a updateMany sin una allowlist, por lo que los campos del modelo suministrados mÃ¡s allÃ¡ del DTO documentado se persisten en la propia fila UserRole del llamador, incluidos roleId/password/userId/email.

**RemediaciÃ³n:** Parsear la solicitud con una allowlist Zod estricta (solo nombre/apellidos/telefono/tipoUsuarioId/idEmpresa/nombreEmpresa), construir un objeto data explÃ­cito a partir de los campos validados, y nunca reenviar el cuerpo sin procesar a Prisma; tratar las columnas de rol/credenciales como solo del servidor.

**Severity:** likelihood=medium (Cualquier usuario autenticado puede intentarlo, aunque escalar a admin requiere conocer un id de rol.) Â· impact=high (Escribir roleId/password/userId/email en la fila del llamador permite escalada de privilegios y manipulaciÃ³n de la identidad de la cuenta.) Â· overall=high Â· confidence=high

---

## HIGH â€” La importaciÃ³n GESS no autenticada permite la creaciÃ³n/sobrescritura arbitraria de stands para cualquier evento

**Fingerprint:** `gess/sync/unauth-import-authority-expansion`

**DescripciÃ³n:** POST /api/gess/sync no estÃ¡ cubierto por el middleware (middleware.ts:72) y gessController.sync no realiza autenticaciÃ³n ni autorizaciÃ³n (gess.controller.ts:39-48). ReenvÃ­a el eventoId suministrado por el llamador (cualquier string) y el arreglo seleccionadas a gessService.sync, que hace upsert de filas GessStand con uid, tipoStand, estado, empresa, pabellon y rawData controlados por el llamador (gess-service.ts:61-98). Un llamador anÃ³nimo puede inyectar o sobrescribir el inventario de stands de cualquier evento, expandiendo su autoridad mÃ¡s allÃ¡ de cualquier conjunto de datos autorizado.

**Causa raÃ­z:** La ruta /api/gess falta tanto en PROTECTED como en las listas pÃºblicas, el controlador de sync nunca llama a getSession, y el servicio acepta un eventoId arbitrario mÃ¡s filas suministradas por el llamador sin validar la autoridad ni el vÃ­nculo con el evento.

**Comportamiento previsto:** Una importaciÃ³n masiva debe exigir autenticaciÃ³n, un permiso de importaciÃ³n y vÃ­nculo con el evento, y no deberÃ­a permitir que el llamador elija quÃ© datos de evento se escriben.

**Rastreo:**
- *( entrypoint )* `src/middleware.ts:72` â€” middleware fall-through: se permite /api/gess/sync de forma anÃ³nima porque ningÃºn prefijo coincide.
- *( propagation )* `src/controllers/gess.controller.ts:39` â€” gessController.sync: El handler toma directamente body.eventoId/seleccionadas y llama a services.gess.sync sin verificaciÃ³n de sesiÃ³n ni de permisos.
- *( sink )* `src/application/gess/gess-service.ts:88` â€” GessApplicationService.sync upsert: Para cada fila del llamador el servicio actualiza o crea un GessStand con campos controlados por el atacante bajo el eventoId elegido.

**Evidencia:**
- `src/application/gess/gess-service.ts:62` â€” las filas provienen de body.seleccionadas cuando no estÃ¡ vacÃ­o, es decir, totalmente controladas por el atacante.
- `src/application/gess/gess-service.ts:79` â€” El objeto data persistido mapea los campos del llamador directamente a standApiId/standCode/tipoStand/estado/empresa/rawData.
- `src/infrastructure/persistence/gess-repository.ts:51` â€” create/update van directo a prisma.gessStand sin predicado de autorizaciÃ³n.
- `src/app/api/gess/[...slug]/route.ts:9` â€” POST mapea el slug `sync` a gessController.sync sin wrapper de guarda.

**Condiciones:**
- (data_state) La creaciÃ³n de filas siempre tiene Ã©xito para una relaciÃ³n eventoId vÃ¡lida; la sobrescritura requiere filas coincidentes (eventoId, standApiId).

**Perspectiva del atacante:** Un cliente de internet anÃ³nimo.

**Payloads / entradas:**
- `{"eventoId":"<any-evento-id>","tipoEvento":0,"codigoEvento":0,"seleccionadas":[{"uid":"ATTACKER-1","tipo":"PREFERENCIAL","status":"reservado","company":"Attacker SA"}]}`

**Instrucciones acotadas:**
1. Enviar POST /api/gess/sync con un eventoId arbitrario y un arreglo seleccionadas, sin cookie de sesiÃ³n.
1. Consultar GET /api/gess/listar?eventoId=... para confirmar que las filas de stands inyectadas se persistieron.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que el controlador reenvÃ­a el cuerpo sin autenticaciÃ³n y el servicio crea/actualiza filas GessStand a partir del arreglo suministrado por el llamador para el evento elegido por el llamador.

**RemediaciÃ³n:** Proteger la familia /api/gess con autenticaciÃ³n y un permiso de importaciones, derivar eventoId de la sesiÃ³n en lugar del cuerpo cuando sea posible, y validar las filas importadas contra un esquema.

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

**Severity:** likelihood=high (AnÃ³nimo e incondicional; una sola solicitud elaborada es suficiente.) Â· impact=high (La creaciÃ³n/sobrescritura arbitraria del inventario de stands para cualquier evento socava la integridad de los datos y cualquier lÃ³gica de reserva posterior que confÃ­e en gess_stand.) Â· overall=high Â· confidence=high

---

## HIGH â€” DivulgaciÃ³n no autenticada del inventario de stands GESS en todos los eventos

**Fingerprint:** `gess.listar.unauth-stand-inventory-disclosure`

**DescripciÃ³n:** GET /api/gess/listar no estÃ¡ cubierto por ninguna guarda del middleware (middleware.ts:72); gessController.listar no realiza verificaciÃ³n de sesiÃ³n y acepta cualquier eventoId o bloqueId (gess.controller.ts:8-31). El repositorio ejecuta prisma.gessStand.findMany({ where: { eventoId } }) sin `select`, devolviendo todas las columnas, incluidos empresa, email, userId y rawData (gess-repository.ts:14-20; schema.prisma:181-212). Debido a que el endpoint pÃºblico /api/eventos/listar?presala=1 expone eventoIds reales, un cliente anÃ³nimo puede enumerar el inventario de stands (empresa y email del expositor, userId interno, datos upstream sin procesar) de cualquier evento.

**Causa raÃ­z:** La familia de rutas /api/gess estÃ¡ ausente de la lista de autorizaciÃ³n del middleware, el controlador de listar nunca autentica al llamador ni vincula el evento a la sesiÃ³n, y el repositorio devuelve la fila completa sin proyecciÃ³n de campos.

**Comportamiento previsto:** Una lectura del inventario de stands debe ser autenticada/autorizada por la guarda del middleware y estar vinculada al alcance de evento del llamador, y debe exponer solo los campos que el llamador tiene derecho a ver.

**Rastreo:**
- *( entrypoint )* `src/middleware.ts:72` â€” middleware fall-through: /api/gess/listar no es ni protegido ni pÃºblico, por lo que es alcanzable sin sesiÃ³n.
- *( propagation )* `src/controllers/gess.controller.ts:10` â€” gessController.listar: eventoId y bloqueId se leen del query y se usan sin verificaciÃ³n de sesiÃ³n ni de permisos.
- *( sink )* `src/infrastructure/persistence/gess-repository.ts:14` â€” GessPrismaRepository.findAllPaginated: findMany sin select devuelve todas las columnas de GessStand, incluidos empresa, email, userId y rawData.

**Evidencia:**
- `src/infrastructure/persistence/gess-repository.ts:32` â€” findByBloque igualmente devuelve una fila completa para cualquier bloqueId sin autorizaciÃ³n.
- `prisma/schema.prisma:194` â€” GessStand expone las columnas email, userId y rawData que la respuesta no autenticada incluye.
- `src/middleware.ts:44` â€” La excepciÃ³n presala hace pÃºblico /api/eventos/listar?presala=1, proporcionando eventoIds reales para enumeraciÃ³n.
- `src/app/api/gess/[...slug]/route.ts:6` â€” GET mapea el slug `listar` a gessController.listar sin guarda.

**Condiciones:**
- (data_state) Deben existir filas de stands para el eventoId consultado para que se devuelvan datos.

**Perspectiva del atacante:** Un cliente de internet anÃ³nimo.

**Payloads / entradas:**
- `GET /api/gess/listar?eventoId=<id>&per_page=100`
- `GET /api/gess/listar?bloqueId=<bloqueId>`

**Instrucciones acotadas:**
1. Obtener un eventoId real desde el endpoint pÃºblico GET /api/eventos/listar?presala=1.
1. Solicitar GET /api/gess/listar?eventoId=<id> sin cookie de sesiÃ³n.
1. Observar las filas de stands devueltas, incluidos empresa, email, userId y rawData.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que el GET pasa por el fall-through del middleware, el controlador no realiza verificaciÃ³n de autenticaciÃ³n, y el repositorio devuelve el conjunto completo de filas GessStand para el eventoId suministrado por el llamador.

**RemediaciÃ³n:** Agregar /api/gess a PROTECTED con un permiso adecuado, exigir getSession y vincular eventoId a la sesiÃ³n en listar, y proyectar solo los campos que el llamador necesita (excluyendo email/userId/rawData).

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

**Severity:** likelihood=high (AnÃ³nimo, sin restricciÃ³n por id, y los eventoIds estÃ¡n disponibles desde un endpoint pÃºblico.) Â· impact=high (Divulga nombres de empresas expositoras, email de contacto, userId interno y datos upstream sin procesar de eventos arbitrarios.) Â· overall=high Â· confidence=high

---

## HIGH â€” La generaciÃ³n de mockup no autenticada reinicia el estado de GessStand a disponible y limpia empresa

**Fingerprint:** `gess/mockup/unauth-stand-state-reset`

**DescripciÃ³n:** POST /api/gess/mockup no estÃ¡ cubierto por ninguna guarda del middleware (middleware.ts:72) y gessController.mockup no realiza verificaciÃ³n de sesiÃ³n ni de permisos (gess.controller.ts:50-59). Tras resolver los planos del evento, gessService.mockup hace upsert de cada stand del bloque forzando estado: "disponible" y empresa: null (gess-service.ts:124-145, especÃ­ficamente :132-133). Por lo tanto, un llamador anÃ³nimo que suministra un eventoId existente (con tipoEvento/codigoEvento) puede reiniciar el estado de stands en vivo y desvincular la empresa asociada a cada stand.

**Causa raÃ­z:** La familia /api/gess no tiene protecciÃ³n del middleware y el handler de mockup no tiene verificaciÃ³n de autorizaciÃ³n, mientras que el generador sobrescribe incondicionalmente estado/empresa en filas existentes que coinciden por (eventoId, bloqueId).

**Comportamiento previsto:** Un generador de datos de demostraciÃ³n es una acciÃ³n administrativa privilegiada; debe requerir autorizaciÃ³n y no debe degradar el estado de stands de producciÃ³n existente.

**Rastreo:**
- *( entrypoint )* `src/middleware.ts:72` â€” middleware fall-through: /api/gess/mockup no es ni protegido ni pÃºblico, por lo que es alcanzable de forma anÃ³nima.
- *( propagation )* `src/controllers/gess.controller.ts:50` â€” gessController.mockup: El handler valida que eventoId/tipoEvento/codigoEvento estÃ©n presentes pero nunca autentica ni autoriza al llamador.
- *( sink )* `src/application/gess/gess-service.ts:132` â€” GessApplicationService.mockup upsert: Cada stand coincidente se actualiza con estado: "disponible" y empresa: null (lÃ­nea 133), sobrescribiendo los valores en vivo.

**Evidencia:**
- `src/application/gess/gess-service.ts:124` â€” El bucle llama a findByStandApiId(eventoId, b.bloqueId) y luego a repo.update(exists.id, data) para los stands existentes.
- `src/application/gess/gess-service.ts:133` â€” data.empresa estÃ¡ codificado de forma fija como null, borrando cualquier empresa actualmente vinculada al stand.
- `src/app/api/gess/[...slug]/route.ts:10` â€” POST mapea el slug `mockup` a gessController.mockup sin guarda.

**Condiciones:**
- (data_state) El efecto real requiere filas GessStand existentes para el evento/bloques objetivo; los planos deben resolverse para tipoEvento/codigoEvento.

**Perspectiva del atacante:** Un cliente de internet anÃ³nimo.

**Payloads / entradas:**
- `{"eventoId":"<existing-evento-id>","tipoEvento":1,"codigoEvento":1}`

**Instrucciones acotadas:**
1. Enviar POST /api/gess/mockup con un eventoId existente y tipoEvento/codigoEvento vÃ¡lidos, sin cookie de sesiÃ³n.
1. Volver a leer los stands afectados (p. ej. vÃ­a GET /api/gess/listar) para observar el estado reiniciado a disponible y empresa limpiada.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que el handler se ejecuta sin autenticaciÃ³n y que la ruta de actualizaciÃ³n del servicio fuerza estado: "disponible" y empresa: null en cada stand coincidente.

**RemediaciÃ³n:** Exigir autenticaciÃ³n mÃ¡s un permiso administrativo para mockup (y toda la familia /api/gess), y condicionar la generaciÃ³n de demostraciÃ³n a una verificaciÃ³n de entorno no-producciÃ³n para que no pueda sobrescribir el estado en vivo.

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

**Severity:** likelihood=high (El endpoint es anÃ³nimo y determinista; solo se necesita un eventoId existente y cÃ³digos de evento.) Â· impact=high (El estado de stands en vivo y el vÃ­nculo con la empresa se reinician silenciosamente, corrompiendo los datos de reserva/ocupaciÃ³n del evento objetivo.) Â· overall=high Â· confidence=high

---

## HIGH â€” La reserva de stands no autenticada bloquea inventario y crea solicitudes

**Fingerprint:** `reservas/crear/unauth-stand-block-and-solicitud`

**DescripciÃ³n:** POST /api/reservas/crear llama a getSession() pero descarta un resultado null, por lo que un llamador anÃ³nimo continÃºa. El servicio marca cada stand solicitado como en_evaluacion, registra el email/usuario del llamador, y luego crea una solicitud con tres registros de revisiÃ³n, filas de alerta y correos de confirmaciÃ³n. La ruta no estÃ¡ protegida por el middleware, por lo que un atacante no autenticado puede bloquear el inventario de stands e inyectar solicitudes falsas en el flujo de revisiÃ³n.

**Causa raÃ­z:** reserva.controller.ts:10 obtiene la sesiÃ³n pero nunca devuelve 401 cuando es null; reenvÃ­a session?.email y session?.sub (undefined) hacia services.reservas.crear, y reserva-service.ts:27-43 y 52-59 aplican la transiciÃ³n de estado y crean la solicitud de todos modos. NingÃºn prefijo de PROTECTED coincide con /api/reservas en middleware.ts.

**Comportamiento previsto:** Crear una reserva muta el estado compartido de los stands e inicia un flujo de aprobaciÃ³n; debe exigir un propietario autenticado (y el permiso write:reservas) antes de cualquier cambio de estado.

**Rastreo:**
- *( entrypoint )* `src/middleware.ts:50` â€” PROTECTED prefix loop: Ninguna entrada de PROTECTED coincide con /api/reservas y no es pÃºblica, por lo que la solicitud anÃ³nima cae en el fall-through en la lÃ­nea 72.
- *( propagation )* `src/app/api/reservas/[...slug]/route.ts:6` â€” POST crear dispatch: createRouter despacha el POST anÃ³nimo a reservaController.crear.
- *( propagation )* `src/controllers/reserva.controller.ts:10` â€” crear: Se llama a getSession() pero su resultado null no se rechaza; la solicitud continÃºa con session?.email y session?.sub undefined.
- *( sink )* `src/application/reservas/reserva-service.ts:37` â€” stand state transition: gessRepo.update establece el estado del stand a en_evaluacion, almacena el email/usuario del llamador y los documentos opcionales, y luego las lÃ­neas 52-59 crean la solicitud y tres registros de revisiÃ³n.

**Evidencia:**
- `src/controllers/reserva.controller.ts:10` â€” La sesiÃ³n se lee pero nunca se rechaza cuando es null.
- `src/controllers/reserva.controller.ts:15` â€” session?.email y session?.sub toman el valor undefined por defecto para llamadores anÃ³nimos.
- `src/application/reservas/reserva-service.ts:38` â€” ESTADOS_STAND.EN_EVALUACION se asigna al stand.
- `src/application/reservas/reserva-service.ts:52` â€” crearSolicitud mÃ¡s tres llamadas a crearRevisionInicial crean el registro del flujo de trabajo.
- `src/application/reservas/reserva-service.ts:106` â€” El correo de notificaciÃ³n al administrador se envÃ­a desde el flujo no autenticado.
- `src/lib/shared/constants.ts:212` â€” cliente es el rol que se espera cree reservas (write:reservas); ese permiso nunca se aplica.

**Condiciones:**
- (authentication_level) anonymous: no se requiere cookie de token.
- (data_state) el atacante debe enviar identificadores de stands que existan y que no estÃ©n ya bloqueados; los ids de GessStand enumerables hacen esto prÃ¡ctico.

**Perspectiva del atacante:** Cliente HTTP no autenticado.

**Payloads / entradas:**
- `POST /api/reservas/crear body {"standIds":["<existing-stand-id>"],"datos":{"razonSocial":"x","tipoDocumento":"DNI","numeroDocumento":"1","email":"a@b.com"}} with no Cookie header`

**Instrucciones acotadas:**
1. Emitir el POST sin cookie de token.
1. Observar que getSession() devuelve null pero el controlador igualmente llama a services.reservas.crear.
1. Observar que la fila del stand se actualiza a en_evaluacion y se crea una solicitud con filas de revisiÃ³n de comunicacion, legal y logistica.

**Resultado observado:** No ejecutado (sin sandbox impuesto por el SO en el host de auditorÃ­a); el rastreo del cÃ³digo fuente muestra de forma determinista que una sesiÃ³n null no se rechaza y que la actualizaciÃ³n del stand mÃ¡s la creaciÃ³n de la solicitud y las revisiones se ejecutan para el llamador anÃ³nimo.

**RemediaciÃ³n:** Rechazar sesiones null en reservaController.crear con un 401 y aplicar write:reservas, luego reverificar el alcance de propietario/evento en el servicio antes de mutar los stands; agregar /api/reservas a la lista PROTECTED del middleware y hacer que /api deniegue por defecto.

**Severity:** likelihood=high (el endpoint es alcanzable de forma anÃ³nima y los ids de reserva son valores de solicitud ordinarios.) Â· impact=high (un actor anÃ³nimo puede quitar stands de disponibilidad para todos los demÃ¡s clientes e inyectar solicitudes y correos falsos en un flujo de revisiÃ³n compartido.) Â· overall=high Â· confidence=high

---

## HIGH â€” ActualizaciÃ³n no autenticada de cualquier GessStand por id

**Fingerprint:** `gess/actualizar/unauth-arbitrary-id-update`

**DescripciÃ³n:** PATCH /api/gess/actualizar se despacha a travÃ©s del enrutador [...slug] (gess/[...slug]/route.ts:12-14) pero /api/gess no aparece ni en PROTECTED ni en las listas pÃºblicas, por lo que el middleware lo permite de forma anÃ³nima (middleware.ts:72). gessController.actualizar no realiza verificaciÃ³n de sesiÃ³n (gess.controller.ts:33-37); parsea updateGessStandSchema (que acepta cualquier id mÃ¡s estado/documentos/imagenes/bloqueId, gess.validator.ts:3-9) y llama a services.gess.actualizarStand, que llama a repo.update(id, data) -> prisma.gessStand.update({ where: { id } }) sin predicado de propietario o evento (gess-repository.ts:56-59). Por lo tanto, un llamador anÃ³nimo puede modificar el estado, documentos o imÃ¡genes de cualquier stand en todos los eventos.

**Causa raÃ­z:** La familia de rutas /api/gess estÃ¡ ausente de la lista de autorizaciÃ³n del middleware y el controlador/repositorio no aplican autenticaciÃ³n, permisos ni predicado de evento/propietario, por lo que un id suministrado por el cliente se escribe directamente.

**Comportamiento previsto:** Actualizar un stand GESS debe exigir que el llamador estÃ© autenticado y autorizado para ese evento, y la actualizaciÃ³n debe estar vinculada al alcance del llamador; las escrituras arbitrarias por id de clientes anÃ³nimos deben denegarse.

**Rastreo:**
- *( entrypoint )* `src/middleware.ts:72` â€” middleware fall-through: /api/gess no coincide con ningÃºn prefijo de PROTECTED ni con ninguna lista pÃºblica, por lo que la solicitud continÃºa sin autenticaciÃ³n.
- *( propagation )* `src/controllers/gess.controller.ts:33` â€” gessController.actualizar: El handler parsea el cuerpo con updateGessStandSchema y llama a services.gess.actualizarStand sin verificaciÃ³n de getSession/autorizaciÃ³n.
- *( sink )* `src/infrastructure/persistence/gess-repository.ts:57` â€” GessPrismaRepository.update: prisma.gessStand.update({ where: { id }, data }) escribe el registro seleccionado por el atacante sin predicado de propietario/evento.

**Evidencia:**
- `src/validators/gess.validator.ts:3` â€” updateGessStandSchema acepta id, bloqueId, documentos, imagenes y estado sin ningÃºn campo de evento/propiedad.
- `src/application/gess/gess-service.ts:57` â€” actualizarStand reenvÃ­a el objeto parseado (incluidos estado/documentos/imagenes elegidos por el atacante) al repositorio.
- `src/app/api/gess/[...slug]/route.ts:12` â€” PATCH mapea el slug `actualizar` a gessController.actualizar sin ningÃºn wrapper de guarda.
- `prisma/schema.prisma:181` â€” Las filas GessStand contienen estado, empresa, documentos, imagenes y rawData que la actualizaciÃ³n no autenticada puede reescribir.

**Condiciones:**
- (data_state) El id de GessStand objetivo debe existir para que la actualizaciÃ³n persista (Prisma lanza una excepciÃ³n en caso contrario); los ids son descubribles vÃ­a el endpoint listar no autenticado.

**Perspectiva del atacante:** Un cliente de internet anÃ³nimo.

**Payloads / entradas:**
- `{"id":"<gessStand.id>","estado":"reservado","documentos":["https://attacker.example/x"]}`

**Instrucciones acotadas:**
1. Obtener un id de GessStand desde la respuesta del GET /api/gess/listar?eventoId=... no autenticado.
1. Enviar PATCH /api/gess/actualizar con ese id y estado/documentos/imagenes arbitrarios, sin ninguna cookie de sesiÃ³n.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que el middleware deja pasar el PATCH y el repositorio actualiza la fila seleccionada Ãºnicamente por el id suministrado por el atacante.

**RemediaciÃ³n:** Agregar /api/gess a la lista PROTECTED del middleware con un permiso apropiado (y vÃ­nculo con el evento), y exigir getSession mÃ¡s un predicado con alcance de evento/propietario en actualizarStand/el repositorio.

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

**Severity:** likelihood=high (La ruta es anÃ³nima y acepta cualquier id; no se necesita ningÃºn secreto ni cuenta.) Â· impact=high (La integridad del inventario de stands, incluidos estado, empresa y documentos relevantes para reservas, puede reescribirse para registros y eventos arbitrarios.) Â· overall=high Â· confidence=high

---

## MEDIUM â€” .gitignore omite .env.prod / .env.production pese a que producciÃ³n los requiere

**Fingerprint:** `gitignore:.env.prod-not-ignored`

**DescripciÃ³n:** .gitignore excluye .env, .env.local, las variantes *.local y *.pem/*.key, pero no tiene ninguna regla que coincida con .env.prod o .env.production. La documentaciÃ³n de despliegue y docker-compose.prod.yml requieren un .env.prod poblado que contenga DB_PASSWORD y JWT_SECRET en el Ã¡rbol de trabajo, por lo que estos secretos de producciÃ³n pueden confirmarse accidentalmente.

**Causa raÃ­z:** Los patrones de ignorado de archivos de entorno enumeran `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local` y `.env*.local`, ninguno de los cuales coincide con el nombre `.env.prod` que realmente usa el proyecto.

**Comportamiento previsto:** Todo archivo de entorno que contenga secretos y que use el proyecto, incluidos .env.prod y .env.production, debe excluirse del control de versiones.

**Rastreo:**
- *( entrypoint )* `.gitignore:34` â€” variables de entorno block: La lista de ignorados comienza en .env pero nunca incluye .env.prod/.env.production.
- *( propagation )* `docker-compose.prod.yml:41` â€” app service env_file: El servicio de producciÃ³n requiere .env.prod en el Ã¡rbol de trabajo.
- *( sink )* `.env.prod.example:19` â€” secret template: La plantilla documenta DB_PASSWORD y JWT_SECRET que el .env.prod real contendrÃ¡.

**Evidencia:**
- `.gitignore:39` â€” .env*.local solo coincide con archivos que terminan en .local; .env.prod y .env.production no coinciden con ninguna lÃ­nea anterior.
- `docs/01-despliegue/despliegue.md:81` â€” Las instrucciones de despliegue requieren un .env.prod poblado con DB_PASSWORD/JWT_SECRET reales en el Ã¡rbol de trabajo.
- `.env.prod.example:20` â€” DATABASE_URL/DB_PASSWORD y JWT_SECRET son el contenido secreto en riesgo.

**Condiciones:**
- (system_configuration) Se materializa solo una vez que un operador crea un .env.prod real a partir del ejemplo; el Ã¡rbol rastreado actual contiene solo .env.example y .env.prod.example.

**Perspectiva del atacante:** Un committer oportunista o descuidado cuyo .env.prod local es preparado por un git add amplio y empujado al remoto.

**Payloads / entradas:**
- `git add .env.prod && git commit -m 'config' && git push`

**Instrucciones acotadas:**
1. ReproducciÃ³n estÃ¡tica (no se ejecutÃ³ nada contra el objetivo): aplicar los patrones de .gitignore a la cadena '.env.prod' â€” ningÃºn patrÃ³n coincide.
1. Verificar con `git check-ignore -v .env.prod .env.production` en la raÃ­z del repositorio; ambos nombres estÃ¡n sin ignorar.

**Resultado observado:** Ninguna regla de .gitignore coincide con .env.prod/.env.production, por lo que un archivo poblado de secretos de producciÃ³n serÃ­a rastreado y empujado si se prepara.

**RemediaciÃ³n:** Agregar reglas de ignorado explÃ­citas para todos los archivos de entorno de producciÃ³n antes de que exista cualquier .env.prod real.

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

**Severity:** likelihood=medium (Requiere que se cree y prepare un .env.prod real, lo que el flujo de trabajo documentado vuelve rutinario; actualmente no hay ningÃºn secreto confirmado.) Â· impact=high (Un .env.prod confirmado expone la contraseÃ±a de la base de datos de producciÃ³n y el secreto de firma JWT, lo que permite acceso total a los datos y falsificaciÃ³n de sesiones.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” La autorizaciÃ³n confÃ­a en los claims del JWT sin revocaciÃ³n hasta que expira a las 24h

**Fingerprint:** `authz.jwt.claims-only-no-revocation`

**DescripciÃ³n:** El middleware y hasPermission autorizan Ãºnicamente a partir de los claims firmados del JWT. Los cambios de permisos/roles en la base de datos (roles.controller -> role-repository.updatePermisos/addUser/removeUser) no invalidan los tokens emitidos, y hasDBPermission (la Ãºnica verificaciÃ³n respaldada por la BD) se llama en un solo endpoint. Un principal revocado o degradado conserva el acceso hasta el tiempo de vida del token de 24h.

**Causa raÃ­z:** La guarda del middleware llama a hasPermission(payload, permission), que lee solo payload.permissions/payload.roles; no hay denylist, versiÃ³n de sesiÃ³n ni verificaciÃ³n de permisos en la BD para toda la app, y los tokens expiran solo despuÃ©s de 24h.

**Comportamiento previsto:** La autorizaciÃ³n debe reflejar el estado actual de roles/permisos del lado del servidor, o la revocaciÃ³n debe surtir efecto dentro de una ventana corta y acotada.

**Rastreo:**
- *( entrypoint )* `src/middleware.ts:58` â€” middleware PROTECTED prefix loop: Rechaza solo cuando hasPermission(payload, route.permission) es false, usando los claims del token.
- *( propagation )* `src/lib/server/auth.ts:70` â€” hasPermission: Lee payload.permissions y payload.roles del JWT, sin consulta a la base de datos.
- *( sink )* `src/lib/server/auth.ts:40` â€” signToken: Emite un token de 24h cuyos claims no pueden revocarse antes de la expiraciÃ³n.

**Evidencia:**
- `src/lib/server/auth.ts:70` â€” hasPermission devuelve payload.permissions.includes(...) || payload.roles.includes(admin).
- `src/middleware.ts:58` â€” La guarda de autorizaciÃ³n consume solo los claims verificados.
- `src/lib/server/auth.ts:40` â€” Los tokens se configuran para expirar tras 24h sin ninguna ventana de revalidaciÃ³n mÃ¡s corta.
- `src/controllers/solicitudes.controller.ts:54` â€” hasDBPermission se importa y usa exactamente en este Ãºnico endpoint; ninguna otra ruta reverifica la base de datos.
- `src/infrastructure/persistence/role-repository.ts:29` â€” Los permisos de rol se mutan en la base de datos independientemente de los tokens emitidos.

**Condiciones:**
- (authorization_role) Un administrador cambia los permisos (updatePermisos/addUser/removeUser) del principal.
- (timing_dependency) El principal afectado sigue usando el token dentro de su tiempo de vida de 24h.

**Perspectiva del atacante:** Un usuario cuyo permiso o rol acaba de ser revocado, o una cuenta dada de baja, que aÃºn conserva una cookie de sesiÃ³n vÃ¡lida.

**Payloads / entradas:**
- `GET /api/facturacion/... with the previously issued token cookie`

**Instrucciones acotadas:**
1. Obtener un token mientras se posee un permiso.
1. Hacer que un administrador revoque el permiso o elimine la cuenta.
1. Seguir llamando a las rutas protegidas por ese permiso con la misma cookie.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente muestra que la guarda verifica solo la firma y lee los permisos del token, por lo que los permisos revocados siguen siendo efectivos hasta la expiraciÃ³n a las 24h.

**RemediaciÃ³n:** Usar tokens de acceso de vida corta con refresh mÃ¡s una versiÃ³n de sesiÃ³n/token del lado del servidor o una denylist verificada en cada solicitud, y aplicar verificaciones de permisos respaldadas por la BD en rutas sensibles en lugar de confiar solo en los claims.

**Severity:** likelihood=medium (Requiere una concesiÃ³n legÃ­tima previa y un cambio posterior de rol/permiso, que es una operaciÃ³n administrativa normal.) Â· impact=high (Los principales revocados o degradados conservan acceso total a la funcionalidad protegida hasta por 24h.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” CloudFront reenvÃ­a el trÃ¡fico de los espectadores al origen ALB por HTTP en texto claro

**Fingerprint:** `terraform.cloudfront:origin-http-only-cleartext`

**DescripciÃ³n:** El origen personalizado de la distribuciÃ³n de CloudFront establece origin_protocol_policy = "http-only", por lo que CloudFront termina el TLS en el borde y retransmite las solicitudes al ALB expuesto a internet mediante HTTP en texto plano sobre el puerto 80, exponiendo los JWT de sesiÃ³n, los datos personales y la informaciÃ³n relacionada con pagos a la interceptaciÃ³n entre CloudFront y el origen, a pesar de que existe un listener HTTPS disponible en el ALB.

**Causa raÃ­z:** La polÃ­tica de protocolo del origen estÃ¡ codificada de forma fija como http-only aunque el ALB aprovisiona un listener HTTPS cuando enable_https es true (es true en prod).

**Comportamiento esperado:** CloudFront deberÃ­a alcanzar el origen por HTTPS (origin_protocol_policy = "https-only") usando el listener TLS del ALB y un certificado validado.

**Trace:**
- *( entrypoint )* `terraform/modules/cloudfront/main.tf:184` â€” aws_cloudfront_distribution.main origin: el origen es el nombre DNS del ALB expuesto a internet.
- *( propagation )* `terraform/modules/cloudfront/main.tf:188` â€” custom_origin_config: se declaran http_port 80 / https_port 443, y luego el protocolo se fuerza a http-only.
- *( sink )* `terraform/modules/cloudfront/main.tf:191` â€” custom_origin_config.origin_protocol_policy: origin_protocol_policy = "http-only" â€” CloudFront usa el puerto 80 hacia el origen.

**Evidencia:**
- `terraform/modules/cloudfront/main.tf:191` â€” Protocolo de origen http-only explÃ­cito a pesar de viewer_protocol_policy = redirect-to-https para los clientes.
- `terraform/modules/ecs/main.tf:550` â€” Existe un listener HTTPS del ALB (enable_https true en prod), por lo que el salto hacia el origen en texto claro es una decisiÃ³n, no una restricciÃ³n.
- `terraform/modules/ecs/main.tf:534` â€” Los comentarios reconocen el diseÃ±o de origen http-only (el ALB debe reenviar, no redirigir, para evitar un bucle).

**Condiciones:**
- (network_routing) CloudFront se conecta al DNS pÃºblico del ALB por el puerto 80, por lo que el salto atraviesa redes donde el HTTP en texto plano puede ser observado.

**Perspectiva del atacante:** Un adversario posicionado en la red (o un intermediario comprometido) en la ruta entre un borde de CloudFront y el ALB/la regiÃ³n.

**Payloads / inputs:**
- `Passive capture of plaintext HTTP requests/responses on the CloudFront-to-ALB hop.`

**Instrucciones acotadas:**
1. ReproducciÃ³n estÃ¡tica (no se ejecutÃ³ el objetivo): leer terraform/modules/cloudfront/main.tf:191 y confirmar origin_protocol_policy = "http-only".
1. ReproducciÃ³n en el momento del despliegue: inspeccionar el trÃ¡fico del origen desplegado y confirmar que las solicitudes llegan al puerto 80 del ALB sin TLS.

**Resultado observado:** El cÃ³digo fuente fija el protocolo del origen en HTTP-only, por lo que los payloads del borde al origen se transportan sin cifrar.

**RemediaciÃ³n:** Establecer la polÃ­tica de protocolo del origen en https-only y apuntar CloudFront al listener TLS del ALB con el certificado validado.

`terraform/modules/cloudfront/main.tf`:
```
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
```

**Severity:** likelihood=medium (Requiere una posiciÃ³n de red en la ruta de CloudFront al origen; el salto no estÃ¡ autenticado mediante TLS mutuo.) Â· impact=medium (La interceptaciÃ³n revela tokens de sesiÃ³n, datos personales y datos comerciales en trÃ¡nsito, pero el atacante no puede reescribir trivialmente las respuestas en un tramo de espectador cifrado.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” El flujo de trabajo de despliegue invoca un tag mutable de una acciÃ³n de terceros mientras le entrega credenciales EC2 de producciÃ³n

**Fingerprint:** `github.workflows.deploy.yml:ssh-action-mutable-tag-with-prod-secrets`

**DescripciÃ³n:** El job de despliegue de CD en .github/workflows/deploy.yml invoca appleboy/ssh-action@v1.2.2, un tag de versiÃ³n mÃ³vil en lugar de un commit fijado, y le entrega el host de producciÃ³n, la clave privada SSH y el token de git. El cÃ³digo al que resuelva ese tag en tiempo de ejecuciÃ³n se ejecuta en el runner de GitHub con esos secretos, y el job se ejecuta automÃ¡ticamente en cada push a main sin un entorno protegido.

**Causa raÃ­z:** La acciÃ³n de terceros se referencia mediante un tag semver mutable (v1.2.2) en lugar de un SHA de commit completo e inmutable, por lo que su contenido puede cambiarse despuÃ©s de la revisiÃ³n y no estÃ¡ vinculado por integridad.

**Comportamiento esperado:** Las acciones de terceros que reciben credenciales de producciÃ³n deben fijarse a un SHA de commit completo (o incluirse como cÃ³digo propio) y el job de despliegue debe estar condicionado por un GitHub Environment protegido.

**Trace:**
- *( entrypoint )* `.github/workflows/deploy.yml:113` â€” job deploy â€” paso Deploy via SSH: uses: appleboy/ssh-action@v1.2.2 â€” acciÃ³n resuelta desde un tag mutable.
- *( propagation )* `.github/workflows/deploy.yml:117` â€” with: key/host/username: los secretos de producciÃ³n EC2_SSH_KEY, EC2_HOST, EC2_USERNAME y EC2_GIT_TOKEN se pasan a la acciÃ³n mutable.
- *( sink )* `.github/workflows/deploy.yml:124` â€” script remoto ejecutado por la acciÃ³n: la acciÃ³n ejecuta un script remoto que consume EC2_GIT_TOKEN, por lo que mover el tag produce ejecuciÃ³n con la credencial de despliegue de producciÃ³n.

**Evidencia:**
- `.github/workflows/deploy.yml:113` â€” uses: appleboy/ssh-action@v1.2.2 â€” referencia por tag, no un SHA de commit de 40 caracteres.
- `.github/workflows/deploy.yml:117` â€” key: ${{ secrets.EC2_SSH_KEY }} â€” clave privada SSH de producciÃ³n expuesta a la acciÃ³n.
- `.github/workflows/deploy.yml:96` â€” La condiciÃ³n del job de despliegue se ejecuta en push a refs/heads/main sin protecciÃ³n de entorno ni aprobaciÃ³n.

**Condiciones:**
- (system_configuration) El job de despliegue se ejecuta automÃ¡ticamente en push a main; no se declara ninguna protecciÃ³n de GitHub Environment en el cÃ³digo fuente, por lo que un tag movido aguas arriba se consume sin revisiÃ³n humana.

**Perspectiva del atacante:** Un atacante de la cadena de suministro capaz de mover el tag v1.2.2 en el repositorio aguas arriba appleboy/ssh-action (o de comprometerlo).

**Payloads / inputs:**
- `Re-point the appleboy/ssh-action v1.2.2 tag to an attacker-controlled commit that exfiltrates the with: inputs.`

**Instrucciones acotadas:**
1. ReproducciÃ³n estÃ¡tica (no se ejecutÃ³ el objetivo): inspeccionar .github/workflows/deploy.yml, confirmar que la lÃ­nea 113 resuelve la acciÃ³n desde el tag v1.2.2 en lugar de un SHA, y confirmar que las lÃ­neas 115-124 pasan EC2_SSH_KEY y EC2_GIT_TOKEN a esa acciÃ³n.
1. ReproducciÃ³n en el momento del despliegue: mover el tag aguas arriba al cÃ³digo del atacante y hacer push de cualquier commit a main; el job de despliegue ejecuta entonces el cÃ³digo movido con los secretos de producciÃ³n.

**Resultado observado:** El cÃ³digo fuente establece la referencia al tag mutable y las entradas de secretos; no existe ningÃºn vÃ­nculo de integridad con un commit revisado, por lo que las credenciales quedan expuestas a cualquier cÃ³digo al que apunte el tag en tiempo de ejecuciÃ³n.

**RemediaciÃ³n:** Fijar todas las acciones de terceros a SHA de commit completos (p. ej. appleboy/ssh-action@<40-hex-sha>) y exigir la aprobaciÃ³n de un revisor mediante un GitHub Environment protegido para el job de despliegue.

`.github/workflows/deploy.yml`:
```
        uses: appleboy/ssh-action@<immutable-40-char-commit-sha> # v1.2.2
```

**Severity:** likelihood=low (Requiere que el mantenedor aguas arriba mueva el tag (o que se comprometa el repositorio aguas arriba); no hay evidencia de que eso haya ocurrido.) Â· impact=high (Una sustituciÃ³n exitosa entrega la clave privada SSH de EC2 y un token de GitHub de larga duraciÃ³n, lo que permite la ejecuciÃ³n arbitraria de cÃ³digo en producciÃ³n y el acceso al repositorio.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” GET /api/solicitudes/historial expone el historial de revisores y las justificaciones de cualquier solicitud a cualquier titular de solicitudes:view

**Fingerprint:** `solicitudes.historial.missing-session-and-owner`

**DescripciÃ³n:** La autenticaciÃ³n para /api/solicitudes la proporciona el middleware, que exige un JWT vÃ¡lido con solicitudes:view (middleware.ts:28); por lo tanto, la palabra "missing session" del candidato es inexacta para la ruta de extremo a extremo. El defecto real es la falta de vinculaciÃ³n del propietario por registro: solicitudesController.historial lee el id de la query y llama a repo.obtenerHistorial(id) sin ninguna comprobaciÃ³n de sesiÃ³n, permiso o propiedad (solicitudes.controller.ts:159-163), y obtenerHistorial consulta prisma.revision.findMany / prisma.revisionHistorial.findMany usando solo { where: { solicitudId } } (solicitudes-repository.ts:374-384). Cualquier `cliente` (constants.ts:212) puede asÃ­ leer el historial de revisiÃ³n de cualquier solicitud, incluidos los correos de los revisores (createdBy/updatedBy) y las justificaciones previas (comentarioAnterior).

**Causa raÃ­z:** Los mÃ©todos del repositorio de historial filtran exclusivamente por el solicitudId proporcionado por quien llama y el controlador ni autentica al sujeto contra el registro ni restringe el endpoint a los revisores; el Ãºnico control es el permiso general solicitudes:view que comparten los clientes.

**Comportamiento esperado:** Un endpoint de historial que devuelve identidades de revisores y justificaciones debe exigir un revisor con derecho (permiso de Ã¡rea o admin) y/o vincular el registro con quien llama; los clientes solo deben ver el historial de sus propias solicitudes.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:8` â€” despacho de GET historial: el router de slug mapea GET /api/solicitudes/historial a solicitudesController.historial.
- *( propagation )* `src/controllers/solicitudes.controller.ts:163` â€” historial: const { revisiones, historial } = await services.solicitudes.repo.obtenerHistorial(gessStandId) â€” el id de la consulta se pasa directamente; no hay ninguna comprobaciÃ³n de sesiÃ³n ni de propiedad en el handler.
- *( propagation )* `src/infrastructure/persistence/solicitudes-repository.ts:376` â€” obtenerHistorial revisiones: prisma.revision.findMany({ where: { solicitudId }, select: { ..., createdBy, updatedBy, comentario } }) devuelve la identidad del revisor y los comentarios para cualquier id de solicitud.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:381` â€” obtenerHistorial historial: prisma.revisionHistorial.findMany({ where: { solicitudId } }) devuelve estadoAnterior/comentarioAnterior/motivo/createdBy para cualquier id de solicitud.

**Evidencia:**
- `src/middleware.ts:28` â€” El endpoint estÃ¡ autenticado (al contrario del planteamiento de "missing session"), pero solo por el permiso amplio solicitudes:view.
- `src/lib/shared/constants.ts:212` â€” El rol `cliente` posee solicitudes:view y por lo tanto puede alcanzar historial.
- `src/controllers/solicitudes.controller.ts:160` â€” Solo se valida el parÃ¡metro de query id; no se realiza ninguna comprobaciÃ³n de sesiÃ³n, rol ni propietario.
- `prisma/schema.prisma:331` â€” RevisionHistorial almacena createdBy (revisor) y comentarioAnterior (justificaciÃ³n), que se devuelven a quien llama.

**Condiciones:**
- (authentication_level) Se requiere y es suficiente una sesiÃ³n vÃ¡lida con solicitudes:view (incluido el rol de cliente); el endpoint no es anÃ³nimo.
- (data_state) Debe existir una solicitud objetivo con revisiones/historial previos; los UUID de solicitud son enumerables a travÃ©s del endpoint listar sin alcance.

**Perspectiva del atacante:** Un cliente autenticado que quiere inspeccionar el rastro de revisiÃ³n y las identidades de los revisores de la solicitud de otra empresa.

**Payloads / inputs:**
- `GET /api/solicitudes/historial?id=<victimSolicitudUuid>`

**Instrucciones acotadas:**
1. Autenticarse como cualquier rol que posea solicitudes:view, p. ej. `cliente`.
1. Obtener un UUID de solicitud objetivo.
1. Llamar a GET /api/solicitudes/historial?id=<uuid> y leer los elementos revision/historial devueltos que contienen usuario (correo del revisor) y justificaciones.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que el middleware admite a cualquier titular de solicitudes:view y que el repositorio devuelve todas las filas de Revision y RevisionHistorial para el solicitudId proporcionado sin ningÃºn predicado de propietario.

**RemediaciÃ³n:** Exigir un permiso de revisor (solicitudes:review:* o admin:full) para historial y, al exponerlo a los clientes, verificar primero que la solicitud pertenece a session.sub; no confiar en el permiso general solicitudes:view para datos exclusivos de revisores.

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

**Severity:** likelihood=high (Alcanzable por cualquier cliente y solo requiere un UUID de solicitud, que es enumerable vÃ­a listar.) Â· impact=medium (Divulga identidades internas de revisores, estados previos y justificaciones de la solicitud de otro propietario; metadatos sensibles del proceso, no credenciales.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” Los clientes de integraciÃ³n salientes deshabilitan la verificaciÃ³n del certificado TLS en todo el proceso

**Fingerprint:** `tls.external-clients.cert-verification-disabled`

**DescripciÃ³n:** Tanto el cliente KBServicios como el cliente Planogess establecen process.env.NODE_TLS_REJECT_UNAUTHORIZED="0" inmediatamente antes del fetch y lo restablecen a "1" despuÃ©s. El cambio es global para el proceso y cubre cada conexiÃ³n TLS realizada durante esa ventana; se omite cuando un fetch lanza una excepciÃ³n (no hay try/finally), dejando la verificaciÃ³n deshabilitada hasta que otra llamada la restablezca. Los endpoints configurados son HTTPS.

**Causa raÃ­z:** Los clientes modifican la variable de entorno global NODE_TLS_REJECT_UNAUTHORIZED en lugar de configurar la verificaciÃ³n por conexiÃ³n, y son singletons en services.ts, por lo que cualquier llamada en curso o fallida se ejecuta con la verificaciÃ³n del par deshabilitada.

**Comportamiento esperado:** Los clientes TLS salientes deben verificar el certificado del par; cualquier relajaciÃ³n debe ser una configuraciÃ³n explÃ­cita por conexiÃ³n, nunca un interruptor global del proceso.

**Trace:**
- *( entrypoint )* `src/infrastructure/external/kbservicios-client.ts:7` â€” fetchApi: establece process.env.NODE_TLS_REJECT_UNAUTHORIZED="0" antes de la llamada saliente.
- *( propagation )* `src/infrastructure/external/kbservicios-client.ts:8` â€” fetchApi -> fetch(BASE_URL): realiza la solicitud HTTPS con la verificaciÃ³n deshabilitada en todo el proceso.
- *( sink )* `src/infrastructure/external/planogess-client.ts:34` â€” PlanogessClient.fetchStands: el mismo interruptor global; el restablecimiento en la lÃ­nea 34 es inalcanzable si el fetch de la lÃ­nea 28 lanza una excepciÃ³n.

**Evidencia:**
- `src/infrastructure/external/kbservicios-client.ts:7` â€” Deshabilita la verificaciÃ³n del certificado antes del fetch.
- `src/infrastructure/external/kbservicios-client.ts:14` â€” Vuelve a habilitar la verificaciÃ³n solo despuÃ©s de un fetch exitoso (sin finally).
- `src/infrastructure/external/planogess-client.ts:27` â€” Repite la deshabilitaciÃ³n global para el cliente Planogess.
- `src/lib/server/services.ts:29` â€” Ambos clientes se construyen como singletons a nivel de mÃ³dulo compartidos en todo el proceso.
- `.env.prod.example:25` â€” PLANOGESS_API_URL y KBSERVICIOS_URL apuntan a endpoints HTTPS (https://secure2.iimp.org:8443).

**Condiciones:**
- (system_configuration) Los endpoints externos son HTTPS (secure2.iimp.org:8443).
- (network_routing) Un atacante puede interceptar o redirigir la conexiÃ³n saliente de la aplicaciÃ³n hacia esos endpoints.

**Perspectiva del atacante:** Un atacante de red en la ruta entre el host de la aplicaciÃ³n y secure2.iimp.org.

**Payloads / inputs:**
- `Serve a self-signed or otherwise invalid certificate for secure2.iimp.org:8443`

**Instrucciones acotadas:**
1. Posicionarse en la ruta de red de las llamadas a KBServicios/Planogess.
1. Presentar un certificado que normalmente fallarÃ­a la validaciÃ³n y devolver una respuesta falsificada.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente muestra que los clientes establecen NODE_TLS_REJECT_UNAUTHORIZED="0" alrededor del fetch, por lo que la verificaciÃ³n del certificado del par queda deshabilitada para esa conexiÃ³n y se acepta una respuesta manipulada.

**RemediaciÃ³n:** Eliminar el interruptor global NODE_TLS_REJECT_UNAUTHORIZED y mantener habilitada la verificaciÃ³n del certificado; si un endpoint heredado usa una CA privada, fijar esa CA por solicitud o por agente en lugar de deshabilitar la verificaciÃ³n globalmente.

**Severity:** likelihood=low (La explotaciÃ³n requiere una posiciÃ³n de red en la ruta saliente hacia los servidores de integraciÃ³n.) Â· impact=high (La manipulaciÃ³n de man-in-the-middle puede alterar los datos de eventos/stands/planogess ingeridos por la aplicaciÃ³n sin detecciÃ³n.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” POST /api/solicitudes/orden-pago mueve cualquier solicitud a PENDIENTE_PAGO y crea una factura sin el permiso facturacion

**Fingerprint:** `solicitudes.orden-pago.missing-facturacion-permission`

**DescripciÃ³n:** solicitudesController.ordenPago realiza solo una comprobaciÃ³n de sesiÃ³n y llama a repo.marcarOrdenPago(solicitudId) con el id del cuerpo (solicitudes.controller.ts:150-156). marcarOrdenPago establece el estado de la solicitud en PENDIENTE_PAGO y crea o actualiza un registro Facturacion con un montoTotal calculado (solicitudes-repository.ts:349-371). La Ãºnica barrera es el permiso solicitudes:view sobre /api/solicitudes (middleware.ts:28); el permiso facturacion:view que protege /api/facturacion (middleware.ts:21) nunca se exige aquÃ­. Cualquier `cliente` (constants.ts:212) puede por lo tanto empujar cualquier solicitud al flujo de facturaciÃ³n y generar una factura.

**Causa raÃ­z:** La transiciÃ³n al estado de facturaciÃ³n se expone bajo el prefijo general solicitudes y el controlador solo comprueba la existencia de una sesiÃ³n; no se aplica ningÃºn permiso de facturaciÃ³n ni vinculaciÃ³n de propiedad.

**Comportamiento esperado:** Transicionar una solicitud a un estado de facturaciÃ³n y crear un registro Facturacion debe exigir un permiso explÃ­cito de facturaciÃ³n (o admin:full), tal como lo hacen los endpoints dedicados de /api/facturacion.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:17` â€” despacho de POST orden-pago: el router de slug mapea POST /api/solicitudes/orden-pago a solicitudesController.ordenPago.
- *( propagation )* `src/controllers/solicitudes.controller.ts:151` â€” ordenPago: solo se realiza `const session = await getSession()` y una comprobaciÃ³n de presencia; el solicitudId del cuerpo se reenvÃ­a luego sin ninguna comprobaciÃ³n de permiso ni de propiedad.
- *( propagation )* `src/infrastructure/persistence/solicitudes-repository.ts:350` â€” marcarOrdenPago: prisma.solicitud.update establece estado = PENDIENTE_PAGO para el id proporcionado.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:363` â€” marcarOrdenPago: prisma.facturacion.create({ data: { solicitudId, tipo: MANUAL, montoTotal, moneda } }) crea la factura para cualquier solicitud objetivo.

**Evidencia:**
- `src/middleware.ts:28` â€” solicitudes:view es la Ãºnica barrera para /api/solicitudes, que sirve orden-pago.
- `src/middleware.ts:21` â€” Los endpoints dedicados de facturaciÃ³n exigen facturacion:view, lo que confirma que las acciones de facturaciÃ³n estÃ¡n pensadas para estar restringidas por permisos.
- `src/lib/shared/constants.ts:212` â€” El rol `cliente` posee solicitudes:view y por lo tanto alcanza orden-pago.
- `src/infrastructure/persistence/solicitudes-repository.ts:368` â€” El registro Facturacion creado usa un montoTotal derivado de los datos del stand, por lo que quien llama influye en registros financieros.

**Condiciones:**
- (authentication_level) Cualquier sesiÃ³n con solicitudes:view es suficiente; el rol de cliente califica.
- (system_configuration) La solicitud debe estar en un estado que el repositorio no restrinja de otro modo; marcarOrdenPago no realiza ninguna validaciÃ³n de estado.

**Perspectiva del atacante:** Un cliente autenticado que quiere forzar otra solicitud dentro del flujo de facturaciÃ³n o crear una factura.

**Payloads / inputs:**
- `POST /api/solicitudes/orden-pago {"solicitudId":"<victimSolicitudUuid>"}`

**Instrucciones acotadas:**
1. Autenticarse como cualquier titular de solicitudes:view.
1. Obtener un UUID de solicitud objetivo.
1. Ejecutar POST /api/solicitudes/orden-pago y observar el cambio de estado a pendiente_pago y la nueva fila de Facturacion.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que el controlador solo afirma la existencia de una sesiÃ³n y luego escribe el estado y una fila de Facturacion indexada por el id proporcionado, sin permiso de facturaciÃ³n ni predicado de propietario.

**RemediaciÃ³n:** Exigir facturacion:view (o admin:full, opcionalmente validado contra la BD) en ordenPago, y verificar que la solicitud pertenece a quien llama cuando este es un cliente; alternativamente, mover la acciÃ³n bajo /api/facturacion.

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

**Severity:** likelihood=high (Basta un solo POST desde cualquier sesiÃ³n de cliente; no se requiere ningÃºn rol de facturaciÃ³n.) Â· impact=medium (Se compromete la integridad del flujo de facturaciÃ³n (solicitudes arbitrarias movidas a pago pendiente y facturas creadas), aunque esta llamada no mueve fondos directamente.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” POST /api/solicitudes/reevaluar permite que cualquier titular de solicitudes:view cree una reevaluaciÃ³n sobre cualquier solicitud

**Fingerprint:** `solicitudes.reevaluar.missing-owner-and-permission`

**DescripciÃ³n:** solicitudesController.reevaluar comprueba solo la existencia de una sesiÃ³n, luego verifica que no haya una reevaluaciÃ³n pendiente y llama a repo.crearReevaluacion con el solicitudId, el motivo y los documentos proporcionados por el atacante (solicitudes.controller.ts:106-119). No hay comprobaciÃ³n de propiedad, ni de permisos mÃ¡s allÃ¡ de solicitudes:view, ni de existencia de la solicitud mÃ¡s allÃ¡ de una escritura de clave forÃ¡nea. Los documentos almacenados se copian despuÃ©s en Solicitud.documentos al aprobarse (solicitudes-repository.ts:310-312), por lo que un cliente puede inyectar URLs de documentos y estados de flujo arbitrarios en la solicitud de otro propietario.

**Causa raÃ­z:** La ruta de creaciÃ³n de reevaluaciÃ³n reenvÃ­a directamente al repositorio el solicitudId, el motivo y los documentos proporcionados por quien llama, el cual crea la fila indexada solo por ese id, sin vinculaciÃ³n de propietario/permiso derivada de la sesiÃ³n.

**Comportamiento esperado:** La creaciÃ³n de una reevaluaciÃ³n deberÃ­a restringirse al propietario de la solicitud (session.sub) o a un revisor con derecho, y deberÃ­a validar la existencia y el estado del objetivo.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:14` â€” despacho de POST reevaluar: el router de slug mapea POST /api/solicitudes/reevaluar a solicitudesController.reevaluar.
- *( propagation )* `src/controllers/solicitudes.controller.ts:115` â€” reevaluar: await services.solicitudes.repo.crearReevaluacion(raw.solicitudId, PENDIENTE, raw.motivo ?? null, raw.documentos ?? [], session.email) â€” solo se usa el correo de la sesiÃ³n; sin comprobaciÃ³n de propiedad/permiso.
- *( propagation )* `src/infrastructure/persistence/solicitudes-repository.ts:286` â€” crearReevaluacion: prisma.reevaluacion.create({ data: { solicitudId, estado, motivo, documentos, createdBy } }) escribe para cualquier id de solicitud existente.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:311` â€” atenderReevaluacionAprobacion: al aprobarse, el array documentos proporcionado por el atacante se copia en solicitud.documentos, persistiÃ©ndolo en el registro de la vÃ­ctima.

**Evidencia:**
- `src/middleware.ts:28` â€” El prefijo /api/solicitudes solo exige solicitudes:view.
- `src/lib/shared/constants.ts:212` â€” El rol `cliente` posee solicitudes:view, por lo que los clientes pueden llamar a reevaluar.
- `src/controllers/solicitudes.controller.ts:112` â€” La Ãºnica barrera ademÃ¡s de la sesiÃ³n es tieneReevaluacionPendiente; no hay ninguna comprobaciÃ³n de propietario o Ã¡rea.
- `src/infrastructure/persistence/solicitudes-repository.ts:287` â€” documentos se almacena como JSON proporcionado por quien llama sin ninguna validaciÃ³n.

**Condiciones:**
- (authentication_level) Cualquier sesiÃ³n con solicitudes:view es suficiente.
- (data_state) La solicitud objetivo debe existir y no tener ya una reevaluaciÃ³n pendiente.

**Perspectiva del atacante:** Un cliente autenticado que quiere manipular el flujo de trabajo de la solicitud de otra parte o inyectarle documentos.

**Payloads / inputs:**
- `POST /api/solicitudes/reevaluar {"solicitudId":"<victimUuid>","motivo":"re-evaluacion","documentos":["https://attacker.example/x.pdf"]}`

**Instrucciones acotadas:**
1. Autenticarse como cualquier titular de solicitudes:view.
1. Obtener un UUID de solicitud objetivo sin una reevaluaciÃ³n pendiente.
1. Ejecutar POST /api/solicitudes/reevaluar y observar que la fila reevaluacion se crea para esa solicitud con quien llama como createdBy.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que el handler no realiza ninguna comparaciÃ³n de propietario/permiso y que el repositorio crea una Reevaluacion vinculada al solicitudId proporcionado, por lo que cualquier titular de solicitudes:view puede crear reevaluaciones para otros propietarios.

**RemediaciÃ³n:** Cargar la solicitud, exigir que session.sub sea igual a su userId o que quien llama posea un permiso interno de revisiÃ³n/admin, y validar que la solicitud existe y estÃ¡ en un estado reevaluable antes de crear la reevaluacion.

`src/controllers/solicitudes.controller.ts`:
```
const detalle = await services.solicitudes.detalle(raw.solicitudId);
    if (!detalle) return error(API_ERROR_CODES.NOT_FOUND, "Solicitud no encontrada", 404);
    const esRevisor = session.permissions.some((p) => p.startsWith("solicitudes:review:") || p === "admin:full");
    if (!esRevisor && detalle.userId !== session.sub) {
      return error(API_ERROR_CODES.FORBIDDEN, "No puedes re-evaluar solicitudes de otro usuario", 403);
    }
```

**Severity:** likelihood=high (Alcanzable desde cualquier sesiÃ³n de cliente con un UUID de solicitud conocido/enumerable y un solo POST.) Â· impact=medium (Permite la manipulaciÃ³n del flujo de trabajo entre propietarios y la inyecciÃ³n de URLs de documentos elegidas por el atacante en el registro de la solicitud de otra parte.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” POST /api/solicitudes/upload-doc adjunta un documento a cualquier id de solicitud sin vinculaciÃ³n de propietario

**Fingerprint:** `solicitudes.upload-doc.missing-owner-binding`

**DescripciÃ³n:** solicitudesController.uploadDocumento exige una sesiÃ³n y luego llama a services.solicitudes.uploadDocumento con el solicitudId y la url proporcionados por quien llama (solicitudes.controller.ts:200-213). El servicio de aplicaciÃ³n calcula solo si quien llama es admin/upload y establece el userId del nuevo documento en consecuencia, luego llama a repo.crearDocumentoAdjunto sin verificar nunca que la solicitud objetivo pertenezca a quien llama (solicitudes-service.ts:84-98), y el repositorio crea la fila indexada solo por el solicitudId proporcionado (solicitudes-repository.ts:413-417). La ruta hermana modificar (controller.ts:94) y eliminarDocumento (service.ts:105-110) sÃ­ aplican la propiedad, lo que demuestra la invariante prevista. Cualquier `cliente` (constants.ts:212) puede por lo tanto adjuntar URLs de documentos arbitrarios a la solicitud de otro cliente.

**Causa raÃ­z:** uploadDocumento solo autoriza que exista una sesiÃ³n y deriva el userId del documento de quien llama, pero nunca comprueba el propietario de la solicitud padre (ni el alcance de revisor de quien llama) antes de crear el registro hijo.

**Comportamiento esperado:** El servicio debe cargar la solicitud y denegar la escritura a menos que quien llama sea el propietario (session.sub igual a Solicitud.userId) o posea un permiso interno de upload/review, reflejando las comprobaciones usadas por modificar y eliminarDocumento.

**Trace:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:18` â€” despacho de POST upload-doc: el router de slug mapea POST /api/solicitudes/upload-doc a solicitudesController.uploadDocumento.
- *( propagation )* `src/controllers/solicitudes.controller.ts:206` â€” uploadDocumento: el controlador reenvÃ­a raw.solicitudId y raw.url a services.solicitudes.uploadDocumento tras solo una comprobaciÃ³n de presencia de sesiÃ³n; nunca carga la solicitud.
- *( propagation )* `src/application/solicitudes/solicitudes-service.ts:92` â€” uploadDocumento: isAdmin se calcula a partir de los permisos y se usa solo para anular el userId del documento; el solicitudId se pasa al repositorio sin verificar.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:414` â€” crearDocumentoAdjunto: prisma.solicitudDocumento.create({ data: { solicitudId, url, nombre, uploadedBy, userId } }) inserta el documento en cualquier id de solicitud.

**Evidencia:**
- `src/middleware.ts:28` â€” Solo solicitudes:view protege /api/solicitudes, por lo que cualquier cliente puede llamar a upload-doc.
- `src/lib/shared/constants.ts:212` â€” El rol `cliente` posee solicitudes:view.
- `src/application/solicitudes/solicitudes-service.ts:107` â€” eliminarDocumento exige doc.userId === userSub (o admin), lo que muestra que en esta funcionalidad se espera la vinculaciÃ³n de propietario.
- `src/controllers/solicitudes.controller.ts:94` â€” modificar aplica la comprobaciÃ³n de propietario que uploadDocumento omite.

**Condiciones:**
- (authentication_level) Cualquier sesiÃ³n con solicitudes:view es suficiente.
- (data_state) Debe existir un id de solicitud objetivo; los ids son enumerables a travÃ©s del endpoint listar sin alcance.

**Perspectiva del atacante:** Un cliente autenticado que quiere adjuntar documentos a la solicitud de otra empresa o manipular su lista de archivos.

**Payloads / inputs:**
- `POST /api/solicitudes/upload-doc {"solicitudId":"<victimUuid>","url":"https://attacker.example/contracto.pdf","nombre":"contrato.pdf"}`

**Instrucciones acotadas:**
1. Autenticarse como cualquier titular de solicitudes:view.
1. Obtener un UUID de solicitud objetivo.
1. Ejecutar POST /api/solicitudes/upload-doc y luego cargar el detalle de la solicitud de la vÃ­ctima para observar el documento inyectado.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que el servicio nunca carga ni comprueba el propietario de la solicitud y que el repositorio inserta SolicitudDocumento para el id proporcionado, por lo que se adjunta un documento al registro de otro propietario.

**RemediaciÃ³n:** En uploadDocumento, cargar la solicitud y exigir la propiedad (session.sub igual a Solicitud.userId) a menos que quien llama posea un permiso interno de upload/review; rechazar con FORBIDDEN/NOT_FOUND en caso contrario.

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

**Severity:** likelihood=high (Un solo POST desde cualquier sesiÃ³n de cliente adjunta un documento; los ids objetivo son enumerables.) Â· impact=medium (ViolaciÃ³n de integridad entre propietarios del conjunto de documentos usado en el flujo de revisiÃ³n y mostrado al propietario y a los revisores; por sÃ­ solo no expone datos.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” Escrituras no autenticadas y sin lÃ­mite en la tabla ErrorLog

**Fingerprint:** `errors/log/unauth-unbounded-errorlog-insert`

**DescripciÃ³n:** POST /api/errors/log no estÃ¡ cubierto por ningÃºn prefijo PROTECTED ni por la lista de rutas pÃºblicas, por lo que el middleware cae en NextResponse.next() (middleware.ts:72) y la ruta es anÃ³nima. El handler acepta message/stack/digest/url/metadata, trata la sesiÃ³n como opcional (route.ts:21) e inserta una fila sin lÃ­mite de longitud por campo, sin deduplicaciÃ³n, sin lÃ­mite de tasa ni polÃ­tica de retenciÃ³n (error-logger.ts:16); el modelo ErrorLog almacena columnas String/Json sin lÃ­mite (schema.prisma:398-410). Un cliente anÃ³nimo puede por lo tanto hacer crecer la tabla sin lÃ­mite, y nginx solo acota dÃ©bilmente una Ãºnica solicitud en 50M (nginx.conf:17) sin acotar la cardinalidad.

**Causa raÃ­z:** /api/errors estÃ¡ ausente de PROTECTED y de las listas pÃºblicas, la ruta nunca rechaza una sesiÃ³n faltante, y ni la ruta ni errorLogger.log aplican lÃ­mites de tamaÃ±o, deduplicaciÃ³n, tasa o retenciÃ³n.

**Comportamiento esperado:** Un almacÃ©n de errores de solo adiciÃ³n al que se puede llegar sin autenticaciÃ³n debe al menos acotar el tamaÃ±o por registro y la cardinalidad/retenciÃ³n total, o restringirse a clientes autenticados; el diseÃ±o actual no ofrece ninguna de las dos cosas.

**Trace:**
- *( entrypoint )* `src/middleware.ts:72` â€” caÃ­da del middleware: /api/errors no coincide con ninguna entrada de PROTECTED ni con la lista de rutas pÃºblicas, por lo que la solicitud continÃºa sin autenticar.
- *( propagation )* `src/app/api/errors/log/route.ts:21` â€” sesiÃ³n opcional: getSession().catch(() => null) se usa solo para adjuntar un userId opcional; el handler no exige una sesiÃ³n.
- *( sink )* `src/lib/server/error-logger.ts:16` â€” prisma.errorLog.create: las cadenas/JSON controlados por quien llama se persisten sin ninguna aplicaciÃ³n de lÃ­mites de longitud, deduplicaciÃ³n, tasa o retenciÃ³n.

**Evidencia:**
- `src/middleware.ts:12` â€” PROTECTED no contiene ninguna entrada /api/errors, y PUBLIC_API_ROUTES/PUBLIC_API_PREFIXES tampoco la listan.
- `src/app/api/errors/log/route.ts:17` â€” La Ãºnica comprobaciÃ³n de entrada es que message sea veraz; stack, digest, url y metadata no tienen lÃ­mite.
- `prisma/schema.prisma:398` â€” Los campos message/stack/digest/url de ErrorLog son String sin lÃ­mite y metadata es Json sin lÃ­mite.
- `docker/nginx.conf:17` â€” client_max_body_size 50M limita solo el cuerpo de una Ãºnica solicitud; no acota el nÃºmero de registros ni la retenciÃ³n.

**Condiciones:**
- (network_routing) La ruta debe ser alcanzable desde internet (handler del App Router de Next.js servido por nginx), lo que el despliegue expone.
- (data_state) El impacto sostenido requiere solicitudes repetidas para acumular filas; una sola solicitud ya crea filas controladas por el atacante.

**Perspectiva del atacante:** Un cliente anÃ³nimo de internet sin ninguna cuenta.

**Payloads / inputs:**
- `{"message":"<large repeated string>","metadata":{"k":"<arbitrary>"}}`

**Instrucciones acotadas:**
1. Enviar POST /api/errors/log con un message arbitrario (y stack/url/metadata opcionales) sin cookie de sesiÃ³n.
1. Repetir la solicitud para acumular filas.

**Resultado observado:** El anÃ¡lisis del cÃ³digo fuente establece que la solicitud atraviesa la caÃ­da del middleware, no se exige ninguna sesiÃ³n y se inserta una fila por cada llamada; la tabla no tiene ningÃºn lÃ­mite de retenciÃ³n ni de cardinalidad.

**RemediaciÃ³n:** Exigir autenticaciÃ³n para /api/errors/log o, si debe permanecer abierta para la captura de errores del cliente, aplicar una longitud mÃ¡xima de cuerpo/message, descartar campos autoritativos del servidor o sobredimensionados, aplicar limitaciÃ³n de tasa por IP y una polÃ­tica de retenciÃ³n/rotaciÃ³n sobre error_log.

`src/app/api/errors/log/route.ts`:
```
if (typeof body.message !== "string" || body.message.length > 2000) {
    return error(API_ERROR_CODES.VALIDATION, "message invalido", 400);
  }
  const stack = typeof body.stack === "string" ? body.stack.slice(0, 8000) : undefined;
  // plus per-IP rate limiting and scheduled error_log retention
```

**Severity:** likelihood=high (El endpoint es anÃ³nimo e incondicional; cualquier cliente puede provocar inserciones a voluntad.) Â· impact=medium (El efecto demostrado es un crecimiento de almacenamiento sin lÃ­mite y contaminaciÃ³n de datos en error_log (y de cualquier panel que la lea), con potencial agotamiento de disponibilidad/almacenamiento; nginx limita un cuerpo individual pero no el nÃºmero de filas.) Â· overall=medium Â· confidence=high

---

## MEDIUM â€” Entrada del atacante sin escapar interpolada en correos HTML de notificaciÃ³n

**Fingerprint:** `email/templates/unescaped-html-interpolation`

**DescripciÃ³n:** El flujo de reserva acepta campos de cadena no autenticados y sin lÃ­mite (razonSocial, tipoDocumento, numeroDocumento) y los interpola textualmente en cuerpos de correo HTML. La notificaciÃ³n de administrador construida por buildAdminNotificacionEmail los incrusta en una celda de tabla y en el asunto, y el correo de confirmaciÃ³n al cliente hace lo mismo. No se aplica ningÃºn escape HTML ni codificaciÃ³n de salida en ningÃºn punto entre la solicitud y el campo `html` de Resend, por lo que un remitente anÃ³nimo puede inyectar marcado en el correo que reciben los administradores de IIMP, permitiendo contenido y enlaces falsificados dentro de un mensaje que parece originarse en la plataforma.

**Causa raÃ­z:** buildReservaConfirmationEmail y buildAdminNotificacionEmail en src/lib/server/email.ts concatenan cadenas derivadas de la solicitud directamente en plantillas literales HTML sin escaparlas, y buildRevisionEmail en src/lib/server/email-templates.ts interpola opts.mensaje de la misma manera; no se aplica ningÃºn helper de escape en la ruta.

**Comportamiento esperado:** Cualquier valor derivado de quien llama debe codificarse como HTML (o ensamblarse mediante una plantilla con reconocimiento de contexto que escape) antes de colocarse en un cuerpo o asunto de correo HTML, para que el marcado inyectado permanezca como texto inerte.

**Trace:**
- *( entrypoint )* `src/app/api/reservas/[...slug]/route.ts:6` â€” despacho de POST /api/reservas/crear: createRouter mapea el POST anÃ³nimo a reservaController.crear; la ruta no estÃ¡ en PROTECTED, por lo que un llamador no autenticado la alcanza.
- *( propagation )* `src/controllers/reserva.controller.ts:12` â€” reservaRequestSchema.parse(raw): el cuerpo de quien llama se analiza con reservaRequestSchema, cuyos razonSocial/tipoDocumento/numeroDocumento son valores z.string() sin lÃ­mite copiados en la solicitud de reserva.
- *( propagation )* `src/application/reservas/reserva-service.ts:95` â€” construcciÃ³n de emailData: request.datos.razonSocial y la cadena documento compuesta se colocan en emailData y se pasan a ambos constructores de correo.
- *( sink )* `src/lib/server/email.ts:144` â€” celda de tabla HTML de buildReservaConfirmationEmail: emailData.razonSocial se concatena en una celda de tabla HTML; las lÃ­neas 143 y 145 tambiÃ©n interpolan standCodes y documento, y el constructor de administrador repite los mismos valores sin tratar.

**Evidencia:**
- `src/lib/server/email.ts:144` â€” Razon social interpolada sin tratar en el cuerpo HTML de confirmaciÃ³n.
- `src/lib/server/email.ts:178` â€” La notificaciÃ³n de administrador interpola el mismo razonSocial proporcionado por el atacante sin tratar.
- `src/lib/server/email.ts:180` â€” emailCliente proporcionado por el atacante interpolado sin tratar en el correo de administrador.
- `src/application/reservas/reserva-service.ts:108` â€” La notificaciÃ³n de administrador se envÃ­a a ADMIN_EMAIL cuando difiere de la direcciÃ³n de contacto (reserva-service.ts:106-108).
- `src/validators/reserva.validator.ts:6` â€” razonSocial/tipoDocumento/numeroDocumento se aceptan como cadenas sin lÃ­mite.
- `src/lib/server/email-templates.ts:22` â€” opts.mensaje interpolado sin tratar en la plantilla personalizado (ruta proporcionada por el revisor).

**Condiciones:**
- (authentication_level) anonymous: /api/reservas no estÃ¡ en la lista PROTECTED del middleware, por lo que no se requiere sesiÃ³n.
- (user_interaction) un administrador debe abrir el correo de notificaciÃ³n entregado para que el marcado inyectado se renderice.
- (third_party_dependency) la entrega depende de que RESEND_API_KEY estÃ© configurada; el HTML se envÃ­a a Resend tal cual.

**Perspectiva del atacante:** Un cliente de red no autenticado que envÃ­a una reserva de stand.

**Payloads / inputs:**
- `POST /api/reservas/crear body {"standIds":["<existing-stand-id>"],"datos":{"razonSocial":"<b>IIMP</b><a href=\"https://evil.example\">Ver contrato</a>","tipoDocumento":"DNI","numeroDocumento":"12345678","email":"attacker@example.com"}} with no Cookie header`

**Instrucciones acotadas:**
1. Enviar POST /api/reservas/crear con el payload anterior y sin cookie de token.
1. Observar que reservaRequestSchema.parse acepta el marcado como una cadena simple y que no se aplica ningÃºn escape.
1. Seguir el valor desde reserva-service.ts:95 hacia buildAdminNotificacionEmail y hacia el campo html entregado a Resend; aparece dentro de la celda de tabla HTML sin codificar.

**Resultado observado:** No ejecutado (no hay una sandbox impuesta por el SO en el host de auditorÃ­a); la traza del cÃ³digo fuente muestra de forma determinista que las cadenas razonSocial y documento controladas por el atacante se concatenan sin escapar en el cuerpo HTML enviado a ADMIN_EMAIL, por lo que la notificaciÃ³n de administrador contiene marcado del atacante en lugar de texto inerte.

**RemediaciÃ³n:** Escapar como HTML cada valor derivado de quien llama en el punto de interpolaciÃ³n (un Ãºnico helper escapeHtml usado por buildReservaConfirmationEmail, buildAdminNotificacionEmail y buildRevisionEmail), o mover las plantillas a un renderizador con reconocimiento de contexto que escape automÃ¡ticamente; aÃ±adir una prueba de regresiÃ³n que verifique que '<' se emite como &lt; en el cuerpo de administrador.

**Severity:** likelihood=high (el endpoint de reservas no estÃ¡ autenticado y los campos inyectados no tienen restricciones de longitud ni de juego de caracteres, por lo que una sola solicitud es suficiente.) Â· impact=medium (HTML y enlaces controlados por el atacante se renderizan dentro de un correo de notificaciÃ³n que los destinatarios confÃ­an como originado en la plataforma; el impacto es la falsificaciÃ³n de contenido y enlaces (phishing), no la ejecuciÃ³n de cÃ³digo.) Â· overall=medium Â· confidence=high

---
