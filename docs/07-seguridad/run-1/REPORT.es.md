# Informe de auditoría de seguridad — ContratosStands (ejecución 1)

## 1. Resumen de la ejecución

- **Objetivo:** `C:/Proyectos/IIMP/ContratosStands`
- **Ref de origen:** `de1ebbbc07019ab93031f8d9ab25e9bba1928df6` (rama main; worktree sucio solo por el archivo no rastreado `.opencode/skills/security-audit/`)
- **Perfil / alcance:** `standard`, repositorio completo (`scope_paths: ["."]`)
- **Presupuesto:** ninguno definido (null). Agentes empleados: ~26 subagentes (4 de reconocimiento, 8 cazadores en 4 oleadas, 4 críticos de cobertura, 6 verificadores de candidatos, 3 verificadores de registros finales, 2 agentes de extracción).
- **Política de ejecución:** `sandboxed-source-and-local-only`. **No hay sandbox impuesto por el SO disponible en este host Windows** (sin aislamiento de red, entorno con lista blanca, montajes de solo lectura ni límites de recursos), por lo que **no se ejecutó código controlado por el objetivo**. Toda afirmación dependiente de la ejecución o del despliegue se registra como `needs_validation`.
- **Ejecuciones previas:** ninguna — no existe un `coverage-ledger.json` ni un `findings.json` compatibles previos. Esta es la ejecución 1 y es parcial por construcción.
- **Entregables:** `architecture.md`, `coverage-ledger.json`, `findings.json`, `REPORT.md`, `FINDINGS-DETAIL.md`, `NEEDS-VALIDATION.md`.
- **Validación:** `findings.json` y `coverage-ledger.json` pasan ambos sus validadores (ejecutados mediante las funciones exportadas `validateDocument` porque los CLIs incluidos requieren `O_NOFOLLOW`/`O_NONBLOCK` de POSIX que Windows no proporciona).

## 2. Postura de seguridad

Esta aplicación expone una gran superficie de API no autenticada y su autorización está repartida entre un middleware de borde basado en prefijos y comprobaciones inconsistentes por controlador. Los problemas más graves, plenamente establecidos en el código fuente, son: carga de archivos anónima servida en el mismo origen que HTML; múltiples endpoints anónimos que cambian estado (sincronización/actualización/mockup de GESS, reservas, ingesta del registro de errores); falta sistémica de autorización a nivel de objeto en solicitudes (cualquier cliente autenticado puede leer, revisar y reevaluar los registros de cualquier otro cliente); una ruta de facturación que marca cuotas como pagadas sin inspeccionar el resultado de la pasarela; almacenamiento de contraseñas en texto plano con un default `123456`; y un secreto JWT de respaldo hardcodeado.

## 3. Hallazgos confirmados

**28 confirmados** — severidad: high: 16, medium: 11, low: 1.

