# servicio-persona — Guía para consumir el API

Servicio REST para consultar, crear, modificar y dar de baja **personas** y
**empresas**, con la foto de la persona y el logo de la empresa.

## Ambientes

| Ambiente | URL base | Base de datos |
|---|---|---|
| **Pruebas** | `https://secure2.iimp.org:8443/servicio-persona-pruebas/api` | siemax3: separada, para probar sin afectar datos reales |
| **Producción** | `https://secure2.iimp.org:8443/servicio-persona/api` | siemax: datos reales |

Todas las rutas de este documento cuelgan de una de esas dos bases. Lo
habitual es integrar y probar contra **pruebas**, y al pasar a producción
cambiar solo la URL y las credenciales: **las credenciales de cada ambiente
son independientes**. Una cuenta de pruebas no funciona en producción, ni
viceversa.

Este documento se basta solo: tiene todo lo necesario para programar contra el
servicio. Junto a él suele entregarse `openapi.yaml`, el contrato en formato
OpenAPI 3.0, que **no aporta información nueva** pero permite importar la
colección completa en Postman o Insomnia de una vez, y generar código cliente.
Si no lo recibiste y lo quieres, pídelo al equipo de sistemas.

---

## 1. Autenticación

Todos los endpoints exigen un token, salvo `/auth/login` y `/salud`.

### Obtener el token

```
POST /auth/login
Content-Type: application/json

{
  "usuario": "integra",
  "clave": "..."
}
```

