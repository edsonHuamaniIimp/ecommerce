# Módulo Debida Diligencia — Handoff de Stitch

Documento de traspaso para construir los prototipos y la implementación del módulo de
Debida Diligencia del IIMP. Contiene la configuración del MCP de Stitch, los IDs del
proyecto y del design system, el protocolo operativo, el inventario de pantallas, los
prompts exactos usados y las reglas de negocio del formulario.

---

## A. Configuración del MCP de Stitch

Stitch se usa vía MCP (no por la web). En este repositorio:

- `opencode.json` contiene el bloque `mcp.stitch`:
  - `command`: `C:\Proyectos\IIMP\ContratosStands\scripts\stitch-proxy.cmd`
- `scripts/stitch-proxy.cmd` (no sobrescribir):
  - obtiene el token con `gcloud auth print-access-token`;
  - ejecuta `npx -y @_davideast/stitch-mcp proxy`;
  - admite `STITCH_API_KEY` como alternativa al token de gcloud.

### Requisitos del entorno

1. `gcloud` CLI instalado y autenticado con la misma cuenta Google que tiene acceso a
   Stitch. Verificar con `gcloud auth list`; si falta, `gcloud auth login`.
2. Node y `npx` disponibles.
3. MCP `stitch` habilitado en opencode. Reiniciar opencode si se modifica
   `opencode.json`.
4. Verificación rápida: `stitch_list_projects` debe devolver proyectos.
5. Windows con PowerShell. Las descargas requieren ruta absoluta, por ejemplo
   `C:\Users\ASUSVivobook\AppData\Local\Temp\opencode\...`.

---

## B. IDs y URLs

| Elemento | Valor |
|---|---|
| Proyecto nuevo (Debida Diligencia) | `225712813933471231` — "Debida Diligencia — IIMP" — privado |
| URL del proyecto | https://stitch.withgoogle.com/projects/225712813933471231 |
| Design system del proyecto | `assets/7106378997411768435` — "IIMP — Debida Diligencia" |
| Proyecto anterior (ContratosStands, referencia) | `6340363676521095653` |
| Design system del proyecto anterior | `assets/5349154569638791316` |

En el proyecto anterior ya existen "DD Paso 1" y "DD Paso 2", útiles para comparar.

### Tema del design system

```json
{
  "colorMode": "LIGHT",
  "colorVariant": "NEUTRAL",
  "headlineFont": "INTER",
  "bodyFont": "INTER",
  "labelFont": "INTER",
  "roundness": "ROUND_EIGHT",
  "customColor": "#1B365D",
  "overridePrimaryColor": "#1B365D",
  "overrideSecondaryColor": "#B8860B",
  "overrideNeutralColor": "#F8FAFC"
}
```

Tokens del `designMd`: navy `#1B365D`; acento `#B8860B`; fondo `#F8FAFC`; tarjeta
`#FFFFFF`; borde `#E2E8F0`; texto `#0F172A`; secundario `#475569`; estados verde
`#16A34A`, ámbar `#D97706` y `#F59E0B`, azul `#2563EB`, rojo `#DC2626`, gris
`#94A3B8`; radios 8 y 12; sin gradientes; grilla sutil; WCAG AA.

---

## C. Herramientas Stitch disponibles (MCP)

| Tool | Uso | Convención de parámetros |
|---|---|---|
| `stitch_list_projects` | listar proyectos | `filter: "view=owned"` o `"view=shared"` |
| `stitch_create_project` | crear proyecto | `title` |
| `stitch_get_project` | detalle del proyecto | `name: "projects/{id}"` |
| `stitch_delete_project` | borrar proyecto (irreversible) | `name: "projects/{id}"` |
| `stitch_list_screens` | listar pantallas | `projectId: "{id}"` sin prefijo |
| `stitch_get_screen` | detalle de pantalla | `name: "projects/{p}/screens/{s}"` |
| `stitch_generate_screen_from_text` | generar pantalla | `projectId`, `prompt`, `deviceType`, `designSystem: "assets/{id}"`, `modelId` |
| `stitch_edit_screens` | editar pantallas | `projectId`, `selectedScreenIds[]`, `prompt` |
| `stitch_generate_variants` | generar variantes | `projectId`, `selectedScreenIds[]`, `prompt`, `variantOptions` |
| `stitch_create_design_system` | crear design system | `designSystem`, `projectId` |
| `stitch_update_design_system` | editar design system | `name: "assets/{id}"`, `projectId` |
| `stitch_list_design_systems` | listar design systems | `projectId` opcional |
| `stitch_apply_design_system` | aplicar design system | `assetId`, `projectId`, `selectedScreenInstances[]` |
| `stitch_upload_design_md` | subir DESIGN.md | `projectId`, `designMdBase64` |
| `stitch_create_design_system_from_design_md` | crear design system desde DESIGN.md | `projectId`, `selectedScreenInstance` |
| `stitch_download_assets` | descargar HTML y PNG | `projectId`, `outputDir` absoluto |

