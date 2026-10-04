# Plan de Idiomas (Español / Inglés) — Google Translate + Plantillas

> **Estado:** plan aprobado para implementar (2026-09-30). RF-01 de
> `requerimientos-portal-empresas.md`.
> **Avance:** **F1 implementada** (constantes y util de idioma, `user_role.idioma`
> migración 0020, `PATCH /api/auth/idioma`, cookie `iimp_idioma`, selector ES/EN en el
> header del dashboard, Google Translate (script oculto + `googtrans`) en el layout raíz).
> **F2 implementada**: las 9 plantillas de correo migradas a
> `mail-templates/es/index.ts` y `mail-templates/en/index.ts` con resolver
> `getPlantillaEmail(kind, idioma, datos)` + `enviarEmailPlantilla(...)`; los 10 puntos de
> envío resuelven el idioma del destinatario (`user_role.idioma` → cookie → español) y el
> formateo por locale (`es-PE`/`en-US`) quedó en los utils centralizados
> (`dateUtils.format/formatDateTime/formatDateTimeShort` y `numberUtils.monto` aceptan
> `idioma`). Tests: resolver de plantillas, locale de idioma, fecha y monto.
> **Estrategia:** el **portal (UI/DOM)** se traduce con **Google Translate**; los
> **correos y documentos** NO los cubre Google Translate, por lo que viven como
> **plantillas por idioma en archivos** y se eligen según el **estado de idioma**.
> **Idiomas:** español (`es`, por defecto) e inglés (`en`).

---

## 1. Alcance

| Superficie | Traducción | Mecanismo |
|---|---|---|
| Portal / dashboard (UI) | Dinámica en runtime | **Google Translate Website Translator** (cookie `googtrans`) |
| Correos transaccionales | Por plantilla | **Plantillas ES/EN** en archivos + `idioma` del destinatario |
| Documentos generados (contrato DOCX/PDF, constancias) | Por plantilla | **Plantillas DOCX por idioma** al momento de generar |
| Comprobante fiscal (factura/boleta) | No se traduce | Documento fiscal peruano (se mantiene tal cual) |
| Contenido de negocio en BD (eventos, tipos de stand) | Indirecta | Se traduce si aparece en el DOM; no se traducen datos de PDFs |

---

## 2. Estado de idioma

- Constantes: `IDIOMAS = { ES: "es", EN: "en" }`, `IDIOMA_DEFAULT = "es"`,
  `IDIOMAS_DISPONIBLES`, cookies `IDIOMA_COOKIE = "iimp_idioma"` y `GOOGTRANS_COOKIE = "googtrans"`.
- **Persistencia por prioridad** (helper `resolverIdiomaUsuario`):
  1. `user_role.idioma` (BD, migración nueva — usuarios logueados).
  2. Cookie `iimp_idioma` (público / anónimos).
  3. `IDIOMA_DEFAULT` = `es`.
- El estado aplica a: UI (Google), **envío de correos** (resolver del destinatario) y
  **generación de documentos** (contrato/constancia en el idioma del cliente).
- Endpoint: `PATCH /api/auth/idioma` (guarda en `user_role.idioma` y setea cookie).
  La sesión (`/api/auth/session`) expone `idioma`.

---

## 3. Selector de idioma

- **Dashboard (menú horizontal):** nuevo item en `DashboardHeader` —
  dropdown `ES | EN` (Español / English) con check del activo.
- **Sitio público/portal** (`presala`, `mapa`, `login`): mismo componente en el
  header público (queda con cookie; sin usuario).
- Al cambiar:
  1. `PATCH /api/auth/idioma` (si hay sesión) + cookie `iimp_idioma`.
  2. Setear cookie `googtrans=/es/en` (o `/es/es` al volver a español).
  3. `router.refresh()` + recarga: Google Translate traduce el DOM al instante.
- Componente único: `src/components/shared/language-switcher.tsx`.

---

## 4. Google Translate (detalle técnico)

- Script en el layout del portal:
  `https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit`.
