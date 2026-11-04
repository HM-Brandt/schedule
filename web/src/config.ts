/** Configuración de la aplicación leída de las variables de entorno. */
export interface AppConfig {
  /** Si se usan los datos de prueba MSW en lugar del backend. */
  useMocks: boolean
  /** URL base del backend, sin `/` final. Vacía significa mismo origen. */
  apiUrl: string
  mockDelay: number
}

/**
 * Convierte las variables de entorno en la configuración tipada.
 * `useMocks` solo es `true` si `VITE_USE_MOCKS` vale exactamente `'true'`.
 * `apiUrl` se recorta y pierde la `/` final; si falta o queda vacía, es `''`.
 */
export function readConfig(env: {
  VITE_USE_MOCKS?: string
  VITE_API_URL?: string
  VITE_MOCK_DELAY?: string
}): AppConfig {
  const mockDelay = Number.parseInt(env.VITE_MOCK_DELAY ?? '', 10)
  return {
    useMocks: env.VITE_USE_MOCKS === 'true',
    apiUrl: (env.VITE_API_URL ?? '').trim().replace(/\/+$/, ''),
    mockDelay: Number.isNaN(mockDelay) ? 300 : mockDelay,
  }
}

/** Configuración de la aplicación para el entorno actual. */
export const config: AppConfig = readConfig(import.meta.env)
