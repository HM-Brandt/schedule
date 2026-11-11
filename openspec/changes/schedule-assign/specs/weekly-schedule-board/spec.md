# Spec Delta

## Purpose

Tablero semanal de domingo a sábado donde la persona que planifica programa trabajos del catálogo en días concretos, con hora de inicio, usando arrastrar y soltar en escritorio, tablet y teléfono.

## ADDED Requirements

### Requirement: Semana de domingo a sábado
El sistema SHALL mostrar una semana de siete días que empieza en domingo y termina en sábado. Cada día SHALL mostrar su nombre abreviado en inglés (Sun, Mon, Tue, Wed, Thu, Fri, Sat) y su número de día del mes. Al abrir la aplicación SHALL mostrarse la semana que contiene la fecha actual, con el día actual resaltado.

#### Scenario: Apertura en un martes
- **WHEN** la persona abre la aplicación el martes 3 de noviembre de 2026
- **THEN** el tablero muestra los días del domingo 1 al sábado 7 de noviembre de 2026
- **AND** el martes 3 aparece resaltado como día actual

#### Scenario: Encabezado de la semana
- **WHEN** se muestra la semana del 1 al 7 de noviembre de 2026
- **THEN** el encabezado indica el rango "Nov 1 - 7, 2026"

### Requirement: Idioma de la interfaz
El sistema SHALL mostrar todos los textos de la interfaz en inglés, con las fechas en formato estadounidense y las horas en formato de 24 horas. Los mensajes `{"error"}` que envía el servidor SHALL mostrarse tal como llegan.

#### Scenario: Textos en inglés
- **WHEN** se muestra el tablero
- **THEN** las acciones, etiquetas y avisos de la interfaz están en inglés

### Requirement: Navegación entre semanas
El sistema SHALL permitir ir a la semana anterior, a la semana siguiente y volver a la semana actual con una acción "Today". Al cambiar de semana SHALL cargarse los trabajos programados de esa semana.

#### Scenario: Semana siguiente
- **WHEN** la persona está en la semana del 1 al 7 de noviembre de 2026 y pulsa "Next week"
- **THEN** el tablero muestra la semana del 8 al 14 de noviembre de 2026 con sus trabajos programados

#### Scenario: Volver a hoy
- **WHEN** la persona está en una semana distinta a la actual y pulsa "Today"
- **THEN** el tablero muestra la semana que contiene la fecha actual

### Requirement: Catálogo de trabajos
El sistema SHALL mostrar un catálogo con todos los trabajos existentes, cada uno con su `number` y su `name`. El catálogo SHALL permitir filtrar por texto que coincida con el número o el nombre, sin distinguir mayúsculas de minúsculas. Un trabajo SHALL permanecer en el catálogo aunque esté programado.

#### Scenario: Búsqueda por número
- **WHEN** la persona escribe "1024" en la búsqueda del catálogo
- **THEN** el catálogo muestra solo los trabajos cuyo número o nombre contiene "1024"

#### Scenario: Trabajo programado sigue en el catálogo
- **WHEN** la persona programa el trabajo "J-1024 Pintar oficina" en el lunes
- **THEN** "J-1024 Pintar oficina" sigue visible en el catálogo

### Requirement: Indicador de trabajo en uso
El sistema SHALL mostrar con un tono atenuado los trabajos del catálogo que tengan al menos una programación en la semana visible, junto con un contador de cuántas veces están programados en esa semana. Los trabajos sin programación en la semana visible SHALL mostrarse con su tono normal y sin contador.

#### Scenario: Trabajo programado dos veces en la semana
- **WHEN** "J-1024 Pintar oficina" está programado el lunes y el miércoles de la semana visible
- **THEN** en el catálogo aparece atenuado con el contador "x2"

#### Scenario: Cambio de semana actualiza el indicador
- **WHEN** la persona pasa a una semana en la que "J-1024 Pintar oficina" no está programado
- **THEN** en el catálogo aparece con su tono normal y sin contador

