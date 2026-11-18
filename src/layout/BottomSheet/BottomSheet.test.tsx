// Tests de la hoja inferior del teléfono.
//
// Durante un arrastre la hoja se aparta (baja fuera de la pantalla) para dejar a la vista el día
// donde se suelta, y al terminar cualquier arrastre (soltado o cancelado) se cierra llamando a
// `onClose`.
//
// Se monta dentro del `DragDropProvider` real y el arrastre se maneja con las acciones del gestor
// (ver `src/test/dnd.ts`). jsdom no aplica el CSS, así que se comprueba la clase `away`, que es la
// que desplaza la hoja con `translateY(100%)`.
import { DragDropProvider, useDraggable } from '@dnd-kit/react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CapturadorDelGestor, arrastrar, empezarArrastre, gestorActual, simularApisDeArrastre } from '../../test/dnd'
import { BottomSheet } from './BottomSheet'

simularApisDeArrastre()

function Origen() {
  const { ref } = useDraggable({ id: 'origen', type: 'catalog-job', data: { kind: 'catalog-job' } })
  return <div ref={ref}>Origen</div>
}

function renderHoja() {
  const onClose = vi.fn()
  render(
    <DragDropProvider>
      <CapturadorDelGestor />
      <Origen />
      <BottomSheet title="Jobs" onClose={onClose}>
        <p>Contenido de la hoja</p>
      </BottomSheet>
    </DragDropProvider>,
  )
  return { hoja: screen.getByRole('dialog', { name: 'Jobs' }), onClose }
}

describe('BottomSheet', () => {
  it('es un diálogo con el título indicado y muestra su contenido', () => {
    const { hoja } = renderHoja()

    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument()
    expect(hoja).toHaveTextContent('Contenido de la hoja')
  })

  it('el botón "Done" llama a onClose', () => {
    const { onClose } = renderHoja()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sin ningún arrastre en curso no se aparta ni se cierra', () => {
    const { hoja, onClose } = renderHoja()

    expect(hoja).not.toHaveClass(/away/)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('durante un arrastre se aparta, sigue montada y todavía no se cierra', async () => {
    const { hoja, onClose } = renderHoja()

    await empezarArrastre('origen')

    await waitFor(() => expect(hoja).toHaveClass(/away/))
    expect(screen.getByRole('dialog', { name: 'Jobs' })).toBe(hoja)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('al soltar llama a onClose una vez', async () => {
    const { onClose } = renderHoja()

    await arrastrar('origen', null)

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('al cancelar el arrastre también llama a onClose', async () => {
    const { hoja, onClose } = renderHoja()
    await empezarArrastre('origen')
    await waitFor(() => expect(hoja).toHaveClass(/away/))

    await act(async () => {
      gestorActual().actions.stop({ canceled: true })
    })

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
