# Contrato HTTP del tablero de programación

Este documento describe la API que el frontend del tablero semanal (la aplicación de la raíz de este repositorio) espera del backend. Sirve para quien implemente el backend: el frontend ya está construido contra este contrato y, en desarrollo, contra unos datos de prueba que lo reproducen.

La API intercambia JSON y tiene diez endpoints: dos de consulta (empleados y catálogo de trabajos), cinco para gestionar las programaciones de trabajos y sus empleados asignados, y tres para las ausencias de los empleados. Se apoya en MySQL con tres tablas nuevas, sin modificar las existentes `jobs` y `employees` (ver [`schema.sql`](./schema.sql)).

Las fuentes de verdad son los specs `schedule-api` de los cambios de OpenSpec:

- `openspec/changes/schedule-assign/specs/schedule-api/spec.md`: empleados, trabajos y programaciones.
- `openspec/changes/employee-absences/specs/schedule-api/spec.md`: ausencias y su efecto en las programaciones.

Si este documento y un spec no coinciden, manda el spec. Los casos que los specs no detallan están resueltos en "Casos límite", al final.

## Rutas

Todas las rutas son relativas a la URL base del backend, que el frontend lee de `VITE_API_URL`. La URL completa es la URL base seguida de la ruta, con una sola `/` entre ambas.

| `VITE_API_URL` | Petición | URL final |
|---|---|---|
| `https://api.ejemplo.com/api/` | Programación 101 | `https://api.ejemplo.com/api/v2/job-management/schedules/101` |
| *(vacía)* | Listar empleados | `/v1/employee`, en el mismo origen que el frontend |

## Formatos

- **Nombres de campos:** camelCase, con los ids como `<entidad>Id` (`employeesId`, `jobsId`, `jobSchedulesId`, `employeeAbsencesId`).
- **Fechas:** texto `YYYY-MM-DD`, por ejemplo `"2026-11-02"`.
- **Horas de inicio:** texto `HH:mm` en formato de 24 horas, por ejemplo `"07:00"` o `"14:30"`.
- **En las peticiones, la hora debe ser exactamente `HH:mm`.** Una hora con segundos, como `"08:00:00"`, se rechaza con `422`.
- **En las respuestas, la hora puede llevar segundos.** MySQL guarda `start_time` como `TIME` y lo lee como `"08:00:00"`. El frontend descarta los segundos, así que `"08:00"` y `"08:00:00"` son válidos.
- **Campos adicionales:** el frontend ignora los campos que no están en este contrato, por ejemplo `createdAt` o `updatedAt`.
- Los cuerpos de las peticiones y las respuestas son JSON (`Content-Type: application/json`). El frontend rechaza cualquier respuesta que no sea JSON, salvo los `204` sin cuerpo.

> **Importante: no conviertas zonas horarias.**
>
> La fecha y la hora se guardan y se devuelven **exactamente** como llegan. Una programación creada con `"date": "2026-11-02"` y `"startTime": "08:00"`, o una ausencia del `"2026-11-02"`, debe devolverse con esa fecha y esa hora, se consulte desde la zona horaria que se consulte.
>
> No pases las fechas por `Date`/`DateTime` con zona horaria ni por UTC: un desplazamiento de unas horas puede mover una programación o una ausencia al día anterior o al siguiente. Usa columnas `DATE` y `TIME` y trátalas como texto en la frontera de la API.
>
> Para probar la integración, crea una programación en **domingo** y otra en **sábado** (el primer y el último día de la semana del tablero) y comprueba que siguen en su día al volver a consultarlas.

## Errores

Todos los errores usan el mismo cuerpo:

```json
{ "error": "<mensaje legible>" }
```

| Código | Cuándo |
|---|---|
| `422 Unprocessable Entity` | La petición es inválida: faltan datos, tienen un formato incorrecto o violan una regla (trabajo inexistente, empleado inactivo, empleado ausente…). |
| `404 Not Found` | El recurso de la ruta no existe, por ejemplo `PATCH v2/job-management/schedules/99999`. Un id no numérico en la ruta, como `v2/job-management/schedules/abc`, también responde `404`. |

