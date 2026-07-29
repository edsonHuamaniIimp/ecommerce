---
name: pre-merge
description: Checklist obligatorio antes de integrar cambios a produccion. Cubre verificacion de tipos, lint, migraciones de BD sin datos, analisis de impacto de upgrades de dependencias, y revision de breaking changes. Cargar antes de hacer merge o actualizar dependencias criticas (Next.js, Prisma, React, TypeScript).
metadata:
  severity: CRITICAL
---

# Pre-Merge Checklist

## Regla de upgrades de dependencias

**NUNCA actualizar dependencias criticas sin analizar el impacto.** Dependencias criticas incluyen:

- `prisma` / `@prisma/client` — impacta BD, tipos, queries
- `next` — impacta build, rutas, middleware, SSR
- `react` / `react-dom` — impacta toda la UI
- `typescript` — impacta compilacion
- `@auth0/nextjs-auth0` — impacta auth

### Procedimiento antes de actualizar

1. Revisar changelog de la nueva version para breaking changes.
2. Verificar compatibilidad con el resto del stack (Next.js, TypeScript, Node).
3. Probar en branch separada, nunca en master/main directo.
4. Ejecutar `tsc --noEmit` despues del upgrade — debe pasar sin errores.
5. Ejecutar `npm run dev` y verificar que la app carga sin errores de modulo.
6. Si la nueva version requiere cambios en schema/config, actualizar documentacion (`docs/`).
7. Si el upgrade rompe algo, **rollback inmediato**. No forzar la migracion.

### Ejemplo de lo que NO hacer

```bash
# ❌ Upgrade directo sin verificar
npm install prisma@latest @prisma/client@latest
npx prisma generate
# La app rompe en produccion
```

### Ejemplo correcto

```bash
# ✅ En branch separada
git checkout -b test/prisma-upgrade
npm install prisma@X.Y.Z @prisma/client@X.Y.Z
npx prisma generate
npx tsc --noEmit
npm run dev  # verificar que carga
# Si todo ok → merge
# Si falla → git checkout master && git branch -D test/prisma-upgrade
```

## Checklist general pre-merge

- [ ] `tsc --noEmit` pasa sin errores.
- [ ] `npm run lint` pasa (si esta configurado).
- [ ] `npm run dev` carga sin errores de modulo.
- [ ] Las migraciones de BD no borran datos (usar `--accept-data-loss` solo con verificacion manual).
- [ ] Los DTOs estan en archivos individuales (SOLID).
- [ ] No hay `fetch()` directo en componentes — usan servicios.
- [ ] Las constantes vienen de `src/lib/constants.ts`, no strings hardcodeados.
- [ ] La documentacion (`docs/`) esta actualizada.
