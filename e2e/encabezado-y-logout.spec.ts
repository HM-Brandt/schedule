// Camino feliz del encabezado de la aplicación con los mocks de MSW (`VITE_USE_MOCKS=true`):
// logo, título, enlace Home, usuario de prueba "Demo User" y cierre de sesión.
//
// El portal (`https://ckarlosdev.github.io/...`) se intercepta con `page.route` para que el
// test no salga a la red externa.
//
// El código de `page.evaluate` corre en el navegador: necesita los tipos del DOM,
// que tsconfig.node.json no incluye.
/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

const HOME_URL = 'https://ckarlosdev.github.io/HMBrandt/'
const LOGIN_URL = 'https://ckarlosdev.github.io/login/'

test('el encabezado muestra la marca y el usuario, y Logout cierra la sesión y lleva al login', async ({
  page,
  baseURL,
}) => {
  await page.route('https://ckarlosdev.github.io/**', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Login</title>' }),
  )

  // Sesión iniciada: el portal de login dejó los tokens en localStorage.
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'token-e2e')
    localStorage.setItem('refresh_token', 'refresh-e2e')
  })
  await page.reload()

  const logo = page.getByRole('img', { name: 'HM Brandt Demolition' })
  await expect(logo).toBeVisible()
  await expect(page.getByRole('link', { name: 'HM Brandt Demolition' })).toHaveAttribute('href', HOME_URL)
  await expect(page.getByRole('heading', { level: 1, name: 'Weekly schedule' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('href', HOME_URL)
  await expect(page.getByText('Demo User')).toBeVisible()
  await expect(page.getByText('DU', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => [localStorage.getItem('auth_token'), localStorage.getItem('refresh_token')]),
  ).toEqual(['token-e2e', 'refresh-e2e'])

  await page.getByRole('button', { name: 'Logout' }).click()

  await expect(page).toHaveURL(LOGIN_URL)
  const almacenamiento = await page.context().storageState()
  const origenApp = almacenamiento.origins.find((origen) => origen.origin === new URL(baseURL!).origin)
  const claves = (origenApp?.localStorage ?? []).map((entrada) => entrada.name)
  expect(claves).not.toContain('auth_token')
  expect(claves).not.toContain('refresh_token')
})