El frontend muestra al usuario el texto de `error` tal como llega, así que conviene que sea un mensaje claro. La interfaz está en inglés.

Ejemplo:

```http
PATCH v2/job-management/schedules/99999
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
{
  "employeesId": 3,
  "legalName": "Ana López",
  "employeeNumber": "E-003",
  "firstName": "Ana",
  "lastName": "López",
  "status": "Active",
  "title": "Labor",
  "user": "alopez"
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `employeesId` | número | `employees.employees_id`. |
| `legalName` | texto | |
| `employeeNumber` | texto | |
| `firstName` | texto | |
| `lastName` | texto | |
| `status` | texto | `"Active"` o `"Terminated"`. Un empleado es activo si es `Active` e inactivo si es `Terminated`. |
| `title` | texto | Cargo. El panel del tablero muestra solo a los activos con cargo `Supervisor` o `Labor`; ese filtro lo aplica el frontend. |
| `user` | texto | |

### Job

```json
{
  "jobsId": 7,
  "number": "J-1024",
  "type": "Interior",
  "name": "Pintar oficina",
  "address": "Calle Mayor 12",
  "contractor": "Construcciones Pérez",
  "contact": "Laura Pérez",
  "status": "Open",
  "user": "admin"
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `jobsId` | número | `jobs.jobs_id`. |
| `number` | texto | Número del trabajo en el catálogo. |
| `type`, `name`, `address`, `contractor`, `contact`, `status`, `user` | texto | Datos del catálogo. El `status` del trabajo no filtra nada. |

### Schedule

Una programación es un trabajo del catálogo puesto en una fecha y hora, con sus empleados asignados y un comentario opcional. Toda respuesta que devuelva una programación usa esta forma:

```json
{
  "jobSchedulesId": 101,
  "jobsId": 7,
  "date": "2026-11-02",
  "startTime": "08:00",
  "employeesIds": [3, 5],
  "scheduleComment": null
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `jobSchedulesId` | número | `job_schedules.job_schedules_id`. |
| `jobsId` | número | Id del trabajo del catálogo. **Solo el id, no el objeto:** el frontend ya tiene el catálogo completo de `GET v1/job` y cruza los datos él mismo. Si el `jobsId` no está en el catálogo, muestra la programación como "Unknown job". |
| `date` | texto `YYYY-MM-DD` | `job_schedules.scheduled_date`. |
| `startTime` | texto `HH:mm` | `job_schedules.start_time`. Puede llevar segundos (ver "Formatos"). |
| `employeesIds` | lista de números | Ids de los empleados asignados, **sin repetidos**. Puede estar vacía. El orden no está garantizado: el frontend no depende de él. |
| `scheduleComment` | texto o `null` | `job_schedules.schedule_comment`. `null` si no tiene comentario. |

Un mismo trabajo se puede programar varias veces, incluso el mismo día. Un mismo empleado puede estar en varias programaciones del mismo día, salvo que tenga una ausencia ese día.

### Absence

Una ausencia indica que un empleado no está disponible un día concreto. Un empleado tiene como máximo una ausencia por día.

```json
{
  "employeeAbsencesId": 41,
  "employeesId": 3,
  "date": "2026-11-03",
  "absenceType": "Vacation",
  "absenceComment": "Viaje familiar"
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `employeeAbsencesId` | número | `employee_absences.employee_absences_id`. |
| `employeesId` | número | Empleado ausente. |
| `date` | texto `YYYY-MM-DD` | `employee_absences.absence_date`. |
| `absenceType` | texto | `"Off"`, `"Vacation"`, `"Sick"` u `"Other"`. |
| `absenceComment` | texto o `null` | `employee_absences.absence_comment`. `null` si no tiene comentario. |

Los nombres de los empleados y trabajos de los ejemplos son ilustrativos; los ids, el trabajo 7, la programación 101 y la ausencia 41 son los de los specs.

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `v1/employee` | Listar empleados |
| `GET` | `v1/job` | Listar el catálogo de trabajos |
| `GET` | `v2/job-management/schedules` | Listar programaciones de un rango de fechas |
| `POST` | `v2/job-management/schedules` | Crear una programación |
| `PATCH` | `v2/job-management/schedules/{id}` | Cambiar la fecha, la hora o el comentario |
| `DELETE` | `v2/job-management/schedules/{id}` | Eliminar una programación |
| `PUT` | `v2/job-management/schedules/{id}/employees` | Reemplazar los empleados asignados |
| `GET` | `v2/job-management/absences` | Listar ausencias de un rango de fechas |
| `POST` | `v2/job-management/absences` | Crear una ausencia y retirar al empleado de sus programaciones de ese día |
| `DELETE` | `v2/job-management/absences/{id}` | Eliminar una ausencia |

### `GET v1/employee`

Lista los empleados, ordenados por `firstName` y después por `lastName`.

**Parámetros de consulta**

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `status` | No | `Active` o `Terminated`. Si viene, solo se devuelven los empleados con ese estado. Sin él se devuelven **todos**. |

El frontend pide la lista sin filtro y filtra él mismo, para poder mostrar el nombre de un empleado inactivo que sigue asignado a una programación.

**Validaciones**

- `422` si `status` viene con un valor distinto de `Active` o `Terminated`, por ejemplo `?status=otro`.

**Ejemplo de petición**

```http
GET v1/employee?status=Active
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  { "employeesId": 3, "legalName": "Ana López", "employeeNumber": "E-003", "firstName": "Ana", "lastName": "López", "status": "Active", "title": "Labor", "user": "alopez" },
  { "employeesId": 5, "legalName": "Luis Martínez", "employeeNumber": "E-005", "firstName": "Luis", "lastName": "Martínez", "status": "Active", "title": "Supervisor", "user": "lmartinez" }
]
```

Sin `status`, la respuesta incluiría también a los inactivos, por ejemplo `{ "employeesId": 9, …, "status": "Terminated" }`.

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Siempre que la petición sea válida. Una lista vacía también es `200`. |
| `422` | `status` tiene un valor desconocido. |

### `GET v1/job`

Devuelve el catálogo completo de trabajos, **sin parámetros**. El `status` del trabajo no filtra la lista: un trabajo terminado también se devuelve. La búsqueda por número o nombre y el orden los aplica el frontend.

**Ejemplo de petición**

```http
GET v1/job
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  { "jobsId": 7, "number": "J-1024", "type": "Interior", "name": "Pintar oficina", "address": "Calle Mayor 12", "contractor": "Construcciones Pérez", "contact": "Laura Pérez", "status": "Open", "user": "admin" }
]
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Siempre. Un catálogo vacío devuelve `[]`. |

### `GET v2/job-management/schedules`

Lista las programaciones con fecha entre `from` y `to`, **ambos incluidos**, ordenadas por `date`, después por `startTime` y después por `jobSchedulesId`.

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
GET v2/job-management/schedules?from=2026-11-01&to=2026-11-07
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "jobSchedulesId": 101,
    "jobsId": 7,
    "date": "2026-11-02",
    "startTime": "08:00",
    "employeesIds": [3, 5],
    "scheduleComment": null
  }
]
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Rango válido. Una semana sin programaciones devuelve `[]`. |
| `422` | Alguna de las validaciones anteriores falla. |

### `POST v2/job-management/schedules`

Crea una programación.

**Cuerpo**

| Campo | Obligatorio | Descripción |
|---|---|---|
| `jobsId` | Sí | Id de un trabajo existente del catálogo. |
| `date` | Sí | `YYYY-MM-DD`. |
| `startTime` | Sí | `HH:mm` en 24 horas. El frontend siempre la envía: calcula él la hora por defecto. |
| `employeesIds` | No | Lista de ids de empleados. Si no viene, la programación se crea sin empleados (`[]`). Los ids repetidos se ignoran, igual que en `PUT`: la respuesta no trae repetidos. |
| `scheduleComment` | No | Texto libre. Si no viene, o viene `null`, vacío o solo con espacios, se guarda `null`. |

**Validaciones** (todas responden `422`, y en ese caso **no se crea nada**)

- El trabajo `jobsId` no existe.
- Falta `date` o no es una fecha válida.
- Falta `startTime` o no es una hora `HH:mm` válida. Una hora con segundos, como `"08:00:00"`, también se rechaza.
- Algún id de `employeesIds` no existe o corresponde a un empleado con `status` `Terminated`.
- Algún id de `employeesIds` corresponde a un empleado con una **ausencia en `date`**.

**No** hay restricción de unicidad por trabajo y día: si ya existe una programación del trabajo 7 el 2026-11-02, crear otra igual (con la misma u otra hora) es válido y responde `201`. Ese día quedan dos programaciones del trabajo 7.

**Ejemplo de petición**

```http
POST v2/job-management/schedules
Content-Type: application/json

{ "jobsId": 7, "date": "2026-11-02", "startTime": "07:00", "scheduleComment": "Llevar escalera" }
```

**Ejemplo de respuesta**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "jobSchedulesId": 101,
  "jobsId": 7,
  "date": "2026-11-02",
  "startTime": "07:00",
  "employeesIds": [],
  "scheduleComment": "Llevar escalera"
}
```

Ejemplo de rechazo, con el empleado 9 inactivo:

```http
POST v2/job-management/schedules
Content-Type: application/json

{ "jobsId": 7, "date": "2026-11-02", "startTime": "08:00", "employeesIds": [3, 9] }
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

### `PATCH v2/job-management/schedules/{id}`

Cambia la fecha, la hora de inicio, el comentario o cualquier combinación de ellos. Se usa para mover una programación a otro día, cambiar su hora o editar su comentario.

**Cuerpo**

| Campo | Obligatorio | Descripción |
|---|---|---|
| `date` | No | Nueva fecha, `YYYY-MM-DD`. |
| `startTime` | No | Nueva hora, `HH:mm`. |
| `scheduleComment` | No | Nuevo comentario. `null`, vacío o solo con espacios lo borra (se guarda `null`). |

Se envía al menos uno de los tres. Solo se actualizan los campos enviados; el resto queda igual. **Los empleados asignados se conservan.**

**Validaciones**

- `404` si no existe la programación `{id}` o si `{id}` no es numérico.
- `422` si el cuerpo no trae ni `date`, ni `startTime`, ni `scheduleComment`.
- `422` si `date` o `startTime` vienen con un valor inválido. Una hora con segundos, como `"08:00:00"`, es inválida.
- `422` si viene `date` y **algún empleado asignado tiene una ausencia en esa fecha**. La programación no se mueve.

**Ejemplo de petición**

Con la programación 101 del 2026-11-02 a las 08:00 y los empleados 3 y 5:

```http
PATCH v2/job-management/schedules/101
Content-Type: application/json

{ "date": "2026-11-04" }
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jobSchedulesId": 101,
  "jobsId": 7,
  "date": "2026-11-04",
  "startTime": "08:00",
  "employeesIds": [3, 5],
  "scheduleComment": null
}
```

Ejemplo de rechazo, con el empleado 3 ausente el 2026-11-03:

```http
PATCH v2/job-management/schedules/101
Content-Type: application/json

{ "date": "2026-11-03" }
```

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{ "error": "El empleado 3 está ausente el 2026-11-03" }
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Actualizada. El cuerpo es la programación con los cambios. |
| `404` | La programación no existe o el id no es numérico. |
| `422` | No viene ningún campo, algún valor es inválido o algún empleado asignado está ausente en la nueva fecha. |

### `DELETE v2/job-management/schedules/{id}`

Elimina la programación y **todas sus asignaciones de empleados** (en el esquema lo hace `ON DELETE CASCADE`).

**El trabajo del catálogo no se ve afectado:** la fila de `jobs` sigue existiendo y se puede volver a programar. Tampoco se toca ningún empleado.

**Ejemplo de petición**

```http
DELETE v2/job-management/schedules/101
```

**Ejemplo de respuesta**

```http
HTTP/1.1 204 No Content
```

Sin cuerpo. Después, la programación 101 ya no aparece en `GET v2/job-management/schedules`, y el trabajo 7 sigue en `GET v1/job`.

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `204` | Eliminada. Sin cuerpo. |
| `404` | La programación no existe o el id no es numérico. |

### `PUT v2/job-management/schedules/{id}/employees`

Reemplaza el **conjunto completo** de empleados asignados a la programación. No añade ni quita uno a uno: el resultado es exactamente la lista enviada.

El frontend usa este único endpoint para añadir o quitar un empleado al arrastrar, para la lista de casillas del teléfono y para deshacer. Mover un empleado de una programación a otra son dos `PUT`.

**Cuerpo**

| Campo | Obligatorio | Descripción |
|---|---|---|
| `employeesIds` | Sí | Lista de ids de empleados. Los ids repetidos se ignoran: se guarda cada empleado una sola vez. Una lista vacía, `{"employeesIds": []}`, es válida: deja la programación sin empleados y responde `200`. Así se retira al último empleado. |

**Reglas sobre empleados inactivos**

- **Conservar un inactivo ya asignado es válido.** Si el empleado 9 está asignado a la programación 101 y después pasó a `Terminated`, enviar `{"employeesIds": [9, 3]}` responde `200` y lo mantiene asignado.
- **Agregar un inactivo nuevo se rechaza.** Si el empleado 9 es `Terminated` y **no** está asignado a la programación 101, enviar `{"employeesIds": [9]}` responde `422` y la asignación **no cambia**.

**Regla sobre empleados ausentes**

- Si algún empleado de la lista tiene una ausencia en la fecha de la programación, la respuesta es `422` y la asignación **no cambia**. Para asignarlo hay que eliminar antes la ausencia.

**Validaciones**

- `404` si no existe la programación `{id}` o si `{id}` no es numérico (regla general de "Errores").
- `422` si algún id no existe.
- `422` si incluye un empleado inactivo que no estaba ya asignado.
- `422` si incluye un empleado ausente en la fecha de la programación.

Si la respuesta es `422`, no se aplica ningún cambio.

**Ejemplo de petición**

Con la programación 101 asignada a los empleados 3 y 5:

```http
PUT v2/job-management/schedules/101/employees
Content-Type: application/json

{ "employeesIds": [5, 8] }
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jobSchedulesId": 101,
  "jobsId": 7,
  "date": "2026-11-02",
  "startTime": "08:00",
  "employeesIds": [5, 8],
  "scheduleComment": null
}
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Reemplazado. El cuerpo es la programación con su nuevo conjunto de empleados, que puede quedar vacío. |
| `404` | La programación no existe o el id no es numérico. |
| `422` | Algún id no existe, se agrega un empleado inactivo que no estaba asignado o se incluye un empleado ausente ese día. |