No existe tool para borrar pantallas. Los duplicados se eliminan en la interfaz de
Stitch.

---

## D. Protocolo operativo

1. El error `MCP error -32001: Request timed out` no significa que la generación
   falló. Stitch sigue trabajando y la pantalla aparece minutos después. Esto causó
   cuatro versiones del Paso 1.
2. Regla: un intento por pantalla. Nunca reintentar. Lanzar, esperar entre 5 y 10
   minutos y verificar con `stitch_list_screens`.
3. Las pantallas son desktop de 2560 px de ancho. `deviceType` admite `DESKTOP` y
   `MOBILE`.
4. Los prompts en español funcionan. Los prompts compactos, de 600 a 1200
   caracteres, completan con más frecuencia.
5. Antes de generar, confirmar que se pasa el design system del proyecto:
   `designSystem: "assets/7106378997411768435"`.
6. Para implementar en el repositorio, descargar con `stitch_download_assets` a una
   carpeta temporal y leer el HTML y los PNG.
7. El `projectId` va sin el prefijo `projects/`; el `designSystem` va con el prefijo
   `assets/`. `get_project` y `get_screen` usan el nombre completo.

---

## E. Inventario y estado de pantallas

| # | Pantalla | Estado |
|---|---|---|
| 1 | Paso 1 — Consentimientos | Creada. Existen 4 versiones duplicadas por reintentos; borrar 3 en la UI |
| 2 | Paso 2 — Información de la Empresa | Lanzada; verificar |
| 3 | Paso 3 — Representante Legal y Beneficiarios Finales | Lanzada; verificar |
| 4 | Paso 4 — Documentos y Declaración Jurada | Lanzada; verificar |
| 5 | Mi Debida Diligencia — Estado | Lanzada; verificar |
| 6 | Debida Diligencia — Bandeja de Logística | Lanzada; verificar |
| 7 | Comunicaciones — Revisión Reputacional | Lanzada; verificar |
| 8 | Debida Diligencia — Panel del Módulo | Lanzada; verificar |

---

## F. Prompts exactos

### Prompt 1 — Paso 1: Consentimientos

```
Portal de Debida Diligencia IIMP — Paso 1: Consentimientos (desktop).

Header institucional con logo IIMP, "Debida Diligencia", evento activo, ayuda y cuenta. Fondo #F8FAFC con grilla sutil. Tarjeta blanca de 760px centrada, borde #E2E8F0, radio 12px.

Dentro: breadcrumb "Portal del Expositor / Debida Diligencia / Paso 1"; título "Debida Diligencia"; stepper de 4 pasos (1 Consentimientos activo navy, 2 Empresa, 3 Representante y beneficiarios, 4 Documentos); caja introductoria con icono de escudo sobre la evaluación de contrapartes; pregunta 1 "¿Acepta el tratamiento de sus datos personales y derechos ARCO?" con tarjetas "Sí, acepto" (seleccionada, borde navy) y "No acepto"; pregunta 2 "¿Acepta la debida diligencia reforzada?" con las mismas opciones; callout con borde izquierdo dorado #B8860B y fondo #FFFBEB sobre revisión de Logística y Comunicaciones.

Footer: botón outline "Atrás" deshabilitado, "Paso 1 de 4" con barra al 25%, botón navy "Continuar" y link "Borrar formulario". Inter, sobrio, WCAG AA.
```

### Prompt 2 — Paso 2: Información de la Empresa

