---
name: componentes-transversales
description: Uso obligatorio de los componentes y utilidades transversales (compartidos) del proyecto en lugar de primitivas nativas o duplicadas. Prohibe window.confirm/alert/prompt, dialogs de confirmacion ad-hoc, paginacion propia y logica de vista repetida. Cargar al construir cualquier UI que necesite modal, confirmacion, paginacion, skeleton, o vista de bandeja (cuadricula/lista).
metadata:
  severity: HIGH
---

# Componentes transversales — Regla de reutilizacion

## Regla de oro

**Antes de escribir UI transversal (confirmaciones, modales, paginacion, skeletons,
vistas de bandeja), revisa y usa el componente/utilidad compartido.** Nunca primitivas
nativas del navegador ni copias locales.

## Prohibido

- ❌ `window.confirm(...)`, `window.alert(...)`, `window.prompt(...)`.
- ❌ `Dialog` "a mano" para confirmar (Si/No) en cada pagina.
- ❌ Paginacion propia (usar `Pagination`).
- ❌ Estado local para la vista cuadricula/lista de una bandeja.

## Obligatorio

### Confirmaciones
Usar el confirm transversal: `useConfirm()` (hook) o `ConfirmDialog` (componente).

```tsx
import { useConfirm } from "@/hooks/use-confirm";

const { confirm, confirmDialog } = useConfirm();

const eliminar = async (id: string) => {
  const ok = await confirm({
    title: "Eliminar registro",
    description: "Esta accion no se puede deshacer.",
    confirmLabel: "Eliminar",
    destructive: true,
  });
  if (!ok) return;
  // ...
};

// renderizar dentro del JSX del componente:
{confirmDialog}
```

- Implementacion: `src/components/shared/confirm-dialog.tsx` + `src/hooks/use-confirm.tsx`.
- Basado en el `Dialog` del UI Kit (`@nrivera-iimp/ui-kit-iimp`); texto envuelto en `<span>` (regla Google Translate/Radix).

### Modales
- Usar `Dialog` del UI Kit. No portales ni modales propios.

### Vista de bandeja (cuadricula / lista)
- Usar `useVistaBandeja("<clave>")` (persistida por bandeja) + `VISTAS_BANDEJA`.
- Implementacion: `src/lib/shared/utils/vista.ts` (util) + `src/hooks/use-vista-bandeja.ts` (hook).

```tsx
import { useVistaBandeja } from "@/hooks/use-vista-bandeja";
import { VISTAS_BANDEJA } from "@/lib/shared/constants";

const { vista, setVista } = useVistaBandeja("solicitudes");
```

### Otros compartidos
- Paginacion: `Pagination` (`src/components/shared/pagination.tsx`).
- Carga de tablas: `TableSkeleton` (`src/components/shared/table-skeleton.tsx`).

## Ubicacion de componentes/utilidades compartidas

- Componentes: `src/components/shared/`.
- Hooks: `src/hooks/`.
- Utilidades: `src/lib/shared/utils/` (ver regla `utility-services`).

Si algo se va a usar en 2+ pantallas, debe vivir en `shared`/`hooks`/`utils`, no duplicarse.

## Checklist

- [ ] Ninguna confirmacion con `window.confirm/alert/prompt`.
- [ ] Confirmaciones con `useConfirm()` / `ConfirmDialog`.
- [ ] Modales con el `Dialog` del UI Kit (texto en `<span>`).
- [ ] Paginacion con `Pagination`; skeletons con `TableSkeleton`.
- [ ] Vista cuadricula/lista con `useVistaBandeja`.
- [ ] Sin logica/JSX transversal duplicado entre bandejas.
