// Tareas 6.3, 6.4 y 6.5 de `schedule-assign`: camino feliz de mover, duplicar con Alt y
// quitar una tarjeta arrastrándola, y de los resaltados de destino válido, con los datos de
// prueba de MSW (`VITE_USE_MOCKS=true`).
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
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
  return desde
}

/** Lleva el puntero, durante un arrastre, hasta el centro de `destino`. */
async function llevarA(page: Page, destino: Locator | { x: number; y: number; width: number; height: number }) {
  const hasta = 'boundingBox' in destino ? await destino.boundingBox() : destino
  if (!hasta) throw new Error('No se pudo medir el destino del arrastre')
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 20 })
  // @dnd-kit calcula el destino bajo el puntero en los fotogramas siguientes.
  await esperarFotogramas(page)
}

/** Arrastra `origen` hasta el centro de `destino` y lo suelta; con `alt`, soltando con Alt pulsado. */
async function arrastrar(page: Page, origen: Locator, destino: Locator, { alt = false } = {}) {
  await expect(destino).toBeInViewport()
  await empezarArrastre(page, origen)
  await llevarA(page, destino)
  if (alt) await page.keyboard.down('Alt')
  await page.mouse.up()
  if (alt) await page.keyboard.up('Alt')
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
}

/** Espera dos fotogramas de animación del navegador. */
async function esperarFotogramas(page: Page) {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
}

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
const dia = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** La sección del catálogo de trabajos, que también es el destino para quitar tarjetas. */
const catalogo = (page: Page) => page.getByRole('heading', { name: 'Jobs' }).locator('xpath=..')

/** Programa `numero` en el día `nombre` arrastrándolo del catálogo, tras buscarlo para que quepa en la vista. */
async function programarDesdeElCatalogo(page: Page, numero: string, nombre: string) {
  await page.getByRole('searchbox', { name: 'Search jobs' }).fill(numero.replace('J-', ''))
  const trabajos = catalogo(page).getByRole('list').getByRole('listitem')
  await expect(trabajos).toHaveCount(1)
  const tarjetas = dia(page, nombre).getByRole('article')
  const antes = await tarjetas.count()
  await arrastrar(page, trabajos.filter({ hasText: numero }), dia(page, nombre))
  await expect(tarjetas).toHaveCount(antes + 1)
}

/** Iniciales de los empleados de una tarjeta, en orden. */
const iniciales = (tarjeta: Locator) => tarjeta.locator('[title]:not([aria-label^="Comment:"])')

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(dia(page, 'Mon').getByTitle('Ana López')).toHaveCount(2)
})

test('mover "J-1024 Pintar oficina" (07:00, con Ana y Luis) del lunes al martes conserva su hora y sus empleados', async ({
  page,
}) => {
  const lunes = dia(page, 'Mon').getByRole('article')
  const martes = dia(page, 'Tue').getByRole('article')
  await expect(martes.filter({ hasText: 'J-1024' })).toHaveCount(0)
  const pintar = lunes.filter({ hasText: '07:00' })
  await expect(iniciales(pintar)).toHaveText(['AL', 'LM'])

  await arrastrar(page, pintar, dia(page, 'Tue'))

  const movida = martes.filter({ hasText: 'J-1024' })
  await expect(movida).toHaveCount(1)
  await expect(movida).toContainText('Pintar oficina')
  await expect(movida).toContainText('07:00')
  await expect(iniciales(movida)).toHaveText(['AL', 'LM'])
  await expect(movida.getByTitle('Ana López')).toBeVisible()
  await expect(movida.getByTitle('Luis Martínez')).toBeVisible()

  // El lunes ya no la muestra: solo queda la de las 08:00.
  await expect(lunes).toHaveCount(1)
  await expect(lunes).toContainText('08:00')
  await expect(lunes.filter({ hasText: '07:00' })).toHaveCount(0)
})

test('mover "J-1024 Pintar oficina" (07:00) al martes, que ya lo tiene a las 07:00, lo deja a las 08:00', async ({
  page,
}) => {
  // Preparación: el martes pasa a tener "J-1024" a las 07:00.
  await programarDesdeElCatalogo(page, 'J-1024', 'Tue')
  const pintarDelMartes = dia(page, 'Tue').getByRole('article').filter({ hasText: 'J-1024' })
  await expect(pintarDelMartes).toHaveCount(1)
  await expect(pintarDelMartes).toContainText('07:00')

  const lunes = dia(page, 'Mon').getByRole('article')
  await arrastrar(page, lunes.filter({ hasText: '07:00' }), dia(page, 'Tue'))

  await expect(pintarDelMartes).toHaveCount(2)
  await expect(pintarDelMartes.nth(0)).toContainText('07:00')
  await expect(pintarDelMartes.nth(1)).toContainText('08:00')
  // La movida es la de Ana y Luis; la que ya estaba no tiene empleados.
  await expect(iniciales(pintarDelMartes.nth(1))).toHaveText(['AL', 'LM'])
  await expect(lunes).toHaveCount(1)
})

