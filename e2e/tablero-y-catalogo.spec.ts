// Tareas 5.2 y 5.3 de `schedule-assign`: camino feliz del tablero con sus tarjetas y del
// catálogo de trabajos, con los datos de prueba de MSW (`VITE_USE_MOCKS=true`).
//
// El reloj del navegador se fija en el martes 2026-11-03 a las 10:00 antes de abrir la
// app, así la semilla programa "J-1024 Pintar oficina" el lunes 2 a las 07:00 (Ana López
// y Luis Martínez) y a las 08:00 (Ana).
import { expect, test } from '@playwright/test'

test('el lunes muestra J-1024 con sus empleados, el catálogo lo marca "x2" y la búsqueda lo encuentra', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0))
  await page.goto('/')

  // Columna del lunes: el encabezado del día y sus tarjetas.
  const lunes = page.getByText('Mon', { exact: true }).locator('xpath=../..')
  const tarjetasDelLunes = lunes.getByRole('article')
  await expect(tarjetasDelLunes).toHaveCount(2)

  const primera = tarjetasDelLunes.first()
  await expect(primera).toContainText('J-1024')
  await expect(primera).toContainText('Pintar oficina')
  await expect(primera).toContainText('07:00')
  await expect(primera.getByTitle('Ana López')).toHaveText('AL')
  await expect(primera.getByTitle('Luis Martínez')).toHaveText('LM')
  await expect(tarjetasDelLunes.nth(1)).toContainText('08:00')

  // La lista del catálogo, dentro de la sección "Jobs"; la página tiene también la de empleados.
  const catalogo = page.getByRole('heading', { name: 'Jobs' }).locator('xpath=..').getByRole('list')
  const pintar = catalogo.getByRole('listitem').filter({ hasText: 'J-1024' })
  await expect(pintar).toContainText('Pintar oficina')
  await expect(pintar).toContainText('x2')

  await page.getByRole('searchbox', { name: 'Search jobs' }).fill('1024')

  await expect(catalogo.getByRole('listitem')).toHaveCount(1)
  await expect(catalogo.getByRole('listitem')).toContainText('J-1024')
  await expect(catalogo.getByRole('listitem')).toContainText('Pintar oficina')
})
