// Camino feliz de la dirección en el catálogo y de los recuadros de días con trabajo a todo el
// ancho de la tarjeta de cada empleado, con los datos de prueba de MSW (`VITE_USE_MOCKS=true`).
//
// `design.md` de `schedule-assign`: "Los recuadros de días con trabajo de cada empleado se adaptan
// al ancho de su fila para no salirse del panel ni de los cajones". En la tarjeta del empleado van,
// en la primera fila, el círculo de iniciales y el nombre; debajo, empezando a la izquierda como el
// círculo y a todo el ancho, el cargo y los siete recuadros.
//
// Se comprueba en el panel lateral de escritorio, en el cajón "Employees" de tablet y en la hoja
// inferior "Employees" del teléfono. La semilla da a todos los trabajos la dirección "Calle Mayor 1".
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** Margen, en píxeles, para los redondeos de las medidas. */
const TOLERANCIA = 1

/** Abre la app con el reloj fijado en el martes 2026-11-03 y espera a las programaciones visibles. */
async function abrir(page: Page, tarjetasVisibles: number) {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(tarjetasVisibles)
}

/**
 * Mide cada tarjeta de empleado de `contenedor` y comprueba que el cargo y los recuadros empiezan
 * debajo del círculo de iniciales y alineados con él, que los recuadros ocupan el ancho interior
 * de la tarjeta y que ninguno se sale de ella.
 */
async function comprobarTarjetas(contenedor: Locator) {
  const tarjetas = contenedor.getByRole('listitem')
  // 7 empleados en el panel: los activos con cargo "Supervisor" o "Labor".
  await expect(tarjetas).toHaveCount(7)
  const medidas = await tarjetas.evaluateAll((elementos) =>
    elementos.map((tarjeta) => {
      const caja = (elemento: Element) => {
        const r = elemento.getBoundingClientRect()
        return { izquierda: r.left, derecha: r.right, arriba: r.top, abajo: r.bottom, ancho: r.width }
      }
      const estilo = getComputedStyle(tarjeta)
      const exterior = caja(tarjeta)
      const interior = {
        izquierda: exterior.izquierda + parseFloat(estilo.borderLeftWidth) + parseFloat(estilo.paddingLeft),
        derecha: exterior.derecha - parseFloat(estilo.borderRightWidth) - parseFloat(estilo.paddingRight),
      }
      const iniciales = tarjeta.querySelector('[data-hue]')
      const cargo = [...tarjeta.children].find((hijo) => /^(Supervisor|Labor)( · .+ h)?$/.test(hijo.textContent ?? ''))
      const semana = tarjeta.querySelector('[role="img"]')
      return {
        nombre: tarjeta.textContent,
        tarjeta: exterior,
        interior,
        iniciales: iniciales && caja(iniciales),
        cargo: cargo && caja(cargo),
        recuadros: semana ? [...semana.children].map(caja) : [],
      }
    }),
  )

  for (const { nombre, tarjeta, interior, iniciales, cargo, recuadros } of medidas) {
    if (!iniciales || !cargo) throw new Error(`No se encontraron las iniciales o el cargo en ${nombre}`)
    expect(recuadros, `recuadros de ${nombre}`).toHaveLength(7)
    const primero = recuadros[0]
    const ultimo = recuadros[6]

    // El cargo y la fila de recuadros empiezan a la izquierda, alineados con el círculo de
    // iniciales, y debajo de él: no a su derecha.
    expect(Math.abs(cargo.izquierda - iniciales.izquierda), `cargo alineado con las iniciales en ${nombre}`).toBeLessThanOrEqual(TOLERANCIA)
    expect(cargo.arriba, `cargo debajo de las iniciales en ${nombre}`).toBeGreaterThanOrEqual(iniciales.abajo - TOLERANCIA)
    expect(Math.abs(primero.izquierda - iniciales.izquierda), `recuadros alineados con las iniciales en ${nombre}`).toBeLessThanOrEqual(TOLERANCIA)
    expect(primero.arriba, `recuadros debajo del cargo en ${nombre}`).toBeGreaterThanOrEqual(cargo.abajo - TOLERANCIA)

    // La fila de recuadros ocupa el ancho interior de la tarjeta.
    expect(Math.abs(primero.izquierda - interior.izquierda), `inicio de los recuadros de ${nombre}`).toBeLessThanOrEqual(TOLERANCIA)
    expect(Math.abs(ultimo.derecha - interior.derecha), `final de los recuadros de ${nombre}`).toBeLessThanOrEqual(TOLERANCIA)

    // Ningún recuadro se sale de la tarjeta.
    for (const recuadro of recuadros) {
      expect(recuadro.ancho, `ancho de un recuadro de ${nombre}`).toBeGreaterThan(0)
      expect(recuadro.izquierda, `borde izquierdo de un recuadro de ${nombre}`).toBeGreaterThanOrEqual(tarjeta.izquierda)
      expect(recuadro.derecha, `borde derecho de un recuadro de ${nombre}`).toBeLessThanOrEqual(tarjeta.derecha)
      expect(recuadro.arriba, `borde superior de un recuadro de ${nombre}`).toBeGreaterThanOrEqual(tarjeta.arriba)
      expect(recuadro.abajo, `borde inferior de un recuadro de ${nombre}`).toBeLessThanOrEqual(tarjeta.abajo)
    }
  }
}

