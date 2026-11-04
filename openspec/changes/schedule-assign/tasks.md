# Tasks

## 1. Base del proyecto

- [x] 1.1 Crear la app React + Vite + TypeScript en `web/` y verificar que `npm run dev` muestra la página inicial y `npm run build` termina sin errores
- [x] 1.2 Añadir `@dnd-kit/react` (versión fijada), `@tanstack/react-query`, `date-fns` y `msw`, y verificar que `npm install` y `npm run build` terminan sin errores
- [x] 1.3 Configurar Vitest + Testing Library + jsdom con un test de humo y verificar que `npm test` pasa
- [x] 1.4 Definir `VITE_USE_MOCKS` y `VITE_API_URL` en `web/.env.example` y en un módulo de configuración tipado, y verificar con un test que la configuración lee ambos valores
- [x] 1.5 Crear la base de estilos (variables CSS: paleta neutra, acento, espaciado, radios, tipografía) y verificar que la página inicial las usa

## 2. Contrato, tipos y documentación para el backend

- [ ] 2.1 Definir los tipos `Employee`, `Job`, `Schedule` y los cuerpos de petición según `specs/schedule-api/spec.md`, y verificar que `tsc --noEmit` pasa
- [ ] 2.2 Implementar utilidades de fecha y hora (rango domingo-sábado de una fecha, `YYYY-MM-DD` local, normalización de `HH:mm:ss` a `HH:mm`, formato "1 - 7 nov 2026") y verificar con tests que el martes 2026-11-03 da el rango 2026-11-01 a 2026-11-07 sin desplazamientos de zona horaria
- [ ] 2.3 Implementar el cliente HTTP de los siete endpoints con manejo de errores `{"error"}` (404/422/red) y verificar con tests que cada función llama a la ruta y método correctos y lanza un error tipado ante 4xx
- [ ] 2.4 Escribir `docs/schema.sql` con el DDL de `design.md` y `docs/api.md` con el contrato, ejemplos de petición y respuesta, y la nota de no convertir zonas horarias; verificar que el DDL se ejecuta sin errores en un MySQL de prueba con tablas `jobs` y `employees` equivalentes

## 3. Datos de prueba (MSW)

- [ ] 3.1 Crear los datos semilla en `web/src/mocks/` (10 empleados con 2 inactivos, unos 30 trabajos, programaciones en la semana actual incluido un trabajo repetido el mismo día y un empleado con dos trabajos el mismo día) y verificar con un test que la semilla cumple esas condiciones
- [ ] 3.2 Implementar los manejadores de `GET /api/employees` y `GET /api/jobs` (filtro `status`, `search` sin distinguir mayúsculas, orden) y verificar con tests en `msw/node` los escenarios de esos requisitos
- [ ] 3.3 Implementar los manejadores de `/api/schedules` (GET por rango, POST, PATCH, DELETE, PUT de empleados) con las validaciones 404/422 del contrato y verificar con tests en `msw/node` cada escenario de `specs/schedule-api/spec.md`
- [ ] 3.4 Arrancar el service worker solo cuando `VITE_USE_MOCKS=true`, con latencia configurable, y verificar en el navegador que la pestaña de red muestra las llamadas interceptadas

## 4. Datos del servidor y reglas

- [ ] 4.1 Configurar TanStack Query y las consultas de empleados, trabajos y semana (clave `['schedules', from, to]`) y verificar con tests que cambiar de semana pide el nuevo rango
- [ ] 4.2 Implementar las mutaciones (programar, mover o cambiar hora, duplicar, quitar, reemplazar empleados) con actualización optimista y reversión en error, y verificar con tests que ante un 500 simulado el estado vuelve al anterior y se emite un mensaje de error
- [ ] 4.3 Implementar la función de hora por defecto de `design.md` (decisión 3) y verificar con tests los cinco escenarios de "Hora de inicio por defecto" y los dos de "Mover una programación a otro día"
- [ ] 4.4 Implementar los selectores derivados (programaciones por día ordenadas por hora y creación, veces que cada trabajo está en la semana, programaciones por empleado y día) y verificar con tests el orden 07:00, 08:00, 09:00 y los contadores

## 5. Tablero semanal en escritorio

- [ ] 5.1 Construir el encabezado con rango de la semana, anterior, siguiente y "Hoy", y verificar con tests que al abrir el 2026-11-03 se ven del 1 al 7 de noviembre con el martes resaltado y que "semana siguiente" muestra del 8 al 14
- [ ] 5.2 Construir las siete columnas de días con sus tarjetas (número, nombre, hora de inicio, iniciales de empleados, estado sin empleados) y verificar con tests que no se muestra ninguna hora de fin
- [ ] 5.3 Construir el catálogo con búsqueda, estado atenuado y contador "xN" de la semana visible, y verificar con tests los escenarios de "Catálogo de trabajos" e "Indicador de trabajo en uso"

