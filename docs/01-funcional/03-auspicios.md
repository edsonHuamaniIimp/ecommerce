# Auspicios

> Fuente: `src/app/(dashboard)/dashboard/auspicios/page.tsx`,
> `src/app/api/auspicios/{listar,grabar}/route.ts`.

## 1. Propósito

Registrar patrocinios ("auspicios") de un evento y consultar el catálogo de auspicios
disponibles. **No persiste localmente**: es un **proxy autenticado** hacia el sistema
legado KBServicios.

## 2. Roles y permisos

- Permiso `auspicios:view` en página y API (`middleware.ts:19,30`).
- Roles con el permiso: `admin`, `logistica`, `legal`, `comunicacion`. El rol `cliente` **no** lo tiene (`constants.ts:227,231-234`).
- La página toma `tipoEvento`, `codigoEvento` y `eventoNombre` de la sesión.

## 3. Flujo funcional

### 3.1 Listado
1. Al montar: `POST /api/auspicios/listar` con `{ code: tipoEvento, codeEvent: codigoEvento }`.
2. Muestra `nombre`, `tipo`, `moneda` y `codigo`; spinner mientras carga; "Reintentar" si no hay datos.
3. La pestaña "Registrar auspicio" se deshabilita si la lista está vacía.

### 3.2 Registro
1. Formulario: documento (RUC `"6"` / DNI `"1"`), número, empresa, dirección, teléfono, email, `sieCod`, datos de facturación (tipo `01` factura / `03` boleta, doc, razón social, dirección, contacto) y glosa.
2. Tarifas: `codAuspicio`, `moneda` (`US$`/`S/`), `importe`.
3. Validaciones locales: RUC/DNI + empresa obligatorios; al menos una tarifa con importe > 0; sin tarifas duplicadas; tope = cantidad de auspicios.
4. Autocompletado en cascada: IIMP empresa → IIMP persona → SUNAT/RENIEC.
5. `POST /api/auspicios/grabar` con el formulario + `TarifaAuspicio[]`.

## 4. Endpoints

| Método | Ruta | Comportamiento |
|---|---|---|
| `POST` | `/api/auspicios/listar` | Exige sesión; reenvía `{code, codeEvent}` a `${AUSPICIOS_API_URL}/rest/listauspicio` con `x-api-key` |
| `POST` | `/api/auspicios/grabar` | Exige sesión; reenvía el body **tal cual** a `/rest/saveauspicio` |

Base: `AUSPICIOS_API_URL ?? KBSERVICIOS_URL`. Error externo → 502.

## 5. Estados

Sin estados locales; el ciclo de vida vive en KBServicios.

## 6. Reglas de negocio

- Registro solo si hay auspicios disponibles para el evento.
- Importe > 0 por tarifa; sin duplicados por `codAuspicio`.
- Monedas: `US$` y `S/` (`MONEDAS`, `constants.ts:491-496`).

## 7. Limitaciones y observaciones

- **Sin modelo Prisma ni persistencia local**; dependencia total de KBServicios.
- **`grabar` reenvía el body sin validación Zod/DTO** (a diferencia de `listar`): hallazgo de seguridad documentado en `../07-seguridad/run-1`.
- Si `AUSPICIOS_API_URL`/`KBSERVICIOS_URL` no está definido, el fetch falla.
- La búsqueda por documento silencia errores y pide completar manualmente.
