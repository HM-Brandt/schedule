# Design

## Context

- El repositorio solo contiene la configuración de OpenSpec; no hay código previo. El frontend se crea desde cero en `web/`.
- La base de datos MySQL ya tiene `jobs (id, number, name)` y `employees (id, first_name, last_name, title, status)`, con `status` igual a `activo` o `inactivo`. `jobs` no tiene fecha ni hora, así que la programación necesita tablas propias.
- El backend lo implementa el usuario por separado. Este cambio entrega el frontend, el esquema SQL y el contrato HTTP (ver `specs/schedule-api/spec.md`).
- Planifica una sola persona, así que no hay edición concurrente que resolver.
- Los requisitos de comportamiento están en `specs/weekly-schedule-board/spec.md` y `specs/employee-assignment/spec.md`; este documento no los repite.

## Goals / Non-Goals

**Goals:**
- Que el frontend funcione completo con datos de prueba y pase a usar el backend real cambiando solo variables de entorno.
- Que el backend sea sencillo: guarda lo que recibe y valida; las reglas de la interfaz (hora por defecto, deshacer) viven en el frontend.
- Un único modelo de interacción de arrastre que funcione con ratón y con pantalla táctil.

**Non-Goals:**
- Implementar el backend, la autenticación o el despliegue.
- Sincronización en tiempo real o historial de deshacer persistente entre recargas.
- Accesibilidad por teclado completa del arrastre más allá de lo que ofrezca la librería; las mismas acciones existen en el detalle de cada programación.

## Decisions

### 1. Modelo de datos: dos tablas nuevas, sin tocar las existentes

`jobs` actúa como catálogo: un trabajo se puede programar muchas veces. Cada programación es una fila de `job_schedules`, y sus empleados van en `job_schedule_employees`.

```
jobs 1 ──── N job_schedules 1 ──── N job_schedule_employees N ──── 1 employees
```

```sql
CREATE TABLE job_schedules (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id         INT UNSIGNED NOT NULL,        -- mismo tipo EXACTO que jobs.id
  scheduled_date DATE         NOT NULL,
  start_time     TIME         NOT NULL,        -- solo hora de inicio
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_schedules_date (scheduled_date, start_time),
  CONSTRAINT fk_job_schedules_job FOREIGN KEY (job_id) REFERENCES jobs (id)
);

CREATE TABLE job_schedule_employees (
  job_schedule_id INT UNSIGNED NOT NULL,
  employee_id     INT UNSIGNED NOT NULL,       -- mismo tipo EXACTO que employees.id
  PRIMARY KEY (job_schedule_id, employee_id),
  KEY idx_jse_employee (employee_id),
  CONSTRAINT fk_jse_schedule FOREIGN KEY (job_schedule_id)
    REFERENCES job_schedules (id) ON DELETE CASCADE,
  CONSTRAINT fk_jse_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
);
```

- `start_time` es `NOT NULL` porque siempre hay una hora por defecto.
- **Sin restricción única en `(job_id, scheduled_date)`:** un trabajo puede repetirse el mismo día.
- **La clave primaria compuesta** de `job_schedule_employees` impide asignar dos veces al mismo empleado a una programación.
- **`ON DELETE CASCADE`** borra las asignaciones al eliminar una programación.
- El índice `(scheduled_date, start_time)` cubre la consulta por semana y su orden.
- **Supuesto:** `jobs.id` y `employees.id` son `INT UNSIGNED`. Si son otro tipo, hay que ajustar las dos columnas de clave foránea, porque MySQL exige el mismo tipo.
- **Alternativa descartada:** añadir `date` y `start_time` a `jobs`. Obligaría a duplicar filas del catálogo para repetir un trabajo y modificaría una tabla existente.

### 2. Contrato HTTP orientado a recursos

