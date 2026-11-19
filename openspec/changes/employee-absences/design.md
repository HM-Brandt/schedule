# Design

## Context

- El tablero, la asignación y el contrato vienen del cambio `schedule-assign`. Su `design.md` sigue vigente: datos del servidor en TanStack Query, arrastre con `@dnd-kit/react`, deshacer con operaciones inversas y mocks MSW con el mismo contrato.
- Para desasignar, hoy el frontend solo dispone de `PUT .../schedules/{id}/employees` con el conjunto completo, uno por programación (`useScheduleActions.transferEmployee` ya combina dos `PUT` en una sola entrada de deshacer).
- `resolveDrop` (`src/dnd/dropResolution.ts`) decide la acción solo con los datos del elemento arrastrado y del destino. `ACCEPTS` define tres destinos: `day`, `schedule-card` y `catalog`.
- `employeeDayCounts` (`src/lib/selectors.ts`) alimenta `WeekLoad` y el indicador "N jobs" de `DayColumn` y `AssignSheet`.
- `employees.employees_id` es `INT` con signo. Las tablas existentes no se tocan.
- El backend lo implementa Carlos. Los requisitos están en `specs/`; este documento no los repite.

## Goals / Non-Goals

**Goals:**
- Que marcar una ausencia sea una sola operación atómica en el servidor, sin estados intermedios.
- Reutilizar los patrones existentes (caché por semana, optimismo con reversión, pila de inversas, resaltado de destinos) sin introducir otros nuevos.

**Non-Goals:**
- Editar el tipo o el comentario de una ausencia ya creada: se quita y se vuelve a marcar.
- Conciliar ausencias creadas en otra pestaña o por otra vía. El servidor rechaza lo inconsistente con 422 y el frontend lo muestra con el manejo de errores actual.

## Decisions

### 1. Tabla `employee_absences`, una fila por empleado y día

```sql
CREATE TABLE employee_absences (
  employee_absences_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employees_id         INT          NOT NULL,        -- mismo tipo EXACTO que employees.employees_id
  absence_date         DATE         NOT NULL,
  absence_type         ENUM('Off','Vacation','Sick','Other') NOT NULL,
  absence_comment      TEXT         NULL,
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_absences_id),
  UNIQUE KEY uq_employee_absences_day (employees_id, absence_date),
  KEY idx_employee_absences_date (absence_date),
  CONSTRAINT fk_employee_absences_employee FOREIGN KEY (employees_id) REFERENCES employees (employees_id)
);
```

- **El `UNIQUE (employees_id, absence_date)`** garantiza una ausencia por empleado y día. El índice por `absence_date` cubre la consulta por semana.
- **`ENUM`** para el tipo: son cuatro valores cerrados y el contrato los valida igual.
- **Alternativa descartada:** rangos `from`/`to` en una fila. Complica la consulta por semana, la unicidad y la desasignación, y quedó fuera de alcance.
- **Alternativa descartada:** marcar la ausencia en `job_schedule_employees`. Un empleado ausente sin trabajos ese día no tendría fila.

### 2. El backend desasigna en la misma transacción que crea la ausencia

`POST v2/job-management/absences` inserta la ausencia, borra las filas de `job_schedule_employees` de ese empleado cuyas programaciones tienen esa `scheduled_date`, y devuelve `{absence, updatedSchedules}`.

- **Por qué en el backend** (decisión de Carlos): una sola petición, sin estados a medias (ausencia guardada pero el empleado sigue asignado) y con mejor rendimiento que N `PUT`.
- **`updatedSchedules` en la respuesta**: el frontend corrige su caché con la verdad del servidor sin volver a pedir la semana, y la inversa para deshacer queda clara.
- **Alternativa descartada:** `POST` de la ausencia más un `PUT` por programación desde el frontend. No es atómico y duplica la regla en dos sitios.

### 3. Validación de ausentes en los endpoints de programaciones

- `POST schedules` y `PUT .../employees`: 422 si se añade a un ausente en la fecha.
- `PATCH` con `date` nuevo: 422 si algún asignado está ausente en esa fecha (decisión de Carlos: rechazar el movimiento en lugar de quitar al ausente).
- El frontend comprueba lo mismo antes de enviar, para dar una respuesta inmediata y un mensaje que nombre al empleado. El 422 del servidor es la red de seguridad.

### 4. Datos del servidor en el frontend

- Clave nueva `['absences', from, to]` y `useWeekAbsences(from, to)`, paralela a `useWeekSchedules`.
- `useCreateAbsence` es optimista sobre dos cachés:
  - Añade la ausencia con id temporal negativo (`nextTempId`) a `['absences']`.
  - Quita al empleado de las programaciones de esa fecha en `['schedules']` con `putSchedule`.
  - Con la respuesta, reemplaza la ausencia temporal y aplica `updatedSchedules`.
  - Si falla, restaura las dos instantáneas.
  - `startOptimistic` y `rollbackAndRefetch` se generalizan a una lista de claves en lugar de solo `['schedules']`.
- `useDeleteAbsence` es optimista sobre `['absences']`.
- Selector `absenceLookup(absences)`: un `Map<employeesId, Map<date, Absence>>` que usan `resolveDrop`, `DayColumn`, `WeekLoad`, `AssignSheet` y las acciones de mover y duplicar.

