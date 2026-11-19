// Tarea 7.2 de `employee-absences`: camino feliz de marcar una ausencia arrastrando a un
// empleado a la zona "Absences" de un día, con los datos de prueba de MSW
// (`VITE_USE_MOCKS=true`). Escenarios de `specs/employee-absences/spec.md`: "Marcar una ausencia
// arrastrando", "Diálogo de ausencia" y "Desasignación al marcar una ausencia".
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados;
// y una ausencia de Sofía Romero el miércoles 4 (Vacation, "Viaje familiar").
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

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado, sus tarjetas y su zona de ausencias. */
const dia = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** Zona "Absences" del día `nombre`. */
const zona = (page: Page, nombre: string) => dia(page, nombre).getByText('Absences', { exact: true }).locator('xpath=..')

/** Sección del panel de empleados. */
const panel = (page: Page) => page.getByRole('heading', { name: 'Employees' }).locator('xpath=..')

/** Fila del panel de empleados con el nombre completo `nombre`. */
const enElPanel = (page: Page, nombre: string) => panel(page).getByRole('listitem').filter({ hasText: nombre })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(dia(page, 'Mon').getByTitle('Ana López')).toHaveCount(2)
  await expect(panel(page).getByRole('listitem')).toHaveCount(7)
})

test('marcar a Ana de vacaciones el lunes: arrastrarla a "Absences", elegir "Vacation" y guardar la saca de sus trabajos y la muestra en la zona', async ({
  page,
}) => {
  // La zona del lunes está vacía y solo la del miércoles muestra la ausencia de la semilla.
  await expect(zona(page, 'Mon')).toContainText('No absences')
  await expect(zona(page, 'Wed')).toContainText('Sofía Romero')

  await arrastrar(page, enElPanel(page, 'Ana López'), zona(page, 'Mon'))

  const dialogo = page.getByRole('dialog', { name: 'Mark absence' })
  await expect(dialogo).toBeVisible()
  await expect(dialogo).toContainText('Ana López · Mon, Nov 2')
  // Aún no se ha guardado nada: Ana sigue en sus dos trabajos del lunes.
  await expect(dia(page, 'Mon').getByRole('article').getByTitle('Ana López')).toHaveCount(2)

  await dialogo.getByRole('radio', { name: 'Vacation' }).check()
  await dialogo.getByRole('button', { name: 'Save' }).click()

  await expect(dialogo).toBeHidden()
  await expect(zona(page, 'Mon')).toContainText('Ana López')
  await expect(zona(page, 'Mon')).toContainText('Vacation')
  await expect(zona(page, 'Mon')).not.toContainText('No absences')
  // Ana deja de estar en los dos trabajos del lunes; Luis se queda en el suyo.
  await expect(dia(page, 'Mon').getByRole('article').getByTitle('Ana López')).toHaveCount(0)
  await expect(dia(page, 'Mon').getByRole('article').getByTitle('Luis Martínez')).toHaveCount(1)
  // Las demás zonas no la muestran.
  await expect(zona(page, 'Tue')).not.toContainText('Ana López')
  await expect(page.getByRole('status').filter({ hasText: 'Absence marked' })).toBeVisible()
})
