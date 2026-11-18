# Spec Delta

## Purpose

Asignación de empleados activos a los trabajos programados del tablero semanal, por arrastre en escritorio y por lista de selección en teléfono, permitiendo que un empleado tenga varios trabajos el mismo día.

## ADDED Requirements

### Requirement: Panel de empleados activos
El sistema SHALL mostrar un panel con los empleados activos (`status` `Active`) cuyo `title` es "Supervisor" o "Labor", sin distinguir mayúsculas de minúsculas ni espacios al principio o al final. Cada uno SHALL mostrarse con sus iniciales, su nombre completo (`firstName` y `lastName`) y su `title`. Los empleados inactivos (`status` `Terminated`) y los de cualquier otro cargo SHALL NOT aparecer en el panel. El panel SHALL ordenar primero a los "Supervisor" y después a los "Labor", y dentro de cada cargo por `firstName` y `lastName`. La lista de asignación del teléfono SHALL usar los mismos empleados y el mismo orden.

#### Scenario: Empleado inactivo
- **WHEN** existen Ana (activo) y Pedro (inactivo)
- **THEN** el panel muestra a Ana y no muestra a Pedro

#### Scenario: Cargo fuera del panel
- **WHEN** existen Ana (activo, "Labor") y Marta (activo, "Office")
- **THEN** el panel muestra a Ana y no muestra a Marta

#### Scenario: Orden por cargo y nombre
- **WHEN** existen Ana ("Labor"), Bruno ("Supervisor") y Carla ("Labor"), todos activos
- **THEN** el panel los muestra en el orden Bruno, Ana, Carla

### Requirement: Asignar un empleado arrastrándolo
El sistema SHALL asignar un empleado a una programación cuando la persona lo arrastra desde el panel y lo suelta sobre la tarjeta de esa programación. Mientras se arrastra, las tarjetas de la vista SHALL resaltarse como destinos válidos.

#### Scenario: Asignar a Ana
- **WHEN** la persona arrastra a Ana desde el panel y la suelta sobre "J-1024 Pintar oficina" del lunes
- **THEN** la tarjeta muestra a Ana entre sus empleados

### Requirement: Sin asignaciones repetidas en una programación
Un empleado SHALL aparecer como máximo una vez en una misma programación. Soltar un empleado sobre una programación donde ya está asignado SHALL NOT producir cambios.

#### Scenario: Soltar a Ana dos veces
- **WHEN** Ana ya está en "J-1024 Pintar oficina" del lunes y la persona la vuelve a soltar sobre esa tarjeta
- **THEN** la tarjeta sigue mostrando a Ana una sola vez

### Requirement: Varios trabajos por empleado en el mismo día
El sistema SHALL permitir asignar un mismo empleado a dos o más programaciones del mismo día sin bloquearlo ni pedir confirmación. Al asignar, el sistema SHALL mostrar como dato informativo cuántas programaciones tiene ya ese empleado ese día.

#### Scenario: Ana en dos trabajos el lunes
- **WHEN** Ana está en "J-1024 Pintar oficina" del lunes y la persona la suelta sobre "J-1031 Jardín Pérez" del lunes
- **THEN** Ana queda asignada a ambas programaciones del lunes

#### Scenario: Indicador de carga al arrastrar
- **WHEN** la persona arrastra a Ana, que tiene dos programaciones el lunes y ninguna el martes
- **THEN** el lunes indica que Ana tiene 2 programaciones y el martes no muestra indicador para Ana

### Requirement: Mover un empleado entre programaciones
El sistema SHALL permitir arrastrar un empleado desde la tarjeta de una programación y soltarlo sobre otra. El empleado SHALL quedar retirado de la primera y asignado a la segunda.

#### Scenario: Mover a Luis
- **WHEN** la persona arrastra a Luis desde "J-1024 Pintar oficina" del lunes y lo suelta sobre "J-1040 Mudanza López" del miércoles
- **THEN** Luis deja de aparecer en "J-1024 Pintar oficina" y aparece en "J-1040 Mudanza López"

