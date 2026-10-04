# Requerimientos 2026 — Portal del Cliente, Empresas, Contrato y Facturación

> **Estado:** borrador en iteración (análisis previo al desarrollo; nada implementado).
> **Fuente:** lista entregada por IIMP el 2026-09-30.
> **Iteraciones:** 2026-09-30 — primeras decisiones cerradas (§3.1) y pendientes acotadas (§3.2).
> 2026-09-30 (2ª ronda) — credenciales, carga masiva, visuales, token, contrato y comprobante
> definidos; diseños UX en Stitch en curso.
> 2026-09-30 (3ª ronda) — credencial = usuario + contraseña temporal (cambio obligatorio);
> implementados localmente el modelo `empresa`, la bandeja del backoffice, la carga masiva
> Excel/CSV con validaciones y la creación de cuenta con credenciales por correo.
> 2026-09-30 (4ª ronda) — implementado el **gate de primer ingreso**: cambio obligatorio de
> contraseña (JWT + middleware + página) y **validación de datos contractuales** de la empresa
> (razón social, RUC, dirección fiscal, representante legal + DNI, correo de facturación y
> tipo de comprobante, con alerta visual y confirmación explícita).
> **Objetivo del documento:** dejar constancia de la lista de features, el análisis de estado
> actual vs brecha, las decisiones tomadas/pendientes y la propuesta de fases. Se actualiza en
> cada ronda antes de iniciar el desarrollo.

---

## 1. Lista de requerimientos (texto del cliente, organizado)

### A. Idioma y portal
- **RF-01** El sistema debe estar disponible en **español e inglés**.
- **RF-02** Debe existir un **único Portal del Cliente**, desde donde la empresa acceda tanto al
  **E-commerce** como al **módulo de Montaje**, según los permisos/vista que le corresponda.
- **RF-03** **No se requiere Landing Page.**

### B. Registro de empresas (Backoffice) y primer acceso
- **RF-04** Desde el **Backoffice** se debe permitir el registro de empresas de forma
  **individual y masiva**.
- **RF-05** Al registrar una empresa, el sistema debe generar y **enviar automáticamente sus
  credenciales de acceso**.
- **RF-06** En el **primer login**, se mostrarán los datos básicos registrados previamente para
  que la empresa los **confirme o actualice** antes de continuar.
- **RF-07** Los datos que posteriormente serán utilizados en el contrato deben estar
  **resaltados/alerta** (deben validarse porque generan el documento contractual).

### C. Selección de stand
- **RF-08** Cada stand debe mostrar los **datos ya registrados** en el sistema, además de
  **2 elementos visuales**: **imagen referencial según el tipo de stand** y **recorte del plano
  con su ubicación**.
- **RF-09** Al pasar el cursor sobre un stand **reservado**, debe mostrarse la **razón social**
  de la empresa que lo reservó.
- **RF-10** Durante el flujo de reserva, el **propio cliente seleccionará las condiciones de
  pago**, tomando como referencia las **modalidades establecidas en el contrato**.

### D. Contrato
- **RF-11** El contrato debe **autocompletarse** con la información existente: **datos de la
  empresa** (cuerpo principal) y **datos del stand reservado** (anexo).
- **RF-12** Se debe asegurar la **correcta ubicación de la firma** dentro del formato generado.
- **RF-13** El cliente deberá adjuntar junto al contrato la **Vigencia de Poderes** y **DNI del
  representante legal**.

### E. Revisión
- **RF-14** El contrato tendrá únicamente **2 niveles de revisión: Asociado → Legal**.
- **RF-15** La revisión del **Asociado** se realiza directamente en el **E-commerce/Portal**.
- **RF-16** La revisión de **Legal** se realiza en el **Sistema de Gestión de Contratos (SGC)**,
  donde también deben visualizarse el **contrato y sus adjuntos**.
- **RF-17** En el SGC debe mostrarse la **razón social** de la empresa y permitir
  **búsqueda/filtro rápido** por este dato.

### F. Facturación
- **RF-18** **Facturación confirma el pago** realizado.
- **RF-19** Debe existir **integración entre Facturación y el Portal del Cliente** para que,
  una vez confirmado el pago, el cliente pueda **visualizar/descargar su comprobante de pago**
  desde el mismo portal.