| Severidad | Título | Frontera afectada | Resultado observado (establecido en el código) |
|---|---|---|---|
| HIGH | Cualquier rol autenticado puede ejecutar búsquedas arbitrarias de PII de personas contra el servicio upstream de búsqueda de personas | POST /rest/searchpersonv00 | El análisis del código establece que la solicitud pasa el middleware de solo autenticación y llega al servicio upstream de búsqueda de personas a través del cliente del lado del servidor, cuya respuesta declarada  |
| HIGH | GET /api/solicitudes/detalle devuelve cualquier solicitud por UUID a cualquier titular de solicitudes:view | detalle | El análisis del código establece que la solicitud pasa el middleware (solicitudes:view) y llega a findUnique por id sin predicado de propietario, por lo que el registro de cualquier propietario se devuelve a un |
| HIGH | GET /api/solicitudes/listar deriva el alcance de propietario desde la cadena de consulta, exponiendo cada solicitud de un evento a cualquier titular de solicitudes:view | listar | El análisis del código establece que la solicitud pasa la puerta solicitudes:view (middleware.ts:28) y llega a un findMany de Prisma cuya cláusula where contiene solo el predicado del evento  |
| HIGH | Token de GitHub incrustado en la URL remota de git y persistido en la configuración git del host | Copia de trabajo del host EC2 | El código muestra que la URL remota contiene el token; el comportamiento documentado de git persiste esa URL en .git/config, dejando la credencial en disco hasta que se rote. |
| HIGH | El ALB expuesto a Internet es accesible directamente y omite el WAF de CloudFront | aws_cloudfront_distribution.main | El código y el plan de producción muestran el ALB abierto a 0.0.0.0/0 mientras el WAF solo protege CloudFront, por lo que las solicitudes directas al origen omiten todas las reglas del WAF. |
| HIGH | Token de restablecimiento de contraseña generado con Math.random() | AuthPrismaRepository.setResetToken | El análisis del código confirma que el token son 32 caracteres en base36 producidos por Math.random(), que no es criptográficamente seguro, por lo que los valores del token son predecibles en principio dentro del |
| HIGH | Contraseñas almacenadas y comparadas en texto plano | AuthPrismaRepository.findByEmail | El análisis del código muestra que el código de inicio de sesión realiza una comparación exacta de cadenas contra el valor almacenado, por lo que el valor almacenado es directamente utilizable como la contraseña, y el default sembrado 12 |
| HIGH | POST /api/solicitudes/revisar acepta cualquier área de cualquier titular de solicitudes:view, omitiendo los permisos de revisión específicos del área | crearOActualizarRevision | El análisis del código establece que, tras la comprobación de presencia de getSession, el area/estado enviados se persisten mediante crearOActualizarRevision con quien llama como revisor y sin permissi |
| HIGH | El contenedor de producción fuerza el esquema con prisma db push en cada arranque | gated migrations | El código muestra que db push se ejecuta en cada arranque de producción independientemente de RUN_MIGRATIONS; el esquema se fuerza a sincronizarse con el schema.prisma desplegado fuera del historial de migraciones |
| HIGH | El contenedor de producción se ejecuta como root y monta en modo lectura-escritura el árbol de código del host | app service volumes | El código establece ejecución como root y un bind del host en modo lectura-escritura; el compromiso del contenedor puede modificar el código del repositorio del host usado por futuros despliegues. |
| HIGH | La actualización propia del perfil asigna en masa columnas arbitrarias de UserRole | AuthPrismaRepository.updatePerfil | El análisis del código muestra que el cuerpo no validado llega a updateMany sin una lista de permitidos, por lo que los campos del modelo proporcionados más allá del DTO documentado se persisten en el propio UserRole de quien llama |
| HIGH | La importación GESS no autenticada permite la creación/sobrescritura arbitraria de stands para cualquier evento | GessApplicationService.sync upsert | El análisis del código establece que el controlador reenvía el cuerpo sin autenticación y el servicio crea/actualiza filas GessStand a partir del arreglo proporcionado por quien llama para el evento elegido por quien llama |
| HIGH | Divulgación no autenticada del inventario de stands GESS en todos los eventos | GessPrismaRepository.findAllPaginated | El análisis del código establece que el GET atraviesa el fall-through del middleware, el controlador no realiza ninguna comprobación de autenticación y el repositorio devuelve el conjunto completo de filas GessStand para el ca |
| HIGH | La generación de mockup no autenticada restablece el estado de GessStand a disponible y borra empresa | GessApplicationService.mockup upsert | El análisis del código establece que el handler se ejecuta sin autenticación y la ruta de actualización del servicio fuerza estado: "disponible" y empresa: null en cada stand coincidente. |
| HIGH | La reserva de stand no autenticada bloquea inventario y crea solicitudes | transición de estado del stand | No ejecutado (no hay sandbox impuesto por el SO en el host de auditoría); el rastreo del código muestra de forma determinista que una sesión null no se rechaza y la actualización del stand más la creación de solicitud y revisión |
| HIGH | Actualización no autenticada de cualquier GessStand por id | GessPrismaRepository.update | El análisis del código establece que el middleware deja pasar el PATCH y el repositorio actualiza la fila seleccionada únicamente por el id proporcionado por el atacante. |
| MEDIUM | .gitignore omite .env.prod / .env.production pese a que producción los requiere | plantilla de secretos | Ninguna regla de .gitignore coincide con .env.prod/.env.production, por lo que un archivo de secretos de producción con datos se rastrearía y se subiría si se prepara. |
| MEDIUM | La autorización confía en las claims del JWT sin revocación hasta su expiración a las 24h | signToken | El análisis del código muestra que la puerta verifica solo la firma y lee los permisos del token, por lo que los permisos revocados siguen vigentes hasta la expiración de 24h. |
| MEDIUM | CloudFront reenvía el tráfico del espectador al origen ALB sobre HTTP en texto claro | custom_origin_config.origin_protocol_policy | El código fija el protocolo de origen a solo HTTP, por lo que las cargas entre el edge y el origen se transportan sin cifrar. |
| MEDIUM | El workflow de despliegue invoca una etiqueta mutable de una acción de terceros mientras le entrega credenciales de producción de EC2 | script remoto ejecutado por la acción | El código establece la referencia a la etiqueta mutable y las entradas de secretos; no existe ninguna vinculación de integridad a un commit revisado, por lo que las credenciales quedan expuestas a cualquier código al que apunte la etiqueta |
| MEDIUM | GET /api/solicitudes/historial expone el historial de revisor y las justificaciones de cualquier solicitud a cualquier titular de solicitudes:view | obtenerHistorial historial | El análisis del código establece que el middleware admite a cualquier titular de solicitudes:view y el repositorio devuelve todas las filas Revision y RevisionHistorial para el solicitudId proporcionado |
| MEDIUM | Los clientes de integración saliente deshabilitan la verificación de certificados TLS en todo el proceso | PlanogessClient.fetchStands | El análisis del código muestra que los clientes establecen NODE_TLS_REJECT_UNAUTHORIZED="0" alrededor del fetch, por lo que la verificación del certificado del par se deshabilita para esa conexión y una respuesta manipulada es |
| MEDIUM | POST /api/solicitudes/orden-pago mueve cualquier solicitud a PENDIENTE_PAGO y crea una factura sin el permiso facturacion | marcarOrdenPago | El análisis del código establece que el controlador solo comprueba que exista una sesión y luego escribe el estado y una fila Facturacion con clave del id proporcionado sin permiso facturacion ni o |
| MEDIUM | POST /api/solicitudes/reevaluar permite a cualquier titular de solicitudes:view crear una reevaluación sobre cualquier solicitud | atenderReevaluacionAprobacion | El análisis del código establece que el handler no realiza ninguna comparación de propietario/permisos y el repositorio crea una Reevaluacion vinculada al solicitudId proporcionado, por lo que cualquier solicitude |
| MEDIUM | POST /api/solicitudes/upload-doc adjunta un documento a cualquier id de solicitud sin vinculación de propietario | crearDocumentoAdjunto | El análisis del código establece que el servicio nunca carga ni comprueba el propietario de la solicitud y el repositorio inserta el SolicitudDocumento para el id proporcionado, por lo que un documento se adjunta |
| MEDIUM | Escrituras no autenticadas y sin límite en la tabla ErrorLog | prisma.errorLog.create | El análisis del código establece que la solicitud atraviesa el fall-through del middleware, no se requiere sesión y se inserta una fila por cada llamada; la tabla no tiene retención ni cardina |
| MEDIUM | Entrada de atacante sin escapar interpolada en correos de notificación HTML | celda de tabla HTML de buildReservaConfirmationEmail | No ejecutado (no hay sandbox impuesto por el SO en el host de auditoría); el rastreo del código muestra de forma determinista que las cadenas razonSocial y documento controladas por el atacante se concatenan sin escapar |
| LOW | Acceso no autenticado al proxy interno de eventos de KBServicios | fetchApi | No ejecutado (no hay sandbox impuesto por el SO en el host de auditoría); el rastreo del código muestra de forma determinista que la solicitud anónima no es controlada ni por el middleware ni por el controlador y llega |

