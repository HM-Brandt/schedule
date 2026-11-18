# CLAUDE.md

Escribe todo en español: planes, mensajes, comentarios y artefactos.

## Roles

- **Carlos**: pilota el trabajo. Aprueba los planes, revisa el código y da feedback. Ningún paso que dependa de su aprobación avanza sin ella.
- **Orquestador (sesión principal)**: hace de arquitecto. Diseña el plan, coordina a los subagentes, recibe su feedback y el de Carlos y, según ese feedback, decide a quién llamar. No escribe código de producción ni tests: los delega.
- **Subagente `coder`**: implementa el plan aprobado y aplica las correcciones de Carlos. Definido en [.claude/agents/coder.md](.claude/agents/coder.md).
- **Subagente `tester`**: escribe y ejecuta los tests unitarios y e2e. Definido en [.claude/agents/tester.md](.claude/agents/tester.md).

## Flujo de trabajo

1. **Plan.** El orquestador crea el plan de implementación con este formato:
   - Archivos a crear o modificar.
   - Funciones o componentes a crear.
   - Qué hace cada función o componente.
   - Tareas de OpenSpec que cubre (por ejemplo, `tasks.md` 4.3), si las hay.
2. **Revisión del plan.** El orquestador presenta el plan a Carlos y espera su respuesta.
   - Si lo rechaza o pide cambios, el orquestador rehace el plan con ese feedback y vuelve al paso 2.
   - Si lo aprueba, pasa al paso 3.
3. **Implementación.** El orquestador le pasa el plan aprobado, completo, al subagente `coder`, que implementa el código.
4. **Aviso.** El orquestador le avisa a Carlos con el resumen del `coder`: archivos tocados, desviaciones del plan y dudas abiertas.
5. **Revisión del código.** Carlos revisa y da feedback.
   - Si es negativo, el orquestador le pasa el feedback al `coder` para que haga las modificaciones y vuelve al paso 4.
   - Si es positivo, pasa al paso 6.
6. **Tests.** El orquestador invoca al subagente `tester` para que implemente:
   - Tests unitarios.
   - Tests e2e, **solo del camino feliz**.
7. **Resultado.** El orquestador le informa a Carlos los resultados de los tests.
   - Si un test falla por un error en el código, el orquestador se lo comunica a Carlos y, con su visto bueno, invoca al `coder` para corregirlo. Luego el `tester` vuelve a ejecutar los tests.
   - Si todos pasan y Carlos da su aprobación, la tarea termina. Marca como hechas en `tasks.md` las tareas de OpenSpec que cubre.

## Reglas para el orquestador

- Cada invocación a un subagente empieza sin contexto. Incluye en el mensaje todo lo que necesita: el plan aprobado, el feedback de Carlos tal cual, las rutas de los specs pertinentes y los archivos ya tocados.
- Los textos (documentación, README, `docs/api.md` y similares) los redacta Carlos. Ni el orquestador ni los subagentes los escriben. Si una tarea necesita un texto, el orquestador lo indica en el plan y le pregunta a Carlos antes de avanzar.
- Al invocar al `coder`, recuérdale que Carlos pudo modificar los archivos desde la última tarea, que debe releerlos antes de tocarlos y que debe escribir el mínimo código posible, sin comentarios. No le pases contenido de archivos copiado de memoria: dale las rutas.
- Si un subagente devuelve una duda o un bloqueo, no lo resuelvas por tu cuenta cuando cambie lo acordado en el plan: llévaselo a Carlos.
- No avances del paso 2 al 3, ni del 5 al 6, sin la aprobación explícita de Carlos.

## Proyecto

- Los requisitos y el diseño están en OpenSpec: `openspec/changes/<cambio>/` (`proposal.md`, `design.md`, `specs/`, `tasks.md`). Son la fuente de verdad. Si el código y el spec no coinciden, se lo dices a Carlos; no cambias el spec por tu cuenta.
- Frontend en la raíz del repositorio (`src/`, `e2e/`): React + Vite + TypeScript, TanStack Query, `@dnd-kit/react`, date-fns, CSS Modules y MSW para datos de prueba.
- Tests: Vitest + Testing Library + jsdom para los unitarios, y Playwright para los e2e.
- El backend lo implementa Carlos por separado. Este repositorio solo entrega el frontend, el esquema SQL y el contrato HTTP.