---

## 2. Análisis de brecha por requerimiento

### RF-01 — Español / inglés
- **Hoy:** la aplicación está **100% en español y sin infraestructura i18n** (textos
  hardcodeados en componentes, correos, mensajes de API y etiquetas de `constants.ts`).
- **Brecha:** portal traducido con **Google Translate** (decisión §3.1); i18n propio **solo**
  para correos y contenido fuera del sistema (plantillas de email, formatos que Google
  Translate no cubre).
- **Tamaño preliminar: M** (integración Google Translate en el portal + i18n de correos).

### RF-02 — Portal del Cliente único (E-commerce + Montaje)
- **Hoy:** existe **una sola aplicación** con menú por permisos (cliente: "Mis reservas",
  "Mis pagos"; staff: bandejas). El **módulo de Montaje es un sistema aparte** que consume
  nuestra API M2M (`/api/stands/exhibidora`, `asignar-montajista`); no hay SSO ni portal
  unificado. El sitio público tiene `/presala` (selector de evento), `/mapa` (plano público)
  y un landing comercial en `/landing` (no requerido por esta lista).
- **Brecha:** emisión de un **token independiente** (regulado por el administrador) que
  permita al usuario ingresar al sistema de Montaje; retirar la ruta `/landing` (el
  componente se conserva); mantener `/presala` y `/mapa` públicos.
- **Decisiones:** §3.1. **Tamaño preliminar: M/L**.

### RF-03 / RF-04 — Alta de empresas (individual y masiva) en Backoffice
- **Hoy:** **no existe entidad "Empresa" local** ni mantenedor. La búsqueda de empresas se
  hace contra un **servicio externo** (`/api/empresas`), y la vinculación se guarda por
  `user_role.nombreEmpresa`. Existen `solicitud_cuenta` (solicitudes de cuenta de exhibidor)
  y `registro_pendiente` (OTP) como flujo **autoservicio**, no de backoffice.
- **Brecha:** cuentas a nivel de **gestión del sistema** (backoffice), manteniendo el API
  externo **solo para búsqueda**; **vista especial** con herramientas de creación
  **individual y masiva**; validaciones (RUC único, duplicados, formato) y estados.
- **Decisiones:** §3.1 y pendientes §3.2. **Tamaño preliminar: L**.

### RF-05 / RF-06 / RF-07 — Credenciales automáticas, primer login y datos contractuales
- **Hoy:** login propio (JWT `jose` + cookie, permisos en el token). **No hay generación
  automática de credenciales** ni invitación por correo desde backoffice; el registro es
  autoservicio (`/auth/solicitar-cuenta`). No hay "gate" de primer login ni resaltado de
  campos contractuales.
- **Brecha:** al dar de alta la empresa: crear cuenta, **generar credencial** y envío por
  correo; portal **siempre con sesión** (gate obligatorio); primer login con confirmación de
  datos y **alerta sobre los campos que alimentan el contrato**.
- **Decisiones:** §3.1 y pendientes §3.2. **Tamaño preliminar: M**.

### RF-08 / RF-09 — Selección de stand con visuales y hover
- **Hoy:** el plano muestra estado/tipo/empresa **al hacer clic** (modal de detalle) e
  imágenes del stand **por categoría** (subidas manualmente). **No existe** "imagen
  referencial por tipo de stand" ni "recorte del plano con su ubicación" (thumbnail), ni
  tooltip **hover** con razón social sobre stands reservados.
- **Brecha:**
  1. catálogo de **imagen referencial por tipo de stand** **por evento** (con respaldo global);
  2. **recorte/miniatura del plano** por stand (el plano es un render 3D con `x/z` por
     bloque; se puede generar un snapshot programático o subirlo el admin);
  3. **hover** con razón social (variante táctil en móvil); evaluar visibilidad según sesión.
- **Decisiones:** pendientes §3.2. **Tamaño preliminar: M**.

### RF-10 — Condiciones de pago elegidas por el cliente
- **Hoy:** las cuotas las configura **Facturación** (dialog de pago) y el cliente puede
  verlas/ajustarlas en "Mis pagos"; **no existe catálogo de modalidades** ni selección
  durante la reserva. Niubiz está deshabilitado.