El rastreo completo, la reproducción y la remediación de cada hallazgo confirmado están en `FINDINGS-DETAIL.md` (medium y superiores) y en `findings.json` (todos los veredictos).

## 4. Necesitan validación

**13 leads** con un rastreo de código y un hecho exacto sin resolver. Ninguno tiene severidad.

| Título | Frontera / rastreo | Bloqueador exacto (primero) |
|---|---|---|
| Un llamador autenticado de auspicios puede retransmitir un cuerpo no validado al endpoint privilegiado saveauspicio de KBServicios | src/app/api/auspicios/grabar/route.ts:17 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| JWT firmado/verificado con un secreto de respaldo hardcodeado cuando JWT_SECRET no está definido | src/lib/server/auth.ts:41 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| PATCH /api/facturacion/actualizar propaga un cuerpo no validado al update de Prisma | src/infrastructure/persistence/facturacion-repository.ts:123 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| Las mutaciones de facturación direccionadas solo por id de registro carecen de vinculación de propietario/evento | src/infrastructure/persistence/facturacion-repository.ts:141 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| La confirmación de pago de Niubizz ignora el resultado de autorización de la pasarela antes de marcar una cuota como pagada | src/infrastructure/persistence/facturacion-repository.ts:113 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| La creación de sesión de Niubizz lee los datos de cualquier factura por id sin vinculación de propietario/evento | src/application/facturacion/niubizz-service.ts:13 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| POST /api/facturacion/pagar-cuota liquida cualquier cuota por id sin vinculación de propietario/evento | src/infrastructure/persistence/facturacion-repository.ts:113 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| La generación de código TypeScript interpola campos de layout almacenados sin escapar | src/application/planos/planos-service.ts:226 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| La importación de Plano persiste valores de layout omitiendo las restricciones del esquema create/layout | src/infrastructure/persistence/plano-repository.ts:388 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| Consulta de DNI en RENIEC no autenticada bajo el token de operador del lado del servidor | src/infrastructure/external/consultas-client.ts:9 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| La comprobación de propiedad de modificar cortocircuita cuando Solicitud.userId es null | src/infrastructure/persistence/solicitudes-repository.ts:265 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| Consulta de RUC en SUNAT no autenticada bajo el token de operador del lado del servidor | src/infrastructure/external/consultas-client.ts:9 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |
| Carga de archivos no autenticada con extensión controlada por el atacante en la raíz web pública | docker/nginx.conf:26 | no hay sandbox impuesto por el SO disponible en el host de auditoría para ejecutar código controlado por el objetivo |