### `GET v2/job-management/absences`

Lista las ausencias con fecha entre `from` y `to`, **ambos incluidos**, ordenadas por `date` y después por `employeeAbsencesId`.

**Parámetros de consulta**

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `from` | Sí | Primer día, `YYYY-MM-DD`. |
| `to` | Sí | Último día, `YYYY-MM-DD`. |

El frontend pide la misma semana de domingo a sábado que para las programaciones.

**Validaciones** (todas responden `422`)

- Falta `from` o `to`.
- `from` o `to` no es una fecha válida.
- `from` es posterior a `to`.

**Ejemplo de petición**

```http
GET v2/job-management/absences?from=2026-11-01&to=2026-11-07
```

**Ejemplo de respuesta**

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "employeeAbsencesId": 41,
    "employeesId": 3,
    "date": "2026-11-03",
    "absenceType": "Vacation",
    "absenceComment": "Viaje familiar"
  }
]
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `200` | Rango válido. Una semana sin ausencias devuelve `[]`. |
| `422` | Alguna de las validaciones anteriores falla. |

### `POST v2/job-management/absences`

Crea una ausencia y, **en la misma transacción**, retira al empleado de todas las programaciones de esa fecha. Si cualquier paso falla, no se guarda nada: ni la ausencia ni la retirada.

