# Tasks

## 1. Esquema y contrato

- [x] 1.1 Añadir a `docs/schema.sql` la tabla `employee_absences` de `design.md` (decisión 1) y verificar con `docs/test/verify-schema.ps1` que el DDL se ejecuta y rechaza dos ausencias del mismo empleado el mismo día
- [x] 1.2 Definir los tipos `Absence`, `AbsenceType`, `CreateAbsenceBody` y `CreateAbsenceResponse` según `specs/schedule-api/spec.md`, y verificar que `tsc --noEmit` pasa
- [x] 1.3 Añadir al cliente HTTP `getAbsences(from, to)`, `createAbsence(body)` y `deleteAbsence(id)` (con normalización de la ausencia y de `updatedSchedules`), y verificar con tests que cada función llama a la ruta y método correctos y lanza un error tipado ante 4xx
- [x] 1.4 Actualizar `docs/api.md` con los endpoints de ausencias y las validaciones nuevas de schedules (lo redacta Carlos)

## 2. Datos de prueba (MSW)

- [x] 2.1 Implementar los manejadores de `GET`, `POST` y `DELETE` de `v2/job-management/absences` (desasignación en la misma operación, validaciones 404/422) y verificar con tests en `msw/node` cada escenario de ausencias de `specs/schedule-api/spec.md`
- [x] 2.2 Añadir la validación de ausentes a `POST`, `PATCH` y `PUT .../employees` de schedules y verificar con tests en `msw/node` los escenarios "Asignar a un ausente", "Crear con un ausente" y "Mover con un ausente"
- [x] 2.3 Añadir a la semilla una ausencia en la semana actual de un empleado sin trabajos ese día, y verificar con el test de la semilla que ninguna ausencia choca con una asignación

## 3. Datos del servidor y reglas

- [x] 3.1 Añadir la consulta `['absences', from, to]` y verificar con tests que cambiar de semana pide el nuevo rango
- [x] 3.2 Generalizar el optimismo y la reversión a varias claves, e implementar `useCreateAbsence` (ausencia temporal más retirada del empleado de las programaciones del día) y `useDeleteAbsence`; verificar con tests que ante un error simulado las dos cachés vuelven al estado anterior y se emite el mensaje de error
- [x] 3.3 Implementar el selector `absenceLookup` y verificar con tests que devuelve la ausencia de un empleado en una fecha y nada en otra

## 4. Arrastre y diálogo

- [ ] 4.1 Añadir a `resolveDrop` el destino `absences`, el elemento `absence` y las acciones `mark-absent`, `remove-absence` y `blocked-move` de `design.md` (decisión 5), y verificar con tests de la resolución cada fila de la tabla y que `ACCEPTS` tiene cuatro destinos
- [ ] 4.2 Construir `AbsenceDialog` (tipo con `Off` por defecto, comentario, "Save" y "Cancel") y verificar con tests los escenarios de "Diálogo de ausencia"
- [ ] 4.3 Construir `AbsenceZone` y `AbsenceChip`, mostrarlos al pie de `DayColumn` y abrir el diálogo al soltar un empleado; verificar con tests los escenarios de "Zona de ausencias por día", "Marcar una ausencia arrastrando", "Una ausencia por empleado y día" y "Quitar una ausencia"
- [ ] 4.4 Apagar el resaltado y bloquear el soltar de un ausente en las tarjetas de su día, y verificar con tests el escenario de "Empleados ausentes no asignables"
- [ ] 4.5 Bloquear el movimiento de una tarjeta, por arrastre o con "Move to…", a un día con algún asignado ausente, mostrando un mensaje que lo nombra, y verificar con tests el escenario de "Mover una programación a un día con empleados ausentes"

## 5. Acciones y deshacer

- [ ] 5.1 Añadir `markAbsent` y `removeAbsence` a las acciones del tablero, con sus inversas (`DELETE` y después los `PUT` en una sola entrada; `POST` con reasignación de id), y verificar con tests los escenarios de "Deshacer ausencias" y de "Desasignación al marcar una ausencia"
- [ ] 5.2 Filtrar a los ausentes del día de destino al duplicar y verificar con tests el escenario "Duplicar con Luis ausente el viernes"

## 6. Panel y teléfono

- [ ] 6.1 Mostrar en `WeekLoad` el nivel `absent` con su texto accesible, y verificar con tests los escenarios de "Días de ausencia en los recuadros del empleado"
- [ ] 6.2 Mostrar "Absent" en el indicador del día al arrastrar a un empleado ausente, y verificar con tests el escenario de "Indicador de ausencia al arrastrar"
- [ ] 6.3 Deshabilitar en `AssignSheet` a los ausentes del día con su tipo, y verificar con tests el escenario "Ana enferma el lunes"

## 7. Integración

- [ ] 7.1 Recorrer con datos de prueba a 1280, 800 y 390 px el flujo completo (marcar con el diálogo, ver la desasignación, intentar asignar a un ausente, mover y duplicar con ausentes, quitar la ausencia y deshacer cada paso), y verificar que se cumplen los escenarios de `specs/`
- [ ] 7.2 Añadir un test e2e del camino feliz (arrastrar a Ana a "Absences" del lunes, elegir "Vacation", guardar y ver que sale de sus trabajos del lunes y aparece en la zona) y verificar que `npx playwright test` pasa
- [ ] 7.3 Ejecutar `npm test`, `npm run test:tz`, `tsc --noEmit` y `npm run build` y verificar que terminan sin errores

## Workflow follow-up

- Archivar `schedule-assign` antes que este cambio, porque los deltas de `employee-assignment`, `schedule-api` y `weekly-schedule-board` añaden requisitos a sus capacidades.
- Cuando el backend implemente los endpoints de ausencias, probar con `VITE_USE_MOCKS=false` marcar una ausencia de un empleado con dos trabajos ese día.
- Archivar el cambio cuando la revisión esté completa.
