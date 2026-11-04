// Tarea 3.4 de `schedule-assign`: con `VITE_USE_MOCKS=true` (lo pone el `webServer`
// de playwright.config.ts) el service worker de MSW intercepta las llamadas a `/api`.
//
// El código de `page.evaluate` y `waitForFunction` corre en el navegador: necesita los
// tipos del DOM, que tsconfig.node.json no incluye.
/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

test('el service worker de MSW responde GET /api/employees con los datos semilla', async ({ page }) => {
  await page.goto('/')

  // main.tsx monta la app después de arrancar el worker: si se ve la página, ya arrancó.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Planificación semanal' }),
  ).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  const respuestaDeRed = page.waitForResponse(
    (respuesta) => new URL(respuesta.url()).pathname === '/api/employees',
  )
  const resultado = await page.evaluate(async () => {
    const respuesta = await fetch('/api/employees')
    return {
      status: respuesta.status,
      contentType: respuesta.headers.get('content-type'),
      cuerpo: (await respuesta.json()) as Array<{ status: string }>,
    }
  })
  const respuesta = await respuestaDeRed

  // Sin el worker, el servidor de Vite respondería 200 con index.html.
  expect(respuesta.fromServiceWorker()).toBe(true)
  expect(respuesta.status()).toBe(200)
  expect(resultado.status).toBe(200)
  expect(resultado.contentType).toContain('application/json')
  expect(resultado.cuerpo).toHaveLength(10)
  expect(resultado.cuerpo.filter((empleado) => empleado.status === 'inactivo')).toHaveLength(2)
})
