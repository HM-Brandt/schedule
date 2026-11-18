# Proposal

## Why

Hoy el tablero no puede indicar que un empleado está libre, de vacaciones o enfermo un día concreto. Quien planifica tiene que recordarlo por su cuenta, y nada impide asignar a ese empleado a un trabajo ese día. Se necesita registrar ausencias por día en el propio tablero, de forma que un empleado ausente quede fuera de los trabajos de ese día.

## What Changes

- Cada día del tablero tiene una zona "Absences" al pie, con los empleados ausentes ese día.
- Al arrastrar un empleado, desde el panel o desde una tarjeta, y soltarlo en la zona "Absences" de un día, se abre un diálogo para elegir el tipo de ausencia (`Off`, `Vacation`, `Sick` u `Other`) y escribir un comentario opcional. Al guardar, la ausencia se registra y el empleado deja de estar asignado a todas las programaciones de ese día.
- La desasignación la hace el backend en la misma operación que crea la ausencia, de forma atómica.
- Un empleado ausente un día no se puede asignar a ninguna programación de ese día: la interfaz no acepta el arrastre y el backend lo rechaza. Para asignarlo hay que quitar antes la ausencia.
- Una ausencia se quita arrastrándola fuera de la zona.
- Marcar y quitar una ausencia se pueden deshacer. Deshacer una ausencia devuelve al empleado a las programaciones de las que salió.
- Los siete recuadros de cada empleado en el panel y en la lista del teléfono distinguen los días ausentes. En la lista del teléfono, el empleado ausente ese día aparece deshabilitado.
- Duplicar una programación a otro día deja fuera a los empleados ausentes en ese día.
- Contrato HTTP: tres endpoints nuevos para ausencias (listar por rango, crear y eliminar). Las validaciones de crear programación, reemplazar empleados y mover de día pasan a tener en cuenta las ausencias.
- Esquema MySQL: una tabla nueva, `employee_absences`, con una ausencia como máximo por empleado y día. Las tablas existentes no se modifican.
- Los datos de prueba (MSW) implementan el mismo contrato e incluyen ausencias en la semilla.

## Capabilities

### New Capabilities
- `employee-absences`: registrar y quitar ausencias de empleados por día en el tablero (zona por día, diálogo de tipo y comentario, desasignación automática, bloqueo de asignación, deshacer y reflejo en los recuadros de días).

### Modified Capabilities
Las tres capacidades del cambio `schedule-assign` reciben requisitos nuevos. Ese cambio aún no está archivado, así que no existen en `openspec/specs/`. Se añaden como requisitos ADDED, y `schedule-assign` debe archivarse antes que este cambio.
- `employee-assignment`: no se puede asignar a un empleado ausente en el día de la programación; los recuadros de días y la lista del teléfono muestran las ausencias.
- `schedule-api`: endpoints de ausencias, representación de una ausencia, rechazo de empleados ausentes al crear una programación o reemplazar sus empleados, y tratamiento de ausentes al mover una programación de día.
- `weekly-schedule-board`: duplicar a un día excluye a los empleados ausentes ese día.

## Impact

- **Frontend**: tipos, cliente HTTP, consultas y mutaciones de ausencias; resolución de arrastre con un destino y un elemento arrastrable nuevos; componentes de zona, chip y diálogo de ausencia; cambios en la columna de día, los recuadros de días, la lista de asignación del teléfono y la pila de deshacer.
- **Base de datos**: tabla nueva `employee_absences` con clave foránea hacia `employees.employees_id`. Sin cambios en tablas existentes.
- **Backend**: fuera de alcance; lo implementa Carlos siguiendo el contrato `schedule-api`. `docs/api.md` lo redacta Carlos.
- **Ramas**: `feature/employees-hours`, sin fusionar, toca `EmployeePanel`, `EmployeeItem` y el spec `schedule-api`; habrá conflictos al fusionar.
- **Fuera de alcance**: ausencias de varios días o por rango de fechas, editar el tipo o el comentario de una ausencia ya creada, ausencias de empleados inactivos, reportes o historial de ausencias, aprobación de ausencias.