Respuesta:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tipo": "Bearer",
  "expiraEnSegundos": 1800,
  "usuario": "integra",
  "rol": "ESCRITURA"
}
```

### Usarlo

En cada petición siguiente:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Lo que hay que saber

**El token dura 30 minutos y no hay refresco.** Cuando venza, las peticiones
empiezan a responder `401`; hay que volver a llamar a `/auth/login`. Conviene
que el cliente detecte el 401, renueve el token y reintente una vez, en lugar
de fallar hacia el usuario.

**Tras 5 intentos fallidos, el usuario queda bloqueado 15 minutos.** Un
reintento automático en bucle contra `/auth/login` bloquea la cuenta.

**No guardes la clave en código que llegue al navegador.** Si el consumidor es
una página web, el login debe hacerlo un backend: una clave en JavaScript es
visible para cualquiera que abra las herramientas de desarrollo.

### Roles

| Rol | Puede |
|---|---|
| `LECTURA` | Solo `GET` |
| `ESCRITURA` | Todo: `GET`, `POST`, `PUT`, `DELETE` |

Un usuario de lectura que intente escribir recibe **403**, no 401: el token es
válido, lo que falta es el permiso. Los mismos usuarios y roles sirven para
personas y para empresas: no hay credenciales separadas por recurso.

Pide las credenciales de cada ambiente al equipo de sistemas. Se entregan por
separado de este documento.

---

## 2. Endpoints

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `POST` | `/auth/login` | — | Devuelve el token |
| `GET` | `/salud` | — | Estado del servicio |
| `GET` | `/personas` | LECTURA | Listar o buscar personas |
| `GET` | `/personas/documento` | LECTURA | Buscar una persona por tipo y número de documento exacto |
| `GET` | `/personas/{codigo}` | LECTURA | Obtener una persona |
| `POST` | `/personas` | ESCRITURA | Crear una persona |
| `PUT` | `/personas/{codigo}` | ESCRITURA | Actualizar una persona |
| `DELETE` | `/personas/{codigo}` | ESCRITURA | Dar de baja una persona |
| `POST` | `/personas/{codigo}/foto` | ESCRITURA | Subir la foto (reemplaza la anterior) |
| `GET` | `/personas/{codigo}/foto` | LECTURA | Obtener la imagen de la foto |
| `DELETE` | `/personas/{codigo}/foto` | ESCRITURA | Quitar la foto |
| `GET` | `/empresas` | LECTURA | Listar o buscar empresas |
| `GET` | `/empresas/documento` | LECTURA | Buscar una empresa por tipo y número de documento exacto |
| `GET` | `/empresas/{codigo}` | LECTURA | Obtener una empresa |
| `POST` | `/empresas` | ESCRITURA | Crear una empresa |
| `PUT` | `/empresas/{codigo}` | ESCRITURA | Actualizar una empresa |
| `DELETE` | `/empresas/{codigo}` | ESCRITURA | Dar de baja una empresa |
| `POST` | `/empresas/{codigo}/logo` | ESCRITURA | Subir el logo (reemplaza el anterior) |
| `GET` | `/empresas/{codigo}/logo` | LECTURA | Obtener la imagen del logo |
| `DELETE` | `/empresas/{codigo}/logo` | ESCRITURA | Quitar el logo |

---

# PERSONAS

## 3. Listar y buscar personas

```
GET /personas?q=PEREZ&pagina=0&tamanio=20
```

| Parámetro | Por defecto | Notas |
|---|---|---|
| `q` | — | Término de búsqueda. Vacío lista todo |
| `pagina` | `0` | Empieza en cero |
| `tamanio` | `20` | Máximo 100. Un valor mayor se recorta en silencio |

Respuesta:

```json
{
  "contenido": [ { "sie_code": "P0000042960", "nombre_completo": "..." } ],
  "pagina": 0,
  "tamanio": 20,
  "total": 124431,
  "totalPaginas": 6222
}
```

### Cómo funciona `q` — léelo antes de reportar un error

La búsqueda es **por prefijo del nombre completo**, y el nombre completo tiene
el formato `APELLIDO_PATERNO APELLIDO_MATERNO, NOMBRES`.

Para `PEREZ GOMEZ, JUAN CARLOS`:

| `q` | ¿Lo encuentra? |
|---|---|
| `PEREZ` | Sí |
| `PEREZ GOMEZ` | Sí |
| `PEREZ GOMEZ, JUAN` | Sí |
| `GOMEZ` | **No** — no es el comienzo |
| `JUAN` | **No** — el nombre de pila va al final |

En resumen: **se busca por apellido paterno hacia adelante**, no por nombre de
pila ni por apellido materno sueltos.

No es una limitación caprichosa: buscar "que contenga" en lugar de "que empiece
por" anula el índice de la base y obliga a recorrer las más de 124.000 filas en
cada consulta.

Dos detalles más:

- **No distingue mayúsculas, pero sí distingue tildes.** `GARCIA` no encuentra
  a `GARCÍA`.
- **Si el término son 8 dígitos, se prueba también como DNI.** Carné de
  extranjería y pasaporte no se buscan por esta vía — usa `/personas/documento`
  (siguiente sección).

Si ya conoces el código de la persona, usa `GET /personas/{codigo}`: es una
consulta directa y mucho más rápida.

### Buscar por documento exacto (cualquier tipo)

```
GET /personas/documento?tipoDocumento=1&numeroDocumento=72183002
```

A diferencia de `q` (que solo prueba DNI de 8 dígitos como caso especial de la
búsqueda por nombre), esta ruta busca por **cualquier tipo de documento** (DNI,
Carné de extranjería o Pasaporte) de forma exacta. Pensada para cuando ya
conoces el documento y necesitas saber si la persona existe (y con qué código)
antes de decidir crear o actualizar.

| Parámetro | Obligatorio | Notas |
|---|---|---|
| `tipoDocumento` | Sí | `1`, `4` o `7` |
| `numeroDocumento` | Sí | Formato según el tipo (ver sección 5) |

Responde **200** con la misma estructura de la sección 4, o **404** si no
existe ninguna persona con ese documento.

---

## 4. Cómo viene una persona

Esta es la estructura completa que devuelven `GET /personas/{codigo}`,
`GET /personas/documento`, `POST /personas`, `PUT /personas/{codigo}`, y cada
elemento del arreglo `contenido` en el listado:

```json
{
  "sie_code": "P0000012345",
  "apellido_paterno": "PEREZ",
  "apellido_materno": "GOMEZ",
  "nombres": "JUAN CARLOS",
  "nombre_completo": "PEREZ GOMEZ, JUAN CARLOS",
  "sexo": "M",
  "fecha_nacimiento": "1980-05-14",
  "id_tipo_documento": "1",
  "documento": "12345678",
  "direccion": "AV AREQUIPA 1250 LINCE",
  "correo": "juan.perez@empresa.com",
  "celular": "+51987654321",
  "link_foto": "https://intranet.iimp.org/fotos/p0000012345.jpg",
  "id_empresa": "E0000000123",
  "empresa": "NOMBRE DE LA EMPRESA S.A.",
  "pais": 75,
  "pais_nombre": "PERU",
  "departamento": 15,
  "departamento_nombre": "LIMA",
  "provincia": 1,
  "provincia_nombre": "LIMA",
  "distrito": 31,
  "distrito_nombre": "LINCE",
  "auditoria": {
    "usuarioCreacion": "integra",
    "fechaCreacion": "2026-08-24 15:42:07",
    "estacionCreacion": "SVCPRUEBA",
    "usuarioModificacion": "integra",
    "fechaModificacion": "2026-08-24 16:10:33",
    "estacionModificacion": "SVCPRUEBA"
  }
}
```

### Los campos vacíos no aparecen

**Si un campo no tiene valor, se omite del JSON.** No llega como `null` ni como
cadena vacía: simplemente no está. El cliente debe tratar la ausencia como
"sin dato", no asumir que todos los campos vendrán siempre.

Es lo más probable en `empresa`, `link_foto`, el ubigeo y sus descripciones:
mucha gente no los tiene cargados.

### Campos que solo salen, nunca entran

| Campo | De dónde sale |
|---|---|
| `sie_code` | Lo asigna el servicio al crear |
| `nombre_completo` | Lo arma con apellidos y nombres |
| `empresa` | Descripción resuelta a partir de `id_empresa` |
| `pais_nombre`, `departamento_nombre`, `provincia_nombre`, `distrito_nombre` | Descripciones resueltas a partir de sus códigos |
| `auditoria` | La llena el servicio con el usuario del token |

`id_empresa` **se devuelve pero no se puede modificar** por este servicio.
`pais`, `departamento`, `provincia` y `distrito` sí se pueden enviar, como
códigos del catálogo de ubigeo; cada nivel exige el de sus padres.

---

## 5. Crear una persona

```
POST /personas
Content-Type: application/json
Authorization: Bearer ...

