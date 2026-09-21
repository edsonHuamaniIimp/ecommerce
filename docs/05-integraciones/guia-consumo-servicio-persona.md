# servicio-persona — Guía para consumir el API

Servicio REST para consultar, crear, modificar y dar de baja personas.

**Ambiente de pruebas**

```
https://secure2.iimp.org:8443/servicio-persona/api
```

Todas las rutas de este documento cuelgan de esa base.

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
válido, lo que falta es el permiso.

Pide las credenciales al equipo de sistemas. Se entregan por separado de este
documento.

---

## 2. Endpoints

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `POST` | `/auth/login` | — | Devuelve el token |
| `GET` | `/salud` | — | Estado del servicio |
| `GET` | `/personas` | LECTURA | Listar o buscar |
| `GET` | `/personas/{codigo}` | LECTURA | Obtener una |
| `POST` | `/personas` | ESCRITURA | Crear |
| `PUT` | `/personas/{codigo}` | ESCRITURA | Actualizar |
| `DELETE` | `/personas/{codigo}` | ESCRITURA | Dar de baja |

---

## 3. Listar y buscar

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
  extranjería y pasaporte no se buscan por esta vía.

Si ya conoces el código de la persona, usa `GET /personas/{codigo}`: es una
consulta directa y mucho más rápida.

---

## 3.1 Cómo viene una persona

Esta es la estructura completa que devuelven `GET /personas/{codigo}`,
`POST /personas`, `PUT /personas/{codigo}`, y cada elemento del arreglo
`contenido` en el listado:

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

Es lo más probable en `empresa`, el ubigeo y sus descripciones: mucha gente no
los tiene cargados.

### Campos que solo salen, nunca entran

| Campo | De dónde sale |
|---|---|
| `sie_code` | Lo asigna el servicio al crear |
| `nombre_completo` | Lo arma con apellidos y nombres |
| `empresa` | Descripción resuelta a partir de `id_empresa` |
| `pais_nombre`, `departamento_nombre`, `provincia_nombre`, `distrito_nombre` | Descripciones resueltas a partir de sus códigos |
| `auditoria` | La llena el servicio con el usuario del token |

Los códigos `id_empresa`, `pais`, `departamento`, `provincia` y `distrito`
**se devuelven pero no se pueden modificar** por este servicio en esta versión.

---

## 4. Crear una persona

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
  "celular": "+51987654321"
}
```

Responde **201** con la persona creada y una cabecera `Location` apuntando al
recurso nuevo.

### Campos

| Campo | Obligatorio | Máximo | Formato |
|---|---|---|---|
| `apellido_paterno` | Sí | 30 | |
| `apellido_materno` | No | 30 | |
| `nombres` | Sí | 30 | |
| `sexo` | No | 1 | `M` o `F` |
| `fecha_nacimiento` | No | | `AAAA-MM-DD`, anterior a hoy |
| `id_tipo_documento` | Ver abajo | | `1`, `4` o `7` |
| `documento` | Ver abajo | 15 | Depende del tipo |
| `direccion` | No | 100 | |
| `correo` | No | 101 | Ver abajo |
| `celular` | No | 35 | Dígitos, espacios, `-`, `()`, `+` |

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
- `id_empresa`, `pais`, `departamento`, `provincia`, `distrito` — solo lectura
- `empresa`, `pais_nombre`, `departamento_nombre`, `provincia_nombre`,
  `distrito_nombre` — descripciones resueltas por el servicio
- `auditoria` — la llena el servicio con el usuario del token

### Los textos se guardan en mayúsculas

Apellidos, nombres y dirección se convierten a mayúsculas al grabar, para que
los registros nuevos sean consistentes con los existentes. El correo **no** se
transforma.

---

## 5. Actualizar

```
PUT /personas/{codigo}
```

Mismo cuerpo que la creación. Reemplaza los campos que el servicio gestiona; el
resto de la información de la persona queda intacta.

Al cambiar el tipo de documento **no se borra el número anterior**: una persona
puede tener DNI y pasaporte a la vez.

---

## 6. Dar de baja

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

## 7. Códigos de respuesta

| Código | Significa | Qué hacer |
|---|---|---|
| `200` | Correcto | |
| `201` | Creado | El `Location` apunta al recurso nuevo |
| `204` | Dado de baja | Sin cuerpo |
| `400` | Datos inválidos | El cuerpo trae `detalles` con el campo y el motivo |
| `401` | Sin token, o vencido | Volver a autenticarse |
| `403` | Sin permiso de escritura | Usar un usuario con rol ESCRITURA |
| `404` | No existe o está de baja | |
| `409` | Documento duplicado | Otra persona activa ya lo tiene |
| `429` | Demasiados intentos de login | Esperar los minutos que indica el mensaje |
| `500` | Error interno | Reportar el `identificador` de la respuesta |

Todos los errores tienen la misma forma:

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

## 8. Empezar con Postman

1. Importa `openapi.yaml`: **Import → File**. Se crea la colección completa.
2. Crea un Environment con:
   - `baseUrl` = `https://secure2.iimp.org:8443/servicio-persona/api`
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
colección durante 30 minutos.

**Si una petición aparece con el token en rojo**, la variable no existe en el
Environment activo: revisa que esté seleccionado y que el nombre coincida.

---

## 9. Estado del servicio

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

## 10. Antes de reportar un problema

| Síntoma | Causa más probable |
|---|---|
| `401` de repente, tras funcionar | El token venció. Son 30 minutos |
| `401` desde el primer intento | El token no se está enviando, o está mal armado |
| `403` en un `POST` | El usuario es de solo lectura |
| `409` al crear | Ese documento ya existe en una persona activa |
| Búsqueda no encuentra a alguien | El término no es el comienzo del apellido paterno |
| Error de CORS en el navegador, y nada en el log | El origen de la página no está autorizado |

Esa última fila tiene una firma inconfundible: el navegador muestra un error
mencionando `CORS policy` y **en el servidor no aparece absolutamente nada**,
porque la llamada fue bloqueada antes de salir. Si en cambio ves un 401 o un
500, el problema es otro.
