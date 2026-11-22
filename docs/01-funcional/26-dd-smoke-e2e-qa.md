# Debida Diligencia - Smoke / integración E2E en QA

> **Fecha:** 2026-11-22
> **Ambiente:** QA (`qa-ecommerce.sistemasiimp.org.pe`), imagen `25299ee`.
> **Alcance:** de cero hasta la conclusión final, con las reglas de [`25-dd-reunion-transferencia-sig.md`](./25-dd-reunion-transferencia-sig.md).
> **Resultado:** 164 de 190 pasos OK. Los 26 pasos que fallaron corresponden a **9 hallazgos distintos** (sección 3).
> **Herramienta:** [`scripts/e2e-dd-qa/`](../../scripts/e2e-dd-qa/) (setup de usuarios y corrida; salida completa en `ultima-corrida.txt`).

## 1. Cómo se ejecutó

- Se llamó a la **API real** de QA por rol (cliente, SIG/Logística, Comunicaciones, Legal) con usuarios de prueba `e2e-*@example.invalid` y 8 empresas de prueba `E2E EMPRESA A..H S.A.C.` (RUC 20999991001 a 20999991008).
- **Aislamiento de correos:** la app de QA tiene `RESEND_API_KEY`, y las notificaciones por rol (Legal, SIG, Comunicaciones) llegan a todos los usuarios con ese permiso, incluidos administradores reales. Para no enviarles correos de prueba, la corrida usó un **segundo contenedor temporal con la misma imagen y la misma base de datos, sin la clave de correo ni de Pusher**. Ese contenedor ya se eliminó. En la corrida se habrían enviado **162 correos**.
- **Qué no se verificó:** el envío real de correos, Pusher/push y el aspecto visual de las pantallas (solo API).
- Cuando un paso falló, se aplicó un **bypass documentado** para continuar con el resto del flujo (marcado `BYPASS` en la salida).

## 2. Escenarios y resultado

| # | Escenario | Recorrido | Resultado |
|---|---|---|---|
| T | Transversales | Salud, login de los 4 roles, permisos cruzados (cliente sin bandeja SIG, Comunicaciones sin bandeja Legal, Legal sin derivar a Comunicaciones), vista extendida por expediente, datos del informe | OK |
| A | Limpio | Cliente crea y envía, SIG valida y deriva a Comunicaciones, Comunicaciones acepta todo, SIG concluye, conclusión final APTO | OK (con hallazgo 1) |
| B | DD reforzada, Legal aprueba | Observación en un vínculo, SIG y Comunicaciones piden DD reforzada, SIG deriva a Legal, Legal aprueba, vuelve a SIG | Parcial (hallazgos 1 a 4) |
| C | Legal observa y el cliente subsana | Legal observa un documento, el cliente reemplaza y reenvía, vuelve a Legal, Legal aprueba | Parcial (hallazgos 1, 2 y 4) |
| D | Legal rechaza | Legal sube informe PDF y rechaza, el expediente queda `rechazada`, el cliente ve el resultado | OK (con hallazgos 1 y 2) |
| E | SIG observa documentos | SIG observa la ficha RUC, el cliente subsana y reenvía, el flujo continúa hasta la conclusión | Parcial (hallazgo 4) |
| F | Vínculos extranjeros | 6 vínculos de varias nacionalidades (Argentina, China, Alemania, Venezuela, empresa vinculada chilena), criterios por ámbito, "Automatizar todo" asíncrono | Parcial (hallazgos 1, 4, 5, 7 y 8) |
| G | Documentación observada como conclusión final | SIG registra DOCUMENTACIÓN OBSERVADA con comentario y documento, el cliente subsana, SIG concluye APTO | OK (con hallazgo 1) |
| H | Sin respuesta | SIG registra SIN RESPUESTA como conclusión final | OK, ver hallazgo 9 |

Lo que funcionó de punta a punta: crear la DD y enviarla, bandeja de SIG, sincronización de vínculos a la matriz, la declaración de "vínculos completos" como requisito de la derivación, resultado por vínculo de Comunicaciones, conclusiones de SIG, derivación a Legal, bandeja y seguimiento de Legal, observar/aprobar/rechazar de Legal con informe, subsanación del cliente tras observación de SIG y de Legal, vigencia de 6 meses al llegar a APTO y permisos entre roles.

## 3. Hallazgos

