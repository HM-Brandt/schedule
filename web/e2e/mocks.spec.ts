// Tareas 3.4 y 11.7 de `schedule-assign`: con `VITE_USE_MOCKS=true` (lo pone el `webServer`
// de playwright.config.ts) el service worker de MSW intercepta las llamadas a `v1/...`, tanto
// en el mismo origen como en la URL base que tenga configurada `VITE_API_URL`.
//
// El código de `page.evaluate` y `waitForFunction` corre en el navegador: necesita los
// tipos del DOM, que tsconfig.node.json no incluye.
/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

test('el service worker de MSW responde GET /v1/employee con los datos semilla', async ({ page }) => {
  await page.goto('/')

  // main.tsx monta la app después de arrancar el worker: si se ve la página, ya arrancó.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Weekly schedule' }),
  ).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  const respuestaDeRed = page.waitForResponse(
    (respuesta) => new URL(respuesta.url()).pathname === '/v1/employee',
  )
  const resultado = await page.evaluate(async () => {
    const respuesta = await fetch('/v1/employee')
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
  expect(resultado.cuerpo.filter((empleado) => empleado.status === 'Terminated')).toHaveLength(2)
})

test('la app pide empleados, trabajos y programaciones en v1/... de su URL base y responde el service worker', async ({
  page,
}) => {
  const rutas = ['/v1/employee', '/v1/job', '/v1/schedules']
  const respuestas = rutas.map((ruta) =>
    page.waitForResponse((respuesta) => new URL(respuesta.url()).pathname.endsWith(ruta)),
  )

  await page.goto('/')

  for (const promesa of respuestas) {
    const respuesta = await promesa
    expect(respuesta.fromServiceWorker()).toBe(true)
    expect(respuesta.status()).toBe(200)
    // Una sola "/" entre la URL base y la ruta: nunca `/api/api` ni `//v1`.
    expect(respuesta.url()).not.toContain('/api/api')
    expect(new URL(respuesta.url()).pathname).not.toContain('//')
  }
  // Los datos de prueba llegan a la pantalla.
  await expect(page.getByText('Ana López').first()).toBeVisible()
  await expect(page.getByText('Pintar oficina').first()).toBeVisible()
})
