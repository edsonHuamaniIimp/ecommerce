# Incidencia: representante legal en producción vs QA

**Fecha:** 2026-11-14
**Entorno afectado:** Producción
**Servicio externo:** `servicio-persona`
**Documento de prueba:** `06422025`
**Registro:** `P0000256555`

## Resumen

En QA el documento `06422025` se reconoce como **Carné de extranjería (tipo 4)** de `GRONDEL, HUGO`. En producción el mismo registro existe como **DNI (tipo 1)** de `BUSTOS SULLCAPUMA, CARMEN`, pero conserva el correo y celular de Hugo.

Además, el endpoint `/personas/documento` de `servicio-persona` devuelve el mismo registro para `tipoDocumento=1` y `tipoDocumento=4`, sin respetar el tipo solicitado.

## URLs

```text
QA:
https://secure2.iimp.org:8443/servicio-persona-pruebas/api

Producción:
https://secure2.iimp.org:8443/servicio-persona/api

Endpoint:
GET /personas/documento?tipoDocumento={1|4|7}&numeroDocumento=06422025
```

La API requiere autenticación:

```http
POST /auth/login
Content-Type: application/json

{
  "usuario": "<usuario>",
  "clave": "<clave>"
}
```

Luego:

```http
GET /personas/documento?tipoDocumento=4&numeroDocumento=06422025
Authorization: Bearer <token>
```

No incluir credenciales ni tokens en tickets, correos o documentación compartida.

## Respuesta QA

### Carné de extranjería, tipo 4

```http
GET .../personas/documento?tipoDocumento=4&numeroDocumento=06422025
HTTP 200
```

```json
{
  "sie_code": "P0000256555",
  "apellido_paterno": "GRONDEL",
  "nombres": "HUGO",
  "nombre_completo": "GRONDEL, HUGO",
  "sexo": "M",
  "fecha_nacimiento": "1753-01-01",
  "id_tipo_documento": "4",
  "documento": "06422025",
  "correo": "hugo.grondel@minbuza.nl",
  "celular": "993841667",
  "pais": 172,
  "pais_nombre": "PAISES BAJOS",
  "departamento": 0,
  "provincia": 0,
  "distrito": 0,
  "bloqueado": false,
  "dado_de_baja": false,
  "auditoria": {
    "usuarioCreacion": "EOTAROLA",
    "fechaCreacion": "2026-06-19 20:23:08",
    "usuarioModificacion": "EOTAROLA",
    "fechaModificacion": "2026-06-19 20:24:43",
    "estacionModificacion": "201.218.159.123"
  }
}
```

### DNI, tipo 1

```http
GET .../personas/documento?tipoDocumento=1&numeroDocumento=06422025
HTTP 200
```

Devuelve el **mismo registro**, con `id_tipo_documento: "4"`.

### Pasaporte, tipo 7

```http
GET .../personas/documento?tipoDocumento=7&numeroDocumento=06422025
HTTP 404
```

```json
{
  "codigo": "NO_ENCONTRADO",
  "mensaje": "No existe una persona con ese tipo y numero de documento"
}
```

## Respuesta Producción

### Carné de extranjería, tipo 4

```http
GET .../personas/documento?tipoDocumento=4&numeroDocumento=06422025
HTTP 200
```

```json
{
  "sie_code": "P0000256555",
  "apellido_paterno": "BUSTOS",
  "apellido_materno": "SULLCAPUMA",
  "nombres": "CARMEN",
  "nombre_completo": "BUSTOS SULLCAPUMA, CARMEN",
  "id_tipo_documento": "1",
  "documento": "06422025",
  "direccion": "AV. LARCO Nº 1301",
  "correo": "hugo.grondel@minbuza.nl",
  "celular": "993841667",
  "bloqueado": false,
  "dado_de_baja": false,
  "auditoria": {
    "usuarioCreacion": "EOTAROLA",
    "fechaCreacion": "2026-06-19 20:23:08",
    "usuarioModificacion": "integra",
    "fechaModificacion": "2026-11-14 18:22:18",
    "estacionModificacion": "SVCPERSONA"
  }
}
```

### DNI, tipo 1

Devuelve el mismo registro, con `id_tipo_documento: "1"` y nombre `BUSTOS SULLCAPUMA, CARMEN`.

### Pasaporte, tipo 7

```http
HTTP 404
```

## Análisis

1. **El API no filtra por tipo de documento.**
   Tanto en QA como en producción, `/personas/documento` devuelve el registro `P0000256555` para `tipoDocumento=1` y `tipoDocumento=4`. El campo `id_tipo_documento` de la respuesta es el que realmente indica el tipo almacenado.

2. **QA tiene el registro correcto para Hugo.**
   `P0000256555` está almacenado como tipo `4` (Carné de extranjería), nombre `GRONDEL, HUGO`.

3. **Producción fue modificada.**
   El registro `P0000256555` está almacenado como tipo `1` (DNI), nombre `BUSTOS SULLCAPUMA, CARMEN`, pero mantiene correo y celular de Hugo. La auditoría indica modificación por `integra` el `2026-11-14 18:22:18`.

4. **El frontend nuevo valida el tipo.**
   La última versión desplegada (`main`, commit `53451af`, imagen ECR `53451af4fe309065fcd641cb9a9fa790c7d50fe6`) descarta resultados del padrón cuyo `id_tipo_documento` no coincide con el tipo seleccionado. Por eso en producción, al elegir **Carné**, no se muestra el registro: el API devuelve un registro tipo `1`.

## Impacto

- En producción no se puede seleccionar a Hugo desde el padrón usando **Carné de extranjería**, porque su registro fue cambiado a tipo DNI.
- El registro de producción mezcla identidad y contactos:
  - Identidad: Carmen (DNI).
  - Correo/celular: Hugo.
- Riesgo de emitir contrato o facturación con datos inconsistentes.

## Acciones recomendadas

1. **Corregir el registro en producción** `P0000256555`:
   - Devolverlo a tipo `4` (Carné de extranjería) si el documento real de Hugo es ese.
   - Corregir nombre a `GRONDEL, HUGO`.
   - Mantener o validar correo `hugo.grondel@minbuza.nl` y celular `993841667`.
   - Confirmar antes con la embajada que `06422025` es el documento correcto de Hugo.

2. **Corregir el API `servicio-persona`** para que `/personas/documento` filtre realmente por `tipoDocumento` y valide contra `id_tipo_documento`. Actualmente devuelve un registro tipo `4` cuando se consulta tipo `1`, y viceversa.

3. **Revisar la sincronización `integra`** que modificó producción el `2026-11-14 18:22:18`. Verificar qué flujo actualizó el registro y por qué cambió el tipo/nombre sin cambiar los contactos.

4. **No volver a guardar** la ficha de la empresa con `06422025` como DNI de Hugo hasta confirmar y corregir la fuente.

5. **Agregar una prueba de regresión** que verifique que un registro de tipo `4` no se muestre al seleccionar DNI y viceversa, incluso si el API devuelve el registro por error.

## Verificación posterior

Después de corregir producción, validar:

```http
GET /personas/documento?tipoDocumento=4&numeroDocumento=06422025
```

Debe devolver:

```json
{
  "sie_code": "P0000256555",
  "id_tipo_documento": "4",
  "nombre_completo": "GRONDEL, HUGO",
  "correo": "hugo.grondel@minbuza.nl",
  "celular": "993841667"
}
```

Y en la aplicación, con **Carné de extranjería**, debe aparecer Hugo; con **DNI**, no debe aparecer el registro de tipo `4`.