```
Pantalla desktop "Debida Diligencia — Paso 2: Información de la Empresa" del portal IIMP.

Header institucional: logo IIMP, "Debida Diligencia", evento activo, ayuda y cuenta. Fondo #F8FAFC con grilla sutil; tarjeta blanca 760px centrada, borde #E2E8F0, radio 12px.

Contenido: breadcrumb "Portal del Expositor / Debida Diligencia / Paso 2"; título "Información de la empresa"; stepper 4 pasos (1 completado con check verde, 2 "Empresa" activo navy, 3 y 4 inactivos).
Selección múltiple "Tipos de relación comercial con el IIMP": Auspiciador, Exhibidor, Asociado Adherente, Media Partner, Proveedor, Alquileres, Otro (Exhibidor seleccionado). Campos: "Razón social" (prellenado "COMPAÑÍA DE MINAS BUENAVENTURA S.A.A."); "RUC" con badge verde "Validado SUNAT"; "País de constitución" (Perú); select "Actividad económica principal" abierto con catálogo de sectores; campo condicional "En caso de haber marcado Otro, indicar cuál".
Campos nuevos: "Sitio web de la empresa" con helper "Se usa para la revisión reputacional de Comunicaciones"; "Correo de contacto del representante legal" con helper "Aquí recibirá las observaciones".
Aviso dorado #B8860B: "Puede reservar un stand, pero no avanzará en las aprobaciones hasta completar la debida diligencia."

Footer: "Atrás", "Paso 2 de 4" con barra al 50%, botón navy "Continuar", link "Guardar borrador". Inter, WCAG AA.
```

### Prompt 3 — Paso 3: Representante y Beneficiarios

```
Pantalla desktop "Debida Diligencia — Paso 3: Representante Legal y Beneficiarios Finales" del portal IIMP. Mismo shell: header institucional, fondo #F8FAFC con grilla, tarjeta blanca 760px, radio 12px.

Stepper: 1 y 2 completados (check verde), 3 "Representante y beneficiarios" activo navy, 4 inactivo. Título "Representante legal y beneficiarios finales"; subtítulo "Personas que actúan o participan en nombre de la empresa."

Sección "Representante legal": "Nombre completo"; "Tipo de documento" (DNI / Carnet de extranjería / Pasaporte); "Número de documento"; "Nacionalidad".
Sección "Beneficiarios finales (10% o más)": nota "Declare todas las personas naturales o jurídicas que posean directa o indirectamente el 10% o más de participación."; dos filas repetibles con columnas Nombre o razón social / Documento / Nacionalidad / % participación y icono de eliminar: "María Elena Torres Vargas" / "DNI 09876543" / "Perú" / "35%"; "Inversiones Andinas S.A.C." / "RUC 20512345678" / "Perú" / "25%". Botón outline "Agregar beneficiario" con icono +.
Aviso con borde dorado: "Esta información se contrasta con registros públicos y listas restrictivas."

Footer: "Atrás", "Paso 3 de 4" con barra al 75%, botón navy "Continuar", link "Guardar borrador". Inter, WCAG AA.
```

### Prompt 4 — Paso 4: Documentos y Declaración Jurada

```
Pantalla desktop "Debida Diligencia — Paso 4: Documentos y Declaración Jurada" del portal IIMP. Mismo shell: header, fondo #F8FAFC con grilla, tarjeta blanca 800px, radio 12px.

Stepper: 1, 2 y 3 completados (check verde), 4 "Documentos" activo navy. Título "Documentos de sustento"; subtítulo "Todos son obligatorios. Formatos PDF o imagen, máximo 10 MB."

Cuatro tarjetas de carga con icono de archivo, título, helper, botón "Seleccionar archivo" y estado:
1) "Ficha RUC o identificación fiscal" — antigüedad menor a 3 meses — estado "Cargado" (check verde, "ficha_ruc.pdf · 1.2 MB").
2) "Vigencia de poderes del representante legal" — antigüedad menor a 3 meses — estado "Cargado" ("poderes.pdf · 890 KB").
3) "Documento de identidad del representante legal" — ambos lados en un solo documento — estado "Cargado" ("dni.pdf · 640 KB").
4) "Declaración jurada de compromiso de actualización de información" — con link "Descargar formato" — estado "Observado" (borde ámbar, texto "El archivo no corresponde al formato vigente. Reemplazar.").
Resumen lateral o inferior con 3 completados y 1 observado; checkbox "Declaro que la información es veraz y me comprometo a actualizarla."
Callout informativo: "Al enviar, Logística revisará los documentos. Si hay observaciones, recibirá un correo en el contacto declarado y podrá corregir y solicitar una nueva evaluación."

Footer: "Atrás", "Paso 4 de 4" con barra al 100%, botón dorado "Enviar a revisión", link "Guardar borrador". Inter, WCAG AA.
```

