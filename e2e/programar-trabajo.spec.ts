// Tarea 6.2 de `schedule-assign`: camino feliz de programar un trabajo arrastrándolo del
// catálogo a un día, con los datos de prueba de MSW (`VITE_USE_MOCKS=true`).
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la
// app. En la semilla "J-1031 Jardín Pérez" no está programado en esa semana y el jueves 5
// solo tiene "J-1029" a las 09:30, así que al soltarlo en el jueves debe quedar a las 07:00.
//
// J-1031 es el 14.º trabajo del catálogo y no cabe en la ventana sin desplazar la página,
// lo que dejaría el tablero fuera de la vista. Por eso se busca primero "1031", como haría
// la persona, y así el trabajo y el jueves quedan visibles a la vez.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** Arrastra `origen` hasta el centro de `destino` con el ratón, en varios pasos para que @dnd-kit active el arrastre. */
async function arrastrar(page: Page, origen: Locator, destino: Locator) {
  await expect(origen).toBeInViewport()
  await expect(destino).toBeInViewport()
  const desde = await origen.boundingBox()
  const hasta = await destino.boundingBox()
  if (!desde || !hasta) throw new Error('No se pudo medir el origen o el destino del arrastre')

  await page.mouse.move(desde.x + desde.width / 2, desde.y + desde.height / 2)
  await page.mouse.down()
  // Primer movimiento corto, por encima de los 5 px que pide el sensor de ratón, y espera a
  // que @dnd-kit marque el elemento como arrastrado.
  await page.mouse.move(desde.x + desde.width / 2 + 10, desde.y + desde.height / 2 + 10, { steps: 5 })
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(1)
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 20 })
  // @dnd-kit calcula el destino bajo el puntero en los fotogramas siguientes.
  await esperarFotogramas(page)
  await page.mouse.up()
}

/** Espera dos fotogramas de animación del navegador. */
async function esperarFotogramas(page: Page) {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
}

test('soltar "J-1031 Jardín Pérez" en el jueves crea su tarjeta a las 07:00 sin empleados y lo marca "x1" en el catálogo', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')

  const jueves = page.getByText('Thu', { exact: true }).locator('xpath=../..')
  const tarjetasDelJueves = jueves.getByRole('article')
  await expect(tarjetasDelJueves).toHaveCount(1)
  await expect(tarjetasDelJueves.filter({ hasText: 'J-1031' })).toHaveCount(0)

  // La lista del catálogo, dentro de la sección "Jobs"; la página tiene también la de empleados.
  const catalogo = page.getByRole('heading', { name: 'Jobs' }).locator('xpath=..').getByRole('list')
  await page.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
  await expect(catalogo.getByRole('listitem')).toHaveCount(1)

  // Antes de soltarlo, J-1031 tiene su tono normal y ningún contador.
  const jardin = catalogo.getByRole('listitem').filter({ hasText: 'J-1031' })
  await expect(jardin).toContainText('Jardín Pérez')
  await expect(jardin).not.toHaveAttribute('data-in-use')
  await expect(jardin).toHaveCSS('opacity', '1')
  await expect(jardin).not.toContainText(/x\d+/)

  await arrastrar(page, jardin, jueves)

  // El jueves tiene ahora dos tarjetas y la nueva es la de J-1031.
  await expect(tarjetasDelJueves).toHaveCount(2)
  const nueva = tarjetasDelJueves.filter({ hasText: 'J-1031' })
  await expect(nueva).toHaveCount(1)
  await expect(nueva).toContainText('Jardín Pérez')
  await expect(nueva).toContainText('07:00')
  await expect(nueva).toContainText('No employees')

  // El trabajo sigue en el catálogo, atenuado y con el contador "x1".
  await expect(jardin).toHaveCount(1)
  await expect(jardin).toHaveAttribute('data-in-use', 'true')
  await expect(jardin).toHaveCSS('opacity', '0.7')
  await expect(jardin).toContainText('x1')
})
