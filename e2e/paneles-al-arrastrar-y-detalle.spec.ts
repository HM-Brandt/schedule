// Camino feliz de los cajones y la hoja inferior que se cierran al soltar, y del tipo y la
// dirección del trabajo en el detalle, con los datos de prueba de MSW (`VITE_USE_MOCKS=true`).
//
// - En tablet, el cajón "Jobs" o "Employees" se aparta al empezar a arrastrar y se cierra al
//   soltar, y lo soltado aparece en el tablero.
// - En teléfono, la hoja inferior "Jobs" hace lo mismo.
// - El detalle de una programación muestra el tipo del trabajo y su dirección como enlace a
//   Google Maps, que se abre en otra pestaña sin cerrar el detalle.
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
// "J-1031 Jardín Pérez" no está programado y el miércoles 4 está vacío. Todos los trabajos son de
// tipo "Interior" y tienen la dirección "Calle Mayor 1".
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** Abre la app con el reloj fijado y espera a que carguen las programaciones visibles. */
async function abrir(page: Page, tarjetasVisibles: number) {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(tarjetasVisibles)
}

async function medir(elemento: Locator) {
  const caja = await elemento.boundingBox()
  if (!caja) throw new Error('No se pudo medir el elemento')
  return caja
}

/**
 * Arrastra `origen` hasta el centro de `destino` con el ratón y lo suelta. Comprueba que el
 * `panel` abierto se aparta durante el arrastre; el destino se mide ya con el panel apartado.
 */
async function arrastrarDesde(page: Page, panel: Locator, origen: Locator, destino: Locator) {
  await expect(origen).toBeInViewport()
  const desde = await medir(origen)
  await page.mouse.move(desde.x + desde.width / 2, desde.y + desde.height / 2)
  await page.mouse.down()
  // Primer movimiento corto, por encima de los 5 px que pide el sensor de ratón.
  await page.mouse.move(desde.x + desde.width / 2 + 10, desde.y + desde.height / 2 + 10, { steps: 5 })
  await expect(panel).not.toBeInViewport()
  await expect(destino).toBeInViewport()
  const hasta = await medir(destino)
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 20 })
  // @dnd-kit calcula el destino bajo el puntero en los fotogramas siguientes.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
  await page.mouse.up()
}

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
const dia = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** Día `nombre` de la tira de días del teléfono. */
const enLaTira = (page: Page, nombre: string) => page.locator('button[aria-pressed]').filter({ hasText: nombre })

/** Iniciales de los empleados de una tarjeta, en orden. */
const iniciales = (tarjeta: Locator) => tarjeta.locator('span[title]:not([aria-label^="Comment:"])')

test.describe('tablet horizontal, 1180 px', () => {
  test.use({ viewport: { width: 1180, height: 820 } })

  test('arrastrar "J-1031 Jardín Pérez" del cajón "Jobs" al miércoles cierra el cajón y la tarjeta aparece en el miércoles', async ({
    page,
  }) => {
    await abrir(page, 4)
    const miercoles = dia(page, 'Wed').getByRole('article')
    await expect(miercoles).toHaveCount(0)

    await page.getByRole('button', { name: 'Jobs' }).click()
    const cajon = page.getByRole('dialog', { name: 'Jobs' })
    await expect(cajon).toBeInViewport()
    await cajon.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
    const jardin = cajon.getByRole('listitem').filter({ hasText: 'J-1031' })
    await expect(cajon.getByRole('listitem')).toHaveCount(1)

    await arrastrarDesde(page, cajon, jardin, dia(page, 'Wed'))

    await expect(page.getByRole('dialog', { name: 'Jobs' })).toHaveCount(0)
    await expect(miercoles).toHaveCount(1)
    await expect(miercoles).toContainText('J-1031')
    await expect(miercoles).toContainText('Jardín Pérez')
    await expect(miercoles).toHaveAttribute('aria-disabled', 'false')
  })

  test('arrastrar a Pedro Sánchez del cajón "Employees" a la tarjeta del jueves cierra el cajón y la tarjeta muestra "PS"', async ({
    page,
  }) => {
    await abrir(page, 4)
    const lamparas = dia(page, 'Thu').getByRole('article').filter({ hasText: 'J-1029' })
    await expect(lamparas).toContainText('No employees')

    await page.getByRole('button', { name: 'Employees' }).click()
    const cajon = page.getByRole('dialog', { name: 'Employees' })
    await expect(cajon).toBeInViewport()
    const pedro = cajon.getByRole('listitem').filter({ hasText: 'Pedro Sánchez' })

    await arrastrarDesde(page, cajon, pedro, lamparas)

    await expect(page.getByRole('dialog', { name: 'Employees' })).toHaveCount(0)
    await expect(iniciales(lamparas)).toHaveText(['PS'])
    await expect(lamparas).not.toContainText('No employees')
  })
})

test.describe('teléfono, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('arrastrar "J-1031 Jardín Pérez" de la hoja "Jobs" al miércoles de la tira cierra la hoja y lo programa el miércoles', async ({
    page,
  }) => {
    await abrir(page, 1)
    await expect(enLaTira(page, 'Wed').getByLabel('0 jobs')).toBeVisible()

    await page.getByRole('button', { name: 'Jobs', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Jobs' })
    await expect(hoja).toBeInViewport()
    await hoja.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
    const jardin = hoja.getByRole('listitem').filter({ hasText: 'J-1031' })
    await expect(hoja.getByRole('listitem')).toHaveCount(1)

    await arrastrarDesde(page, hoja, jardin, enLaTira(page, 'Wed'))

    await expect(page.getByRole('dialog', { name: 'Jobs' })).toHaveCount(0)
    await expect(enLaTira(page, 'Wed').getByLabel('1 job')).toBeVisible()
    await enLaTira(page, 'Wed').click()
    const miercoles = page.getByRole('article')
    await expect(miercoles).toHaveCount(1)
    await expect(miercoles).toContainText('J-1031')
    await expect(miercoles).toContainText('Jardín Pérez')
  })
})

test.describe('escritorio, 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('el detalle de "J-1024" muestra el tipo "Interior" y la dirección, que abre Google Maps en otra pestaña sin cerrar el detalle', async ({
    page,
    context,
  }) => {
    // Google Maps no se visita de verdad: se responde con una página vacía.
    await context.route('https://www.google.com/**', (ruta) => ruta.fulfill({ contentType: 'text/html', body: '<p>Maps</p>' }))
    await abrir(page, 4)

    await dia(page, 'Mon').getByRole('article').filter({ hasText: '07:00' }).click()
    const detalle = page.getByRole('dialog', { name: 'J-1024 Pintar oficina' })
    await expect(detalle).toBeVisible()
    await expect(detalle.getByText('Interior', { exact: true })).toBeVisible()
    const direccion = detalle.getByRole('link', { name: 'Calle Mayor 1' })
    await expect(direccion).toBeVisible()
    await expect(direccion).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=Calle%20Mayor%201')

    const pestaña = context.waitForEvent('page')
    await direccion.click()

    const maps = await pestaña
    await expect(maps).toHaveURL('https://www.google.com/maps/search/?api=1&query=Calle%20Mayor%201')
    await expect(detalle).toBeVisible()
  })
})
