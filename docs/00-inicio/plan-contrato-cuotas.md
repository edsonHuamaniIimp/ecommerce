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
| Cuotas | El wizard ofrece **tres modalidades fijas**: 1 cuota 100%, 2 cuotas 50/50 y 3 cuotas 40/30/30. Las fechas se asignan automaticamente con el cronograma PERUMIN 38 (hora Lima) y **no son editables**; el servidor recalcula y valida el plan. El contrato conserva ademas la **Modalidad 4 personalizada** para planes legacy/administrados. Detalle: [`plan-contrato-cronograma-2027.md`](./plan-contrato-cronograma-2027.md). |
| Imágenes del Anexo 1 | **Una imagen por pabellón** (todos los stands del cliente en ese pabellón destacados), no una por stand. Se reutiliza el recorte (RF-08), rediseñado con el **stand resaltado ("TU STAND") y flecha de llamada**; el anexo suma el **mapa macro de pabellones** con la declaracion del representante legal. |
| Anexos 4/5 (Reglamentos) | Se adjuntan **aparte**, en el mismo paso del wizard. |
| Partida electrónica | Se agrega como campo de la empresa (si aplica) y se imprime en el contrato. |
| PDF | DOCX (docxtemplater) + PDF (LibreOffice headless en el contenedor ECS); **fallback local via MS Word** (conversion DOCX→PDF acotada por semaforo) y **cache EFS del mapa macro**. |

## 2. Arquitectura implementada

- **Plantilla etiquetada**: `plantillas/contrato-perumin38-tags.docx`, generada por
  `scripts/tag-contrato-plantilla.ps1` (idempotente sobre la plantilla original). Version en
  ingles: `plantillas/contrato-perumin38-tags-en.docx` (traduccion ES→EN generada por
  `scripts/traducir-contrato-plantilla.ps1`; pendiente validacion de Legal). El idioma del
  contrato se elige por request (`idioma`) o por el perfil del cliente. Tags:
  datos de empresa, `{#modulos}` (tabla Anexo 1), montos/IGV, `{sel_modalidad_1}` a
  `{sel_modalidad_4}`, Anexo 3 (firmante) y `{#planos}{%imagen_plano}{pabellon}{/planos}`.
  La Modalidad 3 conserva el texto oficial 40/30/30 y la Modalidad 4 queda para cronogramas
  personalizados; despues de las modalidades se imprime el cronograma seleccionado.
- **Motor**: `docxtemplater` + `pizzip` + `docxtemplater-image-module-free`.
- **PDF y mapa macro**: conversion con `soffice` (LibreOffice headless del contenedor ECS) y
  **cache EFS del mapa macro** (`/app/public/uploads/.cache-macro`) para evitar el 504: CF
  `origin_read_timeout=60s`, ALB `idle_timeout=120s`, tarea ECS con 2048 MB y `HOME=/tmp`.
  Si `soffice` no esta disponible, **fallback local via MS Word** (conversion acotada por
  semaforo). El recorte del plano (RF-08) resalta el stand ("TU STAND") con flecha de llamada.
- **Servicio**: `src/application/contratos/contrato-service.ts`
  (empresa de la cuenta → datos; stands → Anexo 1; `calcularImportes` + cronograma fijo
  `planPagoPredeterminado`/`cronogramaValido`; recortes por pabellón → imágenes; render DOCX;
  PDF best-effort con `soffice`; guarda archivos y **adjunta el contrato** a la solicitud
  como `categoria = contrato`).
- **API**: `POST /api/contratos/generar` (sesión + propiedad/admin; Zod).
- **Utils compartidos**: `numberUtils.numero`, `calcularImportes`, `cronogramaPredeterminado`, `cronogramaValido`.
- **Contenedor**: `Dockerfile.ecs` instala `libreoffice-writer` y copia `plantillas/`.

## 3. Robustez del flujo de cuotas (dinero)

