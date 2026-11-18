// Tareas 9.1 a 9.5 y 15.3 de `schedule-assign`: camino feliz del diseño responsivo y del arrastre
// táctil, con los datos de prueba de MSW (`VITE_USE_MOCKS=true`). La tablet horizontal, el
// arrastre entre días apilados, las filas con muchas programaciones y los recuadros de días con
// trabajo dentro del panel están en `disposiciones-tablet.spec.ts`.
//
// Cubren de `specs/weekly-schedule-board/spec.md` los requisitos "Diseño responsivo por tamaño
// de pantalla" (escenarios "Escritorio", "Tablet vertical" y "Teléfono"), "Tira de días en
// teléfono" ("Cambiar de día" y "Mover soltando sobre la tira") y "Arrastre táctil sin interferir
// con el desplazamiento" ("Deslizar para desplazar" y "Mantener para arrastrar"); de
// `specs/employee-assignment/spec.md`, "Asignación por lista en teléfono" ("Marcar dos
// empleados"); y la decisión 8 de `design.md`.
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
//
// El arrastre táctil se hace con eventos táctiles de Chrome por CDP (`Input.dispatchTouchEvent`),
// porque `page.touchscreen` solo sabe tocar, no mantener ni deslizar.
import { expect, test } from '@playwright/test'
import type { CDPSession, Locator, Page } from '@playwright/test'

const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Columna del día con nombre abreviado `nombre` ("Mon") en el tablero de escritorio o tablet. */
const columna = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** Contenedor del tablero: siete columnas en escritorio y tablet horizontal, siete filas en tablet vertical. */
const tablero = (page: Page) => columna(page, 'Sun').locator('xpath=..')

/** Día `nombre` de la tira de días del teléfono. */
const enLaTira = (page: Page, nombre: string) => page.locator('button[aria-pressed]').filter({ hasText: nombre })

/** Abre la app con el reloj fijado y espera a que carguen las programaciones y los empleados. */
async function abrir(page: Page, tarjetasVisibles: number) {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(tarjetasVisibles)
}

/** Espera dos fotogramas de animación del navegador. */
async function esperarFotogramas(page: Page) {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
}

/** Arrastra `origen` hasta el centro de `destino` con el ratón, en varios pasos para que @dnd-kit active el arrastre. */
async function arrastrarConRaton(page: Page, origen: Locator, destino: Locator) {
  await expect(origen).toBeInViewport()
  const desde = await origen.boundingBox()
  if (!desde) throw new Error('No se pudo medir el origen del arrastre')

  await page.mouse.move(desde.x + desde.width / 2, desde.y + desde.height / 2)
  await page.mouse.down()
  // Primer movimiento corto, por encima de los 5 px que pide el sensor de ratón.
  await page.mouse.move(desde.x + desde.width / 2 + 10, desde.y + desde.height / 2 + 10, { steps: 5 })
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(1)
  // El destino se mide ya con el arrastre en curso: el cajón se ha apartado.
  await expect(destino).toBeInViewport()
  const hasta = await destino.boundingBox()
  if (!hasta) throw new Error('No se pudo medir el destino del arrastre')
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 20 })
  await esperarFotogramas(page)
  await page.mouse.up()
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
}

/** Centro de un elemento en coordenadas de la ventana. */
async function centro(elemento: Locator) {
  const caja = await elemento.boundingBox()
  if (!caja) throw new Error('No se pudo medir el elemento')
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 }
}

/** Envía un evento táctil de un solo dedo por CDP. */
async function tocar(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', punto?: { x: number; y: number }) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' || !punto ? [] : [{ x: Math.round(punto.x), y: Math.round(punto.y) }],
  })
}

test.describe('escritorio, 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('escenario "Escritorio": se ven los siete días, el catálogo y el panel de empleados a la vez', async ({ page }) => {
    await abrir(page, 4)

    for (const nombre of DIAS) await expect(columna(page, nombre)).toBeInViewport({ ratio: 1 })
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeInViewport()
    await expect(page.getByRole('searchbox', { name: 'Search jobs' })).toBeInViewport()
    await expect(page.getByRole('heading', { name: 'Employees' })).toBeInViewport()
    await expect(page.getByText('Ana López', { exact: true })).toBeInViewport()
    await expect(page.locator('button[aria-pressed]')).toHaveCount(0)
  })
})

