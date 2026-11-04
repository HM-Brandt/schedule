// Tipos de las variables de entorno propias. Sin `import`: convertiría el archivo
// en módulo y dejaría de extender la interfaz global. Los tipos de `vite/client`
// se cargan desde `types` en tsconfig.app.json.
interface ImportMetaEnv {
  /** `'true'` activa los datos de prueba MSW. */
  readonly VITE_USE_MOCKS?: string
  /** URL base del backend. Vacía: mismo origen. */
  readonly VITE_API_URL?: string
}