{
  "apellido_paterno": "PEREZ",
  "apellido_materno": "GOMEZ",
  "nombres": "JUAN CARLOS",
  "sexo": "M",
  "fecha_nacimiento": "1980-05-14",
  "id_tipo_documento": "1",
  "documento": "12345678",
  "direccion": "AV AREQUIPA 1250 LINCE",
  "correo": "juan.perez@empresa.com",
  "celular": "+51987654321",
  "link_foto": "https://intranet.iimp.org/fotos/p0000012345.jpg"
}
```

Responde **201** con la persona creada y una cabecera `Location` apuntando al
recurso nuevo.

### Campos

| Campo | Obligatorio | Máximo | Formato |
|---|---|---|---|
| `apellido_paterno` | Sí | 30 | |
| `apellido_materno` | Sí | 30 | |
| `nombres` | Sí | 30 | |
| `sexo` | No | 1 | `M` o `F` |
| `fecha_nacimiento` | No | | `AAAA-MM-DD`, anterior a hoy |
| `id_tipo_documento` | Sí | | `1`, `4` o `7` |
| `documento` | Sí | 15 | Depende del tipo |
| `direccion` | Sí | 100 | |
| `correo` | Sí | 101 | Ver abajo |
| `celular` | Sí | 35 | Dígitos, espacios, `-`, `()`, `+` |
| `link_foto` | No | 2048 | Debe empezar con `http://` o `https://` |

