# Spec Delta

## ADDED Requirements

### Requirement: Días de ausencia en los recuadros del empleado
En los siete recuadros de cada empleado, en el panel y en la lista de casillas del teléfono, un día en que el empleado está ausente SHALL mostrarse con un estilo propio, distinto de los de vacío, tono claro y tono fuerte. El texto accesible de la fila SHALL incluir los días ausentes con su tipo, por ejemplo "Absent: Tue (Vacation)". Los recuadros SHALL actualizarse al marcar o quitar una ausencia.

#### Scenario: Juan de vacaciones el martes
- **WHEN** Juan tiene una programación el lunes y una ausencia `Vacation` el martes de la semana visible
- **THEN** su recuadro del lunes se muestra con tono claro, el del martes con el estilo de ausencia, y el texto accesible de su fila incluye "Absent: Tue (Vacation)"

#### Scenario: Marcar actualiza los recuadros
- **WHEN** Juan tiene una programación el jueves y se guarda una ausencia de Juan el jueves
- **THEN** el recuadro del jueves de Juan pasa al estilo de ausencia

### Requirement: Indicador de ausencia al arrastrar
Mientras se arrastra a un empleado, un día en que ese empleado está ausente SHALL indicar "Absent" en lugar del número de programaciones que tiene ese día.

#### Scenario: Arrastrar a Ana, ausente el miércoles
- **WHEN** la persona arrastra a Ana, que tiene una programación el lunes y está ausente el miércoles
- **THEN** el lunes indica que Ana tiene 1 programación y el miércoles indica "Absent"

### Requirement: Empleados ausentes en la lista del teléfono
En la lista de casillas del teléfono para una programación, un empleado ausente el día de esa programación SHALL mostrarse deshabilitado, sin poder marcarse, y con el tipo de su ausencia.

#### Scenario: Ana enferma el lunes
- **WHEN** Ana tiene una ausencia `Sick` el lunes y la persona toca "+" en "J-1024 Pintar oficina" del lunes
- **THEN** la lista muestra a Ana deshabilitada con el tipo "Sick" y no se puede marcar
