// Tests de `useAcceptsDrag` (tarea 6.5 de `schedule-assign`).
//
// Cubren los resaltados de destino válido de la decisión 5 de `design.md`: un destino solo
// se resalta mientras hay un arrastre en curso cuyo tipo acepta (`ACCEPTS`).
//
// Se usa el `DragDropProvider` real de @dnd-kit/react con un origen arrastrable de cada tipo,
// y el arrastre se maneja con las acciones del gestor (ver `src/test/dnd.tsx`).
import { DragDropProvider, useDraggable } from '@dnd-kit/react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CapturadorDelGestor, empezarArrastre, gestorActual, simularApisDeArrastre } from '../test/dnd'
import type { DragData, DropData } from './dropResolution'
import { useAcceptsDrag } from './useAcceptsDrag'

simularApisDeArrastre()

const DESTINOS: DropData['kind'][] = ['day', 'schedule-card', 'catalog']
const ORIGENES: DragData['kind'][] = ['catalog-job', 'schedule-card', 'employee']

function Origen({ tipo }: { tipo: DragData['kind'] }) {
  const { ref } = useDraggable({ id: `origen-${tipo}`, type: tipo })
  return <div ref={ref}>{tipo}</div>
}

/** Muestra lo que devuelve `useAcceptsDrag(destino)` como texto "true" o "false". */
function Sonda({ destino }: { destino: DropData['kind'] }) {
  const acepta = useAcceptsDrag(destino)
  return <output data-testid={`acepta-${destino}`}>{String(acepta)}</output>
}

function renderSondas() {
  render(
    <DragDropProvider>
      <CapturadorDelGestor />
      {ORIGENES.map((tipo) => (
        <Origen key={tipo} tipo={tipo} />
      ))}
      {DESTINOS.map((destino) => (
        <Sonda key={destino} destino={destino} />
      ))}
    </DragDropProvider>,
  )
}

/** Valor de la sonda de `destino`: true si se resaltaría. */
const acepta = (destino: DropData['kind']) => screen.getByTestId(`acepta-${destino}`).textContent === 'true'

function valores() {
  return Object.fromEntries(DESTINOS.map((destino) => [destino, acepta(destino)]))
}

describe('useAcceptsDrag', () => {
  it('sin ningún arrastre en curso devuelve false para todos los destinos', () => {
    renderSondas()

    expect(valores()).toEqual({ day: false, 'schedule-card': false, catalog: false })
  })

  it('arrastrando un trabajo del catálogo: solo el día lo acepta, el catálogo no', async () => {
    renderSondas()

    await empezarArrastre('origen-catalog-job')

    await waitFor(() => expect(acepta('day')).toBe(true))
    expect(valores()).toEqual({ day: true, 'schedule-card': false, catalog: false })
  })

  it('arrastrando una tarjeta: la aceptan el día y el catálogo, pero no otra tarjeta', async () => {
    renderSondas()

    await empezarArrastre('origen-schedule-card')

    await waitFor(() => expect(acepta('day')).toBe(true))
    expect(valores()).toEqual({ day: true, 'schedule-card': false, catalog: true })
  })

  it('arrastrando un empleado: solo la tarjeta lo acepta; ni el día ni el catálogo', async () => {
    renderSondas()

    await empezarArrastre('origen-employee')

    await waitFor(() => expect(acepta('schedule-card')).toBe(true))
    expect(valores()).toEqual({ day: false, 'schedule-card': true, catalog: false })
  })

  it('al terminar el arrastre vuelve a false', async () => {
    renderSondas()
    await empezarArrastre('origen-schedule-card')
    await waitFor(() => expect(acepta('catalog')).toBe(true))

    await act(async () => {
      gestorActual().actions.stop({ canceled: true })
    })

    await waitFor(() => expect(valores()).toEqual({ day: false, 'schedule-card': false, catalog: false }))
  })
})