En el esquema, esto es insertar en `employee_absences` y borrar de `job_schedule_employees` las filas de ese empleado cuyas programaciones tienen `scheduled_date` igual a `date`.

**Cuerpo**

| Campo | Obligatorio | Descripción |
|---|---|---|
| `employeesId` | Sí | Id de un empleado existente y activo. |
| `date` | Sí | `YYYY-MM-DD`. |
| `absenceType` | Sí | `Off`, `Vacation`, `Sick` u `Other`. |
| `absenceComment` | No | Texto libre. Si no viene, o viene `null`, vacío o solo con espacios, se guarda `null`. |

**Respuesta**

Un objeto con dos campos:

| Campo | Tipo | Notas |
|---|---|---|
| `absence` | objeto `Absence` | La ausencia creada. |
| `updatedSchedules` | lista de `Schedule` | Cada programación de la que se retiró al empleado, ya sin él. Lista vacía si ese día no tenía ninguna. El frontend la usa para actualizar el tablero sin volver a pedir la semana. |

**Validaciones** (todas responden `422`, y en ese caso **no se crea la ausencia ni cambia ninguna programación**)

- El empleado `employeesId` no existe o tiene `status` `Terminated`.
- Falta `date` o no es una fecha válida.
- Falta `absenceType` o no es uno de los cuatro valores.
- El empleado ya tiene una ausencia en `date`. Hay como máximo una ausencia por empleado y día (en el esquema, `UNIQUE (employees_id, absence_date)`).

