// Tarea 10.1 de `schedule-assign`: recorrido completo del camino feliz en las tres disposiciones
// (escritorio 1280 px, tablet 800 px y teléfono 390 px), con los datos de prueba de MSW
// (`VITE_USE_MOCKS=true`). Escenarios de `specs/weekly-schedule-board/spec.md` y
// `specs/employee-assignment/spec.md`, y decisiones 3, 5, 6 y 8 de `design.md`.
//
// Cada test sigue el mismo orden: programar un trabajo (07:00 y contador "x1"), repetirlo el mismo
// día (08:00 y "x2"), asignar un empleado, mover la programación a otro día conservando el empleado,
// duplicar una programación, quitar otra, deshacer el quitar y cambiar de semana ida y vuelta.
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
// La semana siguiente (8 al 14) está vacía. "J-1031 Jardín Pérez" no está programado en ninguna
// semana y el miércoles 4 está vacío, así que es el trabajo y el día que se usan para programar.
//
// Cada test abre la app en una página nueva, así que la base en memoria de MSW empieza siempre
// desde la semilla.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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
 * Arrastra `origen` hasta el centro de `destino` con el ratón y lo suelta; con `alt`, soltando con
 * Alt pulsado. El destino se mide con el arrastre ya en curso, porque en la tablet el cajón abierto
 * se aparta al empezar a arrastrar.
 */
async function arrastrar(page: Page, origen: Locator, destino: Locator, { alt = false } = {}) {
  await expect(origen).toBeInViewport()
  const desde = await origen.boundingBox()
  if (!desde) throw new Error('No se pudo medir el origen del arrastre')

  await page.mouse.move(desde.x + desde.width / 2, desde.y + desde.height / 2)
  await page.mouse.down()
  // Primer movimiento corto, por encima de los 5 px que pide el sensor de ratón, y espera a que
  // @dnd-kit marque el elemento como arrastrado.
  await page.mouse.move(desde.x + desde.width / 2 + 10, desde.y + desde.height / 2 + 10, { steps: 5 })
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(1)
  await expect(destino).toBeInViewport()
  const hasta = await destino.boundingBox()
  if (!hasta) throw new Error('No se pudo medir el destino del arrastre')
  await page.mouse.move(hasta.x + hasta.width / 2, hasta.y + hasta.height / 2, { steps: 20 })
  // @dnd-kit calcula el destino bajo el puntero en los fotogramas siguientes.
  await esperarFotogramas(page)
  if (alt) await page.keyboard.down('Alt')
  await page.mouse.up()
  if (alt) await page.keyboard.up('Alt')
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
}

/** Columna del día con nombre abreviado `nombre` ("Wed") en el tablero de escritorio o tablet. */
const columna = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** Tarjetas de "J-1031 Jardín Pérez" dentro de `contenedor`. */
const jardines = (contenedor: Locator | Page) => contenedor.getByRole('article').filter({ hasText: 'J-1031' })

/** Iniciales de los empleados de una tarjeta, en orden. */
const iniciales = (tarjeta: Locator) => tarjeta.locator('[title]:not([aria-label^="Comment:"])')

/** Aviso de acción con el texto `texto` (la página tiene además la región en vivo de @dnd-kit). */
const aviso = (page: Page, texto: string) => page.getByRole('status').filter({ hasText: texto })

/** Rango de la semana visible en el encabezado. */
const rango = (page: Page) => page.getByRole('heading', { level: 2, name: /\d{4}$/ })

/** "J-1031 Jardín Pérez" en la lista del catálogo contenida en `contenedor`. */
const jardinEnElCatalogo = (contenedor: Locator) =>
  contenedor.getByRole('list').getByRole('listitem').filter({ hasText: 'J-1031' })

/** Espera a que el servidor confirme la tarjeta (con id definitivo deja de estar desactivada). */
async function esperarConfirmada(tarjeta: Locator) {
  await expect(tarjeta).toHaveAttribute('aria-disabled', 'false')
}

/** Comprueba la tarjeta: hora y empleados (iniciales o "No employees"). */
async function comprobarTarjeta(tarjeta: Locator, hora: string, empleados: string[]) {
  await expect(tarjeta).toHaveCount(1)
  await expect(tarjeta).toContainText('Jardín Pérez')
  await expect(tarjeta).toContainText(hora)
  if (empleados.length === 0) await expect(tarjeta).toContainText('No employees')
  else await expect(iniciales(tarjeta)).toHaveText(empleados)
}

