# Tasks

## 1. Base del proyecto

- [x] 1.1 Crear la app React + Vite + TypeScript en `web/` y verificar que `npm run dev` muestra la página inicial y `npm run build` termina sin errores
- [x] 1.2 Añadir `@dnd-kit/react` (versión fijada), `@tanstack/react-query`, `date-fns` y `msw`, y verificar que `npm install` y `npm run build` terminan sin errores
- [x] 1.3 Configurar Vitest + Testing Library + jsdom con un test de humo y verificar que `npm test` pasa
- [x] 1.4 Definir `VITE_USE_MOCKS` y `VITE_API_URL` en `web/.env.example` y en un módulo de configuración tipado, y verificar con un test que la configuración lee ambos valores
- [x] 1.5 Crear la base de estilos (variables CSS: paleta neutra, acento, espaciado, radios, tipografía) y verificar que la página inicial las usa
- [x] 1.6 Pasar a inglés los textos de interfaz ya implementados (título de la página, mensajes por defecto de `ApiError` y mensaje de error al guardar) y verificar con tests los nuevos textos

## 2. Contrato, tipos y documentación para el backend

- [x] 2.1 Definir los tipos `Employee`, `Job`, `Schedule` y los cuerpos de petición según `specs/schedule-api/spec.md`, y verificar que `tsc --noEmit` pasa
- [x] 2.2 Implementar utilidades de fecha y hora (rango domingo-sábado de una fecha, `YYYY-MM-DD` local, normalización de `HH:mm:ss` a `HH:mm`, formato "Nov 1 - 7, 2026") y verificar con tests que el martes 2026-11-03 da el rango 2026-11-01 a 2026-11-07 sin desplazamientos de zona horaria
- [x] 2.3 Implementar el cliente HTTP de los siete endpoints con manejo de errores `{"error"}` (404/422/red) y verificar con tests que cada función llama a la ruta y método correctos y lanza un error tipado ante 4xx
- [x] 2.4 Escribir `docs/schema.sql` con el DDL de `design.md` y `docs/api.md` con el contrato, ejemplos de petición y respuesta, y la nota de no convertir zonas horarias; verificar que el DDL se ejecuta sin errores en un MySQL de prueba con tablas `jobs` y `employees` equivalentes

## 3. Datos de prueba (MSW)

- [x] 3.1 Crear los datos semilla en `web/src/mocks/` (10 empleados con 2 inactivos, unos 30 trabajos, programaciones en la semana actual incluido un trabajo repetido el mismo día y un empleado con dos trabajos el mismo día) y verificar con un test que la semilla cumple esas condiciones
- [x] 3.2 Implementar los manejadores de `GET /api/employees` y `GET /api/jobs` (filtro `status`, `search` sin distinguir mayúsculas, orden) y verificar con tests en `msw/node` los escenarios de esos requisitos
- [x] 3.3 Implementar los manejadores de `/api/schedules` (GET por rango, POST, PATCH, DELETE, PUT de empleados) con las validaciones 404/422 del contrato y verificar con tests en `msw/node` cada escenario de `specs/schedule-api/spec.md`
- [x] 3.4 Arrancar el service worker solo cuando `VITE_USE_MOCKS=true`, con latencia configurable, y verificar en el navegador que la pestaña de red muestra las llamadas interceptadas

## 4. Datos del servidor y reglas

- [x] 4.1 Configurar TanStack Query y las consultas de empleados, trabajos y semana (clave `['schedules', from, to]`) y verificar con tests que cambiar de semana pide el nuevo rango
- [x] 4.2 Implementar las mutaciones (programar, mover o cambiar hora, duplicar, quitar, reemplazar empleados) con actualización optimista y reversión en error, y verificar con tests que ante un 500 simulado el estado vuelve al anterior y se emite un mensaje de error
- [x] 4.3 Implementar la función de hora por defecto de `design.md` (decisión 3) y verificar con tests los cinco escenarios de "Hora de inicio por defecto" y los dos de "Mover una programación a otro día"
- [x] 4.4 Implementar los selectores derivados (programaciones por día ordenadas por hora y creación, veces que cada trabajo está en la semana, programaciones por empleado y día) y verificar con tests el orden 07:00, 08:00, 09:00 y los contadores

