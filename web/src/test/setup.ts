// Configuración común de los tests unitarios (Vitest + Testing Library + jsdom).
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { instalarMatchMedia, restablecerAncho } from './viewport'

// Vitest lee `VITE_API_URL` de los `.env*` locales de cada máquina. Con una URL absoluta, jsdom
// aplica CORS a las XHR y los manejadores MSW (que no envían cabeceras CORS) responden con un
// error de red. Los tests usan siempre el mismo origen de jsdom; `config.ts` se evalúa después
// de este archivo, así que toma este valor. Las URL base absolutas se prueban aparte en
// `api/client.test.ts` y `mocks/handlers.test.ts`.
vi.stubEnv('VITE_API_URL', '')

// Con la máquina cargada, el plazo por defecto de `waitFor`/`findBy` (1000 ms) se agota.
configure({ asyncUtilTimeout: 3000 })

// jsdom no tiene `matchMedia`: se simula con un ancho de 1280 px (escritorio). Ver `viewport.ts`.
instalarMatchMedia()

// Testing Library solo limpia el DOM sola si `afterEach` es global, y aquí las
// globals de Vitest están desactivadas: se desmonta lo renderizado tras cada test.
// Después se vuelve al ancho por defecto por si el test simuló otro.
afterEach(() => {
  cleanup()
  restablecerAncho()
})