/** Comprueba que el trabajo está atenuado en el catálogo con el contador `contador` ("x2"). */
async function comprobarContador(trabajo: Locator, contador: string) {
  await expect(trabajo).toHaveAttribute('data-in-use', 'true')
  await expect(trabajo).toContainText(contador)
}

/** Comprueba que el trabajo tiene su tono normal en el catálogo y ningún contador. */
async function comprobarSinContador(trabajo: Locator) {
  await expect(trabajo).toHaveCount(1)
  await expect(trabajo).not.toHaveAttribute('data-in-use')
  await expect(trabajo).not.toContainText(/x\d+/)
}

/** Abre el detalle de `tarjeta` pulsándola. */
async function abrirDetalle(page: Page, tarjeta: Locator) {
  await tarjeta.click()
  const detalle = page.getByRole('dialog', { name: 'J-1031 Jardín Pérez' })
  await expect(detalle).toBeVisible()
  return detalle
}

test.describe('escritorio, 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('recorrido completo: programar, repetir, asignar, mover, duplicar con Alt, quitar, deshacer y cambiar de semana', async ({
    page,
  }) => {
    await abrir(page, 4)
    const catalogo = page.getByRole('heading', { name: 'Jobs' }).locator('xpath=..')
    const empleados = page.getByRole('heading', { name: 'Employees' }).locator('xpath=..')
    const miercoles = jardines(columna(page, 'Wed'))
    const viernes = jardines(columna(page, 'Fri'))
    const sabado = jardines(columna(page, 'Sat'))
    await expect(columna(page, 'Wed').getByRole('article')).toHaveCount(0)

    // 1. Programar "J-1031 Jardín Pérez" en el miércoles: 07:00, sin empleados y "x1" en el catálogo.
    await page.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
    await expect(catalogo.getByRole('list').getByRole('listitem')).toHaveCount(1)
    const jardin = jardinEnElCatalogo(catalogo)
    await comprobarSinContador(jardin)
    await arrastrar(page, jardin, columna(page, 'Wed'))
    await comprobarTarjeta(miercoles, '07:00', [])
    await esperarConfirmada(miercoles)
    await expect(aviso(page, 'Job scheduled')).toBeVisible()
    await comprobarContador(jardin, 'x1')

    // 2. Repetirlo en el miércoles: la segunda queda a las 08:00 y el contador pasa a "x2".
    await arrastrar(page, jardin, columna(page, 'Wed'))
    await expect(miercoles).toHaveCount(2)
    await expect(miercoles.nth(0)).toContainText('07:00')
    await expect(miercoles.nth(1)).toContainText('08:00')
    await expect(miercoles.nth(1)).toContainText('No employees')
    await esperarConfirmada(miercoles.nth(1))
    await comprobarContador(jardin, 'x2')

    // 3. Asignar a Ana arrastrándola del panel a la de las 07:00.
    const deLasSiete = miercoles.filter({ hasText: '07:00' })
    await arrastrar(page, empleados.getByRole('listitem').filter({ hasText: 'Ana López' }), deLasSiete)
    await comprobarTarjeta(deLasSiete, '07:00', ['AL'])
    await expect(aviso(page, 'Employees updated')).toBeVisible()

    // 4. Moverla al viernes: conserva la hora y a Ana, y el miércoles se queda con la de las 08:00.
    await arrastrar(page, deLasSiete, columna(page, 'Fri'))
    await comprobarTarjeta(viernes, '07:00', ['AL'])
    await expect(viernes.getByTitle('Ana López')).toBeVisible()
    await comprobarTarjeta(miercoles, '08:00', [])
    await expect(aviso(page, 'Job moved')).toBeVisible()

    // 5. Duplicar con Alt la del viernes en el sábado: copia con Ana y el viernes la conserva.
    await arrastrar(page, viernes, columna(page, 'Sat'), { alt: true })
    await comprobarTarjeta(sabado, '07:00', ['AL'])
    await comprobarTarjeta(viernes, '07:00', ['AL'])
    await expect(aviso(page, 'Job duplicated')).toBeVisible()
    await esperarConfirmada(sabado)
    await comprobarContador(jardin, 'x3')

    // 6. Quitar la del miércoles arrastrándola al catálogo; el trabajo sigue en el catálogo.
    await arrastrar(page, miercoles, catalogo)
    await expect(miercoles).toHaveCount(0)
    await expect(aviso(page, 'Job removed')).toBeVisible()
    await comprobarContador(jardin, 'x2')

    // 7. Deshacer el quitar con "Undo": la del miércoles vuelve a las 08:00.
    await aviso(page, 'Job removed').getByRole('button', { name: 'Undo' }).click()
    await comprobarTarjeta(miercoles, '08:00', [])
    await esperarConfirmada(miercoles)
    await comprobarContador(jardin, 'x3')

    // 8. "Next week" muestra la semana siguiente sin nada y "Previous week" vuelve con todo lo hecho.
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(rango(page)).toHaveText('Nov 8 - 14, 2026')
    await expect(page.getByRole('article')).toHaveCount(0)
    await comprobarSinContador(jardin)

    await page.getByRole('button', { name: 'Previous week' }).click()
    await expect(rango(page)).toHaveText('Nov 1 - 7, 2026')
    await expect(page.getByRole('article')).toHaveCount(7)
    await comprobarTarjeta(miercoles, '08:00', [])
    await comprobarTarjeta(viernes, '07:00', ['AL'])
    await comprobarTarjeta(sabado, '07:00', ['AL'])
    await comprobarContador(jardin, 'x3')
  })
})

