// jsdom no implementa la navegación: `window.location.assign` solo escribe un error en la
// consola. En Vitest `window` es el propio global y `location` es una propiedad configurable,
// así que se sustituye con `vi.stubGlobal` por una copia de la ubicación actual con un
// `assign` simulado. Cada test que lo use debe llamar a `vi.unstubAllGlobals()` al terminar.
import { vi } from 'vitest'

/** Sustituye `window.location` y devuelve el `assign` simulado para comprobar a dónde se navegó. */
export function simularNavegacion() {
  const actual = window.location
  const assign = vi.fn<(url: string | URL) => void>()
  vi.stubGlobal('location', {
    href: actual.href,
    origin: actual.origin,
    protocol: actual.protocol,
    host: actual.host,
    hostname: actual.hostname,
    port: actual.port,
    pathname: actual.pathname,
    search: actual.search,
    hash: actual.hash,
    assign,
    replace: vi.fn(),
    reload: vi.fn(),
  })
  return assign
}