**Ejemplo de petición**

Con el empleado 3 asignado a las programaciones 101 y 102 del 2026-11-02, y a la 103 del 2026-11-03:

```http
POST v2/job-management/absences
Content-Type: application/json

{ "employeesId": 3, "date": "2026-11-02", "absenceType": "Off" }
```

**Ejemplo de respuesta**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "absence": {
    "employeeAbsencesId": 42,
    "employeesId": 3,
    "date": "2026-11-02",
    "absenceType": "Off",
    "absenceComment": null
  },
  "updatedSchedules": [
    { "jobSchedulesId": 101, "jobsId": 7, "date": "2026-11-02", "startTime": "08:00", "employeesIds": [5], "scheduleComment": null },
    { "jobSchedulesId": 102, "jobsId": 12, "date": "2026-11-02", "startTime": "10:00", "employeesIds": [], "scheduleComment": null }
  ]
}
```

La programación 103 del 2026-11-03 no cambia y no aparece en `updatedSchedules`.

Ejemplo de rechazo, con el empleado 3 ya ausente ese día:

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{ "error": "El empleado 3 ya está ausente el 2026-11-02" }
```

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `201` | Creada. El cuerpo es `{absence, updatedSchedules}`. |
| `422` | Alguna de las validaciones anteriores falla. |

