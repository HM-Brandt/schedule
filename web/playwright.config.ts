import { defineConfig, devices } from '@playwright/test'

// Puerto propio para no chocar con otros servidores Vite (5173).
const PUERTO = 5180
const BASE_URL = `http://localhost:${PUERTO}`

// https://playwright.dev/docs/test-configuration
export default defineConfig({
  testDir: './e2e',
  // En CI falla si quedó algún `test.only` olvidado.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `--strictPort` hace que Vite falle si el puerto está ocupado en vez de elegir otro.
    command: `npm run dev -- --port ${PUERTO} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Se suma a `process.env`: la app usa los mocks de MSW en lugar de la API real.
    env: { VITE_USE_MOCKS: 'true' },
  },
})