test.describe('tablet vertical, 800 px', () => {
  test.use({ viewport: { width: 800, height: 1100 } })

  test('escenario "Tablet vertical": se ven los siete días apilados, uno por fila de domingo a sábado, sin desplazamiento horizontal', async ({
    page,
  }) => {
    await abrir(page, 4)
    await expect(page.getByRole('heading', { name: 'Jobs' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Employees' })).toHaveCount(0)

    // Cada día ocupa una fila entera del tablero, debajo del anterior y alineado a la izquierda con él.
    const tableroCaja = await tablero(page).boundingBox()
    if (!tableroCaja) throw new Error('No se pudo medir el tablero')
    let anterior: { x: number; y: number; width: number; height: number } | null = null
    for (const nombre of DIAS) {
      const caja = await columna(page, nombre).boundingBox()
      if (!caja) throw new Error(`No se pudo medir el día ${nombre}`)
      expect(Math.abs(caja.x - tableroCaja.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(caja.width - tableroCaja.width)).toBeLessThanOrEqual(1)
      if (anterior) expect(caja.y).toBeGreaterThanOrEqual(anterior.y + anterior.height)
      anterior = caja
    }

    // Sin desplazamiento horizontal: ni la página ni el tablero son más anchos que la ventana.
    const anchos = await page.evaluate(() => ({
      documento: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
    }))
    expect(anchos.documento).toBe(anchos.ventana)
    expect(await tablero(page).evaluate((elemento) => elemento.scrollWidth - elemento.clientWidth)).toBe(0)
  })

  test('"Jobs" abre el cajón del catálogo y arrastrar "J-1031 Jardín Pérez" de él al miércoles lo programa', async ({
    page,
  }) => {
    await abrir(page, 4)
    const miercoles = columna(page, 'Wed').getByRole('article')
    await expect(miercoles).toHaveCount(0)

    await page.getByRole('button', { name: 'Jobs' }).click()
    const cajon = page.getByRole('dialog', { name: 'Jobs' })
    await expect(cajon).toBeInViewport()
    await cajon.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
    const jardin = cajon.getByRole('listitem').filter({ hasText: 'J-1031' })
    await expect(cajon.getByRole('listitem')).toHaveCount(1)

    await arrastrarConRaton(page, jardin, columna(page, 'Wed'))

    await expect(miercoles).toHaveCount(1)
    await expect(miercoles).toContainText('J-1031')
    await expect(miercoles).toContainText('Jardín Pérez')
    await expect(miercoles).toContainText('07:00')
  })
})

test.describe('teléfono, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('escenarios "Teléfono" y "Cambiar de día": se ve un solo día con la tira, y tocar el jueves muestra el jueves', async ({
    page,
  }) => {
    await abrir(page, 1)

    // La tira tiene los siete días; el único día con columna es hoy, el martes 3.
    await expect(page.locator('button[aria-pressed]')).toHaveCount(7)
    for (const nombre of DIAS) await expect(enLaTira(page, nombre)).toBeInViewport()
    await expect(enLaTira(page, 'Tue')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Tue', { exact: true })).toHaveCount(2)
    await expect(page.getByText('Thu', { exact: true })).toHaveCount(1)
    await expect(page.getByRole('article')).toContainText('J-1019')
    await expect(enLaTira(page, 'Mon').getByLabel('2 jobs')).toBeVisible()

    await enLaTira(page, 'Thu').click()

    await expect(enLaTira(page, 'Thu')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Thu', { exact: true })).toHaveCount(2)
    await expect(page.getByText('Tue', { exact: true })).toHaveCount(1)
    const tarjetas = page.getByRole('article')
    await expect(tarjetas).toHaveCount(1)
    await expect(tarjetas).toContainText('J-1029')
    await expect(tarjetas).toContainText('Instalar lámparas')
    await expect(tarjetas).toBeInViewport()
  })

  test('escenario "Marcar dos empleados": "+" abre "Assign employees" y marcar a Ana y a Pedro los asigna', async ({
    page,
  }) => {
    await abrir(page, 1)
    // "J-1029 Instalar lámparas" del jueves no tiene empleados.
    await enLaTira(page, 'Thu').click()
    const lamparas = page.getByRole('article').filter({ hasText: 'J-1029' })
    await expect(lamparas).toContainText('No employees')

    await lamparas.getByRole('button', { name: 'Assign employees' }).click()
    const panel = page.getByRole('dialog', { name: 'Assign employees' })
    await expect(panel).toBeInViewport()

    // Las casillas reflejan el cambio en el ciclo siguiente: se pulsa y se espera a que quede marcada.
    const ana = panel.getByRole('checkbox', { name: 'Ana López' })
    await ana.click()
    await expect(ana).toBeChecked()
    // El spec usa a Luis, pero en la semilla tiene cargo "Office" y la lista solo ofrece a los
    // cargos "Supervisor" y "Labor": se marca a Pedro (Supervisor).
    const pedro = panel.getByRole('checkbox', { name: 'Pedro Sánchez' })
    await pedro.click()
    await expect(pedro).toBeChecked()

    await panel.getByRole('button', { name: 'Done' }).click()
    await expect(panel).toHaveCount(0)
    await expect(lamparas.locator('span[title]:not([aria-label^="Comment:"])')).toHaveText(['AL', 'PS'])
    await expect(lamparas).not.toContainText('No employees')
  })
})

test.describe('táctil en teléfono, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('escenarios "Mantener para arrastrar" y "Mover soltando sobre la tira": mantener una tarjeta del lunes y soltarla en "Wed" la pasa al miércoles', async ({
    page,
  }) => {
    await abrir(page, 1)
    await enLaTira(page, 'Mon').tap()
    const lunes = page.getByRole('article')
    await expect(lunes).toHaveCount(2)
    await expect(enLaTira(page, 'Wed').getByLabel('0 jobs')).toBeVisible()
    const tarjeta = lunes.filter({ hasText: '08:00' })

    const cdp = await page.context().newCDPSession(page)
    const desde = await centro(tarjeta)
    const hasta = await centro(enLaTira(page, 'Wed'))
    await tocar(cdp, 'touchStart', desde)
    // Se mantiene el dedo quieto unos 400 ms, más que los 250 ms que pide el arrastre táctil.
    await page.waitForTimeout(400)
    await tocar(cdp, 'touchMove', { x: desde.x + 3, y: desde.y - 3 })
    await expect(page.locator('[data-dnd-dragging]')).toHaveCount(1)
    for (let paso = 1; paso <= 15; paso++) {
      await tocar(cdp, 'touchMove', {
        x: desde.x + ((hasta.x - desde.x) * paso) / 15,
        y: desde.y + ((hasta.y - desde.y) * paso) / 15,
      })
    }
    await esperarFotogramas(page)
    await tocar(cdp, 'touchEnd')
    await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)

    // El lunes se queda con una y el miércoles pasa a tener la de las 08:00.
    await expect(enLaTira(page, 'Wed').getByLabel('1 job')).toBeVisible()
    await expect(enLaTira(page, 'Mon').getByLabel('1 job')).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(1)
    await enLaTira(page, 'Wed').tap()
    const miercoles = page.getByRole('article')
    await expect(miercoles).toHaveCount(1)
    await expect(miercoles).toContainText('J-1024')
    await expect(miercoles).toContainText('08:00')
  })
})

