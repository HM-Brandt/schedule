# Spec Delta

## ADDED Requirements

### Requirement: Representación de una ausencia
Toda respuesta que devuelva una ausencia SHALL usar la forma `{employeeAbsencesId, employeesId, date, absenceType, absenceComment}`. `absenceType` es `Off`, `Vacation`, `Sick` u `Other`. `absenceComment` es el comentario, o `null` si no hay. `date` sigue el formato de fechas del contrato. El frontend SHALL ignorar los campos adicionales que envíe el backend.

#### Scenario: Ausencia con comentario
- **WHEN** se consulta la ausencia de vacaciones del empleado 3 el 2026-11-03 con el comentario "Viaje familiar"
- **THEN** su representación es `{"employeeAbsencesId": 41, "employeesId": 3, "date": "2026-11-03", "absenceType": "Vacation", "absenceComment": "Viaje familiar"}`

### Requirement: Listar ausencias de un rango de fechas
`GET v2/job-management/absences?from=YYYY-MM-DD&to=YYYY-MM-DD` SHALL devolver las ausencias con fecha entre `from` y `to`, ambos incluidos, ordenadas por `date` y `employeeAbsencesId`. Si falta algún parámetro, no es una fecha válida o `from` es posterior a `to`, SHALL responder 422.

#### Scenario: Semana completa
- **WHEN** se envía `GET v2/job-management/absences?from=2026-11-01&to=2026-11-07`
- **THEN** la respuesta es 200 con todas las ausencias del 1 al 7 de noviembre de 2026, incluidas las del día 7

#### Scenario: Rango invertido
- **WHEN** se envía `GET v2/job-management/absences?from=2026-11-07&to=2026-11-01`
- **THEN** la respuesta es 422

### Requirement: Crear una ausencia
`POST v2/job-management/absences` con `{employeesId, date, absenceType, absenceComment}` SHALL crear la ausencia y, en la misma transacción, retirar al empleado de todas las programaciones de esa fecha. SHALL responder 201 con `{absence, updatedSchedules}`: la ausencia creada y la representación actualizada de cada programación de la que se retiró al empleado (lista vacía si no había ninguna). `absenceComment` es opcional; si es `null`, vacío o solo espacios, SHALL guardarse como `null`.

#### Scenario: Ausencia de un empleado con dos trabajos ese día
- **WHEN** el empleado 3 está en las programaciones 101 y 102 del 2026-11-02 y se envía `{"employeesId": 3, "date": "2026-11-02", "absenceType": "Off"}`
- **THEN** la respuesta es 201 con la ausencia, `absenceComment` `null` y `updatedSchedules` con las programaciones 101 y 102 sin el empleado 3

#### Scenario: Ausencia sin trabajos ese día
- **WHEN** el empleado 5 no tiene programaciones el 2026-11-04 y se envía `{"employeesId": 5, "date": "2026-11-04", "absenceType": "Sick", "absenceComment": "Gripe"}`
- **THEN** la respuesta es 201 con la ausencia y `updatedSchedules` vacío

### Requirement: Validación al crear una ausencia
`POST v2/job-management/absences` SHALL responder 422 sin crear la ausencia ni cambiar ninguna programación si el empleado no existe o tiene `status` `Terminated`, si falta o es inválida la fecha, si `absenceType` no es uno de los cuatro valores, o si el empleado ya tiene una ausencia en esa fecha.

#### Scenario: Ya ausente ese día
- **WHEN** el empleado 3 ya tiene una ausencia el 2026-11-02 y se envía otra para el empleado 3 el 2026-11-02
- **THEN** la respuesta es 422 y sigue habiendo una sola ausencia del empleado 3 ese día

#### Scenario: Tipo inválido
- **WHEN** se envía `{"employeesId": 3, "date": "2026-11-02", "absenceType": "Holiday"}`
- **THEN** la respuesta es 422 y las asignaciones del empleado 3 no cambian

### Requirement: Eliminar una ausencia
`DELETE v2/job-management/absences/{id}` SHALL eliminar la ausencia y responder 204 sin cuerpo. SHALL NOT cambiar ninguna programación. SHALL responder 404 si no existe.

#### Scenario: Eliminación
- **WHEN** se envía `DELETE v2/job-management/absences/41`
- **THEN** la respuesta es 204 y la ausencia 41 ya no aparece en `GET v2/job-management/absences`

#### Scenario: Ausencia inexistente
- **WHEN** se envía `DELETE v2/job-management/absences/99999` y no existe esa ausencia
- **THEN** la respuesta es 404 con un cuerpo `{"error": "..."}`

### Requirement: Empleados ausentes al crear una programación o reemplazar sus empleados
`POST v2/job-management/schedules` y `PUT v2/job-management/schedules/{id}/employees` SHALL responder 422, sin cambios, si `employeesIds` incluye un empleado con una ausencia en la fecha de la programación.

#### Scenario: Asignar a un ausente
- **WHEN** el empleado 3 tiene una ausencia el 2026-11-02, la programación 101 es del 2026-11-02 y se envía `PUT v2/job-management/schedules/101/employees` con `{"employeesIds": [3]}`
- **THEN** la respuesta es 422 y los empleados de la programación 101 no cambian

#### Scenario: Crear con un ausente
- **WHEN** el empleado 3 tiene una ausencia el 2026-11-02 y se envía `POST v2/job-management/schedules` con `{"jobsId": 7, "date": "2026-11-02", "startTime": "07:00", "employeesIds": [3]}`
- **THEN** la respuesta es 422 y no se crea la programación

### Requirement: Mover una programación a un día con empleados ausentes
`PATCH v2/job-management/schedules/{id}` con un `date` nuevo SHALL responder 422, sin cambios, si algún empleado asignado a la programación tiene una ausencia en esa fecha.

#### Scenario: Mover con un ausente
- **WHEN** la programación 101 del 2026-11-02 tiene al empleado 3, que está ausente el 2026-11-03, y se envía `PATCH v2/job-management/schedules/101` con `{"date": "2026-11-03"}`
- **THEN** la respuesta es 422 y la programación 101 sigue el 2026-11-02 con el empleado 3

### Requirement: Persistencia de ausencias
Las ausencias SHALL guardarse en una tabla nueva que admita como máximo una ausencia por empleado y fecha. SHALL NOT modificarse la estructura de las tablas existentes `jobs`, `employees`, `job_schedules` y `job_schedule_employees`.

#### Scenario: Instalación del esquema
- **WHEN** se aplica el esquema de este cambio en la base de datos MySQL
- **THEN** existe la tabla de ausencias y las columnas de las tablas existentes quedan igual que antes
