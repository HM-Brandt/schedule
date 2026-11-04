// Configuración común de los tests unitarios (Vitest + Testing Library + jsdom).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library solo limpia el DOM sola si `afterEach` es global, y aquí las
// globals de Vitest están desactivadas: se desmonta lo renderizado tras cada test.
afterEach(() => {
  cleanup()
})