## 6. Arrastrar y soltar trabajos

- [ ] 6.1 Configurar el contexto de arrastre con los tipos y destinos de `design.md` (decisión 5) en un módulo propio, y verificar con un test que la función de resolución de soltar devuelve la acción correcta para cada combinación origen-destino
- [ ] 6.2 Soltar un trabajo del catálogo en un día crea la programación con la hora por defecto, y verificar en el navegador con datos de prueba que aparece en el día y el catálogo pasa a atenuado
- [ ] 6.3 Mover una tarjeta entre días conserva empleados y aplica la regla de hora al haber repetición, y verificar en el navegador ambos escenarios de "Mover una programación a otro día"
- [ ] 6.4 Duplicar con Alt al soltar y quitar soltando sobre el catálogo, y verificar en el navegador los escenarios de "Duplicar una programación" y "Quitar una programación"
- [ ] 6.5 Añadir los resaltados de destino válido y la animación al soltar, y verificar en el navegador que solo se resaltan los destinos que aceptan el elemento arrastrado

## 7. Asignación de empleados

- [ ] 7.1 Construir el panel de empleados activos (iniciales, nombre, cargo) y verificar con tests que los inactivos no aparecen
- [ ] 7.2 Soltar un empleado en una tarjeta lo asigna (sin repetirlo si ya estaba) y verificar con tests de la resolución de soltar y en el navegador los escenarios de "Asignar un empleado arrastrándolo" y "Sin asignaciones repetidas"
- [ ] 7.3 Mover un empleado entre tarjetas (dos PUT) y retirarlo soltándolo fuera, y verificar en el navegador los escenarios de "Mover un empleado entre programaciones" y "Retirar un empleado"
- [ ] 7.4 Mostrar durante el arrastre de un empleado cuántas programaciones tiene en cada día, y verificar con datos de prueba que el día con dos trabajos indica 2 y el día sin trabajos no muestra indicador
- [ ] 7.5 Mostrar "+N" cuando no caben las iniciales y marcar a los empleados inactivos ya asignados, y verificar con tests los escenarios de "Empleados en la tarjeta" y "Empleados que pasan a inactivos"

## 8. Detalle y deshacer

- [ ] 8.1 Construir el panel de detalle (editar hora de inicio, empleados con quitar, "Duplicar", "Mover a…", "Quitar") y verificar con tests que cambiar la hora a 10:30 reordena la tarjeta en su día
- [ ] 8.2 Implementar la pila de deshacer con operaciones inversas (decisión 6, máximo 20, reasignación de id al deshacer un quitar), y verificar con tests cada fila de la tabla de inversas
- [ ] 8.3 Mostrar el aviso con "Deshacer" tras cada acción y el atajo Ctrl+Z / Cmd+Z, y verificar en el navegador los escenarios de "Deshacer"

## 9. Diseño responsivo y táctil

- [ ] 9.1 Implementar el hook de disposición con cortes en 640 y 1024 px, y verificar con tests que 1280, 800 y 390 px devuelven escritorio, tablet y teléfono
- [ ] 9.2 Construir la disposición de tablet (3-4 días con desplazamiento horizontal ajustado por columna y paneles plegables) y verificar en el navegador a 800 px
- [ ] 9.3 Construir la disposición de teléfono (un día, tira de días con contadores, cambio de día al tocar, catálogo en panel inferior) y verificar en el navegador a 390 px los escenarios de "Tira de días en teléfono"
- [ ] 9.4 Construir el panel inferior de asignación con casillas y carga por día, y verificar con tests los escenarios de "Asignación por lista en teléfono"
- [ ] 9.5 Verificar el arrastre táctil con emulación táctil del navegador: un deslizamiento rápido desplaza la vista y una pulsación de unos 250 ms arrastra la tarjeta, incluido soltar sobre la tira de días

## 10. Integración

- [ ] 10.1 Recorrer con datos de prueba el flujo completo a 1280, 800 y 390 px (programar, repetir el mismo trabajo, asignar, mover, duplicar, quitar, deshacer, cambiar de semana) y verificar que todos los escenarios de `weekly-schedule-board` y `employee-assignment` se cumplen
- [ ] 10.2 Con `VITE_USE_MOCKS=false` y un `VITE_API_URL` sin backend, verificar que la app muestra errores de carga claros y que los cambios se revierten con mensaje
- [ ] 10.3 Ejecutar `npm test`, `tsc --noEmit` y `npm run build` y verificar que los tres terminan sin errores

## Workflow follow-up

- Cuando el backend implemente `docs/api.md`, probar la integración con una programación en domingo y otra en sábado para confirmar que no hay desplazamientos de zona horaria.
- Archivar el cambio cuando la revisión esté completa.
