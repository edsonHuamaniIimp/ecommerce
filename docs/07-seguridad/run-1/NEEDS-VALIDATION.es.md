# Requiere validación — ContratosStands (ejecución 1)

Pistas priorizadas y fundamentadas en el código fuente, cada una con un hecho exacto sin resolver. **No se asigna severidad** y ninguna de estas es una vulnerabilidad confirmada. Resuelve cada una con el plan local acotado y/o el plan observado por el responsable que se describe abajo; nunca envíes tráfico de auditoría a un despliegue.

## Un llamador autenticado de auspicios puede retransmitir un cuerpo sin validar al endpoint privilegiado saveauspicio de KBServicios

**Fingerprint:** `auspicios/grabar/unvalidated-body-to-privileged-kbs`

**Descripción:** POST /api/auspicios/grabar exige una sesión más el permiso auspicios:view (middleware.ts:29 y route.ts:9-10), luego reenvía el JSON provisto por el llamador tal cual al endpoint legado de KBServicios con el x-api-key del lado del servidor (route.ts:13-18). El endpoint hermano /api/auspicios/listar restringe el cuerpo a code/codeEvent (listar/route.ts:13-14), lo que muestra la intención de quien lo escribió de que el contrato aguas abajo es acotado, pero grabar no aplica ningún esquema. Si los campos residuales no verificados permiten que un llamador no privilegiado cambie estado privilegiado de auspicio no puede decidirse desde el repositorio porque el contrato aguas abajo /rest/saveauspicio está ausente; por lo tanto el candidato permanece sin validar.

**Causa raíz alegada:** grabar/route.ts parsea el cuerpo sin ninguna allowlist de Zod/DTO y pasa JSON.stringify(body) sin modificar a `${KBS_URL}/rest/saveauspicio` bajo el KBSERVICIOS_API_KEY del lado del servidor, a diferencia de listar que valida code/codeEvent.

**Traza:**
- *( entrypoint )* `src/middleware.ts:29` — Entrada PROTECTED para /api/auspicios: Las solicitudes a /api/auspicios requieren autenticación y el permiso auspicios:view, por lo que el llamador es un usuario autenticado del área interna y no anónimo.
- *( propagation )* `src/app/api/auspicios/grabar/route.ts:13` — Parseo del cuerpo del handler POST: El valor crudo de request.json() se toma sin ningún parseo de esquema ni allowlist de campos.
- *( sink )* `src/app/api/auspicios/grabar/route.ts:17` — fetch saliente hacia KBServicios: JSON.stringify(body) se envía por POST a ${KBS_URL}/rest/saveauspicio con el encabezado x-api-key del lado del servidor, de modo que todas las claves controladas por el llamador llegan al servicio privilegiado aguas abajo.

**Evidencia:**
- `src/app/api/auspicios/grabar/route.ts:6` — API_KEY se lee de process.env.KBSERVICIOS_API_KEY y se inyecta como x-api-key en la llamada saliente.
- `src/app/api/auspicios/grabar/route.ts:13` — const body = await request.json() sin validación antes de la llamada aguas abajo.
- `src/app/api/auspicios/listar/route.ts:14` — El endpoint hermano listar requiere code y codeEvent, lo que evidencia que el contrato de auspicio aguas abajo está acotado por campos mientras que grabar no lo está.
- `src/middleware.ts:29` — El control más fuerte visible en el código fuente es sesión + auspicios:view; no existe restricción por campo ni por alcance de rol.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- El contrato aguas abajo /rest/saveauspicio (qué campos acepta y cuáles de ellos cambian estado privilegiado más allá del propio auspicio del llamador) no está presente en ninguna parte del repositorio, por lo que la violación de límite no puede establecerse solo con el código fuente.
- Si AUSPICIOS_API_URL/KBSERVICIOS_API_KEY están configurados y qué autorización aplica KBServicios a campos inesperados son hechos del despliegue.

**Plan de resolución:**
- *Observado por el responsable:* Un responsable u operador del servicio KBServicios confirma, a partir del contrato /rest/saveauspicio o de la configuración del servicio, qué campos acepta el endpoint, si las claves no reconocidas se ignoran y qué campos aceptados pueden cambiar estado privilegiado de auspicio más allá del propio auspicio del llamador; esta es una revisión de documentación/configuración y no se envía ninguna solicitud al servicio en ejecución.

---

## JWT firmado/verificado con un secreto de respaldo hardcodeado cuando JWT_SECRET no está definido

**Fingerprint:** `auth.jwt.fallback-secret`

**Descripción:** El módulo de firma/verificación recae en la constante "dev-secret-cambiar-en-produccion" (auth.ts:9) y la ruta de selección de evento recae en una constante distinta "dev-secret" (auth-service.ts:53). Si el despliegue no define JWT_SECRET, los tokens se firman con una clave públicamente conocida. .env.prod.example incluye JWT_SECRET vacío mientras que Dockerfile.ecs solo incrusta un marcador de posición en tiempo de build, por lo que si el respaldo está activo es un hecho del despliegue.

**Causa raíz alegada:** Secretos de respaldo hardcodeados para la firma/verificación HS256, más un respaldo divergente en seleccionarEvento, sin ninguna aserción de arranque que verifique que JWT_SECRET está configurado.

**Traza:**
- *( entrypoint )* `src/app/api/auth/[...slug]/route.ts:10` — POST /api/auth/login: Emite un token de sesión firmado mediante signToken.
- *( propagation )* `src/lib/server/auth.ts:9` — Inicialización de SECRET: Recae en una constante hardcodeada cuando process.env.JWT_SECRET es undefined.
- *( sink )* `src/lib/server/auth.ts:41` — signToken: Firma (y verifyToken verifica) con el secreto resuelto.

**Evidencia:**
- `src/lib/server/auth.ts:9` — Secreto de respaldo hardcodeado usado para toda la firma/verificación HS256.
- `src/application/auth/auth-service.ts:53` — Secreto de respaldo divergente "dev-secret" en el jwtVerify de seleccionarEvento.
- `.env.prod.example:29` — JWT_SECRET se incluye vacío, por lo que un valor faltante es plausible.
- `Dockerfile.ecs:37` — Solo incrusta un JWT_SECRET de marcador de posición en tiempo de build.
- `docs/01-despliegue/arquitectura-aws.md:268` — Documenta JWT_SECRET como proveniente de Secrets Manager, es decir, el valor real es un hecho del despliegue.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- el valor desplegado de JWT_SECRET (y si realmente está configurado) es un hecho del despliegue no visible en el código fuente del repositorio

