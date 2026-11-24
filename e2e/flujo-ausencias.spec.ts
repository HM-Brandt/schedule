// Tarea 7.1 de `employee-absences`: recorrido completo de las ausencias en las tres disposiciones
// (escritorio 1280 px, tablet 800 px y teléfono 390 px), con los datos de prueba de MSW
// (`VITE_USE_MOCKS=true`). Escenarios de `specs/employee-absences/spec.md`,
// `specs/employee-assignment/spec.md` y `specs/weekly-schedule-board/spec.md`, y decisiones 5 y 6 de
// `design.md`.
//
// Escenarios cubiertos:
// - Marcar y cancelar: "Soltar desde una tarjeta", "Guardar con tipo y comentario", "Cancelar",
//   "Ana de vacaciones el lunes", "Soltar dos veces", "Cambio de semana".
// - Desasignación y recuadros: "Ana en dos trabajos el lunes", "Marcar actualiza los recuadros".
// - Bloqueos: "Arrastrar a una ausente a una tarjeta de su día", "Otro día sí se puede",
//   "Aviso en la zona con la zona fuera de la vista", "Mover con Ana ausente el martes",
//   "Duplicar con Luis ausente el viernes", "Arrastrar a Ana, ausente el miércoles" y "Ana enferma el lunes".
// - Quitar y deshacer: "Arrastrar fuera", "Deshacer una ausencia marcada", "Deshacer una ausencia quitada".
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app.
// La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 con Ana López y Luis Martínez, y a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados;
// y una ausencia de Sofía Romero el miércoles 4 (Vacation, "Viaje familiar").
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

/** Empieza a arrastrar `origen` con el ratón y lo deja a mitad de camino, aún sin soltar. */
async function empezarArrastre(page: Page, origen: Locator) {
  await expect(origen).toBeInViewport()
  const desde = await origen.boundingBox()
  if (!desde) throw new Error('No se pudo medir el origen del arrastre')

  await page.mouse.move(desde.x + desde.width / 2, desde.y + desde.height / 2)
  await page.mouse.down()
  // Primer movimiento corto, por encima de los 5 px que pide el sensor de ratón, y espera a que
  // @dnd-kit marque el elemento como arrastrado.
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
  await esperarFotogramas(page)
}

/** Suelta lo que se esté arrastrando; con `alt`, con Alt pulsado. */
async function soltar(page: Page, { alt = false } = {}) {
  if (alt) await page.keyboard.down('Alt')
  await page.mouse.up()
  if (alt) await page.keyboard.up('Alt')
  await expect(page.locator('[data-dnd-dragging]')).toHaveCount(0)
}

/** Arrastra `origen` hasta el centro de `destino` y lo suelta; con `alt`, soltando con Alt pulsado. */
async function arrastrar(page: Page, origen: Locator, destino: Locator, { alt = false } = {}) {
  await empezarArrastre(page, origen)
  await llevarA(page, destino)
  await soltar(page, { alt })
}

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado, sus tarjetas y su zona de ausencias. */
const dia = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** Zona "Absences" del día `nombre` en el tablero de escritorio o tablet. */
const zona = (page: Page, nombre: string) => dia(page, nombre).getByText('Absences', { exact: true }).locator('xpath=..')

/** Zona "Absences" del único día visible en el teléfono. */
const zonaDelTelefono = (page: Page) => page.getByText('Absences', { exact: true }).locator('xpath=..')

/** Tarjetas del día `nombre` en el tablero de escritorio o tablet. */
const tarjetasDe = (page: Page, nombre: string) => dia(page, nombre).getByRole('article')

/** Fila del panel de empleados de escritorio con el nombre completo `nombre`. */
const enElPanel = (page: Page, nombre: string) =>
  page.getByRole('heading', { name: 'Employees' }).locator('xpath=..').getByRole('listitem').filter({ hasText: nombre })