### Prompt 5 — Mi Debida Diligencia: Estado

```
Pantalla desktop "Mi Debida Diligencia — Estado" del portal del expositor IIMP (cliente).

Header institucional (logo IIMP, "Debida Diligencia", evento activo, ayuda, cuenta "Manuel Barrantes / Buenaventura"). Fondo #F8FAFC con grilla sutil; contenido en dos columnas (principal 2/3 + lateral 1/3), tarjetas blancas radio 12px.

Columna principal:
- Título "Mi debida diligencia" y badge ámbar "Observada".
- Tarjeta "Estado de la evaluación": línea de tiempo vertical con 4 hitos: "Formulario enviado" (12 may, check verde), "Revisión de Logística" (13 may, check verde), "Observaciones" (14 may, punto ámbar, activo) y "Aprobación final" (pendiente, gris).
- Tarjeta "Observaciones (2)": dos items con borde ámbar, área y fecha, texto y botón "Corregir documento": 1) "Vigencia de poderes: el archivo adjunto tiene más de 3 meses." 2) "Declaración jurada: debe usar el formato vigente 2026."
- Barra de acciones: botón navy "Corregir y solicitar nueva evaluación", link "Ver documentos enviados".

Columna lateral:
- Tarjeta "Vigencia": "Fecha de cese: 12 nov 2026", badge verde "Vigente", barra de progreso "5 de 6 meses" y nota "Debe renovarse cada 6 meses."
- Tarjeta "¿Puedo reservar?": texto "Puede reservar un stand, pero no avanzará en aprobaciones hasta quedar aprobada." con botón outline "Ir al plano de stands".
- Tarjeta "Contacto": correo declarado, botón "Actualizar correo".

Inter, sobrio, WCAG AA.
```

### Prompt 6 — Bandeja de Logística

```
Pantalla desktop "Debida Diligencia — Bandeja de Logística" del dashboard interno IIMP. Estilo backoffice del design system: sidebar navy #1B365D a la izquierda con secciones (Panel, Solicitudes, Debida Diligencia activa, Eventos, Stands, Roles, Facturación), área de contenido sobre #F8FAFC.

Contenido:
- Título "Debida Diligencia" + badge contador "128 en revisión"; breadcrumb "Inicio / Debida Diligencia".
- Fila de 4 KPIs en tarjetas: "Pendientes 42", "En revisión 86", "Observadas 31", "Aprobadas 214" (aprobadas con acento verde).
- Barra de filtros: buscador "Buscar razón social o RUC", chips de estado (Todas, Pendientes, En revisión, Observadas, Aprobadas, Rechazadas, Por vencer) con "En revisión" activo navy, select de evento.
- Tabla: columnas Empresa (razón social + RUC), Vínculo, Documentos (3/4 con indicador), Estado (badges), Vigencia, Asignado, Acciones. 5 filas de ejemplo: Buenaventura (Exhibidor, 4/4, Aprobada, vence 12 nov 2026), Volcan (Auspiciador, 3/4, Observada), Cerro Verde (Exhibidor, 4/4, Por vencer), Mina Sur S.A.C. (Proveedor, 2/4, En revisión), Andina Logistics (Alquileres, 1/4, Pendiente). Acciones: "Revisar" en cada fila y menú de tres puntos.
- Paginación al pie "Mostrando 1–5 de 128".

Inter, WCAG AA, sin gradientes.
```

### Prompt 7 — Comunicaciones: Revisión Reputacional