- Init: `pageLanguage: "es"`, `includedLanguages: "en"`, `layout: SIMPLE`,
  contenedor oculto (no usamos el widget nativo: usamos nuestro selector).
- Cambio de idioma vía cookie `googtrans=/es/<idioma>` + recarga (comportamiento estándar del
  Website Translator). Ocultar banner/toolbar de Google con CSS.
- **Limitaciones a documentar:** solo traduce el DOM en runtime (no correos, no PDFs, no
  contenido generado después del cambio sin recargar); puede alterar formatos menores;
  los placeholders/`title` se traducen de forma parcial.
- **No** se usa Google Cloud Translation API (no hay costo/API key).

---

## 5. Plantillas de correo (inventario actual → migración)

Inventario real (10 puntos de envío):

| Plantilla | Archivo actual | Destinatario | Idioma que usará |
|---|---|---|---|
| Credenciales de empresa | `empresas-email.ts` | Empresa | `user_role.idioma` del contacto |
| Código de registro | `registro-email.ts` | Postulante | Cookie `iimp_idioma` (aún sin cuenta) |
| Reset de contraseña | **inline** en `auth-service.ts:333` | Usuario | `user_role.idioma` |
| Notificación de solicitud de cuenta | `solicitud-cuenta-email.ts` | Admin IIMP | `es` (staff) |
| Invitación de cuenta (token) | `solicitud-cuenta-email.ts` | Exhibidor | Cookie/`es` |
| Rechazo de cuenta | `solicitud-cuenta-email.ts` | Exhibidor | Cookie/`es` |
| Confirmación de reserva | `mail-templates/reservas-email-templates.ts` | Cliente | `user_role.idioma` |
| Notificación de nueva reserva | `mail-templates/reservas-email-templates.ts` | Admin IIMP | `es` (staff) |
| Resultado de revisión por área | `mail-templates/revisiones-email-templates.ts` | Cliente | `user_role.idioma` |
| Notificación manual de bandeja | `solicitudes.controller.ts:82` | Cliente | `user_role.idioma` |

**Nueva estructura:**

```
src/lib/server/mail-templates/
  resolver.ts            # getPlantillaEmail(kind, idioma) + enviarEmail({plantilla, datos, idioma})
  es/
    credenciales-empresa.ts
    codigo-registro.ts
    reset-password.ts
    invitacion-cuenta.ts
    rechazo-cuenta.ts
    notificacion-solicitud-cuenta.ts
    reserva-confirmacion.ts
    reserva-admin.ts
    revision-resultado.ts
    solicitud-notificacion.ts
  en/  (mismas plantillas)
```

- Cada plantilla exporta `{ subject, html }` **parametrizados** (reciben datos).
- `enviarEmail` resuelve el idioma del destinatario cuando no se pasa explícito.
- **Formato por locale:** fechas y montos con `es-PE` / `en-US` (util compartido
  `formatearFecha(iso, idioma)`, `formatearMonto(monto, idioma)`).
- Tests: cada plantilla ES/EN responde con asunto/html no vacíos y el resolver elige el
  idioma correcto (fallback `es`).

---

## 6. Documentos por idioma (contrato / constancias)

- Contrato autocompletado (Fase 2): **una plantilla DOCX por idioma**
  (`contrato-alquiler-es.docx`, `contrato-alquiler-en.docx`) con los mismos marcadores;
  el generador elige la plantilla según el `idioma` del cliente al generar.
- El PDF se genera desde la plantilla del idioma elegido; se versiona por idioma.
- Constancias/comprobantes internos: plantilla ES/EN. La factura/boleta fiscal queda en `es`.
- La UI de configuración de contrato (Stitch) mostrará la plantilla por idioma.

---

## 7. Impacto técnico

- **BD:** migración `0020_add_user_role_idioma` → `user_role.idioma VARCHAR(5) DEFAULT 'es'`.
  (Opcional futuro: `empresa.idioma` si se envían correos a empresas sin usuario.)
