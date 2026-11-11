# Proposal

## Why

Hoy la planificación semanal de trabajos y de qué empleados van a cada uno no tiene una herramienta visual: existen las tablas `jobs` (clave `jobs_id`) y `employees` (clave `employees_id`) en MySQL, pero no hay forma de programar un trabajo en un día ni de relacionarlo con empleados. Se necesita un tablero semanal (domingo a sábado) con arrastrar y soltar, minimalista y usable en teléfono, tablet y escritorio, que una sola persona use para planificar.

## What Changes

- Nueva aplicación frontend en React que muestra una semana de domingo a sábado, con un catálogo de trabajos y un panel de empleados activos.
- Programar trabajos en días arrastrándolos desde el catálogo; mover, duplicar y quitar trabajos programados; deshacer la última acción.
- Un mismo trabajo puede programarse varias veces, el mismo día o en días distintos. En el catálogo nunca desaparece: se muestra tenue con un contador cuando ya está programado en la semana visible.
- Cada trabajo programado tiene solo hora de inicio (nunca hora de fin). Por defecto 07:00; si el mismo trabajo ya está ese día, la siguiente hora después de la más alta de ese trabajo en ese día (tope 23:00).
- Asignar empleados activos a trabajos programados (arrastrando en escritorio, con lista de casillas en teléfono). Un empleado puede estar en dos o más trabajos el mismo día sin restricción.
- Cada empleado del panel muestra siete recuadros (domingo a sábado) con los días de la semana visible en los que ya tiene trabajo.
- Cada trabajo programado puede llevar un comentario de texto libre, editable desde su detalle.
- Todos los textos de la interfaz en inglés.
- Interfaz responsiva: semana completa en escritorio y tablet horizontal, 3-4 días desplazables en tablet vertical, un día a la vez con tira de días en teléfono.
- Contrato HTTP (7 endpoints REST) y esquema MySQL de dos tablas nuevas (`job_schedules`, `job_schedule_employees`) para que el backend se implemente por separado. Las tablas `jobs` y `employees` no se modifican.
- Mientras el backend no exista, el frontend funciona con datos de prueba que implementan exactamente el mismo contrato.

## Capabilities

### New Capabilities
- `weekly-schedule-board`: tablero semanal de domingo a sábado; navegación entre semanas; catálogo de trabajos; programar, mover, duplicar y quitar trabajos en días; hora de inicio por defecto; deshacer; comportamiento responsivo.
- `employee-assignment`: panel de empleados activos y asignación o retiro de empleados en trabajos programados, incluyendo varios trabajos por empleado en el mismo día.
- `schedule-api`: contrato HTTP que el frontend consume y que el backend debe implementar (empleados, catálogo de trabajos, trabajos programados y sus empleados), junto con el esquema de persistencia MySQL que lo respalda.

### Modified Capabilities
(ninguna: el proyecto no tiene especificaciones previas)

## Impact

- **Código nuevo**: aplicación React + Vite + TypeScript en `web/` dentro de este repositorio.
- **Dependencias nuevas**: `@dnd-kit/react` (arrastrar y soltar con soporte táctil), `@tanstack/react-query` (datos del servidor y actualizaciones optimistas), `date-fns` (cálculo de semanas y formato de fechas), `msw` (datos de prueba que interceptan las llamadas HTTP).
- **Base de datos**: dos tablas nuevas con claves foráneas hacia `jobs.jobs_id` y `employees.employees_id`; sin cambios en tablas existentes.
- **Backend**: fuera de alcance de este cambio; lo implementa el usuario siguiendo el contrato `schedule-api`.
- **Fuera de alcance**: autenticación y usuarios, edición simultánea por varias personas, vista para empleados, hora de fin o duración, trabajos que abarcan varios días, administración del catálogo de trabajos o de empleados.