**Plan de resolución:**
- *Local (fixture acotado):* En un entorno controlado con un sandbox impuesto por el SO, lanza la app con JWT_SECRET sin definir y .env.prod sin definir/vacío, luego firma un token con la constante de respaldo hardcodeada y reenvíalo contra una ruta protegida para confirmar que se usa el respaldo; no ejecutes código del objetivo en un host sin sandbox.
- *Observado por el responsable:* Un responsable inspecciona la definición de tarea de ECS o el .env.prod resuelto en docker-compose para confirmar si JWT_SECRET está definido con un valor no vacío y fuerte, distinto del marcador de posición de build de Dockerfile.ecs y del respaldo hardcodeado; esto es solo una inspección de configuración, sin presentar ningún token al servicio en ejecución.

---

## PATCH /api/facturacion/actualizar propaga un cuerpo sin validar dentro del update de Prisma

**Fingerprint:** `facturacion.actualizar.unvalidated-body-mass-assignment`

**Descripción:** El controlador actualizar desestructura solo id del JSON parseado y reenvía el objeto restante, casteado a un tipo estrecho en tiempo de compilación pero nunca validado en tiempo de ejecución, a través del servicio de aplicación hacia prisma.facturacion.update({ where: { id }, data }). Claves adicionales como estado, solicitudId, montoTotal, moneda, modoPago o flgActivo por lo tanto llegan al ORM y se escriben. La explotación aún requiere un principal que pueda pasar la puerta facturacion:view de /api/facturacion, que ningún rol estático no-admin posee.

**Causa raíz alegada:** patrón de auth: el controlador realiza un cast `as` sin verificar de request.json() (sin parseo Zod/esquema), la firma del servicio tipa data como `{ tipo?: string }` pero lo reenvía sin cambios, y el repositorio pasa el objeto completo a prisma.facturacion.update.

**Traza:**
- *( entrypoint )* `src/app/api/facturacion/[...slug]/route.ts:15` — Despacho PATCH actualizar: El enrutador de slug mapea PATCH actualizar a facturacionController.actualizar.
- *( propagation )* `src/controllers/facturacion.controller.ts:53` — actualizar: const { id, ...data } = (await request.json()) as { id: string; tipo?: string } - un cast en tiempo de compilación sin validación en tiempo de ejecución.
- *( propagation )* `src/application/facturacion/facturacion-service.ts:22` — actualizar: data está tipado { tipo?: string } pero se pasa a this.repo.actualizar(id, data, createdBy) sin cambios.
- *( sink )* `src/infrastructure/persistence/facturacion-repository.ts:123` — actualizar: prisma.facturacion.update({ where: { id }, data }) escribe cada clave provista por el atacante que coincida con una columna de Facturacion.

**Evidencia:**
- `src/middleware.ts:21` — Solo facturacion:view protege /api/facturacion, por lo que el conjunto de llamadores alcanzables equivale a los poseedores de ese permiso.
- `src/lib/shared/constants.ts:209` — facturacion:view se concede estáticamente solo a admin, dejando sin probar la alcanzabilidad de un principal no-admin.
- `prisma/schema.prisma:412` — El input de update de Facturacion admite estado, solicitudId, montoTotal, moneda, modoPago y flgActivo, las columnas que el objeto sin verificar puede sobrescribir.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- Si algún rol no-admin desplegado o creado a medida posee facturacion:view es un hecho de base de datos/despliegue; ningún rol estático no-admin lo posee.
- Una sobrescritura concreta de la factura de una víctima requiere un id de fila Facturacion objetivo en la base de datos desplegada (hecho de estado de datos).

**Plan de resolución:**
- *Local (fixture acotado):* Autentícate como poseedor de facturacion:view y envía PATCH /api/facturacion/actualizar con el cuerpo {"id":"<invoiceId>","estado":"pagado","montoTotal":1} ; luego lee la fila de vuelta y confirma que las columnas no previstas cambiaron.
- *Observado por el responsable:* Confirma si se aprovisiona un rol no-admin con facturacion:view, ya que admin posee admin:full y no es un objetivo de escalada de privilegios.

---

## Las mutaciones de facturación direccionadas solo por id de registro carecen de vínculo con propietario/evento

**Fingerprint:** `facturacion.agregar-cuota.actualizar.eliminar.eliminar-cuota.unbound-by-id`

**Descripción:** POST /api/facturacion/agregar-cuota, PATCH /api/facturacion/actualizar, DELETE /api/facturacion/eliminar y POST /api/facturacion/eliminar-cuota autentican al llamador con getSession() pero luego leen/escriben el Facturacion o FacturacionCuota objetivo estrictamente por el id provisto por el llamador, sin ningún predicado que vincule el registro a la solicitud/empresa/evento del llamador. El middleware solo requiere el permiso facturacion:view para todo el prefijo /api/facturacion, y la ruta de lectura listar() sí acota por eventoId mientras que las rutas de mutación no. Si algún principal no-admin posee facturacion:view en el conjunto de roles desplegado, ese principal puede agregar o eliminar cuotas y hacer soft-delete de cualquier factura.

**Causa raíz alegada:** Los métodos de mutación del repositorio se basan solo en el id provisto (findFirst/create/update/delete por facturacionId o id) sin ningún predicado de propietario o evento, mientras que la lectura hermana listar() aplica un predicado de eventoId; los controladores solo reenvían el id del cuerpo/query más session.email.

