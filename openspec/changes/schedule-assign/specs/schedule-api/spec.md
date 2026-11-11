# Spec Delta

## Purpose

Contrato HTTP en JSON entre el tablero semanal y el backend: consulta de empleados y del catálogo de trabajos, y gestión de trabajos programados, de sus empleados asignados y de su comentario, respaldado por MySQL sin alterar las tablas existentes. Los nombres de los campos JSON siguen la convención del backend: camelCase, con los ids como `<entidad>Id`.

## ADDED Requirements

### Requirement: Rutas relativas a la URL base
Todas las rutas del contrato (`v1/employee`, `v1/job`, `v1/schedules` y sus subrutas) SHALL ser relativas a la URL base del backend, configurada en `VITE_API_URL`. La URL completa de cada petición SHALL ser la URL base seguida de la ruta, con una sola `/` entre ambas.

#### Scenario: URL base con prefijo
- **WHEN** `VITE_API_URL` es `https://api.ejemplo.com/api/` y se pide la programación 101
- **THEN** la petición va a `https://api.ejemplo.com/api/v1/schedules/101`

#### Scenario: URL base vacía
- **WHEN** `VITE_API_URL` está vacía y se listan los empleados
- **THEN** la petición va a `/v1/employee` en el mismo origen de la página

### Requirement: Formato de fechas y horas
Toda fecha del contrato SHALL viajar como texto `YYYY-MM-DD` y toda hora de inicio como texto `HH:mm` en formato de 24 horas. El backend SHALL NOT aplicar conversiones de zona horaria: la fecha y la hora que se guardan son exactamente las recibidas.

#### Scenario: Hora devuelta sin segundos
- **WHEN** una programación se guardó con hora de inicio "08:00"
- **THEN** el backend la devuelve como "08:00" y no como "08:00:00"

#### Scenario: Fecha sin desplazamiento
- **WHEN** se crea una programación con fecha "2026-11-02"
- **THEN** al consultarla desde cualquier zona horaria su fecha es "2026-11-02"

### Requirement: Formato de errores
Ante una petición inválida el backend SHALL responder 422 con un cuerpo `{"error": "<mensaje>"}`, y ante un recurso inexistente SHALL responder 404 con el mismo formato.

#### Scenario: Programación inexistente
- **WHEN** se envía `PATCH v1/schedules/99999` y no existe esa programación
- **THEN** la respuesta es 404 con un cuerpo `{"error": "..."}`

### Requirement: Listar empleados
`GET v1/employee` SHALL devolver una lista de objetos `{employeesId, legalName, employeeNumber, firstName, lastName, status, title, user}`, donde `status` es `Active` o `Terminated`, ordenada por `firstName` y `lastName`. El parámetro opcional `status` SHALL filtrar por ese valor; sin él se devuelven todos. Un empleado es activo si su `status` es `Active` e inactivo si es `Terminated`.

#### Scenario: Solo activos
- **WHEN** se envía `GET v1/employee?status=Active`
- **THEN** la respuesta es 200 con solo los empleados cuyo `status` es `Active`

#### Scenario: Todos
- **WHEN** se envía `GET v1/employee`
- **THEN** la respuesta es 200 con empleados `Active` y `Terminated`

### Requirement: Listar y buscar trabajos
`GET v1/job` SHALL devolver una lista de objetos `{jobsId, number, type, name, address, contractor, contact, status, user}` ordenada por `number`. El `status` del trabajo SHALL NOT filtrar la lista: se devuelven todos los trabajos. El parámetro opcional `search` SHALL filtrar los trabajos cuyo `number` o `name` contenga ese texto, sin distinguir mayúsculas de minúsculas.

#### Scenario: Búsqueda por nombre
- **WHEN** se envía `GET v1/job?search=pintar`
- **THEN** la respuesta es 200 con los trabajos cuyo número o nombre contiene "pintar", incluido "Pintar oficina"

#### Scenario: Trabajos terminados incluidos
- **WHEN** existe un trabajo con `status` "Done" y se envía `GET v1/job`
- **THEN** la respuesta incluye ese trabajo

### Requirement: Representación de una programación
Toda respuesta que devuelva una programación SHALL usar la forma `{jobSchedulesId, job, date, startTime, employeesIds, scheduleComment}`, donde `job` es el mismo objeto que devuelve `GET v1/job`, `employeesIds` es la lista de ids de empleados asignados, sin repetidos, y `scheduleComment` es el comentario de la programación o `null` si no tiene.

#### Scenario: Programación con dos empleados
- **WHEN** se consulta una programación del trabajo 7 el 2026-11-02 a las 08:00 con los empleados 3 y 5 y sin comentario
- **THEN** su representación es `{"jobSchedulesId": 101, "job": {"jobsId": 7, "number": "J-1024", "type": "Interior", "name": "Pintar oficina", "address": "...", "contractor": "...", "contact": "...", "status": "Open", "user": "..."}, "date": "2026-11-02", "startTime": "08:00", "employeesIds": [3, 5], "scheduleComment": null}`

### Requirement: Listar programaciones de un rango de fechas
`GET v1/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD` SHALL devolver las programaciones con fecha entre `from` y `to`, ambos incluidos, ordenadas por `date`, `startTime` y `jobSchedulesId`. Si falta algún parámetro, no es una fecha válida o `from` es posterior a `to`, SHALL responder 422.

