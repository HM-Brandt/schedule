# Contrato HTTP del tablero de programación

Este documento describe la API que el frontend del tablero semanal (la aplicación de la raíz de este repositorio) espera del backend. Sirve para quien implemente el backend: el frontend ya está construido contra este contrato y, en desarrollo, contra unos datos de prueba que lo reproducen.

La API intercambia JSON y tiene siete endpoints: dos de consulta (empleados y catálogo de trabajos) y cinco para gestionar las programaciones de trabajos y sus empleados asignados. Se apoya en MySQL con dos tablas nuevas, sin modificar las existentes `jobs` y `employees` (ver [`schema.sql`](./schema.sql)).

La fuente de verdad es el spec `openspec/changes/schedule-assign/specs/schedule-api/spec.md`. Si este documento y el spec no coinciden, manda el spec. Los casos que el spec no detalla están resueltos en "Casos límite", al final.

## Formatos

- **Fechas:** texto `YYYY-MM-DD`, por ejemplo `"2026-11-02"`.
- **Horas de inicio:** texto `HH:mm` en formato de 24 horas, por ejemplo `"07:00"` o `"14:30"`.
- **Devuelve siempre la hora sin segundos.** MySQL guarda `start_time` como `TIME` y lo lee como `"08:00:00"`: el backend debe responder `"08:00"`.
- **En las peticiones, la hora debe ser exactamente `HH:mm`.** Una hora con segundos, como `"08:00:00"`, se rechaza con `422`.
- Los cuerpos de las peticiones y las respuestas son JSON (`Content-Type: application/json`).

> **Importante: no conviertas zonas horarias.**
>
> La fecha y la hora se guardan y se devuelven **exactamente** como llegan. Una programación creada con `"date": "2026-11-02"` y `"start_time": "08:00"` debe devolverse con esa fecha y esa hora, se consulte desde la zona horaria que se consulte.
>
> No pases las fechas por `Date`/`DateTime` con zona horaria ni por UTC: un desplazamiento de unas horas puede mover una programación al día anterior o al siguiente. Usa columnas `DATE` y `TIME` y trátalas como texto en la frontera de la API.
>
> Para probar la integración, crea una programación en **domingo** y otra en **sábado** (el primer y el último día de la semana del tablero) y comprueba que siguen en su día al volver a consultarlas.

## Errores

Todos los errores usan el mismo cuerpo:

```json
{ "error": "<mensaje legible>" }
```

| Código | Cuándo |
|---|---|
| `422 Unprocessable Entity` | La petición es inválida: faltan datos, tienen un formato incorrecto o violan una regla (trabajo inexistente, empleado inactivo…). |
| `404 Not Found` | El recurso de la ruta no existe, por ejemplo `PATCH /api/schedules/99999`. Un id no numérico en la ruta, como `/api/schedules/abc`, también responde `404`. |

El frontend muestra al usuario el texto de `error` cuando viene, así que conviene que sea un mensaje claro en español.

Ejemplo:

```http
PATCH /api/schedules/99999
Content-Type: application/json

{ "date": "2026-11-04" }
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{ "error": "No existe la programación 99999" }
```

## Representaciones

### Employee

```json
{ "id": 3, "first_name": "Ana", "last_name": "López", "title": "Pintora", "status": "activo" }
```

| Campo | Tipo | Notas |
|---|---|---|
| `id` | número | |
| `first_name` | texto | |
| `last_name` | texto | |
| `title` | texto | Puesto del empleado. |
| `status` | texto | `"activo"` o `"inactivo"`. |

### Job

```json
{ "id": 7, "number": "J-1024", "name": "Pintar oficina" }
```

| Campo | Tipo | Notas |
|---|---|---|
| `id` | número | |
| `number` | texto | Número del trabajo en el catálogo. |
| `name` | texto | |

### Schedule

Una programación es un trabajo del catálogo puesto en una fecha y hora, con sus empleados asignados. Toda respuesta que devuelva una programación usa esta forma:

```json
{
  "id": 101,
  "job": { "id": 7, "number": "J-1024", "name": "Pintar oficina" },
  "date": "2026-11-02",
  "start_time": "08:00",
  "employee_ids": [3, 5]
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `id` | número | Id de la programación (`job_schedules.id`). |
| `job` | objeto `Job` | El trabajo completo, no solo su id, para pintar la semana con una sola llamada. |
| `date` | texto `YYYY-MM-DD` | `job_schedules.scheduled_date`. |
| `start_time` | texto `HH:mm` | `job_schedules.start_time`, **sin segundos**. |
| `employee_ids` | lista de números | Ids de los empleados asignados, **sin repetidos**. Puede estar vacía. El orden no está garantizado: el frontend no depende de él. |

Un mismo trabajo se puede programar varias veces, incluso el mismo día.

Los nombres y puestos de los empleados de los ejemplos son ilustrativos; los ids, el trabajo 7 y la programación 101 son los del spec.

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/employees` | Listar empleados |
| `GET` | `/api/jobs` | Listar y buscar trabajos |
| `GET` | `/api/schedules` | Listar programaciones de un rango de fechas |
| `POST` | `/api/schedules` | Crear una programación |
| `PATCH` | `/api/schedules/{id}` | Cambiar la fecha o la hora |
| `DELETE` | `/api/schedules/{id}` | Eliminar una programación |
| `PUT` | `/api/schedules/{id}/employees` | Reemplazar los empleados asignados |

### `GET /api/employees`

Lista los empleados, ordenados por `first_name` y después por `last_name`.

**Parámetros de consulta**

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `status` | No | `activo` o `inactivo`. Si viene, solo se devuelven los empleados con ese estado. Sin él se devuelven **todos**, activos e inactivos. |

El frontend pide la lista sin filtro y filtra él mismo, para poder mostrar el nombre de un empleado inactivo que sigue asignado a una programación.

**Validaciones**

- `422` si `status` viene con un valor distinto de `activo` o `inactivo`, por ejemplo `?status=otro`.

**Ejemplo de petición**

```http
GET /api/employees?status=activo
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  { "id": 3, "first_name": "Ana", "last_name": "López", "title": "Pintora", "status": "activo" },
  { "id": 8, "first_name": "Carlos", "last_name": "Ruiz", "title": "Ayudante", "status": "activo" },
  { "id": 5, "first_name": "Luis", "last_name": "Martínez", "title": "Electricista", "status": "activo" }
]
```

Sin `status`, la respuesta incluiría también a los inactivos, por ejemplo `{ "id": 9, …, "status": "inactivo" }`.

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Siempre que la petición sea válida. Una lista vacía también es `200`. |
| `422` | `status` tiene un valor desconocido. |

### `GET /api/jobs`

Lista el catálogo de trabajos, ordenado por `number`.

**Parámetros de consulta**

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `search` | No | Devuelve solo los trabajos cuyo `number` o `name` **contiene** ese texto, sin distinguir mayúsculas de minúsculas. Sin él se devuelve todo el catálogo. |

**Ejemplo de petición**

```http
GET /api/jobs?search=pintar
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  { "id": 7, "number": "J-1024", "name": "Pintar oficina" }
]
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Siempre que la petición sea válida. Si nada coincide, la lista va vacía. |

### `GET /api/schedules`

Lista las programaciones con fecha entre `from` y `to`, **ambos incluidos**, ordenadas por fecha, después por hora de inicio y después por id.

**Parámetros de consulta**

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `from` | Sí | Primer día, `YYYY-MM-DD`. |
| `to` | Sí | Último día, `YYYY-MM-DD`. |

El frontend pide una semana de domingo a sábado, por ejemplo `from=2026-11-01&to=2026-11-07`, y espera también las programaciones del día 7.

**Validaciones** (todas responden `422`)

- Falta `from` o `to`.
- `from` o `to` no es una fecha válida.
- `from` es posterior a `to`, por ejemplo `from=2026-11-07&to=2026-11-01`.

**Ejemplo de petición**

```http
GET /api/schedules?from=2026-11-01&to=2026-11-07
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": 101,
    "job": { "id": 7, "number": "J-1024", "name": "Pintar oficina" },
    "date": "2026-11-02",
    "start_time": "08:00",
    "employee_ids": [3, 5]
  }
]
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Rango válido. Una semana sin programaciones devuelve `[]`. |
| `422` | Alguna de las validaciones anteriores falla. |

### `POST /api/schedules`

Crea una programación.

**Cuerpo**

| Campo | Obligatorio | Descripción |
|---|---|---|
| `job_id` | Sí | Id de un trabajo existente del catálogo. |
| `date` | Sí | `YYYY-MM-DD`. |
| `start_time` | Sí | `HH:mm` en 24 horas. El frontend siempre la envía: calcula él la hora por defecto. |
| `employee_ids` | No | Lista de ids de empleados. Si no viene, la programación se crea sin empleados (`[]`). Los ids repetidos se ignoran, igual que en `PUT`: la respuesta no trae repetidos. |