### `DELETE v2/job-management/absences/{id}`

Elimina la ausencia. **No vuelve a asignar** al empleado a ninguna programación: si se le quiere asignar, se hace después con `PUT v2/job-management/schedules/{id}/employees`.

**Ejemplo de petición**

```http
DELETE v2/job-management/absences/41
```

**Ejemplo de respuesta**

```http
HTTP/1.1 204 No Content
```

Sin cuerpo. Después, la ausencia 41 ya no aparece en `GET v2/job-management/absences`.

**Códigos de estado**

| Código | Cuándo |
|---|---|
| `204` | Eliminada. Sin cuerpo. |
| `404` | La ausencia no existe o el id no es numérico. |

## Conexión con el frontend

El frontend arranca con datos de prueba (`VITE_USE_MOCKS=true`). Para usar el backend real, en el `.env` de la raíz del repositorio (o en `.env.local`):

```dotenv
VITE_USE_MOCKS=false
VITE_API_URL=https://backend.ejemplo.com/api
```

El frontend llama a `VITE_API_URL` seguida de la ruta (ver "Rutas"). Si `VITE_API_URL` está vacía, las llamadas van al mismo origen que el frontend.

### Autenticación

Cada petición lleva la cabecera `Authorization: Bearer <token>`. Si el backend responde `401`, el frontend intenta una vez renovar el token con `POST auth/refresh` (`{ "refreshToken": "…" }`, que responde `{ "token": "…", "refreshToken": "…" }`) y repite la petición; si no lo consigue, manda al usuario al login. El frontend también usa `GET auth/me` para leer el usuario. Estos endpoints no forman parte de este contrato.

