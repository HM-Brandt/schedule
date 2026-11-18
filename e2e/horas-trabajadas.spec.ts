// Camino feliz de "Resumen de horas trabajadas por empleado" (`specs/schedule-api/spec.md` de
// `schedule-assign`) en escritorio, con los datos de prueba de MSW (`VITE_USE_MOCKS=true`).
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00. La semilla de horas tiene a
// Marta Gómez (Supervisor) con 32.5 h y a Jorge Pérez con 40 h; Pedro Sánchez no aparece en el
// resumen, así que muestra "0 h".
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Sección del panel de empleados. */
const panel = (page: Page) => page.getByRole('heading', { name: 'Employees' }).locator('xpath=..')

/** Fila del panel de empleados con el nombre completo `nombre`. */
const enElPanel = (page: Page, nombre: string) => panel(page).getByRole('listitem').filter({ hasText: nombre })

test('el panel muestra las horas de la semana de cada empleado y "0 h" a quien no aparece en el resumen', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')
  await expect(panel(page).getByRole('listitem')).toHaveCount(7)

  await expect(enElPanel(page, 'Marta Gómez')).toContainText('Supervisor · 32.5 h')
  await expect(enElPanel(page, 'Jorge Pérez')).toContainText('40 h')
  await expect(enElPanel(page, 'Pedro Sánchez')).toContainText('0 h')
})