### El documento y su tipo van siempre juntos

| `id_tipo_documento` | Documento | Formato exigido |
|---|---|---|
| `1` | DNI | 8 dígitos exactos |
| `4` | Carné de extranjería | Hasta 15 alfanuméricos |
| `7` | Pasaporte | Hasta 15 alfanuméricos |

Enviar uno sin el otro devuelve **400**. El número no puede repetirse entre
personas activas del mismo tipo: si ya existe, la respuesta es **409**.

### El correo tiene un límite doble

Además del máximo de 101 caracteres, **ni la parte anterior al arroba ni el
dominio pueden pasar de 50**. Se guarda partido en dos.

Un correo de 60 caracteres con el arroba al final puede ser rechazado aunque el
total quepa. La respuesta dice cuál de las dos mitades se pasó.

### Campos que no se envían

Se ignoran si llegan:

- `sie_code` — lo asigna el servicio
- `nombre_completo` — lo arma el servicio con apellidos y nombres
- `id_empresa` — solo lectura
- `empresa`, `pais_nombre`, `departamento_nombre`, `provincia_nombre`,
  `distrito_nombre` — descripciones resueltas por el servicio
- `auditoria` — la llena el servicio con el usuario del token

### Los textos se guardan en mayúsculas

Apellidos, nombres y dirección se convierten a mayúsculas al grabar, para que
los registros nuevos sean consistentes con los existentes. El correo y el
`link_foto` **no** se transforman: una URL o una parte del correo pueden
distinguir mayúsculas de minúsculas según el servidor de destino.

---

## 6. Actualizar una persona

```
PUT /personas/{codigo}
```

Mismo cuerpo que la creación, con los mismos campos obligatorios — este
servicio **no admite actualización parcial**: hay que enviar el objeto
completo (apellidos, nombres, documento, dirección, correo y celular
incluidos), no solo el campo que cambió. Si necesitas actualizar un campo sin
perder el resto, primero haz `GET` para traer los valores actuales y arma el
`PUT` con esos valores más el cambio.

Al cambiar el tipo de documento **no se borra el número anterior**: una persona
puede tener DNI y pasaporte a la vez.

---

## 7. Dar de baja una persona

```
DELETE /personas/{codigo}
```

Responde **204**, sin cuerpo.

**La baja es lógica.** El registro deja de aparecer en las consultas de este
servicio, pero la fila permanece en la base porque otros sistemas la
referencian. Consecuencias prácticas:

- Un `GET` sobre una persona dada de baja responde **404**
- Deja de aparecer en los listados y búsquedas
- **Su documento vuelve a quedar disponible**: se puede crear otra persona con
  el mismo número

---

## 7.1 Foto de una persona

`link_foto` se puede llenar de dos formas:

- **Una URL propia** (`http://` o `https://`) enviada en `POST /personas`.
  Solo se graba al **crear**: `PUT` no la toca, para no borrar una foto subida.
- **Subiendo la imagen** al servicio, en cualquier momento:

```
POST /personas/{codigo}/foto
Content-Type: image/jpeg
Authorization: Bearer ...

<bytes de la imagen>
```

El cuerpo es la **imagen tal cual**, sin `multipart/form-data`. Se aceptan
JPG, PNG y WEBP de hasta **5 MB**; se revisa el contenido real del archivo,
no su nombre ni el `Content-Type`. Responde **200** con la persona completa,
y desde entonces `link_foto` vale `/personas/{codigo}/foto`: una ruta del
propio servicio, que se lee con:

```
GET /personas/{codigo}/foto
```

Devuelve los bytes de la imagen (o **404** si no tiene foto subida). Exige
token como cualquier otra ruta, pero **es la única que lo acepta también en la
URL** (`?token=...`), porque una etiqueta `<img>` no puede mandar cabeceras.