- **Brecha:** catálogo de **modalidades de pago** configurable por IIMP y **paso de selección
  al iniciar la reserva** que genere cuotas/facturación al habilitarse la orden de pago.
- **Decisiones:** §3.1. **Tamaño preliminar: M**.

### RF-11 / RF-12 / RF-13 — Contrato autocompletado, firma y adjuntos
- **Hoy:** **no hay generación de contrato**. Existe `contrato_plantilla` por tipo de stand
  (URL de plantilla) que el cliente descarga, firma y sube; el administrador puede subir un
  contrato v1 y el SGC gestiona tipos de contrato y plantillas.
- **Brecha:** **motor de generación en este sistema** (plantilla + datos → PDF) con datos de
  empresa (cuerpo) y stand (anexo), **anclas de firma**, soporte de **firma digital y firma
  subida**, y **bloqueo** del envío a Legal si faltan Vigencia de Poderes + DNI.
- **Decisiones:** §3.1. **Tamaño preliminar: L/XL**.

### RF-14 a RF-17 — Revisión Asociado → Legal (SGC) y razón social en SGC
- **Hoy:** pipeline de **3 áreas locales** (Comunicación, Logística, Legal) y **Legal
  delegada al SGC** (expediente, envío de contrato/anexos, observaciones/rechazo con rondas
  de subsanación).
- **Brecha:** "Asociado" **unifica** Logística + Comunicación (2 niveles); las solicitudes
  **en curso se deshabilitan lógicamente** (no migran; etapa de desarrollo/pruebas); **nosotros
  enviamos la razón social** al expediente del SGC para su visualización/filtro.
- **Decisiones:** §3.1. **Tamaño preliminar: M (local) + coordinación con SGC.**

### RF-18 / RF-19 — Facturación confirma y el cliente ve/descarga su comprobante
- **Hoy:** el admin **confirma pagos** (con el voucher del cliente) y el cliente ve cuotas y
  vouchers en "Mis pagos". **No existe comprobante de pago** (boleta/factura) adjuntable por
  Facturación ni descarga en el portal.
- **Brecha:** el cliente elige **boleta o factura** al reservar; al confirmar el pago,
  Facturación adjunta el **comprobante** y el cliente puede verlo/descargarlo en el portal
  (+ notificación).
- **Decisiones:** §3.1 y pendientes §3.2. **Tamaño preliminar: M**.

---

## 3. Decisiones

### 3.1 Cerradas (iteración 2026-09-30)