**Validaciones** (todas responden `422`, y en ese caso **no se crea nada**)

- El trabajo `job_id` no existe.
- Falta `date` o no es una fecha válida.
- Falta `start_time` o no es una hora `HH:mm` válida. Una hora con segundos, como `"08:00:00"`, también se rechaza.
- Algún id de `employee_ids` no existe o corresponde a un empleado con `status` `inactivo`.

**No** hay restricción de unicidad por trabajo y día: si ya existe una programación del trabajo 7 el 2026-11-02, crear otra igual (con la misma u otra hora) es válido y responde `201`. Ese día quedan dos programaciones del trabajo 7.

**Ejemplo de petición**

```http
POST /api/schedules
Content-Type: application/json

{ "job_id": 7, "date": "2026-11-02", "start_time": "07:00" }
```

**Ejemplo de respuesta**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 101,
  "job": { "id": 7, "number": "J-1024", "name": "Pintar oficina" },
  "date": "2026-11-02",
  "start_time": "07:00",
  "employee_ids": []
}
```

Ejemplo de rechazo, con el empleado 9 inactivo:

```http
POST /api/schedules
Content-Type: application/json

{ "job_id": 7, "date": "2026-11-02", "start_time": "08:00", "employee_ids": [3, 9] }
```

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{ "error": "El empleado 9 está inactivo" }
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `201` | Creada. El cuerpo es la nueva programación. |
| `422` | Alguna de las validaciones anteriores falla. |

### `PATCH /api/schedules/{id}`

Cambia la fecha, la hora de inicio o ambas. Se usa para mover una programación a otro día o cambiar su hora.

**Cuerpo**

| Campo | Obligatorio | Descripción |
|---|---|---|
| `date` | No | Nueva fecha, `YYYY-MM-DD`. |
| `start_time` | No | Nueva hora, `HH:mm`. |

Se envía `date`, `start_time` o ambos. Solo se actualizan los campos enviados; el resto queda igual. **Los empleados asignados se conservan.**

**Validaciones**

- `404` si no existe la programación `{id}` o si `{id}` no es numérico.
- `422` si el cuerpo no trae ni `date` ni `start_time`.
- `422` si `date` o `start_time` vienen con un valor inválido. Una hora con segundos, como `"08:00:00"`, es inválida.

**Ejemplo de petición**

Con la programación 101 del 2026-11-02 a las 08:00 y los empleados 3 y 5:

```http
PATCH /api/schedules/101
Content-Type: application/json

{ "date": "2026-11-04" }
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 101,
  "job": { "id": 7, "number": "J-1024", "name": "Pintar oficina" },
  "date": "2026-11-04",
  "start_time": "08:00",
  "employee_ids": [3, 5]
}
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Actualizada. El cuerpo es la programación con los cambios. |
| `404` | La programación no existe o el id no es numérico. |
| `422` | No viene ningún campo, o algún valor es inválido. |

### `DELETE /api/schedules/{id}`

Elimina la programación y **todas sus asignaciones de empleados** (en el esquema lo hace `ON DELETE CASCADE`).

**El trabajo del catálogo no se ve afectado:** la fila de `jobs` sigue existiendo y se puede volver a programar. Tampoco se toca ningún empleado.

**Ejemplo de petición**

```http
DELETE /api/schedules/101
```

**Ejemplo de respuesta**

```http
HTTP/1.1 204 No Content
```

Sin cuerpo. Después, la programación 101 ya no aparece en `GET /api/schedules`, y el trabajo 7 sigue en `GET /api/jobs`.

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `204` | Eliminada. Sin cuerpo. |
| `404` | La programación no existe o el id no es numérico. |

### `PUT /api/schedules/{id}/employees`

Reemplaza el **conjunto completo** de empleados asignados a la programación. No añade ni quita uno a uno: el resultado es exactamente la lista enviada.

El frontend usa este único endpoint para añadir o quitar un empleado al arrastrar, para la lista de casillas del teléfono y para deshacer. Mover un empleado de una programación a otra son dos `PUT`.

**Cuerpo**

