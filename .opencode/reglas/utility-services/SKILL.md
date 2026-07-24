---
name: utility-services
description: Usar servicios utilitarios centralizados (singleton) para funciones reutilizables como formateo de fechas, validaciones y helpers. Prohibe duplicar logica de utilidad en componentes. Cargar al crear funciones de formato, parseo o validacion reutilizables.
metadata:
  severity: HIGH
---

# Utility Services — Singleton + DRY

## Regla

**Toda funcion utilitaria reutilizable (formateo de fechas, parseo, validaciones comunes) debe residir en un servicio centralizado en `src/lib/utils/` como objeto singleton.** Nunca duplicar logica de utilidad en componentes.

```ts
// ❌ PROHIBIDO — duplicar formato de fecha en cada componente
{new Date(ev.fechaInicio + "T00:00:00").toLocaleDateString("es-PE")}
{new Date(ev.fechaInicio).toLocaleDateString("es-PE")}

// ✅ CORRECTO — usar servicio centralizado
import { dateUtils } from "@/lib/utils/date";
{dateUtils.format(ev.fechaInicio)}
```

## Estructura

```
src/lib/utils/
  date.ts          ← dateUtils.format(), dateUtils.toInputValue()
  (futuros)        ← stringUtils, numberUtils, etc.
```

## Singleton Pattern

Cada archivo exporta una **unica instancia** como objeto constante:

```ts
export const dateUtils = {
  format(iso: string | null): string { ... },
  toInputValue(iso: string | null): string { ... },
};
```

No se usan clases instanciables — el objeto es el singleton.

## DRY (Don't Repeat Yourself)

Si la misma logica de formato/parseo aparece en 2+ componentes, debe extraerse al servicio utilitario. El componente solo consume, no implementa.