### Requirement: Retirar un empleado de una programación
El sistema SHALL permitir retirar un empleado de una programación arrastrándolo fuera de cualquier tarjeta o mediante una acción de quitar sobre su indicador en la tarjeta o en el detalle.

#### Scenario: Arrastrar fuera
- **WHEN** la persona arrastra a Ana desde una tarjeta y la suelta fuera de cualquier tarjeta
- **THEN** Ana deja de estar asignada a esa programación

### Requirement: Asignación por lista en teléfono
En teléfono, cada tarjeta SHALL mostrar una acción "+" que abre un panel inferior con la lista de empleados activos y una casilla por empleado. Marcar o desmarcar una casilla SHALL asignar o retirar a ese empleado de la programación. Junto a cada empleado SHALL indicarse cuántas programaciones tiene ese día.

#### Scenario: Marcar dos empleados
- **WHEN** en un teléfono la persona toca "+" en "J-1024 Pintar oficina" y marca a Ana y a Luis
- **THEN** la tarjeta muestra a Ana y a Luis

#### Scenario: Desmarcar
- **WHEN** en el panel inferior la persona desmarca a Ana
- **THEN** Ana deja de estar asignada a esa programación

### Requirement: Empleados en la tarjeta
Cada tarjeta SHALL mostrar los empleados asignados con sus iniciales, y el nombre completo al pasar el puntero o en el detalle. Si hay más empleados de los que caben, SHALL mostrar los primeros y un indicador "+N" con el resto. Una tarjeta sin empleados SHALL indicarlo visualmente.

#### Scenario: Muchos empleados
- **WHEN** una programación tiene seis empleados y la tarjeta tiene espacio para cuatro
- **THEN** la tarjeta muestra cuatro iniciales y el indicador "+2"

### Requirement: Empleados que pasan a inactivos
Si un empleado asignado a una programación pasa a inactivo (`status` `Terminated`), la programación SHALL seguir mostrándolo, marcado como inactivo, hasta que se le retire. Un empleado inactivo SHALL NOT poder asignarse a nuevas programaciones.

#### Scenario: Asignación previa a la baja
- **WHEN** Pedro estaba asignado a una programación del martes y luego pasó a inactivo
- **THEN** la tarjeta del martes sigue mostrando a Pedro marcado como inactivo y Pedro no aparece en el panel de empleados

### Requirement: Días con trabajo en la semana visible
Cada empleado del panel, y de la lista de casillas del teléfono, SHALL mostrar siete recuadros, de domingo a sábado, para la semana visible. Un recuadro SHALL mostrarse vacío si el empleado no tiene programaciones ese día, con un tono claro si tiene una y con un tono fuerte si tiene dos o más. El recuadro del día actual SHALL distinguirse con un borde. Cada fila SHALL tener un texto accesible con los días asignados y su número de programaciones, por ejemplo "Assigned: Mon (1), Tue (2)". Los recuadros SHALL actualizarse al asignar, retirar, mover o quitar programaciones y al cambiar de semana.

#### Scenario: Juan asignado lunes y martes
- **WHEN** Juan tiene una programación el lunes y otra el martes de la semana visible
- **THEN** su fila en el panel muestra pintados los recuadros del lunes y del martes con tono claro y vacíos los demás

#### Scenario: Dos trabajos el mismo día
- **WHEN** Ana tiene dos programaciones el lunes de la semana visible
- **THEN** el recuadro del lunes de Ana se muestra con tono fuerte

#### Scenario: Cambio de semana
- **WHEN** la persona pasa a una semana en la que Juan no tiene programaciones
- **THEN** los siete recuadros de Juan se muestran vacíos

#### Scenario: Asignar actualiza los recuadros
- **WHEN** Juan no tiene programaciones el jueves y la persona lo asigna a una programación del jueves
- **THEN** el recuadro del jueves de Juan pasa a mostrarse pintado