| # | Severidad | Hallazgo | Evidencia y causa | Arreglo sugerido |
|---|---|---|---|---|
| 1 | **Crítica** | **Los beneficiarios y demás vínculos nuevos no se guardan.** Al guardar el formulario, los vínculos recién creados se borran en la misma transacción. Solo llegan a la matriz la empresa y el representante. | `guardarFormulario` en `debida-diligencia-repository.ts` (cambio `651ce51`, 2026-11-18): los registros nuevos no se agregan a `beneficiariosConservados` y el `deleteMany ... notIn` los elimina. En QA: se enviaron 1 y 6 beneficiarios y `mi-expediente` devolvió 0 en todos los escenarios. | Agregar el id de cada `create` al conjunto de conservados (o borrar primero y crear después). **Revisar producción**: `main` tiene el mismo código desde el 18-nov. |
| 2 | Alta | **SIG no puede guardar la conclusión reputacional "Requiere DD reforzada".** | La pantalla envía `requiere_dd_reforzada`; el normalizador reputacional solo acepta `requiere_debida_diligencia`. Respuesta 400 "Conclusión no reconocida". | Agregar el alias en el normalizador reputacional o enviar el valor correcto. |
| 3 | Alta | **Legal aprueba, pero no se puede declarar APTO** si Comunicaciones observó algún vínculo. | `validarComunicacionesParaApto` exige veredicto aceptado y conclusión sin observaciones en todos los vínculos. Respuesta 409 "No se puede declarar APTO: Comunicaciones no tiene un veredicto sin hallazgos para…". En la reunión, International quedó APTO por conformidad de Legal pese a la observación. | Permitir APTO cuando Legal aprobó, o dar la excepción documentada. |
| 4 | Alta | **APTO CON OBSERVACIONES no aprueba el expediente.** Queda `en_revision`, sin fecha de aprobación ni vigencia de 6 meses. | `estadoExpedienteDeResultadoFinal` devuelve `null` para ese resultado. En la reunión equivale a APTO en la práctica y la vigencia corre desde la decisión. | Mapearlo a `aprobada` y registrar fecha de aprobación y vencimiento. |
| 5 | Media | **Una empresa vinculada extranjera no se puede declarar con su ID local.** | Se exige un RUC de 11 dígitos aunque la empresa sea extranjera (en la prueba, una empresa chilena con 8 dígitos): 400 "El RUC de la empresa vinculada debe tener 11 dígitos". En la reunión se dijo que los IDs extranjeros no tienen formato único. | Validar el formato según el país/tipo de documento. |
| 6 | Media | **El resultado final solo se guarda en la fila de la empresa.** Las filas de los demás vínculos quedan `null`. | Se comprobó que solo la fila de la empresa tiene el valor (1 de 3, 1 de 8 filas). La regla R10 pide el mismo resultado en todas. Algunas pantallas lo derivan del estado y otras no. | Replicar el resultado en las filas del expediente, o documentar que se deriva siempre de la fila de la empresa. |
| 7 | Media | **Listas extranjeras que no corresponden.** Interpol y DEA se habilitan también para una empresa vinculada; todos los extranjeros reciben Unión Europea, Canadá y Australia sin importar su país. | En la reunión: Interpol/DEA solo personas; sanciones por país solo si el vínculo es de ese país. | Filtrar por tipo de vínculo y país en `listasAplicables`. |
| 8 | Media | **"Automatizar todo": Sanciones australianas falla en QA** (9 de 10 criterios OK; "fetch failed"). | La descarga del portal de Australia se cuelga sin cabeceras de navegador. El arreglo (cabeceras, límite de tiempo y caché de la lista) **está en el código pero sin commit ni deploy**. | Desplegar el arreglo pendiente. |
| 9 | Baja | **SIN RESPUESTA y los resultados "abiertos" no cambian el estado**; el expediente queda `en_revision` indefinidamente. Tampoco hay plazo límite de subsanación. | Se registró SIN RESPUESTA y el estado siguió en `en_revision`. El plazo límite quedó pendiente en la reunión. | Definir el plazo y cerrar automáticamente a SIN RESPUESTA. |

Observaciones menores:

- La derivación a Legal (`revisar` con acción "derivar") **no exige** que SIG y Comunicaciones hayan declarado "requiere DD reforzada"; hoy es decisión manual de SIG. No se probó el caso en que se deriva sin conclusiones.
- La acción heredada "aprobar" del modal de revisión cierra el expediente como `aprobada` pero deja el resultado final de la matriz vacío; después el sistema bloquea registrar la conclusión final porque ya está cerrada (409). Conviene dejar una sola vía.
- Advertencia en el log al automatizar la lista de la Unión Europea: `standardFontDataUrl` de pdfjs (no afecta la evidencia).

## 4. Cómo repetir la prueba

Ver [`scripts/e2e-dd-qa/README.md`](../../scripts/e2e-dd-qa/README.md). Los datos de prueba quedan en QA: empresas `E2E EMPRESA A..H S.A.C.` y los usuarios `e2e-*@example.invalid`. Cada corrida con `E2E_RESET=1` elimina primero los expedientes de esas empresas.