**Traza:**
- *( entrypoint )* `src/app/api/facturacion/[...slug]/route.ts:10` — Despacho POST agregar-cuota: El enrutador de slug mapea agregar-cuota, pagar-cuota y eliminar-cuota (POST) más actualizar/eliminar al controlador de facturacion.
- *( propagation )* `src/controllers/facturacion.controller.ts:37` — agregarCuota: getSession() y luego service.agregarCuota(facturacionId, ...) usando el id crudo del cuerpo de la solicitud sin búsqueda de propiedad ni de evento.
- *( propagation )* `src/infrastructure/persistence/facturacion-repository.ts:93` — agregarCuota: prisma.facturacionCuota.create({ data: { facturacionId, numero, monto, fechaVencimiento } }) inserta una cuota en cualquier id de factura provisto por el llamador.
- *( propagation )* `src/infrastructure/persistence/facturacion-repository.ts:123` — actualizar: prisma.facturacion.update({ where: { id }, data }) actualiza cualquier factura por id.
- *( propagation )* `src/infrastructure/persistence/facturacion-repository.ts:132` — eliminar: prisma.facturacion.update({ where: { id }, data: { flgActivo: false } }) hace soft-delete de cualquier factura por id.
- *( sink )* `src/infrastructure/persistence/facturacion-repository.ts:141` — eliminarCuota: prisma.facturacionCuota.delete({ where: { id: cuotaId } }) elimina cualquier cuota por id después de un findUnique por el mismo id.

**Evidencia:**
- `src/middleware.ts:21` — Solo facturacion:view protege todo el prefijo /api/facturacion; no hay alcance por registro ni por propietario.
- `src/lib/shared/constants.ts:209` — ROLES_PERMISSIONS no concede facturacion:view a ningún rol estático no-admin: la lista de admin (líneas 183-208) la incluye mientras que logistica, legal, comunicacion y cliente no.
- `src/infrastructure/persistence/facturacion-repository.ts:10` — listar() demuestra el patrón de alcance por evento previsto (predicado eventoId) que los métodos de mutación omiten.
- `prisma/schema.prisma:412` — Facturacion tiene solicitudId, tipo, estado, montoTotal, moneda, modoPago y flgActivo pero ninguna columna de propietario-llamador, por lo que el alcance debe derivarse de la solicitud/evento padre.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- Si algún rol no-admin desplegado o creado a medida posee facturacion:view es un hecho de base de datos/despliegue; src/lib/shared/constants.ts lo concede estáticamente solo a admin, por lo que un principal no-admin alcanzable no queda establecido a partir del código fuente.
- El efecto entre propietarios requiere que exista una fila Facturacion/FacturacionCuota de la víctima perteneciente a otra solicitud/evento en la base de datos desplegada (hecho de estado de datos).

**Plan de resolución:**
- *Local (fixture acotado):* Con la app en ejecución y una BD sembrada, emite una sesión no-admin cuyo rol incluya facturacion:view, luego llama POST /api/facturacion/agregar-cuota (y PATCH /actualizar, DELETE /eliminar, POST /eliminar-cuota) con el id de una factura creada por otro usuario y confirma que la mutación tiene éxito.
- *Observado por el responsable:* Inspecciona las tablas de roles/permisos desplegadas para determinar si algún rol no-admin tiene concedido facturacion:view y si tal rol puede crearse/asignarse mediante roles:manage.

---

## La confirmación de pago de Niubizz ignora el resultado de autorización de la pasarela antes de marcar una cuota como pagada

**Fingerprint:** `facturacion.niubizz.confirmar.unverified-payment`

**Descripción:** confirmarPago hace await de niubizzClient.autorizar(...) pero nunca inspecciona el valor devuelto, luego llama incondicionalmente a facturacionRepo.pagarCuota, lo que puede mover la cuota, la factura padre y la solicitud a PAGADO. También construye la clave de autorización a partir de cuota.respuesta_api, un campo que detalle() nunca devuelve, y pasa un número de compra nuevo String(Date.now()), por lo que la autorización no está demostrablemente vinculada a la factura. Si una autorización rechazada es distinguible de un éxito depende de la semántica de estado HTTP versus cuerpo del proxy externo, que no es visible en el código fuente.

**Causa raíz alegada:** NiubizzApplicationService.confirmarPago descarta el resultado de autorizar() y procede a pagarCuota(); niubizz-client postJson() lanza excepción solo ante una respuesta no-2xx y no examina un campo de éxito/fallo; el controlador llama al flujo sin getSession().

**Traza:**
- *( entrypoint )* `src/app/api/facturacion/niubizz/confirmar/route.ts:3` — POST /api/facturacion/niubizz/confirmar: La ruta exporta directamente niubizzController.confirmarPago; el acceso se rige solo por la puerta de prefijo /api/facturacion del middleware.
- *( propagation )* `src/controllers/niubizz.controller.ts:33` — confirmarPago: Lee facturacionId y transactionToken del cuerpo sin ninguna llamada a getSession() y los reenvía al servicio.
- *( propagation )* `src/application/facturacion/niubizz-service.ts:44` — confirmarPago: await niubizzClient.autorizar({ key: cuotaPendiente.respuesta_api ?? "", amount, transactionToken, purchaseNumber: String(Date.now()) }) - el resultado no se asigna ni se inspecciona.
- *( propagation )* `src/application/facturacion/niubizz-service.ts:52` — confirmarPago: this.facturacionRepo.pagarCuota(cuotaPendiente.id, "niubizz", null) se ejecuta incondicionalmente y marca la cuota como pagada.
- *( sink )* `src/infrastructure/persistence/facturacion-repository.ts:113` — Cascada de pagarCuota: El repositorio puede propagar en cascada facturacion y solicitud a PAGADO una vez que se marca la última cuota.

**Evidencia:**
- `src/infrastructure/external/niubizz-client.ts:29` — Solo se verifica `if (!res.ok) throw`; una respuesta 200 con un cuerpo de fallo se devuelve a los llamadores tal cual y nunca se inspecciona.
- `src/infrastructure/persistence/facturacion-repository.ts:82` — detalle() mapea solo id/numero/monto/fechaVencimiento/estado/comprobante, por lo que respuesta_api siempre es undefined y la clave de autorización es la cadena vacía.
- `src/domain/ports/facturacion-repository.ts:12` — La forma de cuota del puerto omite respuesta_api, lo que confirma que el servicio lee un campo que no puede poblarse.
- `src/middleware.ts:21` — facturacion:view protege el prefijo; ningún rol estático no-admin lo posee (constants.ts:209).

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- El comportamiento del lado del proveedor no es visible en el código fuente: si el proxy de Niubizz/IIMP devuelve una autorización rechazada como no-2xx (lo que lanzaría excepción y evitaría pagarCuota) o como un cuerpo 2xx (que se ignoraría y permitiría pagarCuota) no puede establecerse desde el repositorio.
- Si las credenciales IIMP_PROXY_*/NIUBIZZ_* están configuradas y el proxy es alcanzable en el despliegue es un hecho del despliegue.
- Si algún rol no-admin desplegado posee facturacion:view es un hecho de base de datos/despliegue.

