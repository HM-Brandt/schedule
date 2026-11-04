/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), msw()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Solo los tests unitarios: sin esto Vitest también tomaría los `e2e/*.spec.ts` de Playwright.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