## 5. Tablero semanal en escritorio

- [x] 5.1 Construir el encabezado con rango de la semana, anterior, siguiente y "Today", y verificar con tests que al abrir el 2026-11-03 se ven del 1 al 7 de noviembre con el martes resaltado y que "Next week" muestra del 8 al 14
- [x] 5.2 Construir las siete columnas de días con sus tarjetas (número, nombre, hora de inicio, iniciales de empleados, estado sin empleados) y verificar con tests que no se muestra ninguna hora de fin
- [x] 5.3 Construir el catálogo con búsqueda, estado atenuado y contador "xN" de la semana visible, y verificar con tests los escenarios de "Catálogo de trabajos" e "Indicador de trabajo en uso"

## 6. Arrastrar y soltar trabajos

- [x] 6.1 Configurar el contexto de arrastre con los tipos y destinos de `design.md` (decisión 5) en un módulo propio, y verificar con un test que la función de resolución de soltar devuelve la acción correcta para cada combinación origen-destino
- [x] 6.2 Soltar un trabajo del catálogo en un día crea la programación con la hora por defecto, y verificar en el navegador con datos de prueba que aparece en el día y el catálogo pasa a atenuado
- [x] 6.3 Mover una tarjeta entre días conserva empleados y aplica la regla de hora al haber repetición, y verificar en el navegador ambos escenarios de "Mover una programación a otro día"
- [x] 6.4 Duplicar con Alt al soltar y quitar soltando sobre el catálogo, y verificar en el navegador los escenarios de "Duplicar una programación" y "Quitar una programación"
- [x] 6.5 Añadir los resaltados de destino válido y la animación al soltar, y verificar en el navegador que solo se resaltan los destinos que aceptan el elemento arrastrado

## 7. Asignación de empleados

- [x] 7.1 Construir el panel de empleados activos (iniciales, nombre, cargo) y verificar con tests que los inactivos no aparecen
- [x] 7.2 Soltar un empleado en una tarjeta lo asigna (sin repetirlo si ya estaba) y verificar con tests de la resolución de soltar y en el navegador los escenarios de "Asignar un empleado arrastrándolo" y "Sin asignaciones repetidas"
- [x] 7.3 Mover un empleado entre tarjetas (dos PUT) y retirarlo soltándolo fuera, y verificar en el navegador los escenarios de "Mover un empleado entre programaciones" y "Retirar un empleado"
- [x] 7.4 Mostrar durante el arrastre de un empleado cuántas programaciones tiene en cada día, y verificar con datos de prueba que el día con dos trabajos indica 2 y el día sin trabajos no muestra indicador
- [x] 7.5 Mostrar "+N" cuando no caben las iniciales y marcar a los empleados inactivos ya asignados, y verificar con tests los escenarios de "Empleados en la tarjeta" y "Empleados que pasan a inactivos"

## 8. Detalle y deshacer

- [x] 8.1 Construir el panel de detalle (editar hora de inicio, empleados con quitar, "Duplicate", "Move to…", "Remove") y verificar con tests que cambiar la hora a 10:30 reordena la tarjeta en su día
- [x] 8.2 Implementar la pila de deshacer con operaciones inversas (decisión 6, máximo 20, reasignación de id al deshacer un quitar), y verificar con tests cada fila de la tabla de inversas
- [x] 8.3 Mostrar el aviso con "Undo" tras cada acción y el atajo Ctrl+Z / Cmd+Z, y verificar en el navegador los escenarios de "Deshacer"

## 9. Diseño responsivo y táctil

- [x] 9.1 Implementar el hook de disposición con cortes en 640 y 1024 px, y verificar con tests que 1280, 800 y 390 px devuelven escritorio, tablet y teléfono
- [x] 9.2 Construir la disposición de tablet (3-4 días con desplazamiento horizontal ajustado por columna y paneles plegables) y verificar en el navegador a 800 px
- [x] 9.3 Construir la disposición de teléfono (un día, tira de días con contadores, cambio de día al tocar, catálogo en panel inferior) y verificar en el navegador a 390 px los escenarios de "Tira de días en teléfono"
- [x] 9.4 Construir el panel inferior de asignación con casillas y carga por día, y verificar con tests los escenarios de "Asignación por lista en teléfono"
- [x] 9.5 Verificar el arrastre táctil con emulación táctil del navegador: un deslizamiento rápido desplaza la vista y una pulsación de unos 250 ms arrastra la tarjeta, incluido soltar sobre la tira de días
- [x] 9.6 Estilo visual: paleta con acento índigo, color por trabajo y por empleado, iconos con `lucide-react` (versión fijada) y pulido de encabezado, columnas, tarjetas, detalle y aviso; verificar en el navegador a 1280, 800 y 390 px y que los tests existentes siguen pasando