**Plan de resolución:**
- *Local (fixture acotado):* En un sandbox impuesto por el SO con la app ejecutándose localmente bajo NODE_ENV distinto de production y sin red externa, siembra un Facturacion con una cuota pendiente y envía POST /api/facturacion/niubizz/confirmar con un transactionToken sintético; confirma que el resultado de autorización simulado localmente se descarta y la cuota se marca PAGADO, mostrando que pagarCuota no depende del resultado de la autorización.
- *Observado por el responsable:* El responsable proporciona el comportamiento documentado o previamente capturado de la rama get_authorization de niubiz.php del proxy IIMP para una transacción rechazada (estado HTTP y forma del cuerpo), de modo que pueda determinarse si un rechazo llega como un estado no-2xx (que lanza excepción antes de pagarCuota) o como un cuerpo 2xx que el código ignora; no se ejecuta ninguna transacción real.

---

## La creación de sesión de Niubizz lee los datos de cualquier factura por id sin vínculo con propietario/evento

**Fingerprint:** `facturacion.niubizz.sesion.missing-owner-event-binding`

**Descripción:** crearSesion solo verifica getSession() y luego carga Facturacion.detalle(facturacionId), un findUnique basado únicamente en el id sin ningún predicado de propietario o evento. Lee los PII del solicitante (nombre, apellidos, telefono) y devuelve al llamador un sessionToken de la pasarela, el amount y el merchantId. Un poseedor no-admin de facturacion:view podría iniciar una sesión de pago para cualquier factura y conocer los datos del solicitante y el monto de esa factura.

**Causa raíz alegada:** detalle() es findUnique({ where: { id } }) sin ningún predicado de propietario/evento, y crearSesion reenvía el facturacionId provisto por el llamador directamente hacia él antes de consultar PII y llamar a la pasarela.

**Traza:**
- *( entrypoint )* `src/app/api/facturacion/niubizz/sesion/route.ts:3` — POST /api/facturacion/niubizz/sesion: La ruta exporta niubizzController.crearSesion; /api/facturacion está protegido por facturacion:view en el middleware.
- *( propagation )* `src/controllers/niubizz.controller.ts:15` — crearSesion: getSession() y luego lee facturacionId del cuerpo y llama a niubizzService.crearSesion(facturacionId).
- *( propagation )* `src/application/facturacion/niubizz-service.ts:10` — crearSesion: facturacionRepo.detalle(facturacionId) carga la factura y sus cuotas para cualquier id.
- *( sink )* `src/application/facturacion/niubizz-service.ts:13` — Lectura de PII en crearSesion: prisma.userRole.findFirst({ where: { email: fact.correoSolicitante } }) obtiene el nombre/apellidos/telefono del solicitante y devuelve datos de sesión al llamador.

**Evidencia:**
- `src/infrastructure/persistence/facturacion-repository.ts:61` — findUnique({ where: { id } }) sin ningún predicado de propietario/evento, a diferencia de listar() que filtra por eventoId.
- `src/middleware.ts:21` — facturacion:view es la única puerta para el prefijo /api/facturacion.
- `src/lib/shared/constants.ts:209` — Ningún rol estático no-admin posee facturacion:view.
- `src/controllers/niubizz.controller.ts:20` — La respuesta devuelve sessionToken, amount y merchantId para la factura solicitada.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- Si algún rol no-admin desplegado o creado a medida posee facturacion:view es un hecho de base de datos/despliegue.
- Leer los PII/sesión de una víctima requiere que exista una fila Facturacion de un tercero y su registro de usuario solicitante en la base de datos desplegada (hecho de estado de datos).

**Plan de resolución:**
- *Local (fixture acotado):* Autentícate como poseedor de facturacion:view y llama POST /api/facturacion/niubizz/sesion con el facturacionId de otro usuario, confirmando que se devuelven el token de sesión/monto y los datos del solicitante.
- *Observado por el responsable:* Verifica si algún rol no-admin posee facturacion:view y si se espera que la propiedad de la factura se haga cumplir por solicitante.

---

## POST /api/facturacion/pagar-cuota liquida cualquier cuota por id sin vínculo con propietario/evento

**Fingerprint:** `facturacion.pagar-cuota.missing-owner-event-binding`

**Descripción:** pagarCuota se autentica solo mediante getSession() y luego actualiza el FacturacionCuota direccionado por el cuotaId del cuerpo de la solicitud a PAGADO sin ningún predicado que ate la cuota a la solicitud/empresa/evento del llamador. Cuando no quedan cuotas pendientes, propaga en cascada la Facturacion padre y la Solicitud a PAGADO. Debido a que el prefijo /api/facturacion requiere facturacion:view, un poseedor no-admin de ese permiso podría liquidar la factura de otra parte.

**Causa raíz alegada:** pagarCuota realiza findUnique/update basado únicamente en el cuotaId provisto, y su cascada actualiza facturacion/solicitud por el id padre, sin ningún predicado de propietario o eventoId; la ruta de lectura listar() aplica un filtro de eventoId que pagarCuota no tiene.

**Traza:**
- *( entrypoint )* `src/app/api/facturacion/[...slug]/route.ts:11` — Despacho POST pagar-cuota: El enrutador de slug mapea pagar-cuota a facturacionController.pagarCuota.
- *( propagation )* `src/controllers/facturacion.controller.ts:44` — pagarCuota: getSession() y luego service.pagarCuota(cuotaId, session.email, comprobante) usando el cuotaId crudo del cuerpo.
- *( propagation )* `src/infrastructure/persistence/facturacion-repository.ts:102` — pagarCuota: prisma.facturacionCuota.update({ where: { id: cuotaId }, data: { estado: PAGADO } }) liquida cualquier cuota por id.
- *( sink )* `src/infrastructure/persistence/facturacion-repository.ts:113` — Cascada de pagarCuota: Cuando no quedan cuotas pendientes, prisma.facturacion.update y prisma.solicitud.update establecen ambos a PAGADO para ese registro padre.