`DELETE /personas/{codigo}/foto` borra la imagen, deja `link_foto` vacío y
responde **200** con la persona.

En Postman: pestaña **Body** → **binary** → elegir el archivo.

---

# EMPRESAS

## 8. Listar y buscar empresas

```
GET /empresas?q=ACME&pagina=0&tamanio=20
```

Mismos parámetros que el listado de personas (`q`, `pagina`, `tamanio`), con el
mismo tope de 100 por página.

Respuesta:

```json
{
  "contenido": [ { "sie_code": "E0000000123", "nombre": "..." } ],
  "pagina": 0,
  "tamanio": 20,
  "total": 21334,
  "totalPaginas": 1067
}
```

### Cómo funciona `q`

Igual que en personas: **por prefijo del nombre** (`nombre`, sin
descomposición en partes). `'ACME'` encuentra `'ACME CONSULTORES SAC'` pero no
`'GRUPO ACME'`.

- **No distingue mayúsculas, pero sí distingue tildes.**
- **Si el término son 11 dígitos, se prueba también como RUC.** Empresa
  extranjera (no domiciliada) no se busca por esta vía — usa
  `/empresas/documento`.

### Buscar por documento exacto (cualquier tipo)

```
GET /empresas/documento?tipoDocumento=6&numeroDocumento=20123456789
```

Igual criterio que `/personas/documento`: busca por **cualquier tipo de
documento** (RUC o no domiciliado) de forma exacta.

| Parámetro | Obligatorio | Notas |
|---|---|---|
| `tipoDocumento` | Sí | `6` (RUC) o `0` (no domiciliado) |
| `numeroDocumento` | Sí | Formato según el tipo (ver sección 10) |

Responde **200** con la misma estructura de la sección 9, o **404** si no
existe ninguna empresa con ese documento.

---

## 9. Cómo viene una empresa

```json
{
  "sie_code": "E0000000123",
  "nombre": "ACME CONSULTORES SAC",
  "id_tipo_documento": "6",
  "documento": "20123456789",
  "direccion": "AV JAVIER PRADO 1234 SAN ISIDRO",
  "correo": "contacto@acme.com",
  "telefono": "+51987654321",
  "link_logo": "/empresas/E0000000123/logo",
  "pais": 75,
  "pais_nombre": "PERU",
  "departamento": 15,
  "departamento_nombre": "LIMA",
  "provincia": 1,
  "provincia_nombre": "LIMA",
  "distrito": 21,
  "distrito_nombre": "SAN ISIDRO",
  "auditoria": {
    "usuarioCreacion": "integra",
    "fechaCreacion": "2026-08-26 10:15:00",
    "estacionCreacion": "SVCPRUEBA",
    "usuarioModificacion": "integra",
    "fechaModificacion": "2026-08-26 10:20:00",
    "estacionModificacion": "SVCPRUEBA"
  }
}
```

La diferencia principal frente a persona: **el nombre es un solo campo**
(`nombre`), sin partición en apellidos y nombres — una empresa no tiene esa
descomposición.

Igual que en persona, los campos sin valor se omiten del JSON. El caso más
probable es `link_logo`: es un campo nuevo y casi ninguna empresa lo tiene
cargado. Los `*_nombre` son de solo lectura.

---

## 10. Crear una empresa

```
POST /empresas
Content-Type: application/json
Authorization: Bearer ...

{
  "nombre": "ACME CONSULTORES SAC",
  "id_tipo_documento": "6",
  "documento": "20123456789",
  "direccion": "AV JAVIER PRADO 1234 SAN ISIDRO",
  "correo": "contacto@acme.com",
  "telefono": "+51987654321",
  "link_logo": "https://www.acme.com/logo.png",
  "pais": 75
}
```

Responde **201** con la empresa creada y una cabecera `Location` apuntando al
recurso nuevo.

