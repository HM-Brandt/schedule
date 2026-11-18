// Tareas 15.2, 15.3 y 15.4 de `schedule-assign`: camino feliz de las disposiciones de tablet, con
// los datos de prueba de MSW (`VITE_USE_MOCKS=true`).
//
// Cubren de `specs/weekly-schedule-board/spec.md` el requisito "Diseño responsivo por tamaño de
// pantalla" (escenarios "Tablet horizontal", "Tablet vertical", "Muchas programaciones en un día
// apilado" y "Recuadros dentro del panel") y la decisión 8 de `design.md`: de 1024 a 1279 px, siete
// columnas a todo el ancho con el catálogo y los empleados en cajones; de 640 a 1023 px, los siete
// días apilados, con las tarjetas de cada día una al lado de la otra y pasando a otra línea.
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
// "J-1031 Jardín Pérez" no está programado en ninguna semana y el miércoles 4 está vacío.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Abre la app con el reloj fijado y espera a que carguen las programaciones visibles. */
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

/**
 * Arrastra `origen` hasta el centro de `destino` con el ratón y lo suelta. El destino se mide con
 * el arrastre ya en curso, porque el cajón abierto se aparta al empezar a arrastrar.
 */
async function arrastrar(page: Page, origen: Locator, destino: Locator) {
  await expect(origen).toBeInViewport()
  const desde = await medir(origen)
  await page.mouse.move(desde.x + desde.width / 2, desde.y + desde.height / 2)
  await page.mouse.down()
  // Primer movimiento corto, por encima de los 5 px que pide el sensor de ratón.
  await page.mouse.move(desde.x + desde.width / 2 + 10, desde.y + desde.height / 2 + 10, { steps: 5 })
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(1)
  await expect(destino).toBeInViewport()
  const hasta = await medir(destino)
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 20 })
  // @dnd-kit calcula el destino bajo el puntero en los fotogramas siguientes.
  await esperarFotogramas(page)
  await page.mouse.up()
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
}

async function medir(elemento: Locator) {
  const caja = await elemento.boundingBox()
  if (!caja) throw new Error('No se pudo medir el elemento')
  return caja
}

/** Día con nombre abreviado `nombre` ("Mon") del tablero: su encabezado y sus tarjetas. */
const dia = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** Contenedor del tablero. */
const tablero = (page: Page) => dia(page, 'Sun').locator('xpath=..')

/** Abre el cajón "Jobs" y deja en él solo "J-1031 Jardín Pérez"; devuelve ese trabajo. */
async function jardinDelCajon(page: Page) {
  await page.getByRole('button', { name: 'Jobs' }).click()
  const cajon = page.getByRole('dialog', { name: 'Jobs' })
  await expect(cajon).toBeInViewport()
  await cajon.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
  await expect(cajon.getByRole('list').getByRole('listitem')).toHaveCount(1)
  return cajon.getByRole('list').getByRole('listitem').filter({ hasText: 'J-1031' })
}

/** Comprueba que ni la página ni el tablero tienen desplazamiento horizontal. */
async function comprobarSinDesplazamientoHorizontal(page: Page) {
  const anchos = await page.evaluate(() => ({
    documento: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }))
  expect(anchos.documento).toBe(anchos.ventana)
  expect(await tablero(page).evaluate((elemento) => elemento.scrollWidth - elemento.clientWidth)).toBe(0)
}

/**
 * Comprueba que, en cada fila de empleado de `contenedor`, los siete recuadros de días con trabajo
 * se ven y quedan dentro de la fila.
 */