**Evidencia:**
- `src/middleware.ts:21` — facturacion:view es la única puerta para el prefijo /api/facturacion.
- `src/lib/shared/constants.ts:209` — Ningún rol estático no-admin posee facturacion:view.
- `src/infrastructure/persistence/facturacion-repository.ts:10` — listar() muestra el alcance por evento/solicitud previsto que pagarCuota omite.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- Si algún rol no-admin desplegado o creado a medida posee facturacion:view es un hecho de base de datos/despliegue.
- Alcanzar la cascada a PAGADO requiere una factura de la víctima con todas las cuotas liquidables en la base de datos desplegada (hecho de estado de datos).

**Plan de resolución:**
- *Local (fixture acotado):* Como poseedor de facturacion:view, llama POST /api/facturacion/pagar-cuota con un cuotaId perteneciente a otra solicitud y confirma que la cuota y la facturacion/solicitud padre cambian de estado.
- *Observado por el responsable:* Identifica los roles no-admin desplegados que poseen facturacion:view y si se espera que la confirmación de pago esté acotada por solicitante.

---

## La generación de código TypeScript interpola campos de layout almacenados sin escape

**Fingerprint:** `planos.exportar-ts.unescaped-codegen`

**Descripción:** exportarTypeScript construye código fuente TypeScript mediante interpolación cruda de plantillas de plano.codigo, nombre, descripcion, tipos[].codigo/label/nombre/color, bloques[].bloqueId/tipoCodigo/tipologia y campos de furniture. Ninguno de los valores interpolados se escapa, y los validadores acotan solo la longitud, no los caracteres, por lo que una comilla doble o un salto de línea almacenado en un nombre/código/color puede escapar de los literales de cadena/identificador emitidos. El endpoint está protegido por requireAdmin (laboratorio:manage o admin:full) y la cadena generada se devuelve como JSON, nunca se evalúa dentro del repositorio; el impacto depende de que un consumidor aguas abajo compile el artefacto.

**Causa raíz alegada:** Los template literals del codegen interpolan valores respaldados por la base de datos directamente y tsCodegenUtils no proporciona escape de cadenas/identificadores; toConstName solo convierte a mayúsculas y reemplaza guiones, dejando el resto de caracteres intactos.

**Traza:**
- *( entrypoint )* `src/app/api/planos/[...slug]/route.ts:11` — Despacho GET exportar-ts: El enrutador de slug mapea GET exportar-ts a planosController.exportarTs.
- *( propagation )* `src/controllers/planos.controller.ts:94` — exportarTs: requireAdmin() y luego lee id del query y llama a services.planos.exportarTypeScript(id).
- *( propagation )* `src/application/planos/planos-service.ts:157` — codegen de tipos: `${t.codigo}: { w: ${t.w}, d: ${t.d}, h: ${t.h}, color: "${t.color}" },` interpola codigo y color en crudo dentro del TS emitido.
- *( propagation )* `src/application/planos/planos-service.ts:184` — codegen de items: `{ id: "${b.bloqueId}", ... tipologia: "${b.tipologia ?? ...}", ... }` interpola bloqueId/tipologia en crudo.
- *( sink )* `src/application/planos/planos-service.ts:226` — codegen del registro: nombre: "${plano.nombre}", descripcion: "${plano.descripcion ?? ""}" interpolan texto libre almacenado en crudo dentro del TS emitido.

**Evidencia:**
- `src/lib/shared/utils/ts-codegen.ts:8` — toUnionType une `"${c}"` sin escape de comillas/barras invertidas/saltos de línea.
- `src/validators/planos.validator.ts:22` — planoLayoutSchema restringe codigo/label/nombre/color solo por longitud (z.string().min(1).max(...)), por lo que los caracteres de comilla y salto de línea pasan.
- `src/application/planos/planos-service.ts:154` — toConstName(plano.codigo) igualmente solo se convierte a mayúsculas con los guiones reemplazados, por lo que un identificador puede contener otros caracteres inyectados.
- `src/controllers/planos.controller.ts:11` — requireAdmin restringe el endpoint a poseedores de laboratorio:manage/admin:full.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- La cadena generada se devuelve como JSON y no se compila ni evalúa en ninguna parte de este repositorio; si un árbol aguas abajo compila el artefacto copiado y cómo lo hace es un hecho de despliegue/proceso.
- Si algún rol no-admin desplegado o creado a medida posee laboratorio:manage (o admin:full) es un hecho de base de datos/despliegue; el llamador estáticamente privilegiado ya es de confianza para la gestión del laboratorio.

**Plan de resolución:**
- *Local (fixture acotado):* Como poseedor de laboratorio:manage, almacena un plano cuyo nombre/descripcion/color contenga una comilla doble y un salto de línea, llama GET /api/planos/exportar-ts, luego pasa la cadena emitida por tsc para mostrar que está sintácticamente rota o contiene sentencias inyectadas.
- *Observado por el responsable:* Establece si el artefacto generado se copia y se compila en el build del frontend, y si un principal no-admin puede poseer laboratorio:manage.

---

## La importación de Plano persiste valores de layout evadiendo las restricciones del esquema de create/layout

**Fingerprint:** `planos.importar.unvalidated-layout`

**Descripción:** La ruta importar está protegida por requireAdmin (laboratorio:manage o admin:full) pero su esquema Zod tipa tipos, bloques y furniture como z.unknown() y codigo como solo z.string().min(1), luego importa a través de repo.importar que llama a guardarLayout directamente, evadiendo tanto planoLayoutSchema como la regex de codigo ^[a-z0-9-]+$ que aplica crear(). Por lo tanto, valores sin validar llegan al layout persistido y a cualquier código emitido posteriormente. Si esto cruza un límite de confianza depende de si un no-admin posee laboratorio:manage y de si el layout persistido/emitido es consumido por un build aguas abajo.