### Requirement: Programar un trabajo en un día
El sistema SHALL crear una programación cuando la persona suelta un trabajo del catálogo sobre un día. Un mismo trabajo SHALL poder programarse varias veces, tanto en el mismo día como en días distintos. La nueva programación SHALL aparecer en el día de destino sin empleados asignados.

#### Scenario: Soltar un trabajo en un día
- **WHEN** la persona arrastra "J-1031 Jardín Pérez" del catálogo y lo suelta en el jueves
- **THEN** el jueves muestra una tarjeta "J-1031 Jardín Pérez" sin empleados

#### Scenario: Mismo trabajo dos veces el mismo día
- **WHEN** el lunes ya tiene "J-1024 Pintar oficina" y la persona suelta otra vez ese trabajo en el lunes
- **THEN** el lunes muestra dos tarjetas "J-1024 Pintar oficina"

### Requirement: Hora de inicio por defecto
Al crear una programación, el sistema SHALL asignarle como hora de inicio 07:00 si ese mismo trabajo no está programado ese día. Si ya lo está, SHALL asignar la hora en punto siguiente a la hora de inicio más alta de ese trabajo en ese día, con un máximo de 23:00. Las programaciones de otros trabajos no influyen en el cálculo.

#### Scenario: Primer trabajo del día
- **WHEN** la persona suelta "J-1024 Pintar oficina" en un lunes vacío
- **THEN** la programación queda con hora de inicio 07:00

#### Scenario: Otro trabajo en el mismo día
- **WHEN** el lunes tiene "J-1024 Pintar oficina" a las 07:00 y la persona suelta "J-1031 Jardín Pérez" en el lunes
- **THEN** "J-1031 Jardín Pérez" queda con hora de inicio 07:00

#### Scenario: Segunda vez del mismo trabajo
- **WHEN** el lunes tiene "J-1024 Pintar oficina" a las 07:00 y la persona vuelve a soltar ese trabajo en el lunes
- **THEN** la nueva programación queda con hora de inicio 08:00

#### Scenario: Hueco por una programación borrada
- **WHEN** el lunes tenía "J-1024 Pintar oficina" a las 07:00 y a las 08:00, se quitó la de las 07:00 y la persona vuelve a soltar ese trabajo en el lunes
- **THEN** la nueva programación queda con hora de inicio 09:00

#### Scenario: Tope de las 23:00
- **WHEN** el trabajo ya está programado ese día con una hora de inicio de 23:00 y se vuelve a soltar en ese día
- **THEN** la nueva programación queda con hora de inicio 23:00

### Requirement: Solo hora de inicio
El sistema SHALL mostrar en cada programación únicamente su hora de inicio en formato de 24 horas (HH:mm). El sistema SHALL NOT pedir, guardar ni mostrar hora de fin o duración. La persona SHALL poder cambiar la hora de inicio de una programación desde su detalle.

#### Scenario: Tarjeta con hora de inicio
- **WHEN** se muestra una programación con hora de inicio 07:00
- **THEN** la tarjeta muestra "07:00" y ninguna hora de fin

#### Scenario: Editar la hora de inicio
- **WHEN** la persona abre el detalle de una programación y cambia la hora de inicio a 10:30
- **THEN** la tarjeta muestra "10:30" y se reordena dentro del día

### Requirement: Comentario de una programación
Cada programación SHALL poder tener un comentario de texto libre. El detalle de la programación SHALL mostrar un campo "Comment" de varias líneas que se guarda al salir del campo si su texto cambió. Un comentario vacío o compuesto solo por espacios SHALL eliminar el comentario. La tarjeta de una programación con comentario SHALL mostrar un icono de comentario con el texto completo como ayuda emergente; una tarjeta sin comentario SHALL NOT mostrar el icono.

#### Scenario: Agregar un comentario
- **WHEN** la persona abre el detalle de "J-1024 Pintar oficina", escribe "Llevar escalera" en "Comment" y sale del campo
- **THEN** se guarda el comentario y la tarjeta muestra el icono de comentario