/** Fila de un cajón o panel inferior con el nombre completo `nombre`. */
const enElCajon = (contenedor: Locator, nombre: string) => contenedor.getByRole('listitem').filter({ hasText: nombre })

/** Aviso de acción con el texto `texto` (la página tiene además la región en vivo de @dnd-kit). */
const aviso = (page: Page, texto: string) => page.getByRole('status').filter({ hasText: texto })

/** Mensaje de error del tablero. */
const error = (page: Page) => page.getByRole('alert')

/** Iniciales de los empleados de una tarjeta, en orden. */
const iniciales = (tarjeta: Locator) => tarjeta.locator('span[title]:not([aria-label^="Comment:"])')

/** Rango de la semana visible en el encabezado. */
const rango = (page: Page) => page.getByRole('heading', { level: 2, name: /\d{4}$/ })

/** Diálogo "Mark absence". */
const dialogoDeAusencia = (page: Page) => page.getByRole('dialog', { name: 'Mark absence' })

/** Espera a que el servidor confirme las tarjetas (con id definitivo dejan de estar desactivadas). */
async function esperarConfirmadas(page: Page) {
  await expect(page.locator('article[aria-disabled="true"]')).toHaveCount(0)
}

/** Atajo de deshacer. */
async function deshacer(page: Page) {
  await page.keyboard.press('Control+z')
}

/**
 * Rellena el diálogo "Mark absence" ya abierto: elige `tipo`, escribe `comentario` si lo hay y
 * guarda. Espera al aviso "Absence marked", que llega cuando el servidor ya confirmó la ausencia.
 */
async function guardarAusencia(page: Page, tipo: 'Off' | 'Vacation' | 'Sick' | 'Other', comentario?: string) {
  const dialogo = dialogoDeAusencia(page)
  await expect(dialogo).toBeVisible()
  await dialogo.getByRole('radio', { name: tipo }).check()
  if (comentario) await dialogo.getByRole('textbox', { name: 'Comment' }).fill(comentario)
  await dialogo.getByRole('button', { name: 'Save' }).click()
  await expect(dialogo).toBeHidden()
  await expect(aviso(page, 'Absence marked')).toBeVisible()
}

/** Comprueba que `caja` queda dentro de `contenedor` (con medio píxel de margen). */
async function comprobarDentro(caja: Locator, contenedor: Locator) {
  const interior = await caja.boundingBox()
  const exterior = await contenedor.boundingBox()
  if (!interior || !exterior) throw new Error('No se pudo medir el elemento')
  expect(interior.x).toBeGreaterThanOrEqual(exterior.x - 0.5)
  expect(interior.y).toBeGreaterThanOrEqual(exterior.y - 0.5)
  expect(interior.x + interior.width).toBeLessThanOrEqual(exterior.x + exterior.width + 0.5)
  expect(interior.y + interior.height).toBeLessThanOrEqual(exterior.y + exterior.height + 0.5)
}

/** Abre el detalle de `tarjeta` pulsándola. */
async function abrirDetalle(page: Page, tarjeta: Locator, nombre: string) {
  await tarjeta.click()
  const detalle = page.getByRole('dialog', { name: nombre })
  await expect(detalle).toBeVisible()
  return detalle
}

