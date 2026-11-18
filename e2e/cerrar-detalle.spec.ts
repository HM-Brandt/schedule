// Tareas 14.1 y 14.2 de `schedule-assign`: camino feliz de "Cerrar el detalle de una
// programación" (escenarios "Click fuera del panel" y "Guardar al cerrar" de
// `specs/weekly-schedule-board/spec.md`), de la disposición de las acciones del detalle y de la
// posición del icono de comentario en la tarjeta, en escritorio (1280 px), con los datos de
// prueba de MSW (`VITE_USE_MOCKS=true`). Click dentro, click en otra tarjeta y "Undo" se cubren
// en los tests unitarios (`src/detail/ScheduleDetail/ScheduleDetail.test.tsx`).
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la app. La
// semilla programa el lunes 2 "J-1024 Pintar oficina" a las 07:00 con el comentario "Llevar
// escalera" y a las 08:00 sin comentario; el miércoles 4 no tiene programaciones.
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
const dia = (page: Page, nombre: string) => page.getByText(nombre, { exact: true }).locator('xpath=../..')

/** Tarjeta del día `nombre` que contiene `texto` (una hora o un número de trabajo). */
const tarjeta = (page: Page, nombre: string, texto: string) =>
  dia(page, nombre).getByRole('article').filter({ hasText: texto })

async function medir(elemento: Locator) {
  const caja = await elemento.boundingBox()
  if (!caja) throw new Error('No se pudo medir el elemento')
  return caja
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(page.getByRole('article')).toHaveCount(4)
})

test('el icono de comentario queda en la fila del número, en la esquina superior derecha de la tarjeta', async ({
  page,
}) => {
  const pintar = tarjeta(page, 'Mon', '07:00')
  const icono = pintar.getByLabel('Comment: Llevar escalera')
  await expect(icono).toBeVisible()

  const numero = await medir(pintar.getByText('J-1024', { exact: true }))
  const caja = await medir(icono)
  const hora = await medir(pintar.getByText('07:00', { exact: true }))
  const nombre = await medir(pintar.getByText('Pintar oficina', { exact: true }))
  const centro = (medida: { y: number; height: number }) => medida.y + medida.height / 2

  // A la altura del número y por encima del nombre del trabajo.
  expect(Math.abs(centro(caja) - centro(numero))).toBeLessThanOrEqual(6)
  expect(caja.y + caja.height).toBeLessThanOrEqual(nombre.y + 1)
  // A la derecha del número y sin tapar la hora, pegado al borde derecho de la fila superior. En
  // columnas estrechas la hora pasa a la línea siguiente y puede quedar debajo del icono.
  expect(caja.x).toBeGreaterThanOrEqual(numero.x + numero.width)
  const aLaDerechaDeLaHora = caja.x >= hora.x + hora.width - 1
  const porEncimaDeLaHora = caja.y + caja.height <= hora.y + 1
  expect(aLaDerechaDeLaHora || porEncimaDeLaHora).toBe(true)
  const filaSuperior = await medir(pintar.getByText('J-1024', { exact: true }).locator('xpath=..'))
  expect(Math.abs(caja.x + caja.width - (filaSuperior.x + filaSuperior.width))).toBeLessThanOrEqual(1)
  expect(Math.abs(caja.y - filaSuperior.y)).toBeLessThanOrEqual(1)
})

test('abrir el detalle, ver sus acciones, escribir un comentario y cerrarlo con un click fuera guarda el comentario', async ({
  page,
}) => {
  const pintar = tarjeta(page, 'Mon', '08:00')
  await expect(pintar.getByLabel(/^Comment: /)).toHaveCount(0)

  await pintar.click()
  const detalle = page.getByRole('dialog', { name: 'J-1024 Pintar oficina' })
  await expect(detalle).toBeVisible()

  // "Duplicate" y "Remove" del mismo ancho en una fila; "Close" debajo, con el ancho de ambos.
  const duplicar = await medir(detalle.getByRole('button', { name: 'Duplicate', exact: true }))
  const quitar = await medir(detalle.getByRole('button', { name: 'Remove', exact: true }))
  const cerrar = await medir(detalle.getByRole('button', { name: 'Close', exact: true }))
  expect(Math.abs(duplicar.width - quitar.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(duplicar.y - quitar.y)).toBeLessThanOrEqual(1)
  expect(quitar.x).toBeGreaterThan(duplicar.x + duplicar.width - 1)
  expect(cerrar.y).toBeGreaterThanOrEqual(duplicar.y + duplicar.height)
  expect(Math.abs(cerrar.x - duplicar.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(cerrar.x + cerrar.width - (quitar.x + quitar.width))).toBeLessThanOrEqual(1)

  // Escribe en "Comment" y, sin salir antes del campo, hace click en el miércoles vacío.
  await detalle.getByLabel('Comment').fill('Llevar andamio')
  await expect(dia(page, 'Wed').getByRole('article')).toHaveCount(0)
  await dia(page, 'Wed').click()

  await expect(detalle).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Comment updated' })).toBeVisible()
  await expect(pintar.getByLabel('Comment: Llevar andamio')).toBeVisible()
})