test.describe('tablet, 800 px', () => {
  test.use({ viewport: { width: 800, height: 1100 } })

  test('recorrido completo con los cajones "Jobs" y "Employees", duplicando con Alt y quitando desde el detalle', async ({
    page,
  }) => {
    await abrir(page, 4)
    const miercoles = jardines(columna(page, 'Wed'))
    const domingo = jardines(columna(page, 'Sun'))
    const martes = jardines(columna(page, 'Tue'))
    await expect(columna(page, 'Wed').getByRole('article')).toHaveCount(0)

    // 1. Programar "J-1031 Jardín Pérez" en el miércoles desde el cajón "Jobs".
    await page.getByRole('button', { name: 'Jobs' }).click()
    const cajonJobs = page.getByRole('dialog', { name: 'Jobs' })
    await expect(cajonJobs).toBeInViewport()
    await cajonJobs.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
    await expect(cajonJobs.getByRole('list').getByRole('listitem')).toHaveCount(1)
    const jardin = jardinEnElCatalogo(cajonJobs)
    await comprobarSinContador(jardin)
    await arrastrar(page, jardin, columna(page, 'Wed'))
    await comprobarTarjeta(miercoles, '07:00', [])
    await esperarConfirmada(miercoles)
    await expect(aviso(page, 'Job scheduled')).toBeVisible()
    await comprobarContador(jardin, 'x1')

    // 2. Repetirlo en el miércoles: 08:00 y "x2".
    await arrastrar(page, jardin, columna(page, 'Wed'))
    await expect(miercoles).toHaveCount(2)
    await expect(miercoles.nth(0)).toContainText('07:00')
    await expect(miercoles.nth(1)).toContainText('08:00')
    await esperarConfirmada(miercoles.nth(1))
    await comprobarContador(jardin, 'x2')

    // 3. Asignar a Ana desde el cajón "Employees" a la de las 07:00.
    await page.getByRole('button', { name: 'Employees' }).click()
    const cajonEmpleados = page.getByRole('dialog', { name: 'Employees' })
    await expect(cajonEmpleados).toBeInViewport()
    const deLasSiete = miercoles.filter({ hasText: '07:00' })
    await arrastrar(page, cajonEmpleados.getByRole('listitem').filter({ hasText: 'Ana López' }), deLasSiete)
    await comprobarTarjeta(deLasSiete, '07:00', ['AL'])
    await expect(aviso(page, 'Employees updated')).toBeVisible()
    await cajonEmpleados.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // 4. Moverla al domingo: conserva la hora y a Ana.
    await arrastrar(page, deLasSiete, columna(page, 'Sun'))
    await comprobarTarjeta(domingo, '07:00', ['AL'])
    await comprobarTarjeta(miercoles, '08:00', [])
    await expect(aviso(page, 'Job moved')).toBeVisible()

    // 5. Duplicar con Alt la del domingo en el martes, que tiene "J-1019" a las 07:00: la copia queda a las 07:00 con Ana.
    await arrastrar(page, domingo, columna(page, 'Tue'), { alt: true })
    await comprobarTarjeta(martes, '07:00', ['AL'])
    await comprobarTarjeta(domingo, '07:00', ['AL'])
    await expect(aviso(page, 'Job duplicated')).toBeVisible()
    await esperarConfirmada(martes)

    // 6. Quitar la del miércoles desde su detalle.
    const detalle = await abrirDetalle(page, miercoles)
    await detalle.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(detalle).toHaveCount(0)
    await expect(miercoles).toHaveCount(0)
    await expect(aviso(page, 'Job removed')).toBeVisible()

    // 7. Deshacer el quitar con "Undo".
    await aviso(page, 'Job removed').getByRole('button', { name: 'Undo' }).click()
    await comprobarTarjeta(miercoles, '08:00', [])
    await esperarConfirmada(miercoles)

    // 8. "Next week" y vuelta con "Today": todo sigue ahí y el catálogo marca "x3".
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(rango(page)).toHaveText('Nov 8 - 14, 2026')
    await expect(page.getByRole('article')).toHaveCount(0)

    await page.getByRole('button', { name: 'Today' }).click()
    await expect(rango(page)).toHaveText('Nov 1 - 7, 2026')
    await expect(page.getByRole('article')).toHaveCount(7)
    await comprobarTarjeta(miercoles, '08:00', [])
    await comprobarTarjeta(domingo, '07:00', ['AL'])
    await comprobarTarjeta(martes, '07:00', ['AL'])
    await expect(columna(page, 'Tue').getByRole('article').filter({ hasText: 'J-1019' })).toHaveCount(1)
    await page.getByRole('button', { name: 'Jobs' }).click()
    await cajonJobs.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
    await comprobarContador(jardinEnElCatalogo(cajonJobs), 'x3')
  })
})