async function comprobarRecuadrosDentro(contenedor: Locator) {
  const filas = contenedor.getByRole('listitem')
  // 7 empleados en el panel: los activos con cargo "Supervisor" o "Labor".
  await expect(filas).toHaveCount(7)
  const medidas = await filas.evaluateAll((elementos) =>
    elementos.map((fila) => {
      const caja = fila.getBoundingClientRect()
      const recuadros = [...fila.querySelectorAll('[role="img"] > *')].map((recuadro) => recuadro.getBoundingClientRect())
      return {
        nombre: fila.textContent,
        fila: { izquierda: caja.left, derecha: caja.right, arriba: caja.top, abajo: caja.bottom },
        recuadros: recuadros.map((r) => ({ izquierda: r.left, derecha: r.right, arriba: r.top, abajo: r.bottom, ancho: r.width })),
      }
    }),
  )
  for (const { nombre, fila, recuadros } of medidas) {
    expect(recuadros, `recuadros de ${nombre}`).toHaveLength(7)
    for (const recuadro of recuadros) {
      expect(recuadro.ancho, `ancho de un recuadro de ${nombre}`).toBeGreaterThan(0)
      expect(recuadro.izquierda, `borde izquierdo de un recuadro de ${nombre}`).toBeGreaterThanOrEqual(fila.izquierda)
      expect(recuadro.derecha, `borde derecho de un recuadro de ${nombre}`).toBeLessThanOrEqual(fila.derecha)
      expect(recuadro.arriba, `borde superior de un recuadro de ${nombre}`).toBeGreaterThanOrEqual(fila.arriba)
      expect(recuadro.abajo, `borde inferior de un recuadro de ${nombre}`).toBeLessThanOrEqual(fila.abajo)
    }
  }
}