#### Scenario: Semana completa
- **WHEN** se envía `GET v1/schedules?from=2026-11-01&to=2026-11-07`
- **THEN** la respuesta es 200 con todas las programaciones del 1 al 7 de noviembre de 2026, incluidas las del día 7

#### Scenario: Rango invertido
- **WHEN** se envía `GET v1/schedules?from=2026-11-07&to=2026-11-01`
- **THEN** la respuesta es 422

### Requirement: Crear una programación
`POST v1/schedules` con `{jobsId, date, startTime, employeesIds, scheduleComment}` SHALL crear una programación y responder 201 con su representación. `employeesIds` es opcional y vacío por defecto. `scheduleComment` es opcional y `null` por defecto. SHALL responder 422 si el trabajo no existe, si falta o es inválida la fecha o la hora, o si algún empleado no existe o tiene `status` `Terminated`.

#### Scenario: Creación válida
- **WHEN** se envía `POST v1/schedules` con `{"jobsId": 7, "date": "2026-11-02", "startTime": "07:00"}`
- **THEN** la respuesta es 201 con la nueva programación, `employeesIds` vacío y `scheduleComment` `null`

#### Scenario: Creación con comentario
- **WHEN** se envía `POST v1/schedules` con `{"jobsId": 7, "date": "2026-11-02", "startTime": "07:00", "scheduleComment": "Llevar escalera"}`
- **THEN** la respuesta es 201 con `scheduleComment` "Llevar escalera"

#### Scenario: Mismo trabajo y día repetidos
- **WHEN** ya existe una programación del trabajo 7 el 2026-11-02 y se crea otra igual con `startTime` "08:00"
- **THEN** la respuesta es 201 y ese día quedan dos programaciones del trabajo 7

#### Scenario: Empleado inactivo
- **WHEN** se envía `POST v1/schedules` con un empleado cuyo `status` es `Terminated` en `employeesIds`
- **THEN** la respuesta es 422 y no se crea la programación

### Requirement: Actualizar fecha, hora o comentario de una programación
`PATCH v1/schedules/{id}` SHALL aceptar cualquier combinación de `date`, `startTime` y `scheduleComment`, actualizar solo los campos enviados y responder 200 con la representación actualizada. SHALL conservar los empleados asignados. Un `scheduleComment` `null`, vacío o compuesto solo por espacios SHALL guardarse como `null`. SHALL responder 404 si no existe y 422 si algún valor es inválido.

#### Scenario: Mover a otro día
- **WHEN** se envía `PATCH v1/schedules/101` con `{"date": "2026-11-04"}`
- **THEN** la respuesta es 200 con `date` "2026-11-04", la misma `startTime`, los mismos `employeesIds` y el mismo `scheduleComment`

#### Scenario: Cambiar el comentario
- **WHEN** se envía `PATCH v1/schedules/101` con `{"scheduleComment": "Entrar por la puerta trasera"}`
- **THEN** la respuesta es 200 con ese `scheduleComment` y la misma `date` y `startTime`

#### Scenario: Borrar el comentario
- **WHEN** la programación 101 tiene comentario y se envía `PATCH v1/schedules/101` con `{"scheduleComment": "  "}`
- **THEN** la respuesta es 200 con `scheduleComment` `null`

### Requirement: Eliminar una programación
`DELETE v1/schedules/{id}` SHALL eliminar la programación y todas sus asignaciones de empleados y responder 204 sin cuerpo. El trabajo del catálogo SHALL NOT verse afectado. SHALL responder 404 si no existe.

#### Scenario: Eliminación
- **WHEN** se envía `DELETE v1/schedules/101`
- **THEN** la respuesta es 204 y la programación 101 ya no aparece en `GET v1/schedules`

### Requirement: Reemplazar los empleados de una programación
`PUT v1/schedules/{id}/employees` con `{employeesIds}` SHALL reemplazar el conjunto completo de empleados asignados, ignorando ids repetidos, y responder 200 con la representación actualizada. SHALL responder 422 si algún id no existe o si incluye un empleado con `status` `Terminated` que no estaba ya asignado.

#### Scenario: Reemplazo
- **WHEN** la programación 101 tiene los empleados 3 y 5 y se envía `{"employeesIds": [5, 8]}`
- **THEN** la respuesta es 200 con `employeesIds` [5, 8]

#### Scenario: Conservar un inactivo ya asignado
- **WHEN** el empleado 9 está asignado a la programación 101, ahora tiene `status` `Terminated`, y se envía `{"employeesIds": [9, 3]}`
- **THEN** la respuesta es 200 con `employeesIds` [9, 3]

#### Scenario: Agregar un inactivo
- **WHEN** el empleado 9 tiene `status` `Terminated`, no está asignado a la programación 101, y se envía `{"employeesIds": [9]}`
- **THEN** la respuesta es 422 y la asignación no cambia

### Requirement: Tablas existentes sin cambios
La persistencia de programaciones y asignaciones SHALL usar tablas nuevas y SHALL NOT modificar la estructura de las tablas existentes `jobs` y `employees`.

#### Scenario: Instalación del esquema
- **WHEN** se aplica el esquema de este cambio en la base de datos MySQL
- **THEN** las columnas de `jobs` y de `employees` quedan igual que antes