test.describe('escritorio, 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('recorrido completo: marcar, cancelar, duplicar y mover con ausentes, bloquear asignaciones, quitar la ausencia y deshacer', async ({
    page,
  }) => {
    await abrir(page, 4)
    const lunes = tarjetasDe(page, 'Mon')
    const martes = tarjetasDe(page, 'Tue')
    const viernes = tarjetasDe(page, 'Fri')
    const deLasSiete = lunes.filter({ hasText: '07:00' })
    const deLasOcho = lunes.filter({ hasText: '08:00' })
    const ventanas = martes.filter({ hasText: 'J-1019' })
    await expect(zona(page, 'Mon')).toContainText('No absences')
    await expect(zona(page, 'Wed')).toContainText('Sofía Romero')
    await expect(zona(page, 'Wed')).toContainText('Vacation')
    await expect(zona(page, 'Wed').getByTitle('Viaje familiar')).toBeVisible()
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await expect(iniciales(deLasOcho)).toHaveText(['AL'])

    // 1. Ana al "Absences" del lunes: el diálogo abre con "Off" marcado y "Cancel" no cambia nada.
    await arrastrar(page, enElPanel(page, 'Ana López'), zona(page, 'Mon'))
    const dialogo = dialogoDeAusencia(page)
    await expect(dialogo).toBeVisible()
    await expect(dialogo).toContainText('Ana López · Mon, Nov 2')
    await expect(dialogo.getByRole('radio', { name: 'Off' })).toBeChecked()
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await dialogo.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialogo).toBeHidden()
    await expect(zona(page, 'Mon')).toContainText('No absences')
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await expect(iniciales(deLasOcho)).toHaveText(['AL'])
    await expect(aviso(page, 'Absence marked')).toHaveCount(0)

    // 2. Luis, desde su tarjeta J-1024 de las 07:00, al "Absences" del viernes: "Sick" con el
    // comentario "Gripe". El comentario se ve al pasar el puntero. Luis sigue en su trabajo del lunes.
    await arrastrar(page, deLasSiete.getByTitle('Luis Martínez'), zona(page, 'Fri'))
    await expect(dialogo).toContainText('Luis Martínez · Fri, Nov 6')
    await guardarAusencia(page, 'Sick', 'Gripe')
    await expect(zona(page, 'Fri')).toContainText('Luis Martínez')
    await expect(zona(page, 'Fri')).toContainText('Sick')
    await expect(zona(page, 'Fri')).not.toContainText('No absences')
    const ausenciaDeLuis = zona(page, 'Fri').getByTitle('Gripe')
    await ausenciaDeLuis.hover()
    await expect(ausenciaDeLuis).toHaveAttribute('title', 'Gripe')
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])

    // 3. Duplicar con Alt "J-1024" de las 07:00 (Ana y Luis) al viernes: la copia solo lleva a Ana.
    await arrastrar(page, deLasSiete, dia(page, 'Fri'), { alt: true })
    await expect(viernes).toHaveCount(1)
    await expect(viernes).toContainText('J-1024')
    await expect(iniciales(viernes)).toHaveText(['AL'])
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await expect(aviso(page, 'Job duplicated')).toBeVisible()
    await esperarConfirmadas(page)

    // 4. Mover la original al viernes: Luis está ausente, así que se queda en el lunes con un error
    // que lo nombra.
    await arrastrar(page, deLasSiete, dia(page, 'Fri'))
    await expect(error(page)).toContainText("Can't move the job")
    await expect(error(page)).toContainText('Luis Martínez')
    await expect(lunes).toHaveCount(2)
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await expect(viernes).toHaveCount(1)

    // 5. Marcar a Ana el lunes con "Vacation": sale de las dos "J-1024" del lunes, sigue en la copia
    // del viernes y su recuadro del lunes pasa al estilo de ausencia. "Undo" del aviso la devuelve
    // a las dos tarjetas y quita la ausencia. Luego se vuelve a marcar para seguir el recorrido.
    // Se deshace aquí, justo después de marcar, porque la pila es LIFO y "Undo" solo existe en el
    // aviso de la última acción.
    await arrastrar(page, enElPanel(page, 'Ana López'), zona(page, 'Mon'))
    await guardarAusencia(page, 'Vacation')
    await expect(zona(page, 'Mon')).toContainText('Ana López')
    await expect(zona(page, 'Mon')).toContainText('Vacation')
    await expect(iniciales(deLasSiete)).toHaveText(['LM'])
    await expect(deLasOcho).toContainText('No employees')
    await expect(iniciales(viernes)).toHaveText(['AL'])
    const recuadrosDeAna = enElPanel(page, 'Ana López').getByRole('img')
    await expect(recuadrosDeAna).toHaveAccessibleName(/Absent: Mon \(Vacation\)/)
    await expect(recuadrosDeAna.locator('[data-level="absent"]')).toHaveCount(1)
    await expect(recuadrosDeAna.locator('[data-level="absent"]')).toHaveText('M')

    await aviso(page, 'Absence marked').getByRole('button', { name: 'Undo' }).click()
    await expect(zona(page, 'Mon')).toContainText('No absences')
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await expect(iniciales(deLasOcho)).toHaveText(['AL'])
    await expect(recuadrosDeAna.locator('[data-level="absent"]')).toHaveCount(0)

    await arrastrar(page, enElPanel(page, 'Ana López'), zona(page, 'Mon'))
    await guardarAusencia(page, 'Vacation')
    await expect(iniciales(deLasSiete)).toHaveText(['LM'])
    await expect(deLasOcho).toContainText('No employees')
    await expect(recuadrosDeAna.locator('[data-level="absent"]')).toHaveCount(1)

    // 6. Soltar otra vez a Ana en la zona del lunes: no abre el diálogo y sigue una sola vez.
    await arrastrar(page, enElPanel(page, 'Ana López'), zona(page, 'Mon'))
    await expect(dialogo).toHaveCount(0)
    await expect(zona(page, 'Mon').getByText('Ana López')).toHaveCount(1)

    // 7. Mientras se arrastra a Ana: el lunes indica "Absent" en lugar del número de trabajos y sus
    // tarjetas no se resaltan; el viernes (1 trabajo) y el martes (sin trabajos suyos) sí cuentan.
    // Al soltarla sobre una tarjeta del lunes, la zona da el aviso y Ana no queda asignada.
    await empezarArrastre(page, enElPanel(page, 'Ana López'))
    await expect(dia(page, 'Mon').getByText('Absent', { exact: true })).toBeVisible()
    await expect(dia(page, 'Fri').getByText('1 job', { exact: true })).toBeVisible()
    await expect(dia(page, 'Fri').getByText('Absent', { exact: true })).toHaveCount(0)
    await expect(ventanas).toHaveClass(/accepting/)
    await expect(deLasSiete).not.toHaveClass(/accepting/)
    await expect(deLasOcho).not.toHaveClass(/accepting/)
    await llevarA(page, deLasSiete)
    await expect(deLasSiete).not.toHaveClass(/over/)
    await soltar(page)
    await expect(zona(page, 'Mon')).toHaveClass(/blocked/)
    await expect(iniciales(deLasSiete)).toHaveText(['LM'])
    await expect(deLasOcho).toContainText('No employees')
    await expect(zona(page, 'Mon').getByText('Ana López')).toHaveCount(1)

    //    Otro día sí se puede: Ana a "J-1019 Cambiar ventanas" del martes.
    await arrastrar(page, enElPanel(page, 'Ana López'), ventanas)
    await expect(iniciales(ventanas)).toHaveText(['CR', 'AL'])
    await expect(aviso(page, 'Employees updated')).toBeVisible()
    await expect(zona(page, 'Tue')).not.toContainText('Ana López')

    // 8. Deshacer con el atajo: primero la asignación a J-1019 (la pila es LIFO) y después la
    // ausencia de Ana, que sale de la zona y vuelve a las dos "J-1024" del lunes.
    await deshacer(page)
    await expect(iniciales(ventanas)).toHaveText(['CR'])
    await expect(zona(page, 'Mon')).toContainText('Ana López')
    await deshacer(page)
    await expect(zona(page, 'Mon')).toContainText('No absences')
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await expect(iniciales(deLasOcho)).toHaveText(['AL'])
    await expect(iniciales(viernes)).toHaveText(['AL'])
    await expect(recuadrosDeAna.locator('[data-level="absent"]')).toHaveCount(0)

    // 9. Arrastrar la ausencia de Luis fuera de la zona: Luis no vuelve a ninguna tarjeta. Ctrl+Z
    // la recupera con "Sick" y "Gripe".
    await arrastrar(page, ausenciaDeLuis, rango(page))
    await expect(zona(page, 'Fri')).toContainText('No absences')
    await expect(zona(page, 'Fri')).not.toContainText('Luis Martínez')
    await expect(aviso(page, 'Absence removed')).toBeVisible()
    await expect(iniciales(viernes)).toHaveText(['AL'])
    await expect(viernes.getByTitle('Luis Martínez')).toHaveCount(0)

    await deshacer(page)
    await expect(zona(page, 'Fri')).toContainText('Luis Martínez')
    await expect(zona(page, 'Fri')).toContainText('Sick')
    await expect(zona(page, 'Fri').getByTitle('Gripe')).toBeVisible()
    await expect(iniciales(viernes)).toHaveText(['AL'])

    // 10. Ctrl+Z hasta vaciar la pila: deshace la copia del viernes y la ausencia de Luis, y la
    // semilla queda como estaba.
    await deshacer(page)
    await expect(viernes).toHaveCount(0)
    await deshacer(page)
    await expect(zona(page, 'Fri')).toContainText('No absences')
    await expect(page.getByRole('article')).toHaveCount(4)
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await expect(iniciales(deLasOcho)).toHaveText(['AL'])
    await expect(iniciales(ventanas)).toHaveText(['CR'])
    await expect(zona(page, 'Wed')).toContainText('Sofía Romero')
    for (const nombre of ['Sun', 'Mon', 'Tue', 'Thu', 'Fri', 'Sat']) {
      await expect(zona(page, nombre)).toContainText('No absences')
    }

    // Cambio de semana: las siete zonas quedan vacías y al volver reaparece la ausencia de Sofía.
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(rango(page)).toHaveText('Nov 8 - 14, 2026')
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect(page.getByText('Absences', { exact: true })).toHaveCount(7)
    await expect(page.getByText('No absences', { exact: true })).toHaveCount(7)

    await page.getByRole('button', { name: 'Previous week' }).click()
    await expect(rango(page)).toHaveText('Nov 1 - 7, 2026')
    await expect(page.getByRole('article')).toHaveCount(4)
    await expect(zona(page, 'Wed')).toContainText('Sofía Romero')
  })
})

