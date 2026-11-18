# Debida Diligencia V2 - Pruebas de integracion en QA

> **Fecha:** 2026-11-18
> **Ambiente:** QA (`qa-ecommerce.sistemasiimp.org.pe`), imagen desplegada `2a9474d`.
> **Objetivo:** validar el flujo completo desde el envio de la empresa hasta la decision
> final en Matriz, Comunicaciones y Legal, incluyendo correcciones del cliente.
> **Resultado:** flujo operativo. Se encontraron cuatro defectos de integridad y se
> corrigieron en local; las correcciones no se desplegaron durante la prueba.

## 1. Casos ejecutados

| Empresa | Codigo | Relacion comercial | Vinculos evaluados | Resultado |
|---|---|---|---|---|
| ACTIVOS MINEROS S.A.C. | `DD-2026-0656` | Exhibidor | empresa, representante, beneficiaria final 25% | APTO |
| DIRTEX S.A.C. | `DD-2026-0657` | Proveedor | empresa, representante argentino, socio 10% (15%) | Documentacion observada, luego reenviado |
| ORICA MINING SERVICES PERU S.A. | `DD-2026-0658` | Auspiciador | empresa, representante, empresa vinculada | NO APTO por rechazo legal |

Los tres expedientes se enviaron desde las cuentas de empresa en QA, con los cuatro
documentos obligatorios. La revision se ejecuto desde las APIs autenticadas de Matriz,
Reputacion y Legal, y la bandeja de Matriz se valido en navegador.

## 2. Resultados por caso

### ACTIVOS MINEROS S.A.C. (`DD-2026-0656`)

- Se derivo a Comunicaciones: 3 vinculos, 3 casos reputacionales.
- Comunicaciones cerro los 3 casos como `ACEPTADO`.
- SIG y Reputacional se registraron en Matriz.
- Los 3 vinculos quedaron `APTO`.
- La empresa se cerro automaticamente como `APTO`.
- Expediente: `aprobada`, aprobado el `2026-11-18`, vigencia hasta `2027-05-18`.

### DIRTEX S.A.C. (`DD-2026-0657`)

- Relacion `Proveedor`, representante con nacionalidad argentina.
- Se registro `DOCUMENTACION OBSERVADA` con la ficha RUC como documento a subsanar.
- El cliente recibio la observacion y subio una nueva ficha RUC.
- Al reenviar, el expediente volvio a `en_revision`.
- La matriz debe quedar sin resultado final mientras el expediente este en revision.

### ORICA MINING SERVICES PERU S.A. (`DD-2026-0658`)

- Relacion `Auspiciador`, con una empresa vinculada como sujeto evaluado.
- Se derivo a Legal con motivo e informe de Logistica.
- Legal rechazo con informe PDF obligatorio.
- Expediente: `rechazada`.
- Matriz empresa: `cmp_resultado = rechazado`, `cmp_conclusion = rechazado`,
  `resultado_final = no_apto`.
- La empresa quedo bloqueada: `aptoParaContratar = false`.

## 3. Defectos encontrados y correcciones locales

1. **Empresa vinculada clasificada como beneficiario.**
   - Se mostraba con `tipoDocumento` nulo, cargo `Empresa vinculada (0%)` y listas de
     persona.
   - Correccion: tipo `vinculado`, inferencia de RUC/DNI/CE/Pasaporte, cargo sin
     porcentaje cuando no aplica y listas de empresa para empresas vinculadas con RUC.

2. **Beneficiario duplicado al reenviar una observacion.**
   - El guardado eliminaba y recreaba los beneficiarios; la matriz creaba una segunda
     fila al cambiar el `refKey`.
   - Correccion: conservar los IDs de beneficiarios existentes por documento.

3. **Resultado final anterior persistente al reenviar.**
   - Despues de subsanar una observacion, la matriz mantenia
     `DOCUMENTACION OBSERVADA`.
   - Correccion: al volver a `en_revision` desde `observada` o `en_legal`, limpiar el
     resultado final de la fila empresa.

4. **Respuesta API desactualizada despues del puente APTO.**
   - La base quedaba `aprobada`, pero la respuesta inmediata devolvia
     `en_revision`.
   - Correccion: refrescar el vinculo y el expediente despues de ejecutar el puente.

## 4. Verificacion local

- `npx tsc --noEmit`: sin errores.
- `npx eslint src`: sin errores; queda un warning preexistente en
  `precio-stand.test.ts`.
- `npx vitest run src --testTimeout=10000`: 1,350 tests aprobados, 2 omitidos.
- Prueba focalizada de Matriz y Excel: 40 tests aprobados.

## 5. Estado de QA

Los tres expedientes quedan como data de prueba en QA. No se modifico produccion.
Las correcciones locales se integraron a las ramas de trabajo despues de esta prueba y
deben desplegarse en un siguiente ciclo; la imagen QA usada durante la prueba no las
contiene.