**Causa raíz alegada:** planoImportarSchema usa z.unknown() para tipos/bloques/furniture y omite las regex de create/layout, mientras que PlanoPrismaRepository.importar persiste vía guardarLayout sin revalidar el layout ni el codigo.

**Traza:**
- *( entrypoint )* `src/app/api/planos/[...slug]/route.ts:21` — Despacho POST importar: El enrutador de slug mapea POST importar a planosController.importar; /api/planos está protegido por laboratorio:view en el middleware y por requireAdmin dentro del controlador.
- *( propagation )* `src/controllers/planos.controller.ts:104` — importar: requireAdmin() y luego planoImportarSchema.parse(await request.json()) - el cuerpo parseado se castea `as never` y se reenvía.
- *( propagation )* `src/validators/planos.validator.ts:54` — planoImportarSchema: tipos: z.array(z.unknown()), bloques: z.array(z.unknown()), furniture: z.array(z.unknown()).default([]), y codigo: z.string().min(1) sin la regex de create.
- *( sink )* `src/infrastructure/persistence/plano-repository.ts:388` — importar: this.guardarLayout(plano.id, { tipos: data.tipos, bloques: ..., furniture: ... }) persiste el layout sin verificar directamente.

**Evidencia:**
- `src/application/planos/planos-service.ts:31` — crear() aplica /^[a-z0-9-]+$/ que importar nunca aplica.
- `src/application/planos/planos-service.ts:146` — importar() solo verifica que codigo/nombre existan y que tipos/bloques sean arreglos, luego delega al repositorio.
- `src/controllers/planos.controller.ts:11` — requireAdmin requiere laboratorio:manage o admin:full, un conjunto de llamadores privilegiados.
- `src/lib/shared/constants.ts:183` — laboratorio:manage se lista solo en los permisos del rol admin.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- Si algún rol no-admin desplegado o creado a medida posee laboratorio:manage (o admin:full) es un hecho de base de datos/despliegue; de lo contrario requireAdmin limita el llamador a un principal totalmente de confianza.
- Si el layout persistido se alimenta posteriormente a un paso de build/compilación (el flujo de trabajo documentado supuestamente copia artefactos a un árbol de frontend externo) no es visible en el código fuente de este repositorio.

**Plan de resolución:**
- *Local (fixture acotado):* Autentícate como poseedor de laboratorio:manage y envía POST /api/planos/importar con un codigo que contenga caracteres no permitidos y tipos/bloques de forma arbitraria, luego recarga el plano y confirma que los valores inválidos se persistieron.
- *Observado por el responsable:* Determina si algún rol no-admin posee laboratorio:manage y si un proceso automatizado consume artefactos de plano importados/exportados en un árbol compilado.

---

## Consulta de DNI en RENIEC sin autenticación bajo el token de operador del lado del servidor

**Fingerprint:** `reniec/dni/unauth-paid-pii-lookup`

**Descripción:** GET /api/reniec/dni valida solo el formato de 8 dígitos y luego llama al proveedor externo api.apis.net.pe con un Bearer token del lado del servidor. La ruta está ausente tanto de PROTECTED como de las allowlists públicas, por lo que el middleware deja pasar a llamadores anónimos, y el controlador nunca establece una sesión. La consecuencia alegada es que un llamador no autenticado puede impulsar consultas de PII con credenciales del operador y leer los datos de identidad devueltos; esa consecuencia depende de hechos del proveedor y del despliegue que el código fuente no establece.

**Causa raíz alegada:** src/middleware.ts:50-72 deja pasar /api/reniec porque ningún prefijo PROTECTED coincide; consultas.controller.ts:23-35 verifica solo un patrón de 8 dígitos y llama a consultasClient.consultarDni, que en consultas-client.ts:9-10 adjunta Authorization: Bearer ${SUNAT_API_TOKEN} a la solicitud al proveedor.

**Traza:**
- *( entrypoint )* `src/middleware.ts:50` — Bucle de prefijos PROTECTED: Ninguna entrada PROTECTED coincide por prefijo con /api/reniec y no está en las listas PUBLIC, por lo que la solicitud pasa hasta la ruta.
- *( propagation )* `src/app/api/reniec/[...slug]/route.ts:6` — Despacho GET dni: createRouter despacha el GET anónimo a reniecController.consultarDni.
- *( propagation )* `src/controllers/consultas.controller.ts:26` — Verificación de formato de consultarDni: Solo se aplica /^\d{8}$/; ninguna verificación de getSession o permiso precede la llamada al proveedor.
- *( sink )* `src/infrastructure/external/consultas-client.ts:9` — Solicitud al proveedor fetchAPI: Emite GET a la URL fija de DNI con Authorization: Bearer ${SUNAT_API_TOKEN}; con el token sin definir la función lanza excepción antes de llamar al proveedor.

**Evidencia:**
- `src/middleware.ts:72` — Las rutas sin coincidencia pasan a NextResponse.next().
- `src/lib/shared/constants.ts:30` — PUBLIC_API_ROUTES no incluye /api/reniec.
- `src/controllers/consultas.controller.ts:26` — Solo se valida un patrón de 8 dígitos; ninguna verificación de sesión.
- `src/infrastructure/external/consultas-client.ts:3` — El token de operador se lee de SUNAT_API_TOKEN.
- `src/infrastructure/external/consultas-client.ts:24` — consultarDni apunta a la URL fija de DNI api.apis.net.pe.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- Si SUNAT_API_TOKEN está aprovisionado en la tarea desplegada no es visible en el código fuente; consultas-client.ts:8 lanza excepción antes de cualquier llamada al proveedor cuando no está definido.
- La respuesta del proveedor (si api.apis.net.pe devuelve datos de identidad completos) y la autorización del lado del proveedor son hechos externos no presentes en el repositorio.

**Plan de resolución:**
- *Local (fixture acotado):* En un sandbox impuesto por el SO con un entorno vacío en allowlist, ejecuta el handler /api/reniec/dni contra un stub loopback para api.apis.net.pe usando un token ficticio y verifica que una solicitud anónima sin Cookie llega al handler y emite la solicitud Bearer; no uses red externa.
- *Observado por el responsable:* Un responsable confirma si SUNAT_API_TOKEN está configurado y observa que un GET /api/reniec/dni?numero=<dummy 8 digits> no autenticado desde afuera devuelve datos del proveedor (o 502 cuando el token no está definido) sin ninguna cookie de token presente.