### Campos

| Campo | Obligatorio | Máximo | Formato |
|---|---|---|---|
| `nombre` | Sí | 100 | |
| `id_tipo_documento` | Sí | | `6` o `0` |
| `documento` | Sí | 20 | Depende del tipo |
| `direccion` | Sí | 200 | |
| `correo` | Sí | 101 | Mismo límite doble que en personas |
| `telefono` | Sí | 35 | |
| `link_logo` | No | 2048 | Debe empezar con `http://` o `https://`. Ver sección 12.1 |
| `pais` | Sí | | Código del catálogo de ubigeo |

### El documento y su tipo van siempre juntos

| `id_tipo_documento` | Documento | Formato exigido |
|---|---|---|
| `6` | RUC | 11 dígitos exactos |
| `0` | No domiciliado / empresa extranjera | Hasta 20 alfanuméricos |

Enviar uno sin el otro devuelve **400**. El número no puede repetirse entre
empresas activas del mismo tipo: si ya existe, la respuesta es **409**.

### Direccion y telefono son texto libre

A diferencia de otros campos del servicio, `direccion` y `telefono` **no se
derivan ni se validan contra ningún otro dato**: se guardan tal cual se
envían, hasta su límite de longitud.

### Campos que no se envían

Se ignoran si llegan: `sie_code`, los `*_nombre` y `auditoria` — mismas reglas
que en personas. `departamento`, `provincia` y `distrito` son opcionales y
exigen el código de sus padres.

### Los textos se guardan en mayúsculas

Nombre y dirección se convierten a mayúsculas al grabar. El correo y el
`link_logo` no se transforman.

---

## 11. Actualizar una empresa

```
PUT /empresas/{codigo}
```

Mismo cuerpo que la creación, con los mismos campos obligatorios — tampoco
admite actualización parcial (mismo criterio que personas, sección 6).

**`PUT` no cambia el logo**: si llega `link_logo`, se ignora. El logo se
cambia o se quita solo por `/empresas/{codigo}/logo` (sección 12.1). Así un
`PUT` que no mande el logo no borra uno ya subido.

---

## 12. Dar de baja una empresa

```
DELETE /empresas/{codigo}
```

Responde **204**, sin cuerpo. Baja lógica, igual que en personas: el registro
deja de aparecer en las consultas de este servicio, pero la fila permanece en
la base, y **su documento vuelve a quedar disponible**.

---

## 12.1 Logo de una empresa

Funciona igual que la foto de la persona (sección 7.1). `link_logo` se llena
de dos formas:

- **Una URL propia** (`http://` o `https://`) enviada en `POST /empresas`.
  Solo se graba al crear.
- **Subiendo la imagen** al servicio, en cualquier momento:

```
POST /empresas/{codigo}/logo
Content-Type: image/png
Authorization: Bearer ...

<bytes de la imagen>
```

El cuerpo es la **imagen tal cual**, sin `multipart/form-data`: JPG, PNG o
WEBP de hasta **5 MB**, y se revisa el contenido real del archivo. Responde
**200** con la empresa completa y `link_logo` = `/empresas/{codigo}/logo`.
Subir otro logo reemplaza al anterior, aunque sea de otro formato.

| Ruta | Qué hace | Respuesta |
|---|---|---|
| `GET /empresas/{codigo}/logo` | Bytes de la imagen. Acepta el token en la URL (`?token=...`) para usarla en un `<img>` | **200** imagen, **404** si no tiene logo subido |
| `DELETE /empresas/{codigo}/logo` | Borra la imagen y deja `link_logo` vacío | **200** con la empresa |

Si `link_logo` empieza con `http`, es una URL externa y se muestra directo.
Si empieza con `/empresas/`, se antepone la URL base del ambiente y el token.

---

# COMÚN A AMBOS RECURSOS

## 13. Códigos de respuesta