test.describe('tablet, 800 px', () => {
  test.use({ viewport: { width: 800, height: 1100 } })

  test('recorrido con el cajón "Employees": marcar, bloquear la asignación, duplicar y mover con ausentes, quitar la ausencia y deshacer', async ({
    page,
  }) => {
    await abrir(page, 4)
    const lunes = tarjetasDe(page, 'Mon')
    const viernes = tarjetasDe(page, 'Fri')
    const deLasSiete = lunes.filter({ hasText: '07:00' })
    const deLasOcho = lunes.filter({ hasText: '08:00' })
    const cajon = page.getByRole('dialog', { name: 'Employees' })
    /** Abre el cajón "Employees". */
    const abrirCajon = async () => {
      await page.getByRole('button', { name: 'Employees', exact: true }).click()
      await expect(cajon).toBeInViewport()
    }

    // 1. Luis, desde su tarjeta (no está en el panel: es "Office"), al "Absences" del viernes, con
    // "Off" por defecto.
    await arrastrar(page, deLasSiete.getByTitle('Luis Martínez'), zona(page, 'Fri'))
    await expect(dialogoDeAusencia(page)).toContainText('Luis Martínez · Fri, Nov 6')
    await expect(dialogoDeAusencia(page).getByRole('radio', { name: 'Off' })).toBeChecked()
    await guardarAusencia(page, 'Off')
    await expect(zona(page, 'Fri')).toContainText('Luis Martínez')
    await expect(zona(page, 'Fri')).toContainText('Off')
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])

    // 2. Duplicar con Alt la de las 07:00 (Ana y Luis) al viernes: la copia solo lleva a Ana.
    await arrastrar(page, deLasSiete, dia(page, 'Fri'), { alt: true })
    await expect(viernes).toHaveCount(1)
    await expect(iniciales(viernes)).toHaveText(['AL'])
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await esperarConfirmadas(page)

    // 3. "Move to…" del detalle de la de las 07:00 al viernes: bloqueado, con el error que nombra a Luis.
    const detalle = await abrirDetalle(page, deLasSiete, 'J-1024 Pintar oficina')
    await detalle.getByLabel('Move to').selectOption('2026-11-06')
    await expect(error(page)).toContainText("Can't move the job")
    await expect(error(page)).toContainText('Luis Martínez')
    await expect(detalle).toContainText('Mon, Nov 2')
    await detalle.getByRole('button', { name: 'Close' }).click()
    await expect(detalle).toHaveCount(0)
    await expect(lunes).toHaveCount(2)
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await expect(viernes).toHaveCount(1)

    // 4. Ana al "Absences" del lunes con "Vacation": sale de las dos tarjetas y el recuadro del
    // cajón pasa al estilo de ausencia.
    await abrirCajon()
    await arrastrar(page, enElCajon(cajon, 'Ana López'), zona(page, 'Mon'))
    await expect(cajon).toHaveCount(0)
    await guardarAusencia(page, 'Vacation')
    await expect(zona(page, 'Mon')).toContainText('Ana López')
    await expect(iniciales(deLasSiete)).toHaveText(['LM'])
    await expect(deLasOcho).toContainText('No employees')
    await expect(iniciales(viernes)).toHaveText(['AL'])
    await abrirCajon()
    const recuadrosDeAna = enElCajon(cajon, 'Ana López').getByRole('img')
    await expect(recuadrosDeAna).toHaveAccessibleName(/Absent: Mon \(Vacation\)/)
    await expect(recuadrosDeAna.locator('[data-level="absent"]')).toHaveCount(1)
    await cajon.getByRole('button', { name: 'Close' }).click()
    await expect(cajon).toHaveCount(0)

    // 5. Ana sobre una tarjeta del lunes: la zona da el aviso y Ana no queda asignada.
    await abrirCajon()
    await arrastrar(page, enElCajon(cajon, 'Ana López'), deLasOcho)
    await expect(zona(page, 'Mon')).toHaveClass(/blocked/)
    await expect(deLasOcho).toContainText('No employees')
    await expect(iniciales(deLasSiete)).toHaveText(['LM'])
    await expect(zona(page, 'Mon').getByText('Ana López')).toHaveCount(1)

    // 6. Quitar la ausencia de Ana arrastrándola fuera: no vuelve a ninguna tarjeta.
    await arrastrar(page, zona(page, 'Mon').getByText('Ana López'), rango(page))
    await expect(zona(page, 'Mon')).toContainText('No absences')
    await expect(iniciales(deLasSiete)).toHaveText(['LM'])
    await expect(deLasOcho).toContainText('No employees')
    await expect(aviso(page, 'Absence removed')).toBeVisible()

    // 7. Deshacer: la ausencia de Ana reaparece como "Vacation" y, al deshacer la marca, Ana vuelve
    // a las dos tarjetas.
    await deshacer(page)
    await expect(zona(page, 'Mon')).toContainText('Ana López')
    await expect(zona(page, 'Mon')).toContainText('Vacation')
    await deshacer(page)
    await expect(zona(page, 'Mon')).toContainText('No absences')
    await expect(iniciales(deLasSiete)).toHaveText(['AL', 'LM'])
    await expect(iniciales(deLasOcho)).toHaveText(['AL'])

    // 8. Ctrl+Z hasta vaciar la pila: la copia del viernes y la ausencia de Luis.
    await deshacer(page)
    await expect(viernes).toHaveCount(0)
    await deshacer(page)
    await expect(zona(page, 'Fri')).toContainText('No absences')
    await expect(page.getByRole('article')).toHaveCount(4)
    await expect(zona(page, 'Wed')).toContainText('Sofía Romero')
  })
})