---

## La guarda de propiedad de modificar se cortocircuita cuando Solicitud.userId es null

**Fingerprint:** `solicitudes.modificar.null-owner-bypass`

**Descripción:** solicitudesController.modificar protege con `if (detalle.userId && detalle.userId !== session.sub && !session.permissions.includes("admin:full"))` (solicitudes.controller.ts:94). Debido a que la comparación de propiedad está condicionada a que detalle.userId sea truthy, una solicitud cuyo userId es null evade la verificación para todo llamador autenticado, que luego puede resetear todas sus revisiones a pendiente (controller.ts:100-102). Solicitud.userId es nullable (schema.prisma:221) y /api/reservas/crear está ausente de PROTECTED y de las listas públicas, por lo que el middleware deja pasar (middleware.ts:72) y reservaController.crear lee una sesión opcional y pasa userSub undefined, llevando a crearSolicitud a escribir userId: null (solicitudes-repository.ts:265). Por lo tanto, las filas con propietario null son producibles, pero si existe una fila explotable en la base de datos desplegada — y si tiene revisiones completadas necesarias para pasar la guarda de todas-las-revisiones-no-pendientes del controlador (controller.ts:97) — es un hecho de estado de datos que no puede establecerse a partir del código fuente.

**Causa raíz alegada:** El predicado de autorización está escrito como `detalle.userId && ...` en lugar de denegar por defecto, por lo que un propietario null hace que toda la comparación de propiedad pase de forma vacua; combinado con un Solicitud.userId nullable y una ruta de reserva no autenticada que escribe propietarios null, el invariante de denegar por defecto no se cumple.

**Traza:**
- *( entrypoint )* `src/app/api/solicitudes/[...slug]/route.ts:13` — Despacho POST modificar: El enrutador de slug mapea POST /api/solicitudes/modificar a solicitudesController.modificar.
- *( propagation )* `src/controllers/solicitudes.controller.ts:94` — Guarda de propiedad de modificar: if (detalle.userId && detalle.userId !== session.sub && !admin) — un propietario null/falsy cortocircuita la guarda y admite a cualquier llamador.
- *( propagation )* `src/controllers/solicitudes.controller.ts:101` — Reset de revisiones de modificar: Para cada revisión el controlador llama services.solicitudes.revisar(..., estado: PENDIENTE), reseteando el flujo de trabajo de la solicitud objetivo.
- *( propagation )* `src/controllers/reserva.controller.ts:15` — crear: userEmail/userSub se toman de una sesión opcional (getSession() puede devolver null) y se reenvían a reservas.crear.
- *( sink )* `src/infrastructure/persistence/solicitudes-repository.ts:265` — crearSolicitud: userId: userId ?? null — las solicitudes creadas a través de la ruta no autenticada /api/reservas persisten un propietario null.

**Evidencia:**
- `prisma/schema.prisma:221` — Solicitud.userId es opcional (String? @map("user_id")), por lo que los propietarios null son un estado almacenado válido.
- `src/middleware.ts:72` — /api/reservas no coincide ni con PROTECTED ni con las listas públicas, por lo que el middleware devuelve NextResponse.next() y la ruta es anónima.
- `src/middleware.ts:28` — modificar mismo es alcanzable por cualquier poseedor de solicitudes:view, incluido `cliente`.
- `src/controllers/solicitudes.controller.ts:97` — modificar rechaza mientras alguna revisión esté pendiente, por lo que una fila con propietario null debe haber completado sus tres revisiones para poder resetearse — una precondición de estado de datos.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- La existencia de una fila Solicitud con userId = NULL en la base de datos desplegada (y, según controller.ts:97, una cuyas revisiones sean todas no pendientes) es un hecho de estado de datos que no puede observarse desde el código fuente.
- Si alguna de esas filas con propietario null pertenece a una parte distinta (a diferencia de una reserva anónima) determina si el bypass cruza un límite de propiedad real; el repositorio no registra un creador para las reservas con propietario null.

**Plan de resolución:**
- *Local (fixture acotado):* Con una base de datos sembrada, inserta una Solicitud con userId NULL y tres revisiones no pendientes, luego llama POST /api/solicitudes/modificar como un usuario autenticado no relacionado con ese id y confirma que la guarda 403 se omite y las revisiones se resetean.
- *Observado por el responsable:* Consulta la tabla solicitud desplegada por filas con user_id IS NULL que tengan revisiones completadas, y rastrea si el flujo público /api/reservas se usa para crear reservas de clientes desconectados.

---

## Consulta de RUC en SUNAT sin autenticación bajo el token de operador del lado del servidor

**Fingerprint:** `sunat.ruc.unauth-operator-credential-pii-lookup`

**Descripción:** GET /api/sunat/ruc valida solo el formato de 11 dígitos y luego llama al proveedor externo api.apis.net.pe con un Bearer token del lado del servidor. La ruta está ausente tanto de PROTECTED como de las allowlists públicas, por lo que el middleware deja pasar a llamadores anónimos, y el controlador nunca establece una sesión. La consecuencia alegada es que un llamador no autenticado puede impulsar consultas de RUC con credenciales del operador y leer los datos empresariales/PII devueltos; esa consecuencia depende de hechos del proveedor y del despliegue que el código fuente no establece.

**Causa raíz alegada:** src/middleware.ts:50-72 deja pasar /api/sunat porque ningún prefijo PROTECTED coincide; consultas.controller.ts:7-19 verifica solo un patrón de 11 dígitos y llama a consultasClient.consultarRuc, que en consultas-client.ts:9-10 adjunta Authorization: Bearer ${SUNAT_API_TOKEN} a la solicitud al proveedor.