test.describe('tablet horizontal, 1180 px', () => {
  test.use({ viewport: { width: 1180, height: 820 } })

  test('escenario "Tablet horizontal": siete columnas a todo el ancho sin paneles laterales, y arrastrar "J-1031 Jardín Pérez" del cajón "Jobs" al miércoles lo programa', async ({
    page,
  }) => {
    await abrir(page, 4)
    await expect(page.getByRole('heading', { name: 'Jobs' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Employees' })).toHaveCount(0)
    await expect(page.locator('button[aria-pressed]')).toHaveCount(0)

    // Las siete columnas, completas, en una sola fila y de izquierda a derecha.
    const cajas = []
    for (const nombre of DIAS) {
      await expect(dia(page, nombre)).toBeInViewport({ ratio: 1 })
      cajas.push(await medir(dia(page, nombre)))
    }
    for (let i = 1; i < cajas.length; i++) {
      expect(Math.abs(cajas[i].y - cajas[0].y)).toBeLessThanOrEqual(1)
      expect(cajas[i].x).toBeGreaterThanOrEqual(cajas[i - 1].x + cajas[i - 1].width)
    }
    // A todo el ancho: el tablero ocupa el ancho de la página salvo sus márgenes.
    const tableroCaja = await medir(tablero(page))
    const principal = await medir(page.getByRole('main'))
    const margen = await page
      .getByRole('main')
      .evaluate((elemento) => parseFloat(getComputedStyle(elemento).paddingLeft) + parseFloat(getComputedStyle(elemento).paddingRight))
    expect(Math.abs(tableroCaja.width - (principal.width - margen))).toBeLessThanOrEqual(1)
    await comprobarSinDesplazamientoHorizontal(page)

    const miercoles = dia(page, 'Wed').getByRole('article')
    await expect(miercoles).toHaveCount(0)
    const jardin = await jardinDelCajon(page)

    await arrastrar(page, jardin, dia(page, 'Wed'))

    await expect(miercoles).toHaveCount(1)
    await expect(miercoles).toContainText('J-1031')
    await expect(miercoles).toContainText('Jardín Pérez')
    await expect(miercoles).toContainText('07:00')
    await expect(miercoles).toHaveAttribute('aria-disabled', 'false')
  })
})

test.describe('tablet vertical, 834 px', () => {
  test.use({ viewport: { width: 834, height: 1194 } })

  test('arrastrar la tarjeta de las 08:00 del lunes al miércoles, entre días apilados, la mueve', async ({ page }) => {
    await abrir(page, 4)
    // Los días están apilados: el miércoles queda debajo del lunes.
    const lunesCaja = await medir(dia(page, 'Mon'))
    const miercolesCaja = await medir(dia(page, 'Wed'))
    expect(miercolesCaja.y).toBeGreaterThan(lunesCaja.y + lunesCaja.height)
    const lunes = dia(page, 'Mon').getByRole('article')
    const miercoles = dia(page, 'Wed').getByRole('article')
    await expect(lunes).toHaveCount(2)
    await expect(miercoles).toHaveCount(0)

    await arrastrar(page, lunes.filter({ hasText: '08:00' }), dia(page, 'Wed'))

    await expect(miercoles).toHaveCount(1)
    await expect(miercoles).toContainText('J-1024')
    await expect(miercoles).toContainText('08:00')
    await expect(lunes).toHaveCount(1)
    await expect(lunes).toContainText('07:00')
    await expect(page.getByRole('status').filter({ hasText: 'Job moved' })).toBeVisible()
  })
})

test.describe('tablet vertical, 800 px', () => {
  test.use({ viewport: { width: 800, height: 1100 } })

  test('escenario "Muchas programaciones en un día apilado": las tarjetas del lunes que no caben en una línea pasan a la siguiente dentro de la fila del lunes', async ({
    page,
  }) => {
    await abrir(page, 4)
    const lunes = dia(page, 'Mon').getByRole('article')
    await expect(lunes).toHaveCount(2)

    // Se programa "J-1031 Jardín Pérez" cuatro veces en el lunes desde el cajón "Jobs", que se
    // cierra al soltar y se vuelve a abrir para cada arrastre.
    const cajon = page.getByRole('dialog', { name: 'Jobs' })
    for (let veces = 1; veces <= 4; veces++) {
      const jardin = await jardinDelCajon(page)
      // El cajón entra con una transición: se espera a que esté del todo en su sitio.
      await expect.poll(async () => (await medir(cajon)).x).toBe(0)
      await arrastrar(page, jardin, dia(page, 'Mon'))
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(lunes).toHaveCount(2 + veces)
      // Se espera a que el servidor confirme la nueva antes de arrastrar la siguiente.
      await expect(dia(page, 'Mon').locator('article[aria-disabled="true"]')).toHaveCount(0)
    }

    // Las seis tarjetas quedan dentro de la fila del lunes, en más de una línea: la primera línea
    // tiene varias tarjetas una al lado de la otra y las demás siguen debajo.
    const fila = await medir(dia(page, 'Mon'))
    const cajas = []
    for (let i = 0; i < 6; i++) cajas.push(await medir(lunes.nth(i)))
    for (const caja of cajas) {
      expect(caja.x).toBeGreaterThanOrEqual(fila.x)
      expect(caja.x + caja.width).toBeLessThanOrEqual(fila.x + fila.width)
      expect(caja.y).toBeGreaterThanOrEqual(fila.y)
      expect(caja.y + caja.height).toBeLessThanOrEqual(fila.y + fila.height)
    }
    const lineas = [...new Set(cajas.map((caja) => Math.round(caja.y)))]
    expect(lineas.length).toBeGreaterThanOrEqual(2)
    const primeraLinea = cajas.filter((caja) => Math.round(caja.y) === lineas[0])
    expect(primeraLinea.length).toBeGreaterThanOrEqual(2)
    const ultimaDeLaPrimera = cajas[primeraLinea.length - 1]
    const primeraDeLaSegunda = cajas[primeraLinea.length]
    expect(primeraDeLaSegunda.y).toBeGreaterThanOrEqual(ultimaDeLaPrimera.y + ultimaDeLaPrimera.height)
    expect(primeraDeLaSegunda.x).toBeLessThan(ultimaDeLaPrimera.x)
    // El martes sigue debajo del lunes y no hay desplazamiento horizontal.
    expect((await medir(dia(page, 'Tue'))).y).toBeGreaterThanOrEqual(fila.y + fila.height)
    await comprobarSinDesplazamientoHorizontal(page)
  })
})

test.describe('escenario "Recuadros dentro del panel"', () => {
  test.describe('escritorio, 1280 px', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('en el panel lateral de empleados, los siete recuadros de cada empleado quedan dentro de su fila', async ({
      page,
    }) => {
      await abrir(page, 4)
      const panel = page.getByRole('heading', { name: 'Employees' }).locator('xpath=..')

      await comprobarRecuadrosDentro(panel)
    })
  })

  for (const { ancho, alto } of [
    { ancho: 1024, alto: 768 },
    { ancho: 1180, alto: 820 },
    { ancho: 834, alto: 1194 },
  ]) {
    test.describe(`tablet, ${ancho} px`, () => {
      test.use({ viewport: { width: ancho, height: alto } })

      test('en el cajón "Employees", los siete recuadros de cada empleado quedan dentro de su fila', async ({ page }) => {
        await abrir(page, 4)
        await page.getByRole('button', { name: 'Employees' }).click()
        const cajon = page.getByRole('dialog', { name: 'Employees' })
        await expect(cajon).toBeInViewport()

        await comprobarRecuadrosDentro(cajon)
      })
    })
  }
})
