// Tarea 13.2 de `schedule-assign`: camino feliz de "Días con trabajo en la semana visible"
// (escenario "Asignar actualiza los recuadros" de `specs/employee-assignment/spec.md`) en
// escritorio, con los datos de prueba de MSW (`VITE_USE_MOCKS=true`). Los demás escenarios
// (tonos, día actual, cambio de semana, tablet y teléfono) se cubren en los tests unitarios.
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
// Pedro Sánchez no tiene ninguna programación esa semana.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** Arrastra `origen` con el ratón hasta el centro de `destino` y lo suelta. */
async function arrastrar(page: Page, origen: Locator, destino: Locator) {
  await expect(origen).toBeInViewport()
  const desde = await origen.boundingBox()
  if (!desde) throw new Error('No se pudo medir el origen del arrastre')
  await page.mouse.move(desde.x + desde.width / 2, desde.y + desde.height / 2)
  await page.mouse.down()
  // Primer movimiento corto, por encima de los 5 px que pide el sensor de ratón.
  await page.mouse.move(desde.x + desde.width / 2 + 10, desde.y + desde.height / 2 + 10, { steps: 5 })
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(1)

  await expect(destino).toBeInViewport()
  const hasta = await destino.boundingBox()
  if (!hasta) throw new Error('No se pudo medir el destino del arrastre')
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 20 })
  // @dnd-kit calcula el destino bajo el puntero en los fotogramas siguientes.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
  await page.mouse.up()
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
}

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
const dia = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** Tarjeta del día `nombre` que contiene `texto` (una hora o un número de trabajo). */
const tarjeta = (page: Page, nombre: string, texto: string) =>
  dia(page, nombre).getByRole('article').filter({ hasText: texto })

/** Sección del panel de empleados. */
const panel = (page: Page) => page.getByRole('heading', { name: 'Employees' }).locator('xpath=..')

/** Fila del panel de empleados con el nombre completo `nombre`. */
const enElPanel = (page: Page, nombre: string) => panel(page).getByRole('listitem').filter({ hasText: nombre })

/** Recuadros de días con trabajo de la fila de `nombre` (contenedor con `role="img"`). */
const recuadros = (page: Page, nombre: string) => enElPanel(page, nombre).getByRole('img')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(panel(page).getByRole('listitem')).toHaveCount(8)
})

test('cada empleado del panel muestra sus días con trabajo y asignar a Pedro el jueves pinta su jueves', async ({
  page,
}) => {
  // Situación de partida de la semilla.
  await expect(recuadros(page, 'Ana López')).toHaveAttribute('aria-label', 'Assigned: Mon (2)')
  await expect(recuadros(page, 'Carlos Ruiz')).toHaveAttribute('aria-label', 'Assigned: Tue (1)')
  const pedro = recuadros(page, 'Pedro Sánchez')
  await expect(pedro).toBeVisible()
  await expect(pedro).toHaveAttribute('aria-label', 'Assigned: none')
  const diasDePedro = pedro.locator(':scope > *')
  await expect(diasDePedro).toHaveCount(7)
  await expect(diasDePedro).toHaveText(['S', 'M', 'T', 'W', 'T', 'F', 'S'])
  await expect(diasDePedro.nth(4)).toHaveAttribute('data-level', '0')
  // El martes 3 es el día actual.
  await expect(diasDePedro.nth(2)).toHaveAttribute('data-today', 'true')

  const lamparas = tarjeta(page, 'Thu', 'J-1029')
  await expect(lamparas).toContainText('No employees')
  await arrastrar(page, enElPanel(page, 'Pedro Sánchez'), lamparas)

  await expect(lamparas.getByTitle('Pedro Sánchez')).toHaveText('PS')
  await expect(pedro).toHaveAttribute('aria-label', 'Assigned: Thu (1)')
  await expect(diasDePedro.nth(4)).toHaveAttribute('data-level', '1')
  // El recuadro pintado se ve distinto de uno vacío.
  const fondo = (recuadro: Locator) => recuadro.evaluate((elemento) => getComputedStyle(elemento).backgroundColor)
  expect(await fondo(diasDePedro.nth(4))).not.toBe(await fondo(diasDePedro.nth(3)))
})
