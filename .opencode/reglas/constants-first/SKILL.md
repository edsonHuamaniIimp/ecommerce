---
name: constants-first
description: Uso obligatorio de constantes tipadas para validaciones, estados, roles, permisos, areas y cualquier valor fijo del sistema. Prohibe strings o numeros hardcodeados. Cargar al escribir cualquier logica de validacion, if/switch, o comparacion de estados.
metadata:
  severity: CRITICAL
---

# Constants First — Regla de Constantes

## Regla de oro

**NUNCA usar strings o numeros hardcodeados para validaciones, comparaciones, estados, roles, permisos, areas ni cualquier valor fijo del sistema.** Siempre importar desde `src/lib/constants.ts`.

Todos los valores fijos del sistema se definen en `src/lib/constants.ts` como objetos `as const`. Los tipos se derivan de las constantes, no se redeclaran con literales.

```ts
// ❌ PROHIBIDO — string suelto, sin trazabilidad
if (estado === "en_aprobacion") { ... }
if (evento.estado === "active") { ... }
{ area: "logistica", estado: "aprobado" }
if (!["admin:full", "events:create"].includes(permiso)) { ... }
roles.includes("admin")

// ❌ PROHIBIDO — numero magico sin contexto
if (item.tipo === 3) { ... }
[1, 5].includes(item.estado)

// ✅ CORRECTO — desde el unico archivo de constantes
import { ESTADOS_RESERVA, ESTADOS_EVENTO, AREAS_APROBACION, RESULTADOS_APROBACION, ROLES, ALL_PERMISSIONS } from "@/lib/constants";

if (estado === ESTADOS_RESERVA.EN_APROBACION) { ... }
if (evento.estado === ESTADOS_EVENTO.ACTIVE) { ... }
{ area: AREAS_APROBACION.LOGISTICA, estado: RESULTADOS_APROBACION.APROBADO }
if (ALL_PERMISSIONS.includes(permiso as Permission)) { ... }
roles.includes(ROLES.ADMIN)
```

## Que va en constants.ts

1. **Verticales** — `proexplo | wmc | gess | perumin`
2. **Estados** — stand, reserva, evento, ajuste, aprobacion, interop
3. **Roles** — `admin | logistica | legal | comunicacion`
4. **Permisos** — `ALL_PERMISSIONS`, `ROLES_PERMISSIONS`
5. **Tipos de comprobante** — `factura | boleta`
6. **Monedas** — `USD | PEN`
7. **Ambientes** — `local | qa | production`

## Cuando agregar una nueva constante

Si aparece un nuevo valor fijo en el sistema (estado, tipo, categoria, rol, permiso), el flujo es:

1. Agregarlo a `src/lib/constants.ts` como propiedad de un objeto `as const`
2. Derivar el tipo con `typeof`
3. Usar la constante en TODOS los lugares que referencien ese valor

Nunca al reves: no escribir el string primero y "despues" agregar la constante.

## Excepcion

Unicamente se permite strings literales en:
- URLs hardcodeadas de APIs externas (`.env`)
- Claves de objetos de configuracion interna que no son estados/roles/permisos
- Mensajes de error/validacion (texto para el usuario)