### CORS

Si el backend está en un origen distinto al del frontend (otro dominio o puerto), debe habilitar CORS para el origen del frontend:

- Métodos: `GET`, `POST`, `PATCH`, `PUT`, `DELETE` y `OPTIONS` (las peticiones `PATCH`, `PUT` y `DELETE`, las que envían JSON y las que llevan `Authorization` provocan una petición previa `OPTIONS`).
- Cabeceras permitidas: `Content-Type` y `Authorization`.

### Proxy de Vite en desarrollo

En desarrollo se puede evitar CORS con el proxy del servidor de Vite: se deja `VITE_API_URL` vacía y se añade en `vite.config.ts` una regla por cada prefijo, que reenvíe al backend con el prefijo que este espere:

```ts
export default defineConfig({
  // …
  server: {
    proxy: {
      '/v1': { target: 'http://localhost:8000/api', changeOrigin: true },
      '/v2': { target: 'http://localhost:8000/api', changeOrigin: true },
      '/auth': { target: 'http://localhost:8000/api', changeOrigin: true },
    },
  },
})
```

Cambia `http://localhost:8000/api` por la dirección del backend, con su prefijo. El proxy solo existe en `npm run dev`: el build estático de producción necesita CORS o servirse en el mismo origen que el backend.

### Esquema de base de datos

El DDL de las tres tablas nuevas, `job_schedules`, `job_schedule_employees` y `employee_absences`, está en [`docs/schema.sql`](./schema.sql). Antes de aplicarlo, comprueba con `SHOW CREATE TABLE jobs` y `SHOW CREATE TABLE employees` que `jobs_id` y `employees_id` son `INT`; si no, ajusta las columnas de clave foránea, porque MySQL exige el mismo tipo exacto. El mismo archivo indica cómo revertirlo.

## Casos límite

Reglas decididas para casos que los specs no detallan. Ya están reflejadas en cada endpoint:

1. **Orden de `employeesIds` en la respuesta:** no está garantizado; el frontend no depende del orden.
2. **`PUT v2/job-management/schedules/{id}/employees` con `{"employeesIds": []}`:** es válido, deja la programación sin empleados y responde `200`. Así se retira al último empleado.
3. **`PATCH v2/job-management/schedules/{id}` sin `date`, `startTime` ni `scheduleComment`:** `422`.
4. **Ids repetidos en `employeesIds` de `POST v2/job-management/schedules`:** se ignoran, igual que en `PUT`. La respuesta no trae repetidos.
5. **Hora con segundos en una petición** (`"08:00:00"` en `POST` o `PATCH`): `422`, porque el contrato exige `HH:mm`.
6. **`status` desconocido en `GET v1/employee`** (por ejemplo `?status=otro`): `422`.
7. **Id no numérico en la ruta** (por ejemplo `v2/job-management/schedules/abc` o `v2/job-management/absences/abc`): `404`.
8. **Ausencia de un empleado con varios trabajos ese día:** se le retira de todos ellos y todos aparecen en `updatedSchedules`. Sus programaciones de otros días no cambian.
9. **Ausencia de un empleado sin trabajos ese día:** válida; `updatedSchedules` va vacío.
10. **Eliminar una ausencia:** no reasigna nada. El frontend, al deshacer una ausencia, elimina la ausencia y **después** envía un `PUT` por cada programación de la que salió el empleado; en ese orden, el `PUT` ya no choca con la ausencia.
11. **Mover una programación a un día en que un asignado está ausente:** `422` y la programación no se mueve. No se retira al ausente automáticamente.
