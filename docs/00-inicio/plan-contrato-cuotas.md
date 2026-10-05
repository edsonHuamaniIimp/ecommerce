# Plan — Contrato de exhibición y cuotas en la reserva (RF-10/RF-11/RF-12)

> Objetivo: generar el **contrato automáticamente** al confirmar la reserva (plantilla IIMP +
> datos reales), permitir al cliente **configurar las cuotas** en el wizard, y que el documento
> firmado entre al **flujo de validación** (Asociado → Legal/SGC).

## 1. Decisiones (iteration 2026-10-03)

| Tema | Decisión |
|---|---|
| Plantilla | Se adapta la plantilla real (`CONTRAO-CONDICIONES GENERALES – PERUMIN 38`) con **tags**; Legal la valida. |
| Generación | **Automática** al confirmar la reserva. El cliente descarga, firma y la envía; luego pasa a validación. |
| IGV | Los precios del sistema son **netos**. El **IGV 18% se agrega siempre** al total (factura y boleta); el comprobante elegido solo define RUC/DNI en la reserva. |
| Cuotas | El cliente **configura 1 a 3 cuotas** con **porcentaje y fecha de pago editables** (los porcentajes suman 100%; las fechas no son pasadas y van en orden); presets rapidos 100% y 50/50. El contrato marca **Modalidad 1** (100%), **Modalidad 2** (50/50) o **Modalidad 3 (personalizada)** imprimiendo el cronograma con montos y fechas. |
| Imágenes del Anexo 1 | **Una imagen por pabellón** (todos los stands del cliente en ese pabellón destacados), no una por stand. Se reutiliza el recorte (RF-08). |
| Anexos 4/5 (Reglamentos) | Se adjuntan **aparte**, en el mismo paso del wizard. |
| Partida electrónica | Se agrega como campo de la empresa (si aplica) y se imprime en el contrato. |
| PDF | DOCX (docxtemplater) + PDF (LibreOffice headless en el contenedor ECS). |

## 2. Arquitectura implementada

- **Plantilla etiquetada**: `plantillas/contrato-perumin38-tags.docx`, generada por
  `scripts/tag-contrato-plantilla.ps1` (idempotente sobre la plantilla original). Version en
  ingles: `plantillas/contrato-perumin38-tags-en.docx` (traduccion ES→EN generada por
  `scripts/traducir-contrato-plantilla.ps1`; pendiente validacion de Legal). El idioma del
  contrato se elige por request (`idioma`) o por el perfil del cliente. Tags:
  datos de empresa, `{#modulos}` (tabla Anexo 1), montos/IGV, `{sel_modalidad_1|2}`,
  Anexo 3 (firmante) y `{#planos}{%imagen_plano}{pabellon}{/planos}`.
- **Motor**: `docxtemplater` + `pizzip` + `docxtemplater-image-module-free`.
- **Servicio**: `src/application/contratos/contrato-service.ts`
  (empresa de la cuenta → datos; stands → Anexo 1; `calcularImportes` + `planCuotasPorModalidad`;
  recortes por pabellón → imágenes; render DOCX; PDF best-effort con `soffice`;
  guarda archivos y **adjunta el contrato** a la solicitud como `categoria = contrato`).
- **API**: `POST /api/contratos/generar` (sesión + propiedad/admin; Zod).
- **Utils compartidos**: `numberUtils.numero`, `calcularImportes`, `planCuotasPorModalidad`.
- **Contenedor**: `Dockerfile.ecs` instala `libreoffice-writer` y copia `plantillas/`.

## 3. Robustez del flujo de cuotas (dinero)

- **Montos calculados en el servidor**: el cliente solo envía **porcentajes y fechas**; los
  montos se derivan del precio del stand en BD (nunca se confían montos del cliente).
- **Validación en dos capas**: Zod (`generarContratoSchema`) + guardas del servicio
  (defensa en profundidad): 1–3 cuotas, porcentajes con **hasta 2 decimales**, mayores a 0,
  que **suman 100%** (tolerancia solo para ruido de punto flotante), **monto mínimo por
  cuota** (`CUOTA_MONTO_MINIMO`), y **fechas válidas** (`fechasCuotasValidas`: ISO
  `yyyy-mm-dd`, no anteriores a hoy, ascendentes); se rechaza si el stand no tiene precio
  (`precio > 0`).
- **Plan persistido**: `solicitud.plan_cuotas` guarda el snapshot `{ modalidad, cuotas[] }`
  (fuente de verdad para regenerar el contrato y para Facturación).
- **Regeneración idempotente**: `upsertContratoSistema` mantiene **un único contrato vigente**
  por solicitud (actualiza el existente, no acumula adjuntos).
- **Autorización y estado**: solo el titular o admin; el cliente solo puede (re)generar
  mientras la solicitud está `pendiente`; después, solo admin.
- **Redondeo exacto**: la última cuota absorbe el resto para que la suma de montos sea
  exactamente el total (probado con casos trampa).
- **Imágenes del Anexo 1 generadas en el servidor**: una por pabellón (todos los stands del
  cliente numerados), con la util compartida de recorte + `sharp`; el cliente **no envía
  archivos** y la imagen se regenera igual en cada versión del contrato (leyenda
  “Pabellón — Versión 1 — fecha”).

## 4. Pendiente

1. **Wizard de reserva (4 pasos)** ✅ implementado: `Datos → Cuotas → Contrato → Confirmacion`.
   En **Cuotas** el cliente configura sus cuotas (1–3, **% y fecha editables**; presets 100% y 50/50;
   default de fechas: primera a 30 dias y siguientes a 45) y se genera el **contrato BORRADOR**
   (`POST /api/contratos/borrador`, **sin crear la solicitud**). En **Contrato** descarga/firma
   (firma digital del perfil con `POST /api/contratos/firmar-borrador`, o firma subida) y adjunta
   los **3 documentos requeridos** (Ficha RUC, Vigencia de Poder, DNI o Pasaporte del representante
   legal; cada uno etiquetado con su requisito RF-13). En **Confirmacion** (paso 4) recien se **crea
   la solicitud** (reserva), se regenera el contrato definitivo (`/api/contratos/generar`) y se
   adjunta firmado + los documentos con su requisito.
2. **Recorte por pabellón múltiple** ✅ implementado: `<RecortePlano bloqueIds[]>` en el preview y
   **PNG por pabellón generada en el servidor** (`sharp` + `construirSvgRecorte`) al generar el contrato.
3. **Firma** (RF-12) ✅ **firma subida + firma digital**: el usuario carga su firma (PNG/JPG)
   en *Perfil*; desde el paso de firma, "Firmar digitalmente" valida que exista y **estampa la
   imagen en el contrato** (Anexo 3 y bloque de firmas), equivalente a subirlo firmado.
   Proveedor de firma con certificado: mejora futura.
4. **Cuotas en Facturación**: el plan lo declara el **cliente al reservar** y queda persistido en
   `solicitud.plan_cuotas` (fuente para Facturación); no se requiere auto-creacion separada.
5. **QA visual del contrato** (DOCX/PDF) y **validacion por Legal** de la plantilla y de la
   traduccion al ingles (`contrato-perumin38-tags-en.docx`; ver `plan-idiomas.md` F3).
