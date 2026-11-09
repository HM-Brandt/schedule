// Configuración común de los tests unitarios (Vitest + Testing Library + jsdom).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { instalarMatchMedia, restablecerAncho } from './viewport'

// jsdom no tiene `matchMedia`: se simula con un ancho de 1280 px (escritorio). Ver `viewport.ts`.
instalarMatchMedia()

// Testing Library solo limpia el DOM sola si `afterEach` es global, y aquí las
// globals de Vitest están desactivadas: se desmonta lo renderizado tras cada test.
// Después se vuelve al ancho por defecto por si el test simuló otro.
afterEach(() => {
  cleanup()
  restablecerAncho()
})