### 5. Arrastre

| Elemento | Destino | Acción |
|---|---|---|
| `employee` (panel o tarjeta) | `absences` de un día sin ausencia suya | `mark-absent` (abre el diálogo) |
| `employee` | `absences` de un día con ausencia suya | `none` |
| `employee` | `schedule-card` de un día en que está ausente | `none` |
| `absence` | soltado fuera de cualquier zona `absences` | `remove-absence` |
| `absence` | una zona `absences` | `none` |
| `schedule-card` | `day` donde algún asignado está ausente | `blocked-move` (mensaje de error, sin petición) |

- Destino nuevo `{kind:'absences', date}` con id `absences-${date}`. En `ACCEPTS`, `absences` acepta `employee` y `absence`.
- Elemento arrastrable nuevo `{kind:'absence', employeeAbsencesId, employeeId, date}` con id `absence-${id}`. Solo lo aceptan las zonas `absences` (decisión de Carlos): `@dnd-kit` ignora los destinos que no aceptan el elemento, así que sin esto el destino sería siempre `null` y soltar una ausencia dentro de su zona la quitaría. Las zonas no se resaltan al arrastrar una ausencia.
- `resolveDrop` recibe el `absenceLookup` como argumento, igual que ya recibe las programaciones.
- El resaltado de tarjetas (`useAcceptsDrag`) se apaga en las tarjetas de un día en que el empleado arrastrado está ausente.
- `mark-absent` no guarda: `ScheduleDndProvider` guarda `{employeeId, date}` pendiente y muestra `AbsenceDialog`. "Save" llama a `actions.markAbsent`; "Cancel" descarta.
- **Alternativa descartada:** guardar al soltar con un tipo por defecto y editar después. Carlos prefiere elegir el tipo al soltar.

### 6. Deshacer

| Acción | Inversa |
|---|---|
| Marcar ausencia (`POST absences`) | `DELETE` de la ausencia y, después, `PUT` de cada programación de `updatedSchedules` con su conjunto anterior, como una sola entrada |
| Quitar ausencia (`DELETE absences`) | `POST` con el mismo `employeesId`, `date`, `absenceType` y `absenceComment` |

- **El orden importa:** los `PUT` van después del `DELETE`, porque con la ausencia aún guardada el servidor los rechaza con 422.
- Deshacer un "quitar ausencia" crea una ausencia con id nuevo. Se reemplaza el id viejo en la pila, igual que con las programaciones.
- Duplicar filtra a los ausentes del día de destino, en el mismo punto donde hoy filtra a los inactivos.
- Como la pila es LIFO y las ausencias solo cambian desde el tablero, una ausencia siempre se deshace antes que las acciones anteriores a ella. No hace falta filtrar ausentes al deshacer.

### 7. Componentes

- `src/absences/AbsenceZone`: zona droppable al pie de `DayColumn`, compartida por las tres disposiciones.
- `src/absences/AbsenceChip`: ausencia arrastrable. Queda desactivada mientras tiene id temporal, como las tarjetas.
- `src/absences/AbsenceDialog`: diálogo modal de tipo (radio) y comentario.
- Cambios en `DayColumn` (zona e indicador "Absent"), `WeekLoad` (nivel `absent` y texto accesible) y `AssignSheet` (ausentes deshabilitados).

### 8. Mocks

- Base en memoria con ausencias. Manejadores para `GET`, `POST` y `DELETE` de `absences` con la misma transacción y las mismas validaciones.
- Validación de ausentes en `POST`, `PATCH` y `PUT` de schedules.
- La semilla incluye una ausencia en la semana actual de un empleado sin trabajos ese día, y ninguna que choque con las asignaciones semilla.

## Risks / Trade-offs

- **[Ausencias creadas en otra pestaña]** → El servidor rechaza con 422 y se muestra el mensaje. Al volver a enfocar la pestaña, TanStack Query vuelve a pedir los datos.
- **[El diálogo interrumpe el arrastre continuo]** → Es la decisión de Carlos: el tipo correcto pesa más que un clic. El diálogo arranca con `Off` seleccionado para que baste con pulsar "Save".
- **[Más altura por día en la columna]** → La zona es compacta y, si está vacía, se reduce a una línea.
- **[Conflictos con `feature/employees-hours`]** → Toca `EmployeePanel`, `EmployeeItem` y `schedule-api`. Fusionar una de las dos ramas antes de empezar la otra, o resolver a mano.
- **[Orden de archivado]** → Estos deltas añaden requisitos a capacidades de `schedule-assign`, que aún no está archivado. Hay que archivar `schedule-assign` antes que este cambio.

## Migration Plan

1. Aplicar el DDL de `employee_absences`.
2. Desarrollar y probar con `VITE_USE_MOCKS=true`.
3. El backend implementa los endpoints de ausencias y las validaciones nuevas de schedules; se prueba con `VITE_USE_MOCKS=false`.
4. **Vuelta atrás:** retirar el frontend y, si se desea, ejecutar `DROP TABLE employee_absences;`. Ninguna tabla existente cambia.