| Ref | Tema | Decisión |
|---|---|---|
| RF-01 | **Idioma** | El portal se traduce con **Google Translate** (sin i18n en la UI). Se implementa **i18n propio solo para correos y contenido fuera del sistema** (lo que Google Translate no cubre). |
| RF-02 | **Acceso a Montaje** | **Token independiente** que permite al usuario ingresar al otro sistema. Su emisión y control es **regulado por el administrador**. |
| RF-03 | **Landing** | Se **retira la ruta** `/landing` (el componente/trabajo se conserva en el repo, solo deja de mostrarse). `/presala` y `/mapa` siguen **públicos**. |
| RF-02 | **Pago en línea** | **Niubiz permanece deshabilitado** hasta nuevo aviso; se mantiene el flujo con orden de pago y confirmación de Facturación. |
| RF-04 | **Alta de empresas** | Se crearán **cuentas a nivel de gestión del sistema** (backoffice). Se mantiene el **API externo para búsqueda de empresas** y se crea una **vista especial** con herramientas de creación **individual y masiva**. |
| RF-06 | **Primer login** | El portal **siempre exige sesión iniciada** (gate obligatorio para entrar). |
| RF-11 | **Generación del contrato** | Se genera **en este sistema** (plantilla + datos → PDF). |
| RF-12 | **Firma** | Se soportan **firma digital** y **firma subida** (archivo escaneado/firmado). |
| RF-13 | **Adjuntos obligatorios** | **Vigencia de Poderes + DNI bloquean** el envío a revisión Legal si faltan. |
| RF-14/15 | **Revisión** | "**Asociado**" **unifica** Logística + Comunicación: 2 niveles **Asociado → Legal**. |
| RF-14 | **Solicitudes en curso** | Se **deshabilitan lógicamente** (no migran al nuevo pipeline; etapa de desarrollo/pruebas). |
| RF-17 | **Razón social en SGC** | **La enviamos nosotros** al SGC en el expediente. |
| RF-10 | **Modalidades de pago** | Las **define IIMP** (configurador en el backoffice). |
| RF-10 | **Momento de elección** | El cliente elige las condiciones **al iniciar la reserva**. |
| RF-19 | **Comprobante** | **Boleta o factura según la elección del cliente** (se define al reservar). |
| RF-05 | **Credenciales** | **1 cuenta por empresa**. La cuenta **no es automática/autoservicio**: la **crea el backoffice**; al crearla se generan y envían las credenciales por correo. La credencial es **usuario + contraseña temporal** con **cambio obligatorio en el primer ingreso**; el backoffice puede **reenviar credenciales** (regenera la contraseña). |
| RF-04 | **Carga masiva** | Soportada en **Excel y CSV**, **con validaciones** (RUC/duplicados/formato). |
| RF-08 | **Visuales del stand** | **Generados automáticamente** por el sistema: **imagen referencial por tipo** y **recorte del plano** con la ubicación. |
| RF-09 | **Hover razón social** | **Visible** en el plano sobre los stands reservados. |
| RF-02 | **Token de Montaje** | El **administrador lo habilita/emite desde el portal** (acceso regulado). |
| RF-11/12 | **Formato y firma del contrato** | Se genera en **DOCX y PDF**. **Firma digital con proveedor**: desde el sistema se **sube una firma "universal"**. |
| RF-19 | **Comprobante** | **Facturación lo adjunta** (boleta o factura según elección del cliente) y **se notifica** al cliente. |
| — | **Prioridad** | **Todo es urgente.** Se propone un orden por dependencias (§4); se puede paralelizar por bloques. |

### 3.2 Pendientes (próxima iteración)

1. ~~**Campos contractuales (RF-07):**~~ **RESUELTO**: basta la **alerta visual** (campos
   resaltados) + la **confirmación en el primer login** (`/auth/validar-datos`); no se requiere
   check por campo. Campos marcados: razón social, RUC, dirección fiscal, representante legal
   (nombre y DNI), correo y teléfono.
2. ~~**Bloques con reserva en curso:**~~ **RESUELTO**: el nombre de la empresa se muestra en el
   **detalle del stand al hacer clic/tap** (campo "Empresa", también en el portal) y en el
   **hover** del mapa; el vínculo empresa↔bloque se crea al completar la reserva.
3. ~~**Credenciales (RF-05):**~~ **RESUELTO**: el reset es **autoservicio por correo** (flujo
   existente `/auth/recuperar` + `/auth/recuperar/[token]`, endpoints `reset-password` y
   `reset-password/confirm`, correo en el idioma del usuario). El backoffice puede **reenviar
   credenciales** (regenera la contraseña temporal) desde la bandeja de empresas.
4. ~~**Firma digital (RF-12):**~~ **RESUELTO (local)**: el usuario sube su **firma (PNG/JPG)**
   en *Perfil* y desde el paso de firma puede **Firmar digitalmente**: el servidor estampa la
   imagen en el contrato (Anexo 3 y bloque de firmas) y equivale a subir el contrato firmado
   (`POST /api/contratos/firmar`). Alternativa: descargar/firmar/subir. Proveedor de firma
   externo (certificado): mejora futura, no bloquea el flujo.
5. **SGC (RF-17):** confirmar con el equipo del SGC el campo donde recibirán la razón social
   (expediente/contrato) para su filtro y búsqueda.
6. ~~**Facturación (RF-19):**~~ **RESUELTO**: al adjuntar el comprobante, Facturación **notifica
   por correo** al cliente (es/en, según su idioma) y el comprobante queda **visible/descargable
   en "Mis pagos"** de la cuenta de la empresa (RF-05: una cuenta por empresa). Restricciones o
   recargos por tipo de stand: no aplica por ahora.