test.describe('teléfono, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  /** Día `nombre` de la tira de días. */
  const enLaTira = (page: Page, nombre: string) => page.locator('button[aria-pressed]').filter({ hasText: nombre })

  /** Botón "Jobs" de la barra inferior; los días de la tira también contienen "jobs" en su nombre. */
  const botonJobs = (page: Page) => page.getByRole('button', { name: 'Jobs', exact: true })

  test('recorrido completo con la tira de días, los paneles inferiores, "Assign employees" y el detalle ("Move to…" y "Duplicate")', async ({
    page,
  }) => {
    await abrir(page, 1)
    const tarjetas = jardines(page)

    // 1. Programar "J-1031 Jardín Pérez" en el miércoles arrastrándolo del panel "Jobs" al día de la tira.
    await enLaTira(page, 'Wed').click()
    await expect(enLaTira(page, 'Wed')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('article')).toHaveCount(0)
    await botonJobs(page).click()
    const panelJobs = page.getByRole('dialog', { name: 'Jobs' })
    await panelJobs.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
    await expect(panelJobs.getByRole('list').getByRole('listitem')).toHaveCount(1)
    const jardin = jardinEnElCatalogo(panelJobs)
    await comprobarSinContador(jardin)
    await arrastrar(page, jardin, enLaTira(page, 'Wed'))
    await expect(enLaTira(page, 'Wed').getByLabel('1 job')).toBeVisible()
    await comprobarTarjeta(tarjetas, '07:00', [])
    await esperarConfirmada(tarjetas)
    await expect(aviso(page, 'Job scheduled')).toBeVisible()
    await comprobarContador(jardin, 'x1')

    // 2. Repetirlo en el miércoles: 08:00 y "x2".
    await arrastrar(page, jardin, enLaTira(page, 'Wed'))
    await expect(enLaTira(page, 'Wed').getByLabel('2 jobs')).toBeVisible()
    await expect(tarjetas).toHaveCount(2)
    await expect(tarjetas.nth(0)).toContainText('07:00')
    await expect(tarjetas.nth(1)).toContainText('08:00')
    await esperarConfirmada(tarjetas.nth(1))
    await comprobarContador(jardin, 'x2')
    await panelJobs.getByRole('button', { name: 'Done' }).click()
    await expect(panelJobs).toHaveCount(0)

    // 3. Asignar a Ana con el "+" de la de las 07:00 y su casilla en "Assign employees".
    const deLasSiete = tarjetas.filter({ hasText: '07:00' })
    await deLasSiete.getByRole('button', { name: 'Assign employees' }).click()
    const asignar = page.getByRole('dialog', { name: 'Assign employees' })
    await expect(asignar).toBeInViewport()
    const ana = asignar.getByRole('checkbox', { name: 'Ana López' })
    await ana.click()
    await expect(ana).toBeChecked()
    await expect(aviso(page, 'Employees updated')).toBeVisible()
    await asignar.getByRole('button', { name: 'Done' }).click()
    await expect(asignar).toHaveCount(0)
    await comprobarTarjeta(deLasSiete, '07:00', ['AL'])

    // 4. Moverla al viernes con "Move to…" del detalle: conserva la hora y a Ana.
    const detalleMover = await abrirDetalle(page, deLasSiete)
    await detalleMover.getByLabel('Move to').selectOption('2026-11-06')
    await expect(aviso(page, 'Job moved')).toBeVisible()
    await expect(detalleMover).toContainText('Fri, Nov 6')
    await detalleMover.getByRole('button', { name: 'Close' }).click()
    await expect(detalleMover).toHaveCount(0)
    await expect(enLaTira(page, 'Wed').getByLabel('1 job')).toBeVisible()
    await expect(enLaTira(page, 'Fri').getByLabel('1 job')).toBeVisible()
    await comprobarTarjeta(tarjetas, '08:00', [])
    await enLaTira(page, 'Fri').click()
    await comprobarTarjeta(tarjetas, '07:00', ['AL'])
    await expect(tarjetas.getByTitle('Ana López')).toBeVisible()

    // 5. Duplicarla con "Duplicate" del detalle: el viernes tiene una segunda a las 08:00 con Ana.
    const detalleDuplicar = await abrirDetalle(page, tarjetas)
    await detalleDuplicar.getByRole('button', { name: 'Duplicate' }).click()
    await expect(aviso(page, 'Job duplicated')).toBeVisible()
    await detalleDuplicar.getByRole('button', { name: 'Close' }).click()
    await expect(detalleDuplicar).toHaveCount(0)
    await expect(tarjetas).toHaveCount(2)
    await expect(tarjetas.nth(0)).toContainText('07:00')
    await expect(tarjetas.nth(1)).toContainText('08:00')
    await expect(iniciales(tarjetas.nth(0))).toHaveText(['AL'])
    await expect(iniciales(tarjetas.nth(1))).toHaveText(['AL'])
    await expect(enLaTira(page, 'Fri').getByLabel('2 jobs')).toBeVisible()
    await esperarConfirmada(tarjetas.nth(1))

    // 6. Quitar la del miércoles desde su detalle.
    await enLaTira(page, 'Wed').click()
    await comprobarTarjeta(tarjetas, '08:00', [])
    const detalleQuitar = await abrirDetalle(page, tarjetas)
    await detalleQuitar.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(detalleQuitar).toHaveCount(0)
    await expect(tarjetas).toHaveCount(0)
    await expect(enLaTira(page, 'Wed').getByLabel('0 jobs')).toBeVisible()
    await expect(aviso(page, 'Job removed')).toBeVisible()

    // 7. Deshacer el quitar con "Undo": la del miércoles vuelve a las 08:00.
    await aviso(page, 'Job removed').getByRole('button', { name: 'Undo' }).click()
    await comprobarTarjeta(tarjetas, '08:00', [])
    await esperarConfirmada(tarjetas)
    await expect(enLaTira(page, 'Wed').getByLabel('1 job')).toBeVisible()

    // 8. "Next week" y vuelta con "Previous week": la tira y los días conservan lo hecho.
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(rango(page)).toHaveText('Nov 8 - 14, 2026')
    await expect(page.getByRole('article')).toHaveCount(0)
    for (const nombre of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(enLaTira(page, nombre).getByLabel('0 jobs')).toBeVisible()
    }

    await page.getByRole('button', { name: 'Previous week' }).click()
    await expect(rango(page)).toHaveText('Nov 1 - 7, 2026')
    await expect(enLaTira(page, 'Wed').getByLabel('1 job')).toBeVisible()
    await expect(enLaTira(page, 'Fri').getByLabel('2 jobs')).toBeVisible()
    await enLaTira(page, 'Wed').click()
    await comprobarTarjeta(tarjetas, '08:00', [])
    await enLaTira(page, 'Fri').click()
    await expect(tarjetas).toHaveCount(2)
    await expect(iniciales(tarjetas.nth(0))).toHaveText(['AL'])
    await expect(iniciales(tarjetas.nth(1))).toHaveText(['AL'])
    await botonJobs(page).click()
    await panelJobs.getByRole('searchbox', { name: 'Search jobs' }).fill('1031')
    await comprobarContador(jardinEnElCatalogo(panelJobs), 'x3')
  })
})
