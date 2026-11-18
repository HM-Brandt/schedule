// Simulación de `window.matchMedia` en jsdom, que no la implementa ni calcula tamaños.
//
// Las consultas se evalúan contra un ancho de ventana simulado (1280 px por defecto, la
// disposición de escritorio). Se entienden `(max-width: Npx)` y `(min-width: Npx)`, unidas con
// `and` o separadas por comas, y `(prefers-reduced-motion: reduce)`, que siempre coincide para
// que @dnd-kit no anime la caída (jsdom no tiene `animate`). Cualquier otra consulta no coincide.
//
// `setup.ts` la instala para todos los tests y vuelve a 1280 px tras cada uno. Para probar otra
// disposición, se llama a `simularAncho` antes de renderizar o, dentro de `act`, después.

export const ANCHO_POR_DEFECTO = 1280

let ancho = ANCHO_POR_DEFECTO

function cumpleCondicion(condicion: string): boolean {
  const texto = condicion.trim().replace(/^\(|\)$/g, '').trim()
  if (texto === 'prefers-reduced-motion: reduce') return true
  const medida = /^(max|min)-width:\s*(\d+(?:\.\d+)?)px$/.exec(texto)
  if (!medida) return false
  const valor = Number(medida[2])
  return medida[1] === 'max' ? ancho <= valor : ancho >= valor
}

function evaluar(consulta: string): boolean {
  return consulta.split(',').some((alternativa) => alternativa.split(/\s+and\s+/).every(cumpleCondicion))
}

/** Listas con algún oyente de `change`, para avisarlas cuando cambia el ancho. */
const escuchadas = new Set<ListaSimulada>()

class ListaSimulada extends EventTarget {
  readonly media: string
  onchange: ((evento: Event) => void) | null = null
  private oyentes = 0
  private ultimo: boolean

  constructor(media: string) {
    super()
    this.media = media
    this.ultimo = evaluar(media)
  }

  get matches() {
    return evaluar(this.media)
  }

  addEventListener(...args: Parameters<EventTarget['addEventListener']>) {
    super.addEventListener(...args)
    if (args[0] === 'change') {
      this.oyentes++
      escuchadas.add(this)
    }
  }

  removeEventListener(...args: Parameters<EventTarget['removeEventListener']>) {
    super.removeEventListener(...args)
    if (args[0] === 'change' && --this.oyentes <= 0) escuchadas.delete(this)
  }

  addListener(oyente: (evento: Event) => void) {
    this.addEventListener('change', oyente)
  }

  removeListener(oyente: (evento: Event) => void) {
    this.removeEventListener('change', oyente)
  }

  /** Dispara `change` si el resultado de la consulta cambió desde el último aviso. */
  avisarSiCambio() {
    const ahora = this.matches
    if (ahora === this.ultimo) return
    this.ultimo = ahora
    const evento = new Event('change')
    Object.assign(evento, { matches: ahora, media: this.media })
    this.onchange?.(evento)
    this.dispatchEvent(evento)
  }
}

/** Sustituye `window.matchMedia` por la simulación. */
export function instalarMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (consulta: string) => new ListaSimulada(consulta),
  })
}

/**
 * Fija el ancho simulado de la ventana y avisa con `change` a las consultas escuchadas cuyo
 * resultado cambia. Si ya hay algo renderizado, debe llamarse dentro de `act`.
 */
export function simularAncho(nuevoAncho: number) {
  ancho = nuevoAncho
  for (const lista of [...escuchadas]) lista.avisarSiCambio()
}

/** Vuelve al ancho por defecto sin avisar a nadie (tras desmontar lo renderizado). */
export function restablecerAncho() {
  ancho = ANCHO_POR_DEFECTO
  escuchadas.clear()
}