- **API:** `PATCH /api/auth/idioma`; `session` con `idioma`.
- **Front:** `LanguageSwitcher` (dashboard header + header público),
  `GoogleTranslateScript` (layout), cookies y recarga.
- **Server:** `resolverIdiomaUsuario`, plantillas ES/EN, `enviarEmail` con idioma,
  formateo por locale.
- **Docs:** `DESIGN.md` (selector de idioma en shell), este plan, RF-01 actualizado.

---

## 8. Fases

| Fase | Contenido | Entregable |
|---|---|---|
| **F1. Estado + selector + Google** | Constantes, migración `idioma`, endpoint, switch en dashboard y público, script Google Translate | Cambiar ES/EN traduce y persiste |
| **F2. Plantillas de correo** | Migrar las 10 plantillas a `es/`+`en/`, resolver, locale en fechas/montos, tests | Correos en el idioma del destinatario |
| **F3. Documentos** | Plantillas DOCX por idioma (contrato/constancias) cuando exista el generador | Contrato en el idioma del cliente |
| **F4. QA y cobertura** | QA visual en 375/768/1440, textos largos en inglés, correos bilingües | Cierre RF-01 |

---

## 9. Decisiones

1. Selector también en el **sitio público** (presala/mapa/login) sin login → **sí, con cookie**.
2. Idioma del correo: `user_role.idioma` con fallback `es`. `empresa.idioma` **no** por ahora.
3. **Factura/boleta fiscal no se traduce**; sí los correos y constancias.
4. Migrar los **10** puntos de envío a plantillas ES/EN (incluye el reset inline).
5. Google Translate con **selector propio** (widget nativo oculto).

## 10. Criterios de aceptación

- Cambiar a English en el dashboard traduce la UI y **persiste** al re-loguear/recargar.
- Un cliente con `idioma=en` recibe **todos** los correos en inglés (asunto y cuerpo).
- El contrato/constancia se genera en el idioma del cliente.
- Sin cambios de idioma, todo sigue en español (default) y sin regresiones (tests verdes).

---

## 11. Estado de avance (implementación)

| Fase | Estado | Detalle |
|---|---|---|
| F1 | ✅ Hecho (sin commit) | Constantes `IDIOMAS`/`IDIOMA_LOCALES`/`GOOGTRANS_*`; migración `0020`; `PATCH /api/auth/idioma`; cookie + recarga; `LanguageSwitcher` en dashboard; `GoogleTranslateScript` + `lang` dinámico; widget nativo oculto (CSS). |
| F2 | ✅ Hecho (sin commit) | `mail-templates/{es,en}` (9 plantillas), `getPlantillaEmail` + `enviarEmailPlantilla`; **10/10 puntos de envio** migrados; registro persiste idioma elegido; fechas/montos por idioma (`dateUtils`/`numberUtils`). **Alertas de la campana (in-app) localizadas** (`alert-templates/{es,en}` + `alerta.clave/datos`, migracion `0030`). **Textos dinamicos de portales** (toast/modal de reserva) localizados (`textosReserva`), porque Google Translate no los traduce de forma fiable. Tests: `mail-templates/__tests__`, `alert-templates/__tests__`, `textos/__tests__`. |
| F3 | ✅ Hecho (local) | Documentos por idioma: **contrato en es/en**. Plantilla `contrato-perumin38-tags-en.docx` generada con `scripts/traducir-contrato-plantilla.ps1` (traduccion ES→EN revisable); `POST /api/contratos/generar` acepta `idioma` (la UI envia el idioma seleccionado; si falta, se resuelve el del cliente). **Pendiente: validacion de la traduccion por Legal.** Factura/boleta se mantiene ES. |
| F4 | Parcial | Selector ES/EN en **sitio publico** (presala/mapa/login/dashboard) implementado. QA visual GT (Radix) 375/768/1440 y correos reales pendientes (falta `RESEND_API_KEY` local). |

Extra no previsto: utilidades de formato unificadas (`utils/date.ts`, `utils/number.ts`, `utils/idioma.ts`) y convención de DTOs documentada en `docs/03-arquitectura/convenciones-codigo.md`.