7. ~~**Carga masiva (RF-04):**~~ **RESUELTO (negocio)**: el alta de empresas y usuarios es
   **manual desde la vista de backoffice creada** (la carga masiva Excel/CSV existe como
   herramienta opcional); las empresas existentes se dan de alta manualmente (sin migración).
8. ~~**Multi-evento:**~~ **RESUELTO (negocio)**: las **empresas son transversales** (globales,
   RUC único) y **el vínculo empresa↔bloque se crea al completar la reserva** (el stand queda
   "En evaluacion" con la empresa que reservó, por evento). No se requiere una lista explícita
   empresa↔evento; la habilitación por evento la maneja el administrador vía las reservas.
9. **Diseños UX:** los flujos implementados ya están (primer login, condiciones de pago,
   contrato/firma, comprobante, visuales del stand); pendientes solo los de **token de Montaje**
   (bloqueado por RF-02).

---

## 4. Propuesta de fases (preliminar, todo urgente → orden por dependencias)

| Fase | Contenido | Por qué primero |
|---|---|---|
| **1. Empresas + acceso** | RF-04→RF-07: vista de backoffice (individual/masiva), cuentas, credenciales por correo, primer login con datos y alertas; base del **token de Montaje** (RF-02) | Los datos de empresa alimentan el contrato y la reserva; desbloquea las fases 2–3 |
| **2. Contrato + revisión** | RF-11→RF-17: generación PDF (empresa + anexo del stand), firmas (digital/subida), adjuntos bloqueantes, pipeline **Asociado → Legal**, razón social al SGC, deshabilitar solicitudes en curso | Es el flujo crítico del negocio y depende de Fase 1 |
| **3. Reserva + pago** | RF-10: modalidades configurables por IIMP y elección del cliente al iniciar la reserva; RF-18/19: comprobante (boleta/factura) visible/descargable en el portal | Depende de la reserva existente y del comprobante de Facturación |
| **4. Portal + visuales** | RF-08/09 (imagen referencial, recorte del plano, hover con razón social), RF-03 (retirar ruta `/landing`), **Google Translate** en el portal, i18n de correos | Cierres de experiencia; se puede avanzar en paralelo a 2–3 |

> Tamaños preliminares: L/XL (contrato, empresas), M (i18n de correos + Google Translate,
> visuales, pago, revisión), S (comprobante, retirar ruta). Se recalibran al cerrar §3.2.

---

## 5. Impacto técnico transversal

- **Idioma:** integración de **Google Translate** en el portal; i18n propio (plantillas) para
  correos y contenido fuera del sistema.
- **Datos:** nuevas entidades probables — `Empresa`, `ModalidadPago`/cuotas por contrato,
  `ComprobantePago`; extensión de `GessStand`/`Solicitud` para imágenes referenciales y
  recortes de plano; token de acceso a Montaje (emisión/revocación).
- **Contrato:** motor de plantillas (→ PDF) y almacenamiento versionado; soporte de firma
  digital y firma subida; el flujo convive con SGC (envío de contrato + adjuntos + razón social).
- **Revisión:** pipeline 2 niveles (Asociado → Legal) y **deshabilitación lógica** de las
  solicitudes en curso.
- **Auth:** alta de cuentas por backoffice, credenciales automáticas y emails transaccionales.
- **Regresión:** los cambios de revisión/contrato afectan flujos ya desplegados (subsanación,
  bypass admin, montajista, pagos) → cada fase incluye pruebas de regresión.

---

## 6. Próximos pasos

1. IIMP responde §3.2 (pendientes).
2. Actualizar este documento (decisiones + estimaciones finales) y confirmar el orden de fases.
3. Diseñar UX de los flujos nuevos — **en curso en Stitch** (backoffice de empresas, primer
   login, condiciones de pago, contrato/firma, comprobante, visuales y token de Montaje).
4. Abrir tickets por fase y arrancar por **Fase 1**.

---

## 7. Avance de implementación

