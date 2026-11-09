// Utilidades para probar arrastrar y soltar de @dnd-kit/react en jsdom.
//
// jsdom no calcula posiciones, así que el sensor de puntero no puede detectar sobre qué
// destino está el elemento. En su lugar, el arrastre se maneja con las acciones del gestor
// real (`manager.actions`): se empieza sobre un origen registrado, se fija el destino y se
// suelta con el evento nativo que se quiera (por ejemplo, con `altKey`).
import { useDragDropManager } from '@dnd-kit/react'
import type { DragDropManager } from '@dnd-kit/react'
import { act, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterAll, beforeAll, expect } from 'vitest'

let gestor: DragDropManager | null = null

/** Guarda el gestor del `DragDropProvider` que lo contiene para poder manejar el arrastre. */
export function CapturadorDelGestor() {
  const manager = useDragDropManager()
  useEffect(() => {
    gestor = manager
  }, [manager])
  return null
}

export function gestorActual(): DragDropManager {
  if (!gestor) throw new Error('No hay ningún DragDropProvider con <CapturadorDelGestor /> montado')
  return gestor
}

type Simulada = { objeto: object; nombre: string; valor: unknown }

/** APIs del navegador que @dnd-kit usa durante el arrastre y que jsdom no implementa. */
const SIMULADAS: Simulada[] = [
  // Desplazamiento automático: no hay ningún elemento bajo el puntero.
  { objeto: Document.prototype, nombre: 'elementFromPoint', valor: () => null },
  // Medición de la vista del elemento arrastrado: no hay animaciones en curso.
  { objeto: Document.prototype, nombre: 'getAnimations', valor: () => [] },
  { objeto: Element.prototype, nombre: 'getAnimations', valor: () => [] },
  // Se pide movimiento reducido para que @dnd-kit no anime la caída (jsdom no tiene `animate`).
  {
    objeto: window,
    nombre: 'matchMedia',
    valor: (query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }),
  },
  // Seguimiento del tamaño del elemento arrastrado y de la posición de los destinos: nunca cambian.
  {
    objeto: globalThis,
    nombre: 'ResizeObserver',
    valor: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  },
  {
    objeto: globalThis,
    nombre: 'IntersectionObserver',
    valor: class {
      root = null
      rootMargin = ''
      thresholds = []
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  },
]

/**
 * Simula en jsdom las APIs del navegador que @dnd-kit necesita al arrastrar. Solo añade
 * las que faltan y las retira al terminar el archivo de tests.
 */
export function simularApisDeArrastre() {
  const añadidas: Simulada[] = []
  beforeAll(() => {
    for (const simulada of SIMULADAS) {
      if (typeof (simulada.objeto as Record<string, unknown>)[simulada.nombre] === 'function') continue
      Object.defineProperty(simulada.objeto, simulada.nombre, { value: simulada.valor, configurable: true, writable: true })
      añadidas.push(simulada)
    }
  })
  afterAll(() => {
    for (const { objeto, nombre } of añadidas) delete (objeto as Record<string, unknown>)[nombre]
  })
}

/** Empieza a arrastrar el origen con id `origen`, cuando ya está registrado. */
export async function empezarArrastre(origen: string) {
  await waitFor(() => expect(gestorActual().registry.draggables.get(origen)).toBeDefined())
  await act(async () => {
    gestorActual().actions.start({ source: origen, coordinates: { x: 0, y: 0 } })
  })
  await waitFor(() => expect(gestorActual().dragOperation.status.dragging).toBe(true))
}

/**
 * Suelta lo que se está arrastrando sobre el destino con id `destino` (o fuera de cualquier
 * destino con `null`). `altKey` indica si Alt estaba pulsado al soltar; `cancelado`, si el
 * arrastre se canceló (por ejemplo, con Escape).
 */
export async function soltarSobre(
  destino: string | null,
  { altKey = false, cancelado = false }: { altKey?: boolean; cancelado?: boolean } = {},
) {
  if (destino !== null) {
    await waitFor(() => expect(gestorActual().registry.droppables.get(destino)).toBeDefined())
  }
  await act(async () => {
    await gestorActual().actions.setDropTarget(destino)
  })
  expect(gestorActual().dragOperation.target?.id ?? null).toBe(destino)
  await act(async () => {
    gestorActual().actions.stop({ event: new MouseEvent('pointerup', { altKey }), canceled: cancelado })
  })
  await waitFor(() => expect(gestorActual().dragOperation.status.idle).toBe(true))
}

/** Arrastra el origen `origen` y lo suelta sobre `destino`. */
export async function arrastrar(origen: string, destino: string | null, opciones?: { altKey?: boolean; cancelado?: boolean }) {
  await empezarArrastre(origen)
  await soltarSobre(destino, opciones)
}
