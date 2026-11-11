// Tareas 7.1 a 7.4 de `schedule-assign`: camino feliz de asignar, mover y retirar empleados
// arrastrándolos, y del indicador de carga durante el arrastre, con los datos de prueba de MSW
// (`VITE_USE_MOCKS=true`). Escenarios de `specs/employee-assignment/spec.md`.
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
// Tiene 8 empleados activos y 2 inactivos (Raúl Torres y Lucía Navarro).
// Los datos que la semilla no tiene se preparan en cada test desde la interfaz, programando
// antes el trabajo desde el catálogo.
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

/** Lleva el puntero, durante un arrastre, hasta el centro de `destino`. */
async function llevarA(page: Page, destino: Locator) {
  await expect(destino).toBeInViewport()
  const hasta = await destino.boundingBox()
  if (!hasta) throw new Error('No se pudo medir el destino del arrastre')
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 20 })
  // @dnd-kit calcula el destino bajo el puntero en los fotogramas siguientes.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
}

/** Arrastra `origen` hasta el centro de `destino` y lo suelta. */
async function arrastrar(page: Page, origen: Locator, destino: Locator) {
  await empezarArrastre(page, origen)
  await llevarA(page, destino)
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

/** Iniciales de los empleados de una tarjeta, en orden. */
const iniciales = (tarjetaDelDia: Locator) => tarjetaDelDia.locator('[title]:not([aria-label^="Comment:"])')

/**
 * Programa `numero` en el día `nombre` arrastrándolo del catálogo, tras buscarlo para que quepa
 * en la vista, y espera a que el servidor confirme la nueva tarjeta (deja de estar desactivada).
 */
async function programarDesdeElCatalogo(page: Page, numero: string, nombre: string) {
  const catalogo = page.getByRole('heading', { name: 'Jobs' }).locator('xpath=..')
  await page.getByRole('searchbox', { name: 'Search jobs' }).fill(numero.replace('J-', ''))
  const trabajos = catalogo.getByRole('list').getByRole('listitem')
  await expect(trabajos).toHaveCount(1)
  const nuevas = tarjeta(page, nombre, numero)
  const antes = await nuevas.count()
  await arrastrar(page, trabajos.filter({ hasText: numero }), dia(page, nombre))
  await expect(nuevas).toHaveCount(antes + 1)
  await expect(nuevas.last()).toHaveAttribute('aria-disabled', 'false')
  return nuevas.last()
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(dia(page, 'Mon').getByTitle('Ana López')).toHaveCount(2)
  await expect(panel(page).getByRole('listitem')).toHaveCount(8)
})

test('el panel "Employees" muestra a los activos con iniciales, nombre y cargo, y no a los inactivos', async ({
  page,
}) => {
  const ana = enElPanel(page, 'Ana López')
  await expect(ana).toBeVisible()
  await expect(ana).toContainText('AL')
  await expect(ana).toContainText('Pintora')
  await expect(enElPanel(page, 'Luis Martínez')).toBeVisible()

  await expect(panel(page)).not.toContainText('Raúl Torres')
  await expect(panel(page)).not.toContainText('Lucía Navarro')
})

test('asignar a Ana: arrastrarla del panel a "J-1024 Pintar oficina" del lunes la muestra en la tarjeta', async ({
  page,
}) => {
  // Preparación: una tercera "J-1024" el lunes, sin empleados (queda a las 09:00).
  const pintar = await programarDesdeElCatalogo(page, 'J-1024', 'Mon')
  await expect(pintar).toContainText('09:00')
  await expect(pintar).toContainText('No employees')

  await arrastrar(page, enElPanel(page, 'Ana López'), pintar)

  await expect(pintar.getByTitle('Ana López')).toHaveText('AL')
  await expect(pintar).not.toContainText('No employees')
})

test('soltar a Ana dos veces en "J-1024 Pintar oficina" del lunes: la tarjeta la sigue mostrando una sola vez', async ({
  page,
}) => {
  const pintar = tarjeta(page, 'Mon', '07:00')
  await expect(iniciales(pintar)).toHaveText(['AL', 'LM'])

  await arrastrar(page, enElPanel(page, 'Ana López'), pintar)

  await expect(pintar.getByTitle('Ana López')).toHaveCount(1)
  await expect(iniciales(pintar)).toHaveText(['AL', 'LM'])
})

test('Ana en dos trabajos el lunes: soltarla en "J-1031 Jardín Pérez" la deja también en "J-1024 Pintar oficina"', async ({
  page,
}) => {
  // Preparación: "J-1031 Jardín Pérez" el lunes, sin empleados.
  const jardin = await programarDesdeElCatalogo(page, 'J-1031', 'Mon')
  const pintar = tarjeta(page, 'Mon', 'J-1024').first()
  await expect(pintar.getByTitle('Ana López')).toBeVisible()

  await arrastrar(page, enElPanel(page, 'Ana López'), jardin)

  await expect(jardin.getByTitle('Ana López')).toHaveText('AL')
  await expect(pintar.getByTitle('Ana López')).toHaveText('AL')
})

test('mover a Luis de "J-1024 Pintar oficina" del lunes a "J-1040 Mudanza López" del miércoles', async ({ page }) => {
  // Preparación: "J-1040 Mudanza López" el miércoles, sin empleados.
  const mudanza = await programarDesdeElCatalogo(page, 'J-1040', 'Wed')
  const pintar = tarjeta(page, 'Mon', '07:00')
  await expect(iniciales(pintar)).toHaveText(['AL', 'LM'])

  await arrastrar(page, pintar.getByTitle('Luis Martínez'), mudanza)

  await expect(mudanza.getByTitle('Luis Martínez')).toHaveText('LM')
  await expect(pintar.getByTitle('Luis Martínez')).toHaveCount(0)
  await expect(iniciales(pintar)).toHaveText(['AL'])
})

test('arrastrar a Ana fuera de cualquier tarjeta la retira de "J-1024 Pintar oficina" del lunes', async ({ page }) => {
  const pintar = tarjeta(page, 'Mon', '07:00')
  await expect(iniciales(pintar)).toHaveText(['AL', 'LM'])

  await arrastrar(page, pintar.getByTitle('Ana López'), page.getByRole('heading', { level: 1, name: 'Weekly schedule' }))

  await expect(pintar.getByTitle('Ana López')).toHaveCount(0)
  await expect(iniciales(pintar)).toHaveText(['LM'])
})

test('indicador de carga: arrastrando a Ana el lunes indica "2 jobs" y el martes no muestra indicador', async ({
  page,
}) => {
  const lunes = dia(page, 'Mon')
  const martes = dia(page, 'Tue')
  await expect(lunes).not.toContainText(/\d+ jobs?/)

  await empezarArrastre(page, enElPanel(page, 'Ana López'))

  await expect(lunes.getByText('2 jobs', { exact: true })).toBeVisible()
  await expect(martes).not.toContainText(/\d+ jobs?/)

  // Se suelta donde estaba, en el panel: no se asigna nada y el indicador desaparece.
  await llevarA(page, enElPanel(page, 'Ana López'))
  await page.mouse.up()
  await expect(lunes).not.toContainText(/\d+ jobs?/)
  await expect(iniciales(tarjeta(page, 'Mon', '07:00'))).toHaveText(['AL', 'LM'])
})