test.describe('teléfono, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  /** Día `nombre` de la tira de días. */
  const enLaTira = (page: Page, nombre: string) => page.locator('button[aria-pressed]').filter({ hasText: nombre })

  test('recorrido con la tira de días y los paneles inferiores: marcar, "Assign employees", "Move to…", aviso con la zona fuera de la vista, quitar y deshacer', async ({
    page,
  }) => {
    // El recorrido espera a que se vayan varios avisos de 5 s antes de abrir el panel.
    test.setTimeout(90_000)
    await abrir(page, 1)
    const tarjetas = page.getByRole('article')
    const panel = page.getByRole('dialog', { name: 'Employees' })
    /**
     * Abre el panel inferior "Employees". Antes espera a que se vaya el aviso de la acción
     * anterior (5 s), porque en el teléfono tapa las filas del panel y el ratón no las alcanza.
     */
    const abrirPanel = async () => {
      await expect(page.getByRole('status').filter({ hasText: 'Undo' })).toHaveCount(0, { timeout: 8000 })
      await page.getByRole('button', { name: 'Employees', exact: true }).click()
      await expect(panel).toBeInViewport()
    }

    // 1. Ana al "Absences" del lunes desde el panel "Employees", con "Sick". El nombre y el tipo
    // quedan dentro de la zona.
    await enLaTira(page, 'Mon').click()
    await expect(enLaTira(page, 'Mon')).toHaveAttribute('aria-pressed', 'true')
    await expect(tarjetas).toHaveCount(2)
    await expect(iniciales(tarjetas.first())).toHaveText(['AL', 'LM'])
    await abrirPanel()
    await arrastrar(page, enElCajon(panel, 'Ana López'), zonaDelTelefono(page))
    await expect(panel).toHaveCount(0)
    await expect(dialogoDeAusencia(page)).toContainText('Ana López · Mon, Nov 2')
    await guardarAusencia(page, 'Sick')
    const zonaDelLunes = zonaDelTelefono(page)
    await expect(zonaDelLunes).toContainText('Ana López')
    await expect(zonaDelLunes).toContainText('Sick')
    await comprobarDentro(zonaDelLunes.getByText('Ana López'), zonaDelLunes)
    await comprobarDentro(zonaDelLunes.getByText('Sick', { exact: true }), zonaDelLunes)
    await expect(iniciales(tarjetas.first())).toHaveText(['LM'])
    await expect(tarjetas.last()).toContainText('No employees')

    // 2. "Assign employees" de J-1024 del lunes: Ana aparece deshabilitada, con su tipo y sin marcar.
    await tarjetas.first().getByRole('button', { name: 'Assign employees' }).click()
    const asignar = page.getByRole('dialog', { name: 'Assign employees' })
    await expect(asignar).toBeInViewport()
    const ana = asignar.getByRole('checkbox', { name: 'Ana López' })
    await expect(ana).toBeDisabled()
    await expect(ana).not.toBeChecked()
    await expect(asignar.getByRole('listitem').filter({ hasText: 'Ana López' })).toContainText('Sick')
    await asignar.getByRole('button', { name: 'Done' }).click()
    await expect(asignar).toHaveCount(0)

    // 3. Carlos (en J-1019 del martes) al "Absences" del viernes; "Move to…" del detalle de J-1019
    // al viernes queda bloqueado con un error que lo nombra.
    await enLaTira(page, 'Fri').click()
    await expect(enLaTira(page, 'Fri')).toHaveAttribute('aria-pressed', 'true')
    await abrirPanel()
    await arrastrar(page, enElCajon(panel, 'Carlos Ruiz'), zonaDelTelefono(page))
    await guardarAusencia(page, 'Off')
    await expect(zonaDelTelefono(page)).toContainText('Carlos Ruiz')

    await enLaTira(page, 'Tue').click()
    await expect(tarjetas).toHaveCount(1)
    const detalle = await abrirDetalle(page, tarjetas.first(), 'J-1019 Cambiar ventanas')
    await detalle.getByLabel('Move to').selectOption('2026-11-06')
    await expect(error(page)).toContainText("Can't move the job")
    await expect(error(page)).toContainText('Carlos Ruiz')
    await expect(detalle).toContainText('Tue, Nov 3')
    await detalle.getByRole('button', { name: 'Close' }).click()
    await expect(detalle).toHaveCount(0)
    await expect(tarjetas).toHaveCount(1)
    await expect(iniciales(tarjetas.first())).toHaveText(['CR'])
    await enLaTira(page, 'Mon').click()
    await expect(tarjetas).toHaveCount(2)

    // 4. Programar copias en el lunes (con "Duplicate" del detalle) hasta que su zona "Absences"
    // quede fuera de la vista al desplazarse al final de la página.
    let copias = 0
    const zonaFueraDeLaVista = async () => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      return zonaDelTelefono(page).evaluate((elemento) => elemento.getBoundingClientRect().bottom <= 0)
    }
    while (!(await zonaFueraDeLaVista())) {
      expect(copias).toBeLessThan(12)
      await page.evaluate(() => window.scrollTo(0, 0))
      const detalleCopia = await abrirDetalle(page, tarjetas.first(), 'J-1024 Pintar oficina')
      await detalleCopia.getByRole('button', { name: 'Duplicate' }).click()
      await detalleCopia.getByRole('button', { name: 'Close' }).click()
      await expect(detalleCopia).toHaveCount(0)
      copias++
      await expect(tarjetas).toHaveCount(2 + copias)
      await esperarConfirmadas(page)
    }
    await expect(zonaDelTelefono(page)).not.toBeInViewport()

    //    Ana sobre una tarjeta del lunes: la página se desplaza hasta la zona, que da el aviso, y
    //    Ana no queda asignada.
    await abrirPanel()
    await arrastrar(page, enElCajon(panel, 'Ana López'), tarjetas.nth(2 + copias - 3))
    await expect(zonaDelTelefono(page)).toHaveClass(/blocked/)
    await expect(zonaDelTelefono(page)).toBeInViewport()
    await expect(tarjetas.getByTitle('Ana López')).toHaveCount(0)
    await expect(zonaDelTelefono(page).getByText('Ana López')).toHaveCount(1)

    // 5. Quitar la ausencia de Ana arrastrándola fuera de la zona (no vuelve a ninguna tarjeta) y
    // deshacer paso a paso hasta la semilla.
    await arrastrar(page, zonaDelTelefono(page).getByText('Ana López'), tarjetas.first())
    await expect(zonaDelTelefono(page)).toContainText('No absences')
    await expect(tarjetas.getByTitle('Ana López')).toHaveCount(0)
    // El aviso llega cuando la acción ya entró en la pila de deshacer.
    await expect(aviso(page, 'Absence removed')).toBeVisible()

    await deshacer(page)
    await expect(zonaDelTelefono(page)).toContainText('Ana López')
    await expect(zonaDelTelefono(page)).toContainText('Sick')
    for (let restantes = copias; restantes > 0; restantes--) {
      await deshacer(page)
      await expect(tarjetas).toHaveCount(1 + restantes)
    }
    await expect(tarjetas).toHaveCount(2)

    // La ausencia de Carlos del viernes y después la de Ana del lunes.
    await deshacer(page)
    await enLaTira(page, 'Fri').click()
    await expect(zonaDelTelefono(page)).toContainText('No absences')
    await enLaTira(page, 'Mon').click()
    await deshacer(page)
    await expect(zonaDelTelefono(page)).toContainText('No absences')
    await expect(iniciales(tarjetas.first())).toHaveText(['AL', 'LM'])
    await expect(iniciales(tarjetas.last())).toHaveText(['AL'])
  })
})