```
Pantalla desktop "Comunicaciones — Revisión Reputacional" del dashboard interno IIMP. Estilo backoffice: sidebar navy #1B365D (Panel, Solicitudes, Debida Diligencia, Revisión reputacional activa, Eventos, Stands, Roles), contenido sobre #F8FAFC.

Contenido:
- Título "Revisión reputacional" y subtítulo "Nombres derivados por Logística para evaluación de imagen y reputación."
- Chips de filtro: "Por revisar (12)" activo navy, "En análisis", "Sin hallazgos", "Con hallazgos", "Cerradas".
- Tabla de casos: columnas Empresa / Nombre a revisar, Sitio web (link), Derivado por, Fecha, Resultado (badge), Acciones. Filas de ejemplo: "Cía. de Minas Buenaventura S.A.A." (buenaventura.com, Logística · M. Hernandez, 12 may, En análisis), "Inversiones Andinas S.A.C." (andinas.pe, Logística, 12 may, Sin hallazgos), "Andina Logistics" (sin web, Logística, 11 may, Requiere información), "Mina Sur S.A.C." (minasur.pe, Logística, 10 may, Con hallazgos), "Volcan Compañía Minera" (volcan.pe, Logística, 09 may, Sin hallazgos).
- Panel lateral derecho de detalle: "Caso #DD-2026-0142 — Andina Logistics": dato "Nombre a evaluar: Andina Logistics S.A.C.", "Sitio web: no declarado", vínculo al expediente de Logística; campo "Resultado de la revisión" con radios "Sin hallazgos" / "Con hallazgos" / "Requiere información adicional" (sin seleccionar); textarea "Comentario para Logística" con placeholder; checkbox "Notificar a Logística al guardar"; botones "Guardar" (navy) y "Cerrar caso" (outline).
- Aviso: "Comunicaciones no accede a la ficha completa del cliente; evalúa el nombre y el sitio web remitidos."

Inter, WCAG AA.
```

### Prompt 8 — Panel del Módulo

```
Pantalla desktop "Debida Diligencia — Panel del Módulo" del dashboard interno IIMP. Estilo backoffice: sidebar navy #1B365D con "Debida Diligencia" activo, contenido sobre #F8FAFC.

Contenido:
- Encabezado: título "Panel de Debida Diligencia", subtítulo "Vigencia de 6 meses · 400 empresas · 214 aprobadas", select de evento y botón outline "Exportar matriz".
- 4 KPIs en tarjetas: "Aprobadas y vigentes 214" (verde, tendencia +12), "Por vencer en 30 días 38" (ámbar), "En revisión 86" (azul), "Rechazadas 9" (rojo).
- Gráfico de barras horizontal "Estado por vínculo": Auspiciador, Exhibidor, Asociado Adherente, Media Partner, Proveedor, Alquileres, con barras navy y segmentos verde/ámbar/gris.
- Gráfico de dona "Vigencia": Vigentes 214, Por vencer 38, Vencidas 21, con leyenda y centro "273 total".
- Tabla "Matriz de empresas" con columnas Empresa, RUC, Vínculo, Estado DD, Última revisión, Vigencia hasta, Responsable, Acciones. Filas: Buenaventura (Aprobada, 12 may 2026, 12 nov 2026), Volcan (Observada, 13 may 2026, —), Cerro Verde (Por vencer, 12 may 2026, 20 oct 2026), Mina Sur S.A.C. (En revisión, —, —), Andina Logistics (Pendiente, —, —). Badges de estado; acciones "Ver ficha" y menú.
- Nota al pie: "La debida diligencia se aplica a todas las empresas. Las empresas pendientes pueden reservar, pero no avanzar en aprobaciones."

Inter, WCAG AA, sin gradientes.
```

---

## G. Reglas de negocio y contenido funcional

### Reglas de la reunión

- La debida diligencia tiene vigencia de seis meses y debe renovarse. La fecha
  de cese es la fecha de vencimiento calculada desde la aprobación.
- Una empresa puede tener varias DD por evento: se conserva el historial y solo
  se inicia una nueva cuando la última está rechazada o vencida.
- El menú del cliente incluye "Mi debida diligencia" (estado actual) y
  "Mis debidas diligencias" (historial paginado con filtros por evento, estado
  y código; cada fila permite abrir su historial).
