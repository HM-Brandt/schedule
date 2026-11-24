# Spec Delta

## Purpose

Registro de ausencias de empleados por día en el tablero semanal (libre, vacaciones, enfermedad u otra), para que quien planifica vea quién no está disponible y el empleado ausente quede fuera de los trabajos de ese día.

## ADDED Requirements

### Requirement: Zona de ausencias por día
Cada día del tablero SHALL mostrar al pie una zona "Absences" con los empleados ausentes ese día, en todas las disposiciones (escritorio, tablet y teléfono). Cada ausencia SHALL mostrarse con el nombre del empleado y su tipo. Si tiene comentario, SHALL verse al pasar el puntero. Una zona sin ausencias SHALL indicarlo visualmente. La zona SHALL distinguirse a simple vista del resto del día con un acento rojo, y una zona con ausencias SHALL distinguirse de una vacía. El nombre y el tipo SHALL quedar dentro de la zona en cualquier ancho de pantalla.

#### Scenario: Ana de vacaciones el lunes
- **WHEN** Ana tiene una ausencia `Vacation` el lunes de la semana visible
- **THEN** la zona "Absences" del lunes muestra a Ana con el tipo "Vacation" y las demás zonas no la muestran

#### Scenario: Cambio de semana
- **WHEN** la persona pasa a una semana en la que no hay ausencias
- **THEN** las siete zonas "Absences" se muestran vacías

### Requirement: Marcar una ausencia arrastrando
El sistema SHALL permitir arrastrar un empleado activo, desde el panel o desde una tarjeta, y soltarlo en la zona "Absences" de un día. Mientras se arrastra un empleado, las zonas "Absences" SHALL resaltarse como destinos válidos. Soltar al empleado SHALL abrir el diálogo de ausencia para ese empleado y ese día, sin guardar nada todavía.

#### Scenario: Soltar a Ana en Absences del martes
- **WHEN** la persona arrastra a Ana desde el panel y la suelta en la zona "Absences" del martes
- **THEN** se abre el diálogo de ausencia de Ana para el martes y aún no se guarda ninguna ausencia

#### Scenario: Soltar desde una tarjeta
- **WHEN** la persona arrastra a Luis desde "J-1024 Pintar oficina" del lunes y lo suelta en la zona "Absences" del lunes
- **THEN** se abre el diálogo de ausencia de Luis para el lunes

### Requirement: Diálogo de ausencia
El diálogo SHALL mostrar el nombre del empleado y el día, un selector de tipo con las opciones `Off`, `Vacation`, `Sick` y `Other` (`Off` seleccionado por defecto), un campo de comentario opcional y las acciones "Save" y "Cancel". "Save" SHALL guardar la ausencia con el tipo y el comentario elegidos. "Cancel" SHALL cerrar el diálogo sin cambios.

#### Scenario: Guardar con tipo y comentario
- **WHEN** en el diálogo de Ana para el martes la persona elige "Vacation", escribe "Viaje familiar" y pulsa "Save"
- **THEN** la zona "Absences" del martes muestra a Ana con el tipo "Vacation" y el comentario "Viaje familiar"

#### Scenario: Cancelar
- **WHEN** la persona pulsa "Cancel" en el diálogo de Ana para el martes
- **THEN** no se crea ninguna ausencia y las asignaciones de Ana no cambian

### Requirement: Desasignación al marcar una ausencia
Al guardar una ausencia, el empleado SHALL dejar de estar asignado a todas las programaciones de ese día. Las programaciones de otros días SHALL NOT cambiar.

#### Scenario: Ana en dos trabajos el lunes
- **WHEN** Ana está en "J-1024 Pintar oficina" y en "J-1031 Jardín Pérez" del lunes y en "J-1040 Mudanza López" del martes, y se guarda una ausencia de Ana el lunes
- **THEN** Ana deja de aparecer en las dos tarjetas del lunes y sigue en "J-1040 Mudanza López" del martes

### Requirement: Una ausencia por empleado y día
Un empleado SHALL tener como máximo una ausencia por día. Soltar en la zona "Absences" de un día a un empleado que ya está ausente ese día SHALL NOT abrir el diálogo ni producir cambios.

