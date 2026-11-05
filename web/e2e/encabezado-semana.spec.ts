// Tarea 5.1 de `schedule-assign`: camino feliz del encabezado de la semana.
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la
// app. La fecha se construye en Node con la hora local, que es la misma zona horaria
// que usa el navegador lanzado por Playwright.
import { expect, test } from '@playwright/test'

test('abre en la semana actual, pasa a la siguiente y vuelve con "Today"', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')

  const rango = page.getByRole('heading', { level: 2 })
  const diaActual = page.locator('[aria-current="date"]')

  await expect(rango).toHaveText('Nov 1 - 7, 2026')
  await expect(diaActual).toHaveCount(1)
  await expect(diaActual).toContainText('Tue')
  await expect(diaActual).toContainText('3')

  await page.getByRole('button', { name: 'Next week' }).click()
  await expect(rango).toHaveText('Nov 8 - 14, 2026')

  await page.getByRole('button', { name: 'Today' }).click()
  await expect(rango).toHaveText('Nov 1 - 7, 2026')
  await expect(diaActual).toContainText('Tue')
})