**Traza:**
- *( entrypoint )* `src/middleware.ts:50` — Bucle de prefijos PROTECTED: Ninguna entrada PROTECTED coincide por prefijo con /api/sunat y no está en las listas PUBLIC, por lo que la solicitud pasa hasta la ruta.
- *( propagation )* `src/app/api/sunat/[...slug]/route.ts:6` — Despacho GET ruc: createRouter despacha el GET anónimo a sunatController.consultarRuc.
- *( propagation )* `src/controllers/consultas.controller.ts:10` — Verificación de formato de consultarRuc: Solo se aplica /^\d{11}$/; ninguna verificación de getSession o permiso precede la llamada al proveedor.
- *( sink )* `src/infrastructure/external/consultas-client.ts:9` — Solicitud al proveedor fetchAPI: Emite GET a la URL fija de RUC con Authorization: Bearer ${SUNAT_API_TOKEN}; con el token sin definir la función lanza excepción antes de llamar al proveedor.

**Evidencia:**
- `src/middleware.ts:72` — Las rutas sin coincidencia pasan a NextResponse.next().
- `src/lib/shared/constants.ts:30` — PUBLIC_API_ROUTES no incluye /api/sunat.
- `src/controllers/consultas.controller.ts:10` — Solo se valida un patrón de 11 dígitos; ninguna verificación de sesión.
- `src/infrastructure/external/consultas-client.ts:3` — El token de operador se lee de SUNAT_API_TOKEN.
- `src/infrastructure/external/consultas-client.ts:21` — consultarRuc apunta a la URL fija de RUC api.apis.net.pe.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- Si SUNAT_API_TOKEN está aprovisionado en la tarea desplegada no es visible en el código fuente; consultas-client.ts:8 lanza excepción antes de cualquier llamada al proveedor cuando no está definido.
- La respuesta del proveedor (si api.apis.net.pe devuelve datos empresariales/PII completos) y la autorización del lado del proveedor son hechos externos no presentes en el repositorio.

**Plan de resolución:**
- *Local (fixture acotado):* En un sandbox impuesto por el SO con un entorno vacío en allowlist, ejecuta el handler /api/sunat/ruc contra un stub loopback para api.apis.net.pe usando un token ficticio y verifica que una solicitud anónima sin Cookie llega al handler y emite la solicitud Bearer; no uses red externa.
- *Observado por el responsable:* Un responsable confirma si SUNAT_API_TOKEN está configurado y observa que un GET /api/sunat/ruc?numero=<dummy 11 digits> no autenticado desde afuera devuelve datos del proveedor (o 502 cuando el token no está definido) sin ninguna cookie de token presente.

---

## Carga de archivos sin autenticación con extensión controlada por el atacante dentro de la raíz web pública

**Fingerprint:** `upload/unauth-extension-to-public-html`

**Descripción:** POST /api/upload acepta un archivo multipart sin autenticación, deriva la extensión almacenada del nombre de archivo provisto por el llamador sin ninguna allowlist, y el adaptador de almacenamiento por defecto escribe los bytes en public/uploads. nginx sirve /uploads/ desde el mismo origen con el tipo de contenido inferido por la extensión y sin nosniff ni Content-Disposition. Dependiendo del proveedor de almacenamiento activo y de la capa que sirve, un llamador anónimo puede colocar contenido activo (por ejemplo .html o .svg) que el navegador de una víctima ejecuta en el origen de la aplicación.

**Causa raíz alegada:** src/middleware.ts deja /api/upload sin protección; src/app/api/upload/route.ts:17 deriva la extensión de file.name sin ninguna allowlist; src/lib/server/storage.ts:12-16 escribe en public/uploads por defecto; docker/nginx.conf:26-30 sirve /uploads/ con un tipo de contenido basado en la extensión y sin nosniff ni encabezado attachment.

**Traza:**
- *( entrypoint )* `src/middleware.ts:50` — Bucle de prefijos PROTECTED: /api/upload no coincide con ninguna entrada PROTECTED y no es pública, por lo que la solicitud anónima pasa.
- *( propagation )* `src/app/api/upload/route.ts:7` — Handler POST: Lee formData(file) y procesa la carga sin ninguna verificación de sesión.
- *( propagation )* `src/lib/server/storage.ts:11` — localAdapter.upload: Escribe el buffer en <cwd>/public/uploads/<timestamp>_<random>.<ext>, donde ext provino del nombre de archivo del atacante.
- *( sink )* `docker/nginx.conf:26` — location /uploads/: Sirve el archivo almacenado desde /app/public con el tipo mime inferido de la extensión y sin X-Content-Type-Options ni Content-Disposition.

**Evidencia:**
- `src/middleware.ts:12` — Ninguna entrada PROTECTED coincide con /api/upload.
- `src/lib/shared/constants.ts:30` — PUBLIC_API_ROUTES no incluye /api/upload.
- `src/app/api/upload/route.ts:17` — La extensión es file.name.split('.').pop() sin ninguna allowlist.
- `src/app/api/upload/route.ts:19` — El tipo de contenido proviene de file.type para la rama de S3.
- `src/lib/server/storage.ts:12` — El adaptador por defecto escribe en public/uploads.
- `src/lib/server/storage.ts:52` — El proveedor es local a menos que STORAGE_PROVIDER=s3.
- `docker/nginx.conf:27` — Solo se establecen expires y Cache-Control; no X-Content-Type-Options ni Content-Disposition.
- `docker-compose.prod.yml:52` — El repositorio del host se monta por bind en rw en /app para que public/uploads persista y se sirva.

**Bloqueadores:**
- no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo
- El STORAGE_PROVIDER desplegado (local vs s3) no es visible en el código fuente; la rama de S3 devuelve una URL de bucket/CDN y fija public-read, lo que cambia el origen del host de la app al bucket.
- Qué capa de servicio está delante de la app en el despliegue activo (EC2 nginx /app/public, servicio estático de Next de public/, o CloudFront/S3) y por lo tanto el Content-Type exacto de la respuesta son hechos del despliegue no establecidos completamente por el código fuente.

**Plan de resolución:**
- *Local (fixture acotado):* En un sandbox impuesto por el SO, invoca el handler POST con un fixture multipart acotado cuyo nombre de archivo termine en .html y verifica la ruta devuelta; luego solicítala a través del handler estático configurado y registra el Content-Type y la ausencia de nosniff. No uses red externa.
- *Observado por el responsable:* Un responsable confirma el STORAGE_PROVIDER desplegado y observa que GET https://<host>/uploads/<random>.html devuelve Content-Type text/html con los bytes cargados y sin X-Content-Type-Options: nosniff ni Content-Disposition: attachment.

---