| Requerimiento | Estado | Detalle |
|---|---|---|
| RF-04→RF-07 (Fase 1) | ✅ Hecho (commit `308b718`) | Backoffice de empresas (bandeja + alta/edición + carga masiva Excel/CSV), cuentas con credenciales por correo, primer login (cambio de contraseña + validación de datos), permisos `empresas:view`/`empresas:manage`. |
| RF-01 idiomas (F1–F3) | ✅ Hecho (local) | Selector ES/EN + Google Translate + `user_role.idioma`; plantillas de correo es/en (10 puntos de envío) y **contrato en el idioma del cliente** (plantilla DOCX es/en, F3). F4 (QA visual y correos reales) pendiente — ver `plan-idiomas.md`. |
| RF-18/RF-19 comprobante | ✅ Hecho (local) | Comprobante fiscal (boleta/factura) por cuota pagada: `POST /api/facturacion/adjuntar-comprobante` (permiso `facturacion:view`), visible/descargable en *Mis pagos* y correo al cliente (es/en). Migración `0021_add_facturacion_cuota_comprobante_fiscal`. |
| RF-03 retirar `/landing` | ✅ Hecho (commit `308b718`) | Ruta retirada; componentes se conservan en el repo. |
| RF-10 condiciones de pago | ✅ Hecho (local) | El cliente configura sus cuotas (1–3) con **% y fechas editables** al iniciar la reserva (wizard, paso Cuotas); montos calculados en el servidor y plan persistido (`solicitud.plan_cuotas`), que es la fuente para Facturación. La modalidad (100% / 50-50 / personalizada) se refleja en el contrato (Anexo 2). |
| Fase 2 contrato (RF-11→RF-17) | 🔶 Parcial | **RF-10 (cuotas) ✅ + RF-11 (generación) ✅ motor**: wizard 4 pasos (`Datos → Cuotas → Contrato → Confirmación`) con cuotas 1–3 de **% y fechas editables** (suman 100%, fechas no pasadas/ascendentes; montos en servidor), plantilla real etiquetada + `POST /api/contratos/generar` (DOCX + PDF con LibreOffice en el contenedor; IGV 18% siempre), recortes por pabellón generados en el servidor. **Pendiente**: firma digital (proveedor). Detalle: `plan-contrato-cuotas.md`. |
| RF-14/RF-15 revisión Asociado→Legal | ✅ Hecho (local) | Pipeline local de **un solo nivel**: "**Asociado**" unifica Logística + Comunicación (RF-14/15) con **rol dedicado `asociado`** y permiso `solicitudes:review:asociado` (migración `0033`: crea el rol y quita la revisión a logística/comunicación; admin por `admin:full`). El stepper muestra **Asociado → Legal (SGC)**; al aprobar Asociado se delega el expediente al SGC. Solicitudes con revisiones legacy no migran (se deshabilitan lógicamente). |
| RF-12 firma | ✅ Hecho (local) | Firma manual (subir contrato firmado) + **firma digital**: el usuario carga su firma (PNG/JPG) en *Perfil* y en el paso de firma "Firmar digitalmente" la estampa en el contrato (Anexo 3 + bloque de firmas) y equivale a subirlo firmado (`POST /api/contratos/firmar`; 409 si no tiene firma). Migración `0032` (`user_role.firma_url`). |
| RF-09 hover razón social | ✅ Hecho (local) | En `/mapa`, al pasar el cursor por un stand reservado se muestra la razón social de la **empresa del cliente** que reservó (solicitud → `user_role` → `empresa`). El backend completa `empresa` en `/api/gess/listar`; tooltip sobre el bloque 3D. |
| RF-08 visuales del stand | ✅ Hecho (local) | **Imagen referencial por tipo** (por evento, con respaldo global; aplica a todos sus stands) + **logo** de empresa/usuario pintado en stands reservados + **recorte del pabellón** con el stand destacado: preview en Mis solicitudes, imagen PNG guardada en la solicitud (`recorte_plano_url`) para el contrato, y link a `/mapa?bloque=…` con preselección. Detalle: `spike-recorte-plano.md`. |
| RF-13 adjuntos bloqueantes | ✅ Hecho (local) | Anexos con etiqueta de requisito (Ficha RUC / Vigencia de Poderes / DNI) en el modal del cliente; **Vigencia de Poderes + DNI bloquean** el envío al SGC para revisión Legal en el panel del expediente. Migración `0024_add_solicitud_documento_requisito`. |