| Código | Significa | Qué hacer |
|---|---|---|
| `200` | Correcto | |
| `201` | Creado | El `Location` apunta al recurso nuevo |
| `204` | Dado de baja | Sin cuerpo |
| `400` | Datos inválidos | El cuerpo trae `detalles` con el campo y el motivo |
| `401` | Sin token, o vencido | Volver a autenticarse |
| `403` | Sin permiso de escritura | Usar un usuario con rol ESCRITURA |
| `404` | No existe o está de baja | |
| `413` | Imagen de más de 5 MB | Reducirla antes de subirla |
| `409` | Documento duplicado | Otra persona o empresa activa ya lo tiene |
| `429` | Demasiados intentos de login | Esperar los minutos que indica el mensaje |
| `500` | Error interno | Reportar el `identificador` de la respuesta |

Todos los errores tienen la misma forma, sea persona o empresa:

```json
{
  "codigo": "VALIDACION",
  "mensaje": "La solicitud tiene campos invalidos",
  "detalles": [
    "sexo: El sexo debe ser M o F",
    "nombres: Los nombres no pueden exceder 30 caracteres"
  ]
}
```

El campo `detalles` solo aparece en errores de validación. En un `500` viene un
`identificador` corto: **inclúyelo al reportar el problema**, porque permite
ubicar el error exacto en el log del servidor sin exponer detalles técnicos en
la respuesta.

---

## 14. Empezar con Postman

1. Importa `openapi.yaml`: **Import → File**. Se crea la colección completa,
   con las carpetas de personas y de empresas.
2. Crea **un Environment por ambiente**, cada uno con:
   - `baseUrl`:
     - "servicio-persona — pruebas": `https://secure2.iimp.org:8443/servicio-persona-pruebas/api`
     - "servicio-persona — producción": `https://secure2.iimp.org:8443/servicio-persona/api`
   - `bearerToken` = *(vacío)*
3. Selecciónalo en el desplegable de arriba a la derecha.
4. En la colección: click derecho → **Edit** → **Authorization** → Bearer Token,
   con valor `{{bearerToken}}`.
5. En la petición de login, pestaña **Scripts** → **Post-response**:

```javascript
const r = pm.response.json();
pm.environment.set("bearerToken", r.token);
```

Con eso, ejecutar el login deja el token disponible para el resto de la
colección durante 30 minutos — personas y empresas por igual.

**Si una petición aparece con el token en rojo**, la variable no existe en el
Environment activo: revisa que esté seleccionado y que el nombre coincida.

Con un Environment por ambiente, cambiar de pruebas a producción es elegir
otro en el desplegable. Fíjate siempre en cuál está activo antes de crear o dar
de baja algo: producción tiene datos reales.

---

## 15. Estado del servicio

```
GET /salud
```

No requiere token, para que un monitor externo pueda consultarla.

```json
{"estado":"OPERATIVO","baseDatos":"OK"}
```

Responde **503** con `"estado":"DEGRADADO"` si el servicio está arriba pero sin
conexión a la base de datos.

---

## 16. Antes de reportar un problema

| Síntoma | Causa más probable |
|---|---|
| `401` de repente, tras funcionar | El token venció. Son 30 minutos |
| `401` desde el primer intento | El token no se está enviando, o está mal armado |
| `403` en un `POST` | El usuario es de solo lectura |
| `409` al crear | Ese documento ya existe en otra persona/empresa activa |
| Búsqueda no encuentra a alguien | El término no es el comienzo del nombre |
| Error de CORS en el navegador, y nada en el log | El origen de la página no está autorizado |
| Un dato que cargaste en pruebas no aparece en producción | Son bases de datos distintas — no se replica de una a otra |

Esa penúltima fila tiene una firma inconfundible: el navegador muestra un error
mencionando `CORS policy` y **en el servidor no aparece absolutamente nada**,
porque la llamada fue bloqueada antes de salir. Si en cambio ves un 401 o un
500, el problema es otro.