test.describe('escritorio, 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('el catálogo muestra la dirección de "J-1024 Pintar oficina" en una segunda línea', async ({ page }) => {
    await abrir(page, 4)
    const catalogo = page.getByRole('heading', { name: 'Jobs' }).locator('xpath=..').getByRole('list')
    const pintar = catalogo.getByRole('listitem').filter({ hasText: 'J-1024' })
    await pintar.scrollIntoViewIfNeeded()

    const direccion = pintar.getByText('Calle Mayor 1', { exact: true })
    await expect(direccion).toBeVisible()
    await expect(pintar).toHaveAttribute('title', 'J-1024 Pintar oficina\nCalle Mayor 1')
    // La dirección va debajo de la línea del número y el nombre.
    const numero = await pintar.getByText('J-1024', { exact: true }).boundingBox()
    const caja = await direccion.boundingBox()
    if (!numero || !caja) throw new Error('No se pudo medir el trabajo del catálogo')
    expect(caja.y).toBeGreaterThanOrEqual(numero.y + numero.height - TOLERANCIA)
  })

  test('en el panel lateral de empleados, el cargo y los recuadros van debajo de las iniciales y a todo el ancho de la tarjeta', async ({
    page,
  }) => {
    await abrir(page, 4)
    const panel = page.getByRole('heading', { name: 'Employees' }).locator('xpath=..')

    await comprobarTarjetas(panel)
  })
})

for (const { ancho, alto } of [
  { ancho: 1024, alto: 768 },
  { ancho: 1180, alto: 820 },
  { ancho: 834, alto: 1194 },
]) {
  test.describe(`tablet, ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: alto } })

    test('en el cajón "Employees", el cargo y los recuadros van debajo de las iniciales y a todo el ancho de la tarjeta', async ({
      page,
    }) => {
      await abrir(page, 4)
      await page.getByRole('button', { name: 'Employees' }).click()
      const cajon = page.getByRole('dialog', { name: 'Employees' })
      await expect(cajon).toBeInViewport()

      await comprobarTarjetas(cajon)
    })
  })
}

test.describe('teléfono, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('en la hoja inferior "Employees", el cargo y los recuadros van debajo de las iniciales y a todo el ancho de la tarjeta', async ({
    page,
  }) => {
    // El teléfono muestra un solo día: el martes 3, con una programación.
    await abrir(page, 1)
    await page.getByRole('button', { name: 'Employees', exact: true }).click()
    const hoja = page.getByRole('dialog', { name: 'Employees' })
    await expect(hoja).toBeInViewport()

    await comprobarTarjetas(hoja)
  })
})
