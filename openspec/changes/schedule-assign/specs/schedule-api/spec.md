# Spec Delta

## Purpose

Contrato HTTP en JSON entre el tablero semanal y el backend: consulta de empleados y del catálogo de trabajos, y gestión de trabajos programados y de sus empleados asignados, respaldado por MySQL sin alterar las tablas existentes.

## ADDED Requirements

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
- **WHEN** se envía `PATCH /api/schedules/99999` y no existe esa programación
- **THEN** la respuesta es 404 con un cuerpo `{"error": "..."}`

### Requirement: Listar empleados
`GET /api/employees` SHALL devolver una lista de objetos `{id, first_name, last_name, title, status}`, donde `status` es `activo` o `inactivo`, ordenada por `first_name` y `last_name`. El parámetro opcional `status` SHALL filtrar por ese valor; sin él se devuelven todos.

#### Scenario: Solo activos
- **WHEN** se envía `GET /api/employees?status=activo`
- **THEN** la respuesta es 200 con solo los empleados cuyo `status` es `activo`

#### Scenario: Todos
- **WHEN** se envía `GET /api/employees`
- **THEN** la respuesta es 200 con empleados activos e inactivos

### Requirement: Listar y buscar trabajos
`GET /api/jobs` SHALL devolver una lista de objetos `{id, number, name}` ordenada por `number`. El parámetro opcional `search` SHALL filtrar los trabajos cuyo `number` o `name` contenga ese texto, sin distinguir mayúsculas de minúsculas.

#### Scenario: Búsqueda por nombre
- **WHEN** se envía `GET /api/jobs?search=pintar`
- **THEN** la respuesta es 200 con los trabajos cuyo número o nombre contiene "pintar", incluido "Pintar oficina"

### Requirement: Representación de una programación
Toda respuesta que devuelva una programación SHALL usar la forma `{id, job: {id, number, name}, date, start_time, employee_ids}`, donde `employee_ids` es la lista de ids de empleados asignados, sin repetidos.

#### Scenario: Programación con dos empleados
- **WHEN** se consulta una programación del trabajo 7 el 2026-11-02 a las 08:00 con los empleados 3 y 5
- **THEN** su representación es `{"id": 101, "job": {"id": 7, "number": "J-1024", "name": "Pintar oficina"}, "date": "2026-11-02", "start_time": "08:00", "employee_ids": [3, 5]}`

### Requirement: Listar programaciones de un rango de fechas
`GET /api/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD` SHALL devolver las programaciones con fecha entre `from` y `to`, ambos incluidos, ordenadas por fecha, hora de inicio e id. Si falta algún parámetro, no es una fecha válida o `from` es posterior a `to`, SHALL responder 422.

#### Scenario: Semana completa
- **WHEN** se envía `GET /api/schedules?from=2026-11-01&to=2026-11-07`
- **THEN** la respuesta es 200 con todas las programaciones del 1 al 7 de noviembre de 2026, incluidas las del día 7

#### Scenario: Rango invertido
- **WHEN** se envía `GET /api/schedules?from=2026-11-07&to=2026-11-01`
- **THEN** la respuesta es 422

### Requirement: Crear una programación
`POST /api/schedules` con `{job_id, date, start_time, employee_ids}` SHALL crear una programación y responder 201 con su representación. `employee_ids` es opcional y vacío por defecto. SHALL responder 422 si el trabajo no existe, si falta o es inválida la fecha o la hora, o si algún empleado no existe o está inactivo.

#### Scenario: Creación válida
- **WHEN** se envía `POST /api/schedules` con `{"job_id": 7, "date": "2026-11-02", "start_time": "07:00"}`
- **THEN** la respuesta es 201 con la nueva programación y `employee_ids` vacío

#### Scenario: Mismo trabajo y día repetidos
- **WHEN** ya existe una programación del trabajo 7 el 2026-11-02 y se crea otra igual con `start_time` "08:00"
- **THEN** la respuesta es 201 y ese día quedan dos programaciones del trabajo 7

#### Scenario: Empleado inactivo
- **WHEN** se envía `POST /api/schedules` con un empleado cuyo `status` es `inactivo` en `employee_ids`
- **THEN** la respuesta es 422 y no se crea la programación

### Requirement: Actualizar fecha u hora de una programación
`PATCH /api/schedules/{id}` SHALL aceptar `date`, `start_time` o ambos, actualizar solo los campos enviados y responder 200 con la representación actualizada. SHALL conservar los empleados asignados. SHALL responder 404 si no existe y 422 si algún valor es inválido.

#### Scenario: Mover a otro día
- **WHEN** se envía `PATCH /api/schedules/101` con `{"date": "2026-11-04"}`
- **THEN** la respuesta es 200 con `date` "2026-11-04", la misma `start_time` y los mismos `employee_ids`

### Requirement: Eliminar una programación
`DELETE /api/schedules/{id}` SHALL eliminar la programación y todas sus asignaciones de empleados y responder 204 sin cuerpo. El trabajo del catálogo SHALL NOT verse afectado. SHALL responder 404 si no existe.

#### Scenario: Eliminación
- **WHEN** se envía `DELETE /api/schedules/101`
- **THEN** la respuesta es 204 y la programación 101 ya no aparece en `GET /api/schedules`

### Requirement: Reemplazar los empleados de una programación
`PUT /api/schedules/{id}/employees` con `{employee_ids}` SHALL reemplazar el conjunto completo de empleados asignados, ignorando ids repetidos, y responder 200 con la representación actualizada. SHALL responder 422 si algún id no existe o si incluye un empleado inactivo que no estaba ya asignado.

#### Scenario: Reemplazo
- **WHEN** la programación 101 tiene los empleados 3 y 5 y se envía `{"employee_ids": [5, 8]}`
- **THEN** la respuesta es 200 con `employee_ids` [5, 8]

#### Scenario: Conservar un inactivo ya asignado
- **WHEN** el empleado 9 está asignado a la programación 101, ahora está inactivo, y se envía `{"employee_ids": [9, 3]}`
- **THEN** la respuesta es 200 con `employee_ids` [9, 3]

#### Scenario: Agregar un inactivo
- **WHEN** el empleado 9 está inactivo, no está asignado a la programación 101, y se envía `{"employee_ids": [9]}`
- **THEN** la respuesta es 422 y la asignación no cambia

### Requirement: Tablas existentes sin cambios
La persistencia de programaciones y asignaciones SHALL usar tablas nuevas y SHALL NOT modificar la estructura de las tablas existentes `jobs` y `employees`.

#### Scenario: Instalación del esquema
- **WHEN** se aplica el esquema de este cambio en la base de datos MySQL
- **THEN** las columnas de `jobs` (id, number, name) y de `employees` (id, first_name, last_name, title, status) quedan igual que antes