| Campo | Obligatorio | Descripción |
|---|---|---|
| `employee_ids` | Sí | Lista de ids de empleados. Los ids repetidos se ignoran: se guarda cada empleado una sola vez. Una lista vacía, `{"employee_ids": []}`, es válida: deja la programación sin empleados y responde `200`. Así se retira al último empleado. |

**Reglas sobre empleados inactivos**

- **Conservar un inactivo ya asignado es válido.** Si el empleado 9 está asignado a la programación 101 y después pasó a `inactivo`, enviar `{"employee_ids": [9, 3]}` responde `200` y lo mantiene asignado.
- **Agregar un inactivo nuevo se rechaza.** Si el empleado 9 está inactivo y **no** está asignado a la programación 101, enviar `{"employee_ids": [9]}` responde `422` y la asignación **no cambia**.

**Validaciones**

- `404` si no existe la programación `{id}` o si `{id}` no es numérico (regla general de "Errores").
- `422` si algún id no existe.
- `422` si incluye un empleado inactivo que no estaba ya asignado.

Si la respuesta es `422`, no se aplica ningún cambio.

**Ejemplo de petición**

Con la programación 101 asignada a los empleados 3 y 5:

```http
PUT /api/schedules/101/employees
Content-Type: application/json

{ "employee_ids": [5, 8] }
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 101,
  "job": { "id": 7, "number": "J-1024", "name": "Pintar oficina" },
  "date": "2026-11-02",
  "start_time": "08:00",
  "employee_ids": [5, 8]
}
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Reemplazado. El cuerpo es la programación con su nuevo conjunto de empleados, que puede quedar vacío. |
| `404` | La programación no existe o el id no es numérico. |
| `422` | Algún id no existe, o se agrega un empleado inactivo que no estaba asignado. |

## Conexión con el frontend

El frontend arranca con datos de prueba (`VITE_USE_MOCKS=true`). Para usar el backend real, en el `.env` de la raíz del repositorio (o en `.env.local`):

```dotenv
VITE_USE_MOCKS=false
VITE_API_URL=https://backend.ejemplo.com
```

El frontend llama a `VITE_API_URL` + `/api/...`. Si `VITE_API_URL` está vacía, las llamadas van al mismo origen que el frontend.

### CORS

Si el backend está en un origen distinto al del frontend (otro dominio o puerto), debe habilitar CORS para el origen del frontend:

- Métodos: `GET`, `POST`, `PATCH`, `PUT`, `DELETE` y `OPTIONS` (las peticiones `PATCH`, `PUT` y `DELETE` y las que envían JSON provocan una petición previa `OPTIONS`).
- Cabecera permitida: `Content-Type`.

### Proxy de Vite en desarrollo

En desarrollo se puede evitar CORS con el proxy del servidor de Vite: se deja `VITE_API_URL` vacía y se añade en `vite.config.ts` una regla que reenvíe `/api` al backend, sin reescribir la ruta:

```ts
export default defineConfig({
  // …
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
```

Cambia `http://localhost:8000` por la dirección del backend. El proxy solo existe en `npm run dev`: el build estático de producción necesita CORS o servirse en el mismo origen que el backend.

### Esquema de base de datos

El DDL de las dos tablas nuevas, `job_schedules` y `job_schedule_employees`, está en [`docs/schema.sql`](./schema.sql). Antes de aplicarlo, comprueba con `SHOW CREATE TABLE jobs` y `SHOW CREATE TABLE employees` que los ids son `INT UNSIGNED`; si no, ajusta las columnas de clave foránea. El mismo archivo indica cómo revertirlo.

## Casos límite

Reglas decididas para casos que el spec no detalla. Ya están reflejadas en cada endpoint:

1. **Orden de `employee_ids` en la respuesta:** no está garantizado; el frontend no depende del orden.
2. **`PUT /api/schedules/{id}/employees` con `{"employee_ids": []}`:** es válido, deja la programación sin empleados y responde `200`. Así se retira al último empleado.
3. **`PATCH /api/schedules/{id}` sin `date` ni `start_time`:** `422`.
4. **Ids repetidos en `employee_ids` de `POST /api/schedules`:** se ignoran, igual que en `PUT`. La respuesta no trae repetidos.
5. **Hora con segundos en una petición** (`"08:00:00"` en `POST` o `PATCH`): `422`, porque el contrato exige `HH:mm`.
6. **`status` desconocido en `GET /api/employees`** (por ejemplo `?status=otro`): `422`.
7. **Id no numérico en la ruta** (por ejemplo `/api/schedules/abc`): `404`.