## 10. Integración

- [x] 10.1 Recorrer con datos de prueba el flujo completo a 1280, 800 y 390 px (programar, repetir el mismo trabajo, asignar, mover, duplicar, quitar, deshacer, cambiar de semana) y verificar que todos los escenarios de `weekly-schedule-board` y `employee-assignment` se cumplen
- [x] 10.2 Con `VITE_USE_MOCKS=false` y un `VITE_API_URL` sin backend, verificar que la app muestra errores de carga claros y que los cambios se revierten con mensaje
- [x] 10.3 Ejecutar `npm test`, `tsc --noEmit` y `npm run build` y verificar que los tres terminan sin errores

## 11. Alinear con el backend real

- [x] 11.1 Actualizar los tipos `Employee`, `Job`, `Schedule` y los cuerpos de petición a los nombres del backend (`employeesId`, `firstName`, `lastName`, `jobsId`, `jobSchedulesId`, `startTime`, `employeesIds`; `status` `Active`/`Terminated`) y verificar que `tsc --noEmit` pasa
- [x] 11.2 Ajustar el cliente HTTP (cuerpos y normalización de `startTime`) y verificar con sus tests
- [x] 11.3 Ajustar la semilla y los manejadores MSW a la forma nueva (2 empleados `Terminated`, jobs con todos sus campos, validaciones 422 con `Terminated`) y verificar con tests en `msw/node`
- [x] 11.4 Ajustar componentes, selectores, arrastre, deshacer y regla de hora a los nombres nuevos, y verificar que `npm test`, `tsc --noEmit` y `npm run build` pasan
- [x] 11.5 Actualizar `docs/schema.sql` con el DDL de `design.md` (decisión 1)
- [ ] 11.6 Actualizar `docs/api.md` con el contrato nuevo (lo redacta Carlos)
- [x] 11.7 Usar en el cliente HTTP las rutas `v1/...` relativas a `VITE_API_URL` para los siete endpoints, y en los manejadores MSW (incluida la latencia) un comodín de origen, y verificar con datos de prueba que con `VITE_API_URL` vacía y con una URL absoluta con prefijo `/api` las peticiones se interceptan

## 12. Comentario de una programación

- [ ] 12.1 Añadir `scheduleComment` al tipo `Schedule`, a los cuerpos de POST y PATCH, a la semilla y a los manejadores MSW (vacío o solo espacios se guarda como `null`), y verificar con tests en `msw/node` los escenarios de comentario de `specs/schedule-api/spec.md`
- [ ] 12.2 Añadir el campo "Comment" al detalle (guardar al salir del campo solo si cambió) y el icono con ayuda emergente en la tarjeta, y verificar con tests los escenarios de "Comentario de una programación"
- [ ] 12.3 Incluir el comentario en la pila de deshacer (inversa del PATCH de comentario, restaurarlo al deshacer un quitar) y no copiarlo al duplicar, y verificar con tests los escenarios de deshacer y "Duplicar no copia el comentario"

## 13. Días con trabajo por empleado

- [ ] 13.1 Construir el componente de siete recuadros (vacío, tono claro, tono fuerte, borde en el día actual, texto accesible) a partir del selector de programaciones por empleado y día, y verificar con tests los escenarios de "Días con trabajo en la semana visible"
- [ ] 13.2 Mostrarlo en el panel de empleados y en la lista de casillas del teléfono, y verificar en el navegador a 1280, 800 y 390 px

## Workflow follow-up

- Cuando el backend implemente `docs/api.md`, probar la integración con una programación en domingo y otra en sábado para confirmar que no hay desplazamientos de zona horaria.
- Archivar el cambio cuando la revisión esté completa.