Los siete endpoints de `specs/schedule-api/spec.md`:

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/employees[?status=activo]` | Panel de empleados (activos) y nombres de los ya asignados (todos) |
| GET | `/api/jobs[?search=]` | Catálogo |
| GET | `/api/schedules?from&to` | Semana visible |
| POST | `/api/schedules` | Programar o duplicar |
| PATCH | `/api/schedules/{id}` | Mover de día o cambiar hora |
| DELETE | `/api/schedules/{id}` | Quitar |
| PUT | `/api/schedules/{id}/employees` | Reemplazar empleados |

- **El frontend pide `GET /api/employees` sin filtro y filtra en el cliente.** Así puede mostrar el nombre de un empleado inactivo que sigue asignado.
- **`GET /api/schedules` incluye el objeto `job`** dentro de cada programación, para pintar la semana con una sola llamada y sin cruzar datos en el cliente.
- **Empleados: `PUT` del conjunto completo** en lugar de `POST`/`DELETE` por empleado. Un solo endpoint idempotente sirve para el arrastre (añadir o quitar uno), para la lista de casillas del teléfono y para deshacer (restaurar el conjunto anterior). Mover un empleado entre dos programaciones son dos `PUT`. Con un único usuario no hay riesgo de que se pisen.
- **Alternativa descartada:** GraphQL o un endpoint de "guardar semana". Son más complejos para el backend y peores para las actualizaciones optimistas.

### 3. La hora por defecto se calcula en el frontend

El frontend calcula `start_time` antes del `POST`, o antes del `PATCH` al mover. El cálculo usa las programaciones de la semana visible, que ya tiene cargadas:

```
horas = start_time de las programaciones con ese job_id en ese día (excluyendo la que se mueve)
si horas está vacío -> 07:00
si no              -> min(23, hora_entera(max(horas)) + 1):00
```

- **Por qué en el frontend:** el backend solo guarda y valida; la regla es de interfaz y el usuario puede editar la hora después.
- **Alternativa descartada:** calcular la hora en el backend cuando `start_time` no llega. Repartiría la lógica entre dos sitios y complicaría los datos de prueba.

### 4. Stack del frontend

- **React + Vite + TypeScript** en `web/`. El resultado es un build estático que se puede servir desde cualquier hosting.
- **TanStack Query** para los datos del servidor. Ofrece caché por semana (`['schedules', from, to]`), actualizaciones optimistas con reversión en `onError` e invalidación tras cada cambio. Cubre directamente el requisito de "respuesta inmediata y error al guardar".
- **date-fns** para el cálculo de semanas (`startOfWeek` con `weekStartsOn: 0`). Los nombres de días y meses en inglés salen de listas fijas. Todas las fechas se manejan como cadenas `YYYY-MM-DD` locales, nunca como `Date` en UTC.
- **Idioma:** los textos de la interfaz están en inglés, las fechas en formato estadounidense (`Nov 1 - 7, 2026`) y las horas en 24 h. Los mensajes `{"error"}` del servidor se muestran tal como llegan.
- **CSS Modules con variables CSS** para un estilo minimalista propio, sin librería de componentes. Paleta neutra, un color de acento, tarjetas con bordes suaves y animaciones cortas al soltar.
- **Alternativa descartada:** Redux u otro estado global para datos del servidor. Duplicaría lo que ya da TanStack Query. El estado puramente de interfaz (día visible en teléfono, detalle abierto, pila de deshacer) va en estado local o en un contexto pequeño.

### 5. Arrastrar y soltar con @dnd-kit/react

- **Sensor de puntero único** para ratón y táctil. La configuración por defecto ya activa el arrastre táctil tras 250 ms de pulsación con 5 px de tolerancia, lo que evita robar el desplazamiento. Con ratón se exige un movimiento mínimo de 5 px para no confundir clic y arrastre.
- **Tipos de elemento arrastrable:** `catalog-job`, `schedule-card` y `employee` (desde el panel o desde una tarjeta, con su programación de origen).
- **Destinos:**
  - `day` (columna, o día de la tira en el teléfono): acepta `catalog-job` y `schedule-card`.
  - `schedule-card`: acepta `employee`.
  - `catalog`: acepta `schedule-card` (quitar).
  - Soltar un `employee` que venía de una tarjeta fuera de cualquier destino lo retira de ella.
- **Duplicar:** se lee `altKey` del evento al soltar. En táctil no hay Alt, así que se usa la acción "Duplicate" del detalle.
- Mientras se arrastra un empleado, cada día muestra su número de programaciones ese día. Se calcula en el cliente con los datos de la semana.
- **Alternativa descartada:** la API nativa HTML5 de drag and drop. Su soporte táctil es pobre y no permite personalizar el elemento arrastrado.
- **Versión:** se fija una versión concreta de `@dnd-kit/react` en `package.json`, porque la API de la versión 0.x aún puede cambiar.

### 6. Deshacer como pila de operaciones inversas

Cada acción guarda en una pila en memoria su operación inversa (como máximo 20):

| Acción | Inversa |
|---|---|
| Programar (POST) | DELETE de la nueva programación |
| Mover / cambiar hora (PATCH) | PATCH con `date` y `start_time` anteriores |
| Duplicar (POST) | DELETE de la copia |
| Quitar (DELETE) | POST con el mismo `job_id`, `date`, `start_time` y `employee_ids` |
| Cambiar empleados (PUT) | PUT con el conjunto anterior |
| Mover empleado entre tarjetas (2 PUT) | 2 PUT con los conjuntos anteriores, como una sola entrada |

- Deshacer un "quitar" crea una programación con un id nuevo. El frontend reemplaza el id viejo por el nuevo en las entradas de la pila que lo referencian.
- La pila se vacía al recargar y no se ve afectada por cambiar de semana.

### 7. Datos de prueba con MSW

- `web/src/mocks/` contiene una base en memoria con datos semilla: 10 empleados (2 inactivos), unos 30 trabajos y una semana actual ya armada. También contiene manejadores MSW para los siete endpoints, con las mismas validaciones y códigos de estado que el contrato (422/404, formato `HH:mm`, inactivos), para que el frontend se pruebe contra el comportamiento real esperado.
- Con `VITE_USE_MOCKS=true` se arranca el service worker antes de montar la app. Con `false`, las llamadas van a `VITE_API_URL`.
- Los mocks añaden una latencia corta y configurable, para que se noten los estados de carga y las actualizaciones optimistas.
- **Alternativa descartada:** json-server o un mock aparte. Exige otro proceso y no reproduce las validaciones del contrato.

### 8. Diseño responsivo

Hay tres disposiciones según el ancho, con cortes en 640 y 1024 px:

- **≥ 1024 px:** cuadrícula de 7 columnas, catálogo y panel de empleados laterales.
- **640–1023 px:** columnas que encajan 3 o 4 días completos, con desplazamiento horizontal con ajuste por columna; catálogo y empleados en cajones laterales que se apartan durante el arrastre.
- **< 640 px:** un día con tira de días superior; catálogo y empleados en paneles inferiores; detalle a pantalla completa.

Los componentes de tarjeta, catálogo y empleado se comparten. Solo cambia el contenedor de la disposición. La disposición se elige con `matchMedia` en un hook, porque la del teléfono cambia de verdad la estructura de la página y no solo los estilos.

## Risks / Trade-offs

- **[El backend convierte fechas a UTC y los trabajos cambian de día]** → El contrato exige cadenas `YYYY-MM-DD`/`HH:mm` sin conversión, y los mocks validan el formato. Conviene probar la integración con una programación de domingo y otra de sábado.
- **[Tipos de clave foránea distintos de `INT UNSIGNED`]** → Revisar `SHOW CREATE TABLE jobs` y `SHOW CREATE TABLE employees` antes de aplicar el DDL.
- **[Catálogo muy grande, más de unos miles de trabajos]** → La búsqueda se hace en el servidor con `search`, pero sin paginación `GET /api/jobs` devuelve todo. Si crece, añadir `limit` es compatible con el contrato actual.
- **[API de @dnd-kit/react en 0.x]** → Versión fijada. El arrastre queda aislado en un módulo propio para poder cambiar a `@dnd-kit/core` si hace falta.
- **[La misma persona abre dos pestañas]** → Gana la última escritura. Se acepta, porque solo hay una persona planificando. Al volver a enfocar la pestaña, TanStack Query vuelve a pedir los datos.
- **[Soltar con precisión en la tira de días del teléfono]** → Destinos grandes, resaltados durante el arrastre. El detalle ofrece además "Move to…" como alternativa sin arrastre.
- **[Deshacer tras un error de red]** → Si la operación inversa falla, se muestra el error y la entrada vuelve a la pila. No se dan reintentos silenciosos.

## Migration Plan

1. Verificar los tipos de `jobs.id` y `employees.id` y aplicar el DDL de las dos tablas nuevas.
2. Desarrollar y probar el frontend con `VITE_USE_MOCKS=true`.
3. Cuando el backend implemente el contrato: `VITE_USE_MOCKS=false` y `VITE_API_URL` apuntando al backend. Si el backend está en otro origen, debe habilitar CORS (en desarrollo se puede usar el proxy de Vite).
4. Build estático (`vite build`) y publicación en el hosting.
5. **Vuelta atrás:** retirar el frontend y, si se desea, ejecutar `DROP TABLE job_schedule_employees; DROP TABLE job_schedules;`. `jobs` y `employees` no se tocaron.

## Open Questions

- Tipos exactos de `jobs.id` y `employees.id`. Solo afecta al DDL.
- Hosting y origen del backend en producción. Solo afecta a la configuración de despliegue y a CORS.
- Color de acento y tipografía finales. Se pueden ajustar en las variables CSS sin tocar componentes.