test.describe('táctil en tablet vertical, 800 px', () => {
  // Altura de ventana menor que la página, para que haya desplazamiento vertical.
  test.use({ viewport: { width: 800, height: 500 }, hasTouch: true, isMobile: true })

  test('escenario "Deslizar para desplazar": un deslizamiento rápido sobre una tarjeta desplaza la página en vertical y la tarjeta no se mueve', async ({
    page,
  }) => {
    await abrir(page, 4)
    const pintar = columna(page, 'Mon').getByRole('article').filter({ hasText: '07:00' })
    await expect(pintar).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    const cdp = await page.context().newCDPSession(page)
    const desde = await centro(pintar)
    // Deslizamiento rápido de 180 px hacia arriba, sin pausa tras tocar.
    await tocar(cdp, 'touchStart', desde)
    for (let paso = 1; paso <= 6; paso++) {
      await tocar(cdp, 'touchMove', { x: desde.x, y: desde.y - paso * 30 })
    }
    await tocar(cdp, 'touchEnd')

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    // Sin desplazamiento horizontal.
    expect(await page.evaluate(() => window.scrollX)).toBe(0)
    await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
    // La tarjeta sigue en el lunes, igual que antes.
    await expect(columna(page, 'Mon').getByRole('article')).toHaveCount(2)
    await expect(pintar).toContainText('J-1024')
    await expect(pintar.locator('span[title]:not([aria-label^="Comment:"])')).toHaveText(['AL', 'LM'])
    await expect(page.getByRole('article')).toHaveCount(4)
  })
})