#### Scenario: Borrar el comentario
- **WHEN** la persona vacía el campo "Comment" de una programación con comentario y sale del campo
- **THEN** la programación queda sin comentario y la tarjeta deja de mostrar el icono

#### Scenario: Salir sin cambios
- **WHEN** la persona entra y sale del campo "Comment" sin cambiar el texto
- **THEN** no se envía ningún cambio al servidor

### Requirement: Orden de las programaciones dentro del día
El sistema SHALL ordenar las programaciones de cada día por hora de inicio ascendente. Las programaciones con la misma hora SHALL ordenarse por orden de creación.

#### Scenario: Orden por hora
- **WHEN** el lunes tiene programaciones a las 09:00, 07:00 y 08:00
- **THEN** el lunes las muestra en el orden 07:00, 08:00, 09:00

### Requirement: Mover una programación a otro día
El sistema SHALL mover una programación al día donde la persona la suelta, conservando sus empleados asignados. La hora de inicio SHALL conservarse, salvo que el mismo trabajo ya esté programado en el día de destino; en ese caso SHALL recalcularse con la regla de hora de inicio por defecto.

#### Scenario: Mover a un día sin ese trabajo
- **WHEN** la persona arrastra "J-1024 Pintar oficina" (07:00, con Ana y Luis) del lunes al martes y el martes no tiene ese trabajo
- **THEN** el martes muestra "J-1024 Pintar oficina" a las 07:00 con Ana y Luis, y el lunes ya no lo muestra

#### Scenario: Mover a un día que ya tiene ese trabajo
- **WHEN** la persona mueve "J-1024 Pintar oficina" (07:00) del lunes al martes y el martes ya tiene ese trabajo a las 07:00
- **THEN** la programación movida queda en el martes con hora de inicio 08:00

### Requirement: Duplicar una programación
El sistema SHALL permitir duplicar una programación en un día, mediante arrastre con la tecla Alt en escritorio y mediante la acción "Duplicate" del detalle en cualquier dispositivo. La copia SHALL tener el mismo trabajo y los mismos empleados activos; los empleados inactivos SHALL NOT copiarse. El comentario SHALL NOT copiarse: la copia empieza sin comentario. Su hora de inicio SHALL calcularse con la regla de hora de inicio por defecto.

#### Scenario: Duplicar con Alt en otro día
- **WHEN** la persona arrastra con Alt "J-1024 Pintar oficina" (con Ana) del lunes al viernes
- **THEN** el lunes conserva su programación y el viernes muestra una nueva "J-1024 Pintar oficina" con Ana

#### Scenario: Duplicar desde el detalle en el mismo día
- **WHEN** la persona pulsa "Duplicate" en el detalle de "J-1024 Pintar oficina" (07:00) del lunes
- **THEN** el lunes muestra una segunda "J-1024 Pintar oficina" a las 08:00

#### Scenario: Duplicar no copia el comentario
- **WHEN** la persona duplica "J-1024 Pintar oficina" que tiene el comentario "Llevar escalera"
- **THEN** la copia no tiene comentario y la original conserva "Llevar escalera"

### Requirement: Quitar una programación
El sistema SHALL permitir quitar una programación de la semana desde su detalle o arrastrándola de vuelta al catálogo. Al quitarla SHALL desaparecer del día junto con sus asignaciones de empleados, sin afectar al trabajo del catálogo.

#### Scenario: Arrastrar de vuelta al catálogo
- **WHEN** la persona arrastra la tarjeta "J-1031 Jardín Pérez" del jueves al catálogo
- **THEN** el jueves deja de mostrarla y el trabajo sigue en el catálogo

### Requirement: Deshacer
El sistema SHALL permitir deshacer las acciones de programar, mover, duplicar, quitar, cambiar la hora, cambiar el comentario y cambiar empleados. Tras cada acción SHALL mostrarse un aviso breve con la opción "Undo", y en escritorio SHALL funcionar el atajo Ctrl+Z (Cmd+Z en macOS) en orden inverso a las acciones realizadas. Al deshacer, los empleados inactivos SHALL NOT volver a asignarse a una programación que ya no los tenga.

