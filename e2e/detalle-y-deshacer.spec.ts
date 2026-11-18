// Tareas 8.1 y 8.3 de `schedule-assign`: camino feliz del panel de detalle (editar la hora y
// duplicar) y de deshacer con "Undo" y con Ctrl+Z, con los datos de prueba de MSW
// (`VITE_USE_MOCKS=true`). Escenarios de `specs/weekly-schedule-board/spec.md`.
// "Fallo al mover" no es camino feliz: se cubre en `src/undo/deshacer.test.tsx`.
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
// La semilla no tiene ninguna programación con un empleado inactivo y la interfaz no permite
// asignarlos, así que "Deshacer un quitar con un empleado inactivo" se cubre solo en los tests
// unitarios (`src/undo/deshacer.test.tsx` y `src/undo/useScheduleActions.test.tsx`).
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** Empieza a arrastrar `origen` con el ratón y lo deja a mitad de camino, aún sin soltar. */
async function empezarArrastre(page: Page, origen: Locator) {
  await expect(origen).toBeInViewport()
  const desde = await origen.boundingBox()
  if (!desde) throw new Error('No se pudo medir el origen del arrastre')

  await page.mouse.move(desde.x + desde.width / 2, desde.y + desde.height / 2)
  await page.mouse.down()
  // Primer movimiento corto, por encima de los 5 px que pide el sensor de ratón, y espera a
  // que @dnd-kit marque el elemento como arrastrado.
  await page.mouse.move(desde.x + desde.width / 2 + 10, desde.y + desde.height / 2 + 10, { steps: 5 })
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(1)
}

/** Arrastra `origen` hasta el centro de `destino` y lo suelta. */
async function arrastrar(page: Page, origen: Locator, destino: Locator) {
  await expect(destino).toBeInViewport()
  await empezarArrastre(page, origen)
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

/** Iniciales de los empleados de una tarjeta, en orden. */
const iniciales = (tarjetaDelDia: Locator) => tarjetaDelDia.locator('span[title]:not([aria-label^="Comment:"])')

/** Aviso de acción con el texto `texto` (la página tiene además la región en vivo de @dnd-kit). */
const avisoDeAccion = (page: Page, texto: string) => page.getByRole('status').filter({ hasText: texto })

/** Abre el detalle de `tarjetaDelDia` pulsándola. */
async function abrirDetalle(page: Page, tarjetaDelDia: Locator, nombre: string) {
  await tarjetaDelDia.click()
  const detalle = page.getByRole('dialog', { name: nombre })
  await expect(detalle).toBeVisible()
  return detalle
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(dia(page, 'Mon').getByTitle('Ana López')).toHaveCount(2)
})

test('editar la hora de inicio de "J-1024 Pintar oficina" a 10:30: la tarjeta muestra "10:30" y se reordena en el lunes', async ({
  page,
}) => {
  const lunes = dia(page, 'Mon').getByRole('article')
  await expect(lunes.nth(0)).toContainText('07:00')
  await expect(lunes.nth(1)).toContainText('08:00')

  const detalle = await abrirDetalle(page, tarjeta(page, 'Mon', '07:00'), 'J-1024 Pintar oficina')
  const hora = detalle.getByLabel('Start time')
  await expect(hora).toHaveValue('07:00')
  await hora.fill('10:30')
  await hora.press('Enter')

  await expect(lunes).toHaveCount(2)
  await expect(lunes.nth(0)).toContainText('08:00')
  await expect(lunes.nth(1)).toContainText('10:30')
  await expect(iniciales(lunes.nth(1))).toHaveText(['AL', 'LM'])
  await expect(tarjeta(page, 'Mon', '07:00')).toHaveCount(0)
  await expect(avisoDeAccion(page, 'Start time changed')).toBeVisible()
})

test('duplicar desde el detalle "J-1024 Pintar oficina" (07:00) del lunes deja una segunda a las 08:00', async ({
  page,
}) => {
  // Preparación: el lunes solo tiene "J-1024 Pintar oficina" a las 07:00; se quita la de las 08:00.
  const lunes = dia(page, 'Mon').getByRole('article')
  const quitar = await abrirDetalle(page, tarjeta(page, 'Mon', '08:00'), 'J-1024 Pintar oficina')
  await quitar.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(lunes).toHaveCount(1)
  await expect(avisoDeAccion(page, 'Job removed')).toBeVisible()

  const detalle = await abrirDetalle(page, tarjeta(page, 'Mon', '07:00'), 'J-1024 Pintar oficina')
  await detalle.getByRole('button', { name: 'Duplicate' }).click()

  const pintar = lunes.filter({ hasText: 'J-1024' })
  await expect(pintar).toHaveCount(2)
  await expect(pintar.nth(0)).toContainText('07:00')
  await expect(pintar.nth(1)).toContainText('08:00')
  await expect(pintar.nth(1)).toContainText('Pintar oficina')
  await expect(iniciales(pintar.nth(1))).toHaveText(['AL', 'LM'])
  await expect(avisoDeAccion(page, 'Job duplicated')).toBeVisible()
})

test('deshacer un movimiento: "J-1024 Pintar oficina" del lunes al jueves y "Undo" la devuelve al lunes con su hora y sus empleados', async ({
  page,
}) => {
  const pintar = tarjeta(page, 'Mon', '07:00')
  await expect(iniciales(pintar)).toHaveText(['AL', 'LM'])

  await arrastrar(page, pintar, dia(page, 'Thu'))
  const enElJueves = tarjeta(page, 'Thu', 'J-1024')
  await expect(enElJueves).toHaveCount(1)
  await expect(avisoDeAccion(page, 'Job moved')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()

  await expect(enElJueves).toHaveCount(0)
  const lunes = dia(page, 'Mon').getByRole('article')
  await expect(lunes).toHaveCount(2)
  await expect(lunes.nth(0)).toContainText('J-1024')
  await expect(lunes.nth(0)).toContainText('07:00')
  await expect(iniciales(lunes.nth(0))).toHaveText(['AL', 'LM'])
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
})

test('deshacer un quitar: quitar "J-1024 Pintar oficina" con Ana y Luis desde el detalle y pulsar Ctrl+Z la devuelve', async ({
  page,
}) => {
  const lunes = dia(page, 'Mon').getByRole('article')
  const detalle = await abrirDetalle(page, tarjeta(page, 'Mon', '07:00'), 'J-1024 Pintar oficina')
  await expect(detalle.getByText('Ana López')).toBeVisible()
  await expect(detalle.getByText('Luis Martínez')).toBeVisible()

  await detalle.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(detalle).toHaveCount(0)
  await expect(lunes).toHaveCount(1)
  await expect(avisoDeAccion(page, 'Job removed')).toBeVisible()

  await page.keyboard.press('Control+z')

  await expect(lunes).toHaveCount(2)
  const devuelta = tarjeta(page, 'Mon', '07:00')
  await expect(devuelta).toHaveCount(1)
  await expect(devuelta).toContainText('J-1024')
  await expect(devuelta).toContainText('Pintar oficina')
  await expect(iniciales(devuelta)).toHaveText(['AL', 'LM'])
  await expect(devuelta.getByTitle('Ana López')).toBeVisible()
  await expect(devuelta.getByTitle('Luis Martínez')).toBeVisible()
})