- **Montos calculados en el servidor**: el cliente envía la modalidad y sus cuotas fijas; los
  montos se derivan del precio del stand en BD (nunca se confían montos del cliente).
- **Validación en dos capas**: Zod (`generarContratoSchema`) + guardas del servicio
  (defensa en profundidad): la modalidad debe ser exactamente 1 cuota 100%, 2 cuotas 50/50
  o 3 cuotas 40/30/30, con las fechas del cronograma vigente; monto mínimo por cuota
  (`CUOTA_MONTO_MINIMO`); se rechaza si el stand no tiene precio (`precio > 0`). Los planes
  legacy persistidos se aceptan sin exigir el cronograma nuevo (Modalidad 4).
- **Plan persistido**: `solicitud.plan_cuotas` guarda el snapshot `{ modalidad, cuotas[] }`
  (fuente de verdad para regenerar el contrato y para Facturación).
- **Regeneración idempotente**: `upsertContratoSistema` mantiene **un único contrato vigente**
  por solicitud (actualiza el existente, no acumula adjuntos).
- **Autorización y estado**: solo el titular o admin; el cliente solo puede (re)generar
  mientras la solicitud está `pendiente`; después, solo admin.
- **Redondeo exacto**: la última cuota absorbe el resto para que la suma de montos sea
  exactamente el total (probado con casos trampa).
- **Cronograma fijo**: `cronogramaPredeterminado`/`cronogramaValido` (utils `cuotas.ts`)
  aplican los hitos 2026-11-15, 2027-01-15, 2027-02-15, 2027-03-15 y 2027-06-15, con
  comparación estricta por día en `America/Lima`; la UI muestra el cronograma de solo lectura.
- **Imágenes del Anexo 1 generadas en el servidor**: una por pabellón (todos los stands del
  cliente numerados), con la util compartida de recorte + `sharp`; el cliente **no envía
  archivos** y la imagen se regenera igual en cada versión del contrato (leyenda
  “Pabellón — Versión 1 — fecha”).

## 4. Pendiente

1. **Wizard de reserva (4 pasos)** ✅ implementado: `Datos → Cuotas → Contrato → Confirmacion`.
   En **Cuotas** el cliente elige una modalidad fija (1 cuota 100%, 2 cuotas 50/50 o 3 cuotas
   40/30/30); las fechas las calcula el cronograma PERUMIN 38 y no se editan. Se genera el
   **contrato BORRADOR** (`POST /api/contratos/borrador`, **sin crear la solicitud**). En
   **Contrato** descarga el PDF para firma manual, o selecciona la firma digital de su perfil
   (se aplica al generar el contrato definitivo al enviar) y adjunta los **3 documentos
   requeridos**. En **Confirmacion** (paso 4) recién se **crea la solicitud** (reserva), se
   regenera el contrato definitivo (`/api/contratos/generar`) y se adjunta firmado (digital o
   el PDF subido) + los documentos con su requisito.
2. **Recorte por pabellón múltiple** ✅ implementado: `<RecortePlano bloqueIds[]>` en el preview y
   **PNG por pabellón generada en el servidor** (`sharp` + `construirSvgRecorte`) al generar el contrato.
3. **Firma** (RF-12) ✅ **firma subida + firma digital**: el usuario carga su firma (PNG/JPG)
   en *Perfil*; desde el paso de firma, "Firmar digitalmente" valida que exista y marca la
   intención. El servidor estampa la firma **una sola vez** al generar el contrato definitivo
   durante el envío (Anexo 3 y bloque de firmas), sin generar un borrador firmado descartable.
   Proveedor de firma con certificado: mejora futura.
4. **Cuotas en Facturación**: el plan lo declara el **cliente al reservar** y queda persistido en
   `solicitud.plan_cuotas` (fuente para Facturación); no se requiere auto-creacion separada.
5. **QA visual del contrato** (DOCX/PDF) y **validacion por Legal** de la plantilla y de la
   traduccion al ingles (`contrato-perumin38-tags-en.docx`; ver `plan-idiomas.md` F3).
