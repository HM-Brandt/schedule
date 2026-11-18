// Tarea 12.2 de `schedule-assign`: camino feliz de "Comentario de una programación"
// (escenario "Agregar un comentario" de `specs/weekly-schedule-board/spec.md`) con los datos de
// prueba de MSW (`VITE_USE_MOCKS=true`). Borrar, salir sin cambios y deshacer se cubren en los
// tests unitarios (`src/detail/ScheduleDetail/ScheduleDetail.test.tsx` y `src/undo/`).
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app. La
// semilla programa el lunes 2 "J-1024 Pintar oficina" a las 07:00 con el comentario "Llevar
// escalera" y a las 08:00 sin comentario.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
const dia = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** Tarjeta del día `nombre` que contiene `texto` (una hora o un número de trabajo). */
const tarjeta = (page: Page, nombre: string, texto: string) =>
  dia(page, nombre).getByRole('article').filter({ hasText: texto })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(4)
})

test('agregar el comentario "Llevar andamio" desde el detalle: al salir del campo la tarjeta muestra el icono con el texto', async ({
  page,
}) => {
  const pintar = tarjeta(page, 'Mon', '08:00')
  await expect(pintar.getByLabel(/^Comment: /)).toHaveCount(0)

  await pintar.click()
  const detalle = page.getByRole('dialog', { name: 'J-1024 Pintar oficina' })
  await expect(detalle).toBeVisible()
  const comentario = detalle.getByLabel('Comment')
  await expect(comentario).toHaveValue('')

  await comentario.fill('Llevar andamio')
  await comentario.press('Tab')

  await expect(page.getByRole('status').filter({ hasText: 'Comment updated' })).toBeVisible()
  const icono = pintar.getByLabel('Comment: Llevar andamio')
  await expect(icono).toBeVisible()
  await expect(icono).toHaveAttribute('title', 'Llevar andamio')
  // La otra programación del lunes conserva su propio comentario.
  await expect(tarjeta(page, 'Mon', '07:00').getByLabel('Comment: Llevar escalera')).toBeVisible()

  // Al cerrar y volver a abrir el detalle, el campo muestra el comentario guardado.
  await detalle.getByRole('button', { name: 'Close' }).click()
  await pintar.click()
  await expect(page.getByRole('dialog', { name: 'J-1024 Pintar oficina' }).getByLabel('Comment')).toHaveValue(
    'Llevar andamio',
  )
})
