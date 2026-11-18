# Spec Delta

## ADDED Requirements

### Requirement: Mover una programación a un día con empleados ausentes
El sistema SHALL NOT mover una programación, ni por arrastre ni con "Move to…", a un día en que alguno de sus empleados asignados está ausente. La programación SHALL quedarse en su día y SHALL mostrarse un mensaje de error que nombra a los empleados ausentes.

#### Scenario: Mover con Ana ausente el martes
- **WHEN** "J-1024 Pintar oficina" del lunes tiene a Ana, Ana está ausente el martes y la persona arrastra la tarjeta al martes
- **THEN** la tarjeta sigue en el lunes con Ana y se muestra un mensaje de error que nombra a Ana

### Requirement: Duplicar a un día con empleados ausentes
Al duplicar una programación, los empleados ausentes en el día de la copia SHALL NOT copiarse. La copia SHALL crearse con el resto de empleados activos.

#### Scenario: Duplicar con Luis ausente el viernes
- **WHEN** la persona duplica con Alt "J-1024 Pintar oficina" (con Ana y Luis) del lunes al viernes y Luis está ausente el viernes
- **THEN** el viernes muestra una nueva "J-1024 Pintar oficina" solo con Ana
