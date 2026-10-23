# Validación de datos de empresa por API

Documento de referencia para probar el formulario `/auth/validar-datos` sin usar el navegador.

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/api/empresas/crear` | Alta local de la empresa. Usar `sieCode` para no crear una empresa externa durante pruebas. |
| `POST` | `/api/empresas/crear-cuenta` | Crea el acceso provisional (`acceso-<documento>@acceso.iimp`). |
| `POST` | `/api/auth/login` | Login con el documento/RUC y la contraseña temporal. |
| `POST` | `/api/portal/empresa/validar` | Envía el formulario completo de validación. |
| `GET` | `/api/portal/empresa/mis-datos` | Verifica los datos persistidos. |

## Datos que se guardan

### Empresa

| Campo de la API | Columna | Observación |
|---|---|---|
| `ruc` | `empresa.ruc` | RUC o RUT normalizado. |
| `pais` | `empresa.pais` | ISO 3166-1 alpha-2; por defecto `PE`. |
| `razonSocial` | `empresa.razon_social` | Dato contractual. |
| `nombreComercial` | `empresa.nombre_comercial` | Opcional. |
| `direccionFiscal` | `empresa.direccion_fiscal` | Dato contractual. |
| `telefono` | `empresa.telefono` | Teléfono de la empresa. |
| `emailContacto` | `empresa.email_contacto` | Opcional. |
| `emailFacturacion` | `empresa.email_facturacion` | Se usa para comprobantes. |
| `nombreFriso` | `empresa.nombre_friso` | Nombre visible en el stand. |
| `actividadEconomica` | `empresa.actividad_economica` | Se completa desde SUNAT. |
| `estadoContribuyente` | `empresa.estado_contribuyente` | Estado/condición SUNAT. |
| `facturarANombre` | `empresa.facturar_a_nombre` | Valor de facturación; no placeholder. |
| `tipoComprobante` | `empresa.tipo_comprobante` | `factura` o `boleta`. |
| `sitioWeb` | `empresa.sitio_web` | Opcional. |

### Representante legal

| Campo de la API | Columna | Observación |
|---|---|---|
| `representanteLegalNombre` | `empresa.representante_legal_nombre` | Nombre completo. |
| `representanteLegalTipoDocumento` | `empresa.representante_legal_tipo_documento` | `1` DNI, `4` carné de extranjería, `7` pasaporte. |
| `representanteLegalDni` | `empresa.representante_legal_dni` | Número de documento. |
| `representanteCorreo` | `empresa.representante_correo` | Correo del representante. |
| `representanteCelular` | `empresa.representante_celular` | Celular. |
| `representanteDireccion` | `empresa.representante_direccion` | Dirección. |
| `partidaElectronica` | `empresa.partida_electronica` | Opcional. |
| `representanteUserId` | `empresa.representante_user_id` | UUID local del usuario representante. |
| `representanteSieCode` | `empresa.representante_sie_code` | `sie_code` externo. |

### Responsables EXTEMIN y pagos

Se guardan en `empresa`:

- `responsable_extemin_nombre`
- `responsable_extemin_telefono`
- `responsable_extemin_tipo_documento` (`1`, `4`, `7`)
- `responsable_extemin_dni`
- `responsable_extemin_email`
- `responsable_pagos_nombre`
- `responsable_pagos_telefono`
- `responsable_pagos_tipo_documento` (`1`, `4`, `7`)
- `responsable_pagos_dni`
- `responsable_pagos_email`

## Consultas externas

- **RUC**: `GET /api/sunat/ruc?numero=<ruc>`; completa razón social, dirección, actividad y estado.
- **DNI**: `GET /api/reniec/dni?numero=<dni>`; se usa cuando el tipo de documento es DNI.
- **País**: catálogo ISO local en español mediante `i18n-iso-countries`; no se guarda un diccionario propio.

## Flujo de prueba

1. Crear una empresa temporal con `POST /api/empresas/crear`, usando un `sieCode` explícito y sin DNI del representante.
2. Crear el acceso con `POST /api/empresas/crear-cuenta`.
3. Iniciar sesión con el RUC y la contraseña temporal.
4. Enviar todos los campos con `POST /api/portal/empresa/validar`.
5. Confirmar con `GET /api/portal/empresa/mis-datos`.
6. Eliminar los registros temporales de `user_role` y `empresa`.

## Estado de la prueba

La prueba API quedó bloqueada porque el dev server de `localhost:3001` estaba usando un cliente Prisma anterior a las columnas nuevas y respondió:

```text
Unknown argument `representanteLegalTipoDocumento`
```

Es necesario reiniciar el dev server después de aplicar las migraciones. No se debe probar contra servicio-persona de producción.