- La bandeja de Logística y el panel se filtran por versión de evento; la
  importación masiva se ejecuta sobre el evento seleccionado y guarda
  `EVENTO O PROYECTO ASOCIADO` como referencia de la fuente.
- Son 400 empresas; cerca de 100 estaban aprobadas.
- Una empresa pendiente puede reservar un stand, pero no avanza en aprobaciones.
- Las observaciones permiten corregir documentos y solicitar una nueva evaluación.
- Logística valida documentos y deriva a Legal las observaciones graves. El rechazo
  definitivo se comunica mediante informe legal.
- Comunicaciones hace la revisión reputacional con los nombres que le envía Logística
  y el sitio web de la empresa; no accede a la ficha completa del cliente.
- Campos nuevos del formulario: sitio web de la empresa y correo de contacto del
  representante legal. Las observaciones llegan a ese correo.
- Se requiere un registro de errores reportados por clientes y la validación de
  reservas duplicadas (caso stand 208, error 512).
- La debida diligencia aplica a empresas. Existe una debida diligencia básica para
  personas naturales en otros procesos.

### Formulario vigente (Google Form, 4 páginas)

- Página 1 y 2: consentimiento de tratamiento de datos y derechos ARCO, y aceptación
  de la debida diligencia reforzada (Sí / No).
- Página 3: tipos de relación comercial (Auspiciador, Exhibidor, Asociado Adherente,
  Media Partner, Proveedor, Alquileres, Otro; puede seleccionar varios), razón social, RUC, país de
  constitución, actividad económica principal (catálogo más "Otro"), nombre del
  representante legal, número de documento, nacionalidad, y beneficiarios con 10% o
  más de participación (nombre o razón social, documento o identificación fiscal,
  nacionalidad, porcentaje).
- Página 4: Ficha RUC o identificación fiscal, vigencia de poderes, documento de
  identidad del representante, declaración jurada de compromiso de actualización.
  Formatos PDF o imagen, máximo 10 MB.

### Catálogo de actividad económica

Combustibles, gases y productos químicos; Productos y materiales semiacabados;
Productos y equipos manufacturados; Alimentos, bebidas y consumibles; Producción de
energía y servicios públicos; Electrónica y telecomunicaciones; Papel y embalajes;
Productos terminados; Servicios; Servicios de construcción; Ingeniería y servicios
asociados; Mantenimiento, reparación y gestión de instalaciones; Servicios de
consultoría; Servicios ferroviarios; Servicios de extracción y refinamiento de
recursos; Servicios de transporte, almacenamiento y logística; Servicios llave en
mano; Servicios públicos y asociados; Gestión de residuos y limpieza; Servicios de
salud, seguridad y protección; Servicios de telecomunicaciones; Productos de Ocio;
Otro.

---

## H. Checklist para la siguiente sesión

1. Verificar el MCP con `stitch_list_projects`.
2. Abrir el proyecto `225712813933471231` con `stitch_list_screens` y confirmar cuáles
   de las ocho pantallas existen. Las siete lanzadas pueden tardar; no relanzar.
3. Eliminar en la UI de Stitch los duplicados del Paso 1 y conservar una versión.
4. Si falta alguna pantalla, lanzarla una sola vez con el prompt exacto y el design
   system `assets/7106378997411768435`. Esperar y verificar.
5. Descargar con `stitch_download_assets` a
   `C:\Users\ASUSVivobook\AppData\Local\Temp\opencode\stitch-dd` para obtener HTML y
   PNG.
6. Implementar en `C:\Proyectos\IIMP\ContratosStands` siguiendo `DESIGN.md`, el UI Kit
   `@nrivera-iimp/ui-kit-iimp`, los tokens de `src/app/globals.css`, las constantes de
   `src/lib/shared/constants.ts` y las reglas de arquitectura hexagonal, DTOs y
   `strict-boundaries`.

---

## I. Riesgos conocidos

- El timeout del MCP no equivale a fallo: reintentar genera duplicados. Esperar y
  verificar.
- Los proyectos nuevos pueden tardar en aceptar generaciones.
- No hay tool para borrar pantallas: la limpieza es manual en Stitch.
- Stitch puede inventar datos de ejemplo en las pantallas; validar contra las reglas
  de la sección G.