#### Scenario: Deshacer un movimiento
- **WHEN** la persona mueve una programación del lunes al jueves y pulsa "Undo" en el aviso
- **THEN** la programación vuelve al lunes con su hora y sus empleados anteriores

#### Scenario: Deshacer un quitar
- **WHEN** la persona quita una programación con dos empleados y un comentario y pulsa Ctrl+Z
- **THEN** la programación vuelve a aparecer en su día con su hora, sus dos empleados y su comentario

#### Scenario: Deshacer un cambio de comentario
- **WHEN** la persona cambia el comentario "Llevar escalera" por "Llevar andamio" y pulsa "Undo"
- **THEN** la programación vuelve a tener el comentario "Llevar escalera"

#### Scenario: Deshacer un quitar con un empleado inactivo
- **WHEN** la persona quita una programación con Ana (activa) y Pedro (inactivo) y pulsa "Undo"
- **THEN** la programación vuelve a su día con su hora y con Ana, sin Pedro

### Requirement: Respuesta inmediata y error al guardar
El sistema SHALL reflejar cada cambio en pantalla de inmediato, antes de recibir la confirmación del servidor. Si el servidor rechaza el cambio o no responde, el sistema SHALL revertir el cambio en pantalla y mostrar un mensaje de error.

#### Scenario: Fallo al mover
- **WHEN** la persona mueve una programación al jueves y el servidor responde con un error
- **THEN** la programación vuelve a su día original y se muestra un mensaje de error que empieza por "Couldn't save the change."

### Requirement: Diseño responsivo por tamaño de pantalla
El sistema SHALL adaptar la vista al ancho de pantalla: con 1024 px o más, los siete días a la vez con catálogo y panel de empleados; entre 640 y 1023 px, de tres a cuatro días visibles con desplazamiento horizontal y paneles plegables; con menos de 640 px, un solo día a la vez con una tira superior de los siete días.

#### Scenario: Escritorio
- **WHEN** la aplicación se muestra con 1280 px de ancho
- **THEN** se ven los siete días, el catálogo de trabajos y el panel de empleados al mismo tiempo

#### Scenario: Tablet vertical
- **WHEN** la aplicación se muestra con 800 px de ancho
- **THEN** se ven entre tres y cuatro días y los demás se alcanzan desplazando horizontalmente

#### Scenario: Teléfono
- **WHEN** la aplicación se muestra con 390 px de ancho
- **THEN** se ve un solo día y una tira con los siete días de la semana

### Requirement: Tira de días en teléfono
En teléfono, la tira de días SHALL mostrar para cada día cuántas programaciones tiene y SHALL permitir cambiar el día visible tocándolo. Cada día de la tira SHALL aceptar que se suelte sobre él una programación para moverla a ese día.

#### Scenario: Cambiar de día
- **WHEN** la persona toca el jueves en la tira de días
- **THEN** se muestran las programaciones del jueves

#### Scenario: Mover soltando sobre la tira
- **WHEN** la persona mantiene pulsada una programación del lunes y la suelta sobre el miércoles de la tira
- **THEN** la programación pasa al miércoles

### Requirement: Arrastre táctil sin interferir con el desplazamiento
En pantallas táctiles, el arrastre SHALL activarse solo tras mantener pulsado un elemento unos 250 ms sin moverlo. Un deslizamiento sin esa pausa SHALL desplazar la vista en lugar de arrastrar.

#### Scenario: Deslizar para desplazar
- **WHEN** en una tablet la persona desliza rápidamente el dedo sobre una tarjeta
- **THEN** la vista se desplaza y la tarjeta no se mueve

#### Scenario: Mantener para arrastrar
- **WHEN** la persona mantiene pulsada una tarjeta y luego mueve el dedo
- **THEN** la tarjeta se arrastra