Los detalles y los planes de resolución seguros están en `NEEDS-VALIDATION.md`.

## 5. Notas de endurecimiento y patrones positivos

Controles positivos visibles en el código que vale la pena preservar: las alertas están confiablemente acotadas por propietario (`alertas-service.ts`); la comprobación de clave M2M falla de forma cerrada cuando `INTEGRACION_API_KEY` no está definida; los despliegues declarados fijan `NODE_ENV=production`, por lo que el bypass de `IS_LOCAL` es inalcanzable allí; el entrypoint de ECS prohíbe `prisma db push`; y se revisaron las rutas de lectura del harness/plan y se encontró que no tienen sumidero de SSRF ni de traversal.

- src/lib/server/integracion-m2m.ts:3-15: IS_LOCAL = NODE_ENV !== "production" es una inferencia fail-open; se mitiga porque Dockerfile:11-12, Dockerfile.ecs:45 y docker-compose.prod.yml:43 fijan NODE_ENV=production, pero se prefiere un flag positivo explícito y mantener la comprobación de clave en todos los entornos.
- src/lib/server/integracion-m2m.ts:15: `enviada === clave` no es de tiempo constante, y una única clave global autoriza las lecturas de exhibidoras/stands/contrato sin alcance por evento ni por recurso.
- src/application/auth/auth-service.ts:56-74: seleccionar-evento acuña un token a partir de las claims del cuerpo de la solicitud y puede crear filas Evento/EventoPadre (auth-repository.ts:28-47) sin comprobación de events:create/events:manage.
- src/controllers/auth.controller.ts:52: la cookie de seleccionar-evento omite el atributo Secure que cookie.ts:9 aplica a la cookie de inicio de sesión.
- src/application/auth/auth-service.ts:102: el token de restablecimiento se entrega en una cadena de consulta de URL y se envía por correo, exponiéndolo vía Referer/historial/logs.
- src/middleware.ts:12-36,72: la lista PROTECTED es una allowlist y las rutas no coincidentes hacen fall-through sin comprobación en el edge; hacer que /api/** sea default-deny con una lista pública explícita.
- src/application/auth/auth-service.ts:23: la desigualdad de cadenas no es de tiempo constante; una verificación con hash eliminaría el oráculo de temporización.
- solicitudes.modificar restablece las revisiones con solo solicitudes:view; exigir permiso de propietario/revisor y denegar cuando el propietario esté ausente.
- marcarOrdenPago deriva montoTotal eliminando los no dígitos de medidas ('3x3'->33); usar un campo de precio tipado con validación en el servidor.
- atenderReevaluacionAprobacion copia reevaluacion.documentos en solicitud.documentos sin validar el tipo ni el propietario.
- notificar acepta una dirección `to` arbitraria y envía por correo los detalles de la solicitud; vincular al correo del cliente almacenado o a una allowlist de revisores.
- solicitudes listar parsea un parámetro `search` que nunca se aplica a la cláusula where de Prisma; el filtro declarado es ineficaz.
- /api/reservas/crear no está ni en PROTECTED ni en PUBLIC_API_ROUTES; agregarlo explícitamente a la puerta protegida o exigir una sesión.
- POST /api/planogess/fetch es anónimo e invoca la API interna de Planogess con códigos de evento elegidos por el cliente; agregar autenticación y limitación de tasa por principal.
- src/lib/server/storage.ts:21-48: cualquier cliente puede forzar PUT salientes al endpoint de S3 con content type controlado por el atacante y x-amz-acl: public-read; restringir el content type y usar objetos privados con entrega firmada.
- src/infrastructure/external/planogess-client.ts:27-34: NODE_TLS_REJECT_UNAUTHORIZED solo se restaura en la ruta de éxito; un fetch rechazado deja la verificación TLS deshabilitada en todo el proceso.
- GET /api/gess/listar expone valores de stand/empresa/rawData y alimenta el descubrimiento de ids para los endpoints de escritura no autenticados.
- src/lib/server/error-logger.ts: agregar límites de longitud a nivel de esquema y un trabajo programado de retención/limpieza para error_log.
- src/infrastructure/external/entidades-client.ts: las llamadas upstream no llevan API key ni vinculación, a diferencia de las integraciones m2m/auspicios.
- /api/auspicios/listar devuelve datos upstream textualmente bajo una clave privilegiada; validar y minimizar la respuesta.
- src/lib/server/integracion-m2m.ts:15: usar timingSafeEqual más claves por integración con rotación/revocación.
- Los controladores M2M reflejan los mensajes de excepción sin procesar al llamador en el 500 (exhibidoras.controller.ts:26, stands-exhibidora.controller.ts:27).
- GET /api/exhibidoras devuelve el directorio completo de empresas sin paginación ni limitación de tasa.
- confirmarPago carece de la defensa en profundidad de getSession() que realiza su hermano crearSesion (niubizz.controller.ts:32 vs :12).
- planoLayoutSchema solo limita la longitud de label/nombre/color/bloqueId/tipoCodigo (planos.validator.ts:22-32); agregar restricciones de conjunto de caracteres para reducir la exposición del codegen.
- terraform/modules/ecs/main.tf:602-603: execution_role_arn y task_role_arn son el mismo rol de IAM; separar los roles de ejecución y de tarea.
- terraform/modules/ecs/main.tf:438-446: elasticfilesystem ClientMount/ClientWrite/ClientRootAccess sobre Resource ["*"]; acotar al ARN del file-system/access-point.
- terraform/modules/ecs/main.tf:390-397: la política de confianza del rol de tarea carece de condiciones aws:SourceAccount/aws:SourceArn.
- terraform/modules/ecs/main.tf:337 + terraform/variables.tf:257: ECR image_tag_mutability="MUTABLE" con tag por defecto "latest" permite la sustitución de build-to-promotion; fijar digests y tags inmutables.
- .github/workflows/deploy.yml: actions/checkout, setup-node, upload/download-artifact y aws-actions/configure-aws-credentials se referencian por tags mayores mutables; fijar a SHAs de commit.
- .github/workflows/deploy.yml:136: `prisma migrate deploy || true` enmascara el fallo de migración después del despliegue.
- .github/workflows/deploy.yml:16-17: el grupo de concurrencia se comparte con ejecuciones de pull_request y cancel-in-progress puede cancelar un despliegue a producción en curso.
- .github/workflows/deploy.yml:91-98: el job de despliegue carece de una puerta de aprobación `environment:` protegida de GitHub para producción.
- docker/entrypoint.sh:16: `npm ci --include=dev` instala dependencias de desarrollo en el contenedor de producción.
- docker-compose.prod.yml:64: el healthcheck usa `curl -fk` (verificación TLS deshabilitada), lo que puede enmascarar una cadena de certificados rota.
- Dockerfile/docker-compose.prod.yml: el contenedor no tiene restricciones de seccomp/read-only-root-filesystem/no-new-privileges; agregar si no se puede eliminar el usuario root.
- Agregar entradas PROTECTED explícitas en el middleware (o comprobaciones de sesión por controlador) para /api/kbservicios y /api/sunat; docs/api-inventario.md:226 ya señala el endurecimiento de permisos por endpoint pendiente.
- No hay Content-Security-Policy ni cabeceras de respuesta de seguridad relacionadas configuradas (next.config.ts, src/middleware.ts).
- El árbol de trabajo contiene un SUNAT_API_TOKEN con apariencia de real en .env; confirmar que nunca se subió y rotarlo si así fue.
- Acotar y limitar la tasa de las rutas no autenticadas /api/sunat y /api/kbservicios por principal para proteger la cuota upstream del operador.
- Agregar un validador de URL compartido que permita solo http/https (y rutas relativas del mismo origen) para documentos/imagenes en gess.validator.ts y reserva.validator.ts, renderizar mediante un helper de href sanitizado y agregar rel="noopener noreferrer" a los anclajes target="_blank".
- Agregar un predicado explícito de propietario/evento a todas las mutaciones de Facturacion, o centralizar la autorización de facturación en una sola guarda para que las rutas de listado y mutación no puedan discrepar.
- Reemplazar el spread `{id, ...data}` en PATCH /api/facturacion/actualizar por una allowlist validada con Zod y una selección explícita de campos.
- middleware.ts depende de una allowlist ordenada de prefijos sin default-deny; cualquier nuevo prefijo /api se vuelve anónimo silenciosamente. Agregar un default-deny para /api/** con una lista pública explícita.
- El contrato de respuesta GessStandDTO modela email/userId (gess-stand.dto.ts:14-15); proyectar fuera la PII a menos que un permiso de lectura lo conceda explícitamente.
- /api/auth/ es un PUBLIC_API_PREFIX (constants.ts:25), por lo que las mutaciones de autenticación autenticadas por cookie dependen únicamente de getSession() sin comprobación de Origin/CSRF a nivel de middleware; agregar validación de Origin/Referer para las rutas de autenticación que cambian estado.

## 6. Candidatos rechazados (conservados para futuras ejecuciones)

- `components.plano.documentos.unvalidated-scheme-to-href` — el sanitizador de React 19.2.4 es un control real y verificado en el código que bloquea el esquema javascript: en href/src, el único sumidero ejecutable en estas rutas; data: no puede navegar a nivel superior en navegadores modernos y target=_blank implica noopener, por lo que n
- `solicitudes.upload-doc.unvalidated-url-to-href` — Refutado por un control de framework visible: el sanitizador de producción de React DOM convierte los href javascript: en una URL javascript: que lanza antes de establecer el atributo (react-dom-client.production.js:1412-1416), no hay ningún dangerouslySetInnerHTML o

## 7. Resumen de cobertura

Libro mayor: **43 unidades** — candidate: 37, covered: 6, deferred: 0, out_of_scope: 0.

La cobertura se construyó a lo largo de 4 oleadas de caza con 4 críticos de cobertura (post-oleada 1/2/3 y una pasada final-clean). Cada propuesta de crítico aceptada se convirtió en una unidad (oleada 2: sunat, kbservicios, upload-doc, pagar-cuota; oleada 3: facturacion CRUD, niubizz sesion, client render; oleada 4: auth perfil, gess listar). El crítico final-clean no aceptó ninguna unidad más de alto valor después de la oleada 4.

**Exclusiones / no objetivos:** los complementos nativo/binario, de IA/LLM, de RPC-broker y de escritorio/móvil no aplican a este repositorio (sin código nativo, sin runtime de modelo/herramienta, sin broker, sin cliente de escritorio/móvil). Los controles dependientes del despliegue (`JWT_SECRET` en vivo, adjunción de IAM/SG/WAF, presencia de `.env.prod`, semántica del proxy Niubiz, roles `facturacion:view` no administradores) no son visibles en el código y se representan como `needs_validation` en lugar de asumirse.

**Limitación de cobertura:** como indica la skill, una única ejecución estándar no agota un objetivo; las ejecuciones repetidas encuentran más. Esta ejecución es solo de código y no se ejecutó código del objetivo, que es la principal limitación.
