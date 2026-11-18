# Caso 237 - ENERGIA PERUANA S.A.C.

Fecha de corrección: 2026-11-11  
Solicitud: `26a2eeb6-f038-4102-8c6b-b549980a84ae`  
Evento: `c0a354e0-4c79-4b38-b88d-ff824cd28964`  
Empresa: ENERGIA PERUANA S.A.C.  
Contacto: Víctor Federico Tarazona González (`vtarazona@energiaperuana.com`)

## Situación encontrada

La solicitud aparecía con **2 stands**:

```text
237
237A
```

pero `237A` era un registro comercial inválido:

```text
237A
  bloque 3D: null
  precio:    0.00 USD
  área:      0.00
  estado:    en_evaluacion
```

El stand válido equivalente es:

```text
237-A
  bloque 3D: 237-A
  precio:    7440.00 USD
  área:      6.00
  estado:    en_evaluacion después de la corrección
```

La solicitud mostraba un total de `US$ 9,440` porque calculaba:

```text
237  = 7440
237A = 2000 por fallback del catálogo
Total = 9440
```

El `2000` no era un precio comercial real. Era el fallback de `ESTÁNDAR 6MT2` aplicado porque `237A` tenía precio explícito `0.00`.

## Causa raíz

El API/importación generó dos registros equivalentes:

```text
237A  → precio 0.00, sin bloque
237-A → precio 7440.00, con bloque 237-A
```

El flujo anterior permitía:

- importar el registro con precio `0.00`;
- asociarlo a una solicitud;
- vincularlo a un bloque 3D;
- calcular un precio de catálogo cuando el precio explícito era cero.

Además, la solicitud guardó `237A` en `solicitud_stand`, por lo que la UI mostraba dos stands aunque solo uno tuviera bloque 3D.

## Corrección aplicada

Se reemplazó la relación inválida en `solicitud_stand`:

```text
Antes:  237 + 237A
Después: 237 + 237-A
```

Cambios realizados:

1. Se actualizó la relación de la solicitud de `237A` a `237-A`.
2. `237-A` quedó activo, con bloque `237-A` y precio `7440.00`.
3. `237A` quedó con `flg_activo = false`.
4. Se recalculó el plan de cuotas con dos stands válidos:
   - neto: `14,880.00`
   - IGV 18%: `2,678.40`
   - total: `17,558.40`
5. Se dejó `contrato_habilitado = false` para regenerar el contrato antes de habilitar la firma.

Plan actualizado:

```text
Cuota 1: 7,023.36  (40%)  15 nov 2026
Cuota 2: 5,267.52  (30%)  15 feb 2027
Cuota 3: 5,267.52  (30%)  15 jun 2027
Total:  17,558.40
```

## Datos finales de la solicitud

```text
237
  bloque: BLOQUE-237
  precio: 7440.00
  flg_activo: true

237-A
  bloque: 237-A
  precio: 7440.00
  flg_activo: true
  estado: en_evaluacion

237A
  bloque: null
  precio: 0.00
  flg_activo: false
```

## Contrato regenerado

El contrato PDF anterior fue regenerado con el detalle corregido:

```text
PDF: /uploads/contrato-237237-A-1794425608463.pdf
DOCX: /uploads/contrato-237237-A-1794425608463.docx
```

El contrato quedó nuevamente deshabilitado para firma:

```text
contrato_habilitado = false
```

Antes de habilitar la firma del cliente:

1. Revisar el PDF regenerado.
2. Verificar que incluya `237` y `237-A`.
3. Verificar el total `17,558.40`.
4. Recién después habilitar la firma.

No se eliminó la solicitud, no se borraron filas y no se tocó el bloque 3D `237-A`.

## Validación

Consultas recomendadas después de desplegar:

- Verificar que `solicitud_stand` tenga solo `237` y `237-A`.
- Verificar que `237A` tenga `flg_activo = false`.
- Verificar que el reporte muestre `237` y `237-A`, sin `237A`.
- Verificar que el detalle de la solicitud y el contrato muestren el total correcto.
- Verificar que `237A` no pueda vincularse ni pre-reservarse.

## Nota sobre pabellones

En el plano 3D:

```text
237    → BLOQUE-237 → Pabellon 2
237-A  → 237-A      → Pabellon 2
```

El campo raw del stand `237A` decía `PABELLÓN 1`, pero al no tener bloque 3D no se puede considerar un pabellón válido del plano. La referencia correcta es el bloque 3D.