#### Scenario: Soltar dos veces
- **WHEN** Ana ya está ausente el lunes y la persona la vuelve a soltar en la zona "Absences" del lunes
- **THEN** no se abre el diálogo y la zona sigue mostrando a Ana una sola vez

### Requirement: Quitar una ausencia
El sistema SHALL permitir quitar una ausencia arrastrándola desde la zona "Absences" y soltándola fuera de esa zona. Al quitarla, el empleado SHALL NOT volver a asignarse a ninguna programación.

#### Scenario: Arrastrar fuera
- **WHEN** Ana está ausente el lunes y la persona arrastra su ausencia fuera de la zona "Absences"
- **THEN** la zona del lunes deja de mostrar a Ana y Ana no aparece en ninguna tarjeta del lunes

### Requirement: Empleados ausentes no asignables
El sistema SHALL NOT asignar a un empleado a una programación de un día en que está ausente. Mientras se arrastra a ese empleado, las tarjetas de ese día SHALL NOT resaltarse como destino, y soltarlo sobre una de ellas SHALL NOT producir cambios. Al soltarlo sobre una de ellas, la zona "Absences" de ese día SHALL desplazarse a la vista si no se ve y SHALL parpadear en rojo claro como aviso de que el empleado está ausente.

#### Scenario: Arrastrar a una ausente a una tarjeta de su día
- **WHEN** Ana está ausente el lunes y la persona la arrastra sobre "J-1024 Pintar oficina" del lunes
- **THEN** la tarjeta no se resalta y, al soltar, Ana no queda asignada

#### Scenario: Aviso en la zona con la zona fuera de la vista
- **WHEN** en el teléfono el lunes tiene tantas programaciones que la zona "Absences" quedó fuera de la vista, Ana está ausente el lunes y la persona la suelta sobre una tarjeta del lunes
- **THEN** la página se desplaza hasta mostrar la zona "Absences" del lunes, la zona parpadea en rojo claro y Ana no queda asignada

#### Scenario: Otro día sí se puede
- **WHEN** Ana está ausente el lunes y la persona la suelta sobre "J-1040 Mudanza López" del martes
- **THEN** Ana queda asignada a "J-1040 Mudanza López"

### Requirement: Deshacer ausencias
Marcar y quitar una ausencia SHALL poder deshacerse con el aviso "Undo" y con el atajo de deshacer, como el resto de acciones del tablero. Deshacer una ausencia marcada SHALL quitarla y devolver al empleado a las programaciones de las que salió al marcarla. Deshacer una ausencia quitada SHALL volver a crearla con el mismo tipo y comentario.

#### Scenario: Deshacer una ausencia marcada
- **WHEN** Ana estaba en "J-1024 Pintar oficina" del lunes, se guarda una ausencia de Ana el lunes y la persona pulsa "Undo"
- **THEN** la zona del lunes deja de mostrar a Ana y Ana vuelve a aparecer en "J-1024 Pintar oficina"

#### Scenario: Deshacer una ausencia quitada
- **WHEN** la persona quita la ausencia `Sick` de Luis del miércoles, con comentario "Gripe", y pulsa Ctrl+Z
- **THEN** la zona del miércoles vuelve a mostrar a Luis con el tipo "Sick" y el comentario "Gripe"

### Requirement: Respuesta inmediata y error al guardar ausencias
Al marcar o quitar una ausencia, el sistema SHALL reflejar el cambio en pantalla de inmediato, incluida la retirada del empleado de las programaciones del día. Si el servidor rechaza el cambio o no responde, SHALL revertir la zona de ausencias y las programaciones a su estado anterior y mostrar un mensaje de error.

#### Scenario: Fallo al marcar
- **WHEN** se guarda una ausencia de Ana el lunes, que estaba en "J-1024 Pintar oficina", y el servidor responde con un error
- **THEN** la zona del lunes no muestra a Ana, Ana vuelve a aparecer en "J-1024 Pintar oficina" y se muestra un mensaje de error que empieza por "Couldn't save the change."
