# DD — Ronda 7 E2E en QA: asistente IA / OCR, «Exigir evidencia» y cierre automático

Fecha: 2026-11-25 · Imagen QA: `6052fdaf` · Scripts: `scripts/e2e-dd-qa/ronda7.mjs` (API) y `ronda7-ui.mjs` (Playwright) · Empresas: `E2E RONDA2 R82` (asistente y evidencia) y `R116..R123` (cierre).

Se corrió contra `https://qa-ecommerce.sistemasiimp.org.pe` (QA no envía correos: `RESEND_API_KEY` vacío). El SQL y el cron se ejecutaron dentro de la EC2 por SSM; el `CRON_SECRET` no salió del servidor.

## Resultado

**API: 49/49 OK** (A + E: 23/23; K: 26/26). **Navegador: 11/11 OK.**

Las corridas previas de K tuvieron fallas **de la prueba, no del sistema**:

- La lectura de `json_agg` con varias filas.
- Las tildes deformadas por la consola de SSM en Windows.
- Una fecha vencida que quedó de una corrida anterior. La guarda de aislamiento la detectó y **no ejecutó el cierre real**.

Se corrigieron en el script y la corrida final pasó completa.

| Bloque | Qué se probó | Resultado |
|---|---|---|
| A | Regla «Asistente IA» apagada: `usarAsistenteIa=false` y el endpoint responde 403 con el mensaje de Configuración | OK |
| A | Regla encendida desde Configuración: la matriz ofrece el asistente a SIG | OK |
| A | «Ayúdate con IA» con PDF (OEFA), Word (Otros, el texto lo extrae el servidor) y OSCE | OK (2–4 s) |
| A | «OCR + prompt»: PDF con texto → `texto_pdf`; PDF escaneado y PNG → `ocr` (Tesseract en el contenedor) | OK (3–5 s) |
| A | «Solo dime el RUC» responde solo el RUC, con el aviso de empresa distinta una sola vez | OK |
| A | Errores: criterio fuera de alcance (PEP), sin evidencia, evidencia de otro criterio, indicación corta, modo inválido (mensajes en español) | OK |
| A | Permisos: Legal 403, sin sesión 401 | OK |
| E | «Guardar evaluación» con SI sin evidencia → 400 que nombra el criterio; el borrador sí guarda | OK |
| E | N.A. sin evidencia: permitido con «Permitir N.A. sin evidencia», 400 sin ella; NO sin evidencia permitido; SI con evidencia permitido | OK |
| E | Regla «Exigir evidencia» apagada: SI sin evidencia se guarda | OK |
| K | Cron sin secreto o con secreto incorrecto → 401 | OK |
| K | Simulación: entran solo **A** (DOCUMENTACIÓN OBSERVADA guardada), **B** (observada por SIG, conclusión deducida) y **C** (observada por Legal); no cambia nada | OK |
| K | Quedan fuera **D** (observada dentro del plazo), **E** (vencida, pero el cliente subsanó y reenvió) y **F** (Observada sin observaciones, como la importada del Excel) | OK |
| K | Cierre real: matriz **SIN RESPUESTA** (`final_por = sistema:cierre-automatico`), DD del cliente cerrada con el motivo, evento en el historial | OK |
| K | El cliente ve su DD cerrada; la matriz de SIG muestra SIN RESPUESTA; una segunda corrida no repite | OK |
| K | Opción **NO APTO**: matriz NO APTO y motivo «venció el plazo para subsanar» | OK |
| K | Opción **DOCUMENTACIÓN OBSERVADA**: no cierra nada | OK |
| K | Restauración: fechas de los casos no cerrados, plazo y opción de cierre originales | OK |
| U1 | Configuración: opciones de «Cierre automático» = SIN RESPUESTA / NO APTO / DOCUMENTACIÓN OBSERVADA; encender el asistente y guardar | OK |
| U2 | Matriz (modo Editar): «OCR + prompt» en INDECOPI y «Ayúdate con IA» en OEFA llenan la observación; vista ampliada con el asistente | OK |
| U3 | Regla apagada: la matriz ya no muestra los botones del asistente | OK |
| U4 | «Guardar evaluación» con SI sin evidencia: aviso con la regla y el criterio | OK |
| U5 | SIG ve FINAL = SIN RESPUESTA; el cliente ve su DD cerrada con el motivo | OK |

## Aislamiento del cierre real

La corrida real cierra **todo** lo que vence. Para no tocar datos de otras personas en QA:

1. Los casos de la prueba se llevaron a una fecha de inicio vencida (2020).
2. El plazo se subió por SQL a 1500 días hábiles, de modo que solo alcanzara a esos casos.
3. Antes de cerrar, la simulación debía traer **exactamente** esos casos. Si aparecía cualquier otro expediente, el cierre real no se ejecutaba.

Al terminar se restauraron el plazo (3) y la opción (SIN RESPUESTA). Hoy QA tiene **1 expediente real** que el cron cerraría con el plazo de 3 días (`cad3adb5…`). No se tocó.

## Hallazgos (vista del cliente tras un cierre SIN RESPUESTA)

Los dos ocurren igual con el cierre SIN RESPUESTA **manual** de la matriz (`cerrarSinRespuestaDesdeMatriz`). No los introduce el cron.

1. **Badge «NO APTO» en *Mi debida diligencia*.** El expediente queda `rechazada` y el portal traduce ese estado como NO APTO, mientras la matriz y los informes dicen SIN RESPUESTA. El texto del motivo sí es correcto («Cierre por falta de respuesta… debe presentar una nueva»).
2. **Observaciones abiertas en una DD cerrada.** Sigue el bloque «Observaciones (1) — Corrige… y vuelve a enviar tu expediente» con «Corregir documento», aunque la DD ya no se puede usar. Aparece junto al botón «Iniciar nueva debida diligencia».

**Corregido (pendiente de desplegar):**

- `mi-expediente` devuelve `cerradaSinRespuesta`, calculado con la conclusión final de la matriz.
- Con ese dato, *Mi debida diligencia* muestra:
  - la etiqueta **SIN RESPUESTA**;
  - el aviso «Debida diligencia cerrada sin respuesta»;
  - el hito «Cerrada sin respuesta».
- En una DD cerrada ya no aparece el bloque de observaciones para corregir; el hito dice «sin subsanar».
- Las observaciones no se modifican.
- Un NO APTO real se sigue mostrando como NO APTO.
- Verificado en local con Playwright (DD-2026-0505 cerrada SIN RESPUESTA desde la matriz).

## Datos que quedaron en QA

- Usuario de prueba `e2e-admin@example.invalid`, clon de un administrador, para Configuración DD.
- Empresas `E2E RONDA2 R82..R125`.
- DD `DD-2026-0743..0773`:
  - 0744–0746, 0750–0752 y 0766–0768 cerradas SIN RESPUESTA.
  - 0756 y 0772 cerradas NO APTO.
- Fila `dd_configuracion` creada con los valores por defecto. Antes no existía y el sistema usaba esos mismos valores; el asistente quedó **apagado**.