test('arrastrar con Alt "J-1024 Pintar oficina" (con Ana) del lunes al viernes la duplica', async ({ page }) => {
  const lunes = dia(page, 'Mon').getByRole('article')
  const viernes = dia(page, 'Fri').getByRole('article')
  await expect(viernes).toHaveCount(0)
  const conAna = lunes.filter({ hasText: '08:00' })
  await expect(iniciales(conAna)).toHaveText(['AL'])

  await arrastrar(page, conAna, dia(page, 'Fri'), { alt: true })

  await expect(viernes).toHaveCount(1)
  await expect(viernes).toContainText('J-1024')
  await expect(viernes).toContainText('Pintar oficina')
  await expect(viernes).toContainText('07:00')
  await expect(iniciales(viernes)).toHaveText(['AL'])
  await expect(viernes.getByTitle('Ana López')).toBeVisible()

  // El lunes conserva sus dos programaciones.
  await expect(lunes).toHaveCount(2)
  await expect(lunes.filter({ hasText: '08:00' })).toHaveCount(1)
  await expect(iniciales(lunes.filter({ hasText: '08:00' }))).toHaveText(['AL'])
})

test('arrastrar la tarjeta "J-1031 Jardín Pérez" del jueves al catálogo la quita del jueves y el trabajo sigue en el catálogo', async ({
  page,
}) => {
  // Preparación: el jueves pasa a tener "J-1031 Jardín Pérez".
  await programarDesdeElCatalogo(page, 'J-1031', 'Thu')
  const jueves = dia(page, 'Thu').getByRole('article')
  const jardin = jueves.filter({ hasText: 'J-1031' })
  await expect(jardin).toHaveCount(1)
  await expect(jueves).toHaveCount(2)

  await arrastrar(page, jardin, catalogo(page))

  await expect(jardin).toHaveCount(0)
  await expect(jueves).toHaveCount(1)
  await expect(jueves).toContainText('J-1029')
  const enElCatalogo = catalogo(page).getByRole('list').getByRole('listitem').filter({ hasText: 'J-1031' })
  await expect(enElCatalogo).toHaveCount(1)
  await expect(enElCatalogo).toContainText('Jardín Pérez')
})

test.describe('resaltado de los destinos válidos durante el arrastre', () => {
  const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  test('arrastrando una tarjeta se resaltan los siete días y el catálogo', async ({ page }) => {
    for (const nombre of DIAS) await expect(dia(page, nombre)).not.toHaveClass(/accepting/)
    await expect(catalogo(page)).not.toHaveClass(/accepting/)

    const tarjeta = dia(page, 'Tue').getByRole('article')
    const desde = await empezarArrastre(page, tarjeta)

    for (const nombre of DIAS) await expect(dia(page, nombre)).toHaveClass(/accepting/)
    await expect(catalogo(page)).toHaveClass(/accepting/)

    // Se suelta donde estaba: no cambia nada y los resaltados desaparecen.
    await llevarA(page, desde)
    await page.mouse.up()
    for (const nombre of DIAS) await expect(dia(page, nombre)).not.toHaveClass(/accepting/)
    await expect(catalogo(page)).not.toHaveClass(/accepting/)
    await expect(dia(page, 'Tue').getByRole('article')).toHaveCount(1)
  })

  test('arrastrando un trabajo del catálogo se resaltan los siete días y el catálogo no', async ({ page }) => {
    const trabajo = catalogo(page).getByRole('list').getByRole('listitem').filter({ hasText: 'J-1018' })
    const desde = await empezarArrastre(page, trabajo)

    for (const nombre of DIAS) await expect(dia(page, nombre)).toHaveClass(/accepting/)
    await expect(catalogo(page)).not.toHaveClass(/accepting/)

    // Se suelta donde estaba, en el catálogo: no se programa nada.
    await llevarA(page, desde)
    await page.mouse.up()
    for (const nombre of DIAS) await expect(dia(page, nombre)).not.toHaveClass(/accepting/)
    await expect(page.getByRole('article')).toHaveCount(4)
  })
})
