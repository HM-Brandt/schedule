// Tests del cajón lateral de la tablet (tarea 9.2 de `schedule-assign`).
//
// Cubren la decisión 8 de `design.md`: entre 640 y 1023 px el catálogo y los empleados van en
// cajones laterales que se apartan durante el arrastre, para dejar a la vista el tablero.
//
// Se monta dentro del `DragDropProvider` real y el arrastre se maneja con las acciones del
// gestor (ver `src/test/dnd.ts`). jsdom no aplica el CSS, así que se comprueba la clase `away`,
// que es la que desplaza el cajón con `translateX(±100%)`.
import { DragDropProvider, useDraggable } from '@dnd-kit/react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CapturadorDelGestor, arrastrar, empezarArrastre, gestorActual, simularApisDeArrastre } from '../../test/dnd'
import { Drawer } from './Drawer'

simularApisDeArrastre()

function Origen() {
  const { ref } = useDraggable({ id: 'origen', type: 'catalog-job', data: { kind: 'catalog-job' } })
  return <div ref={ref}>Origen</div>
}

function renderCajon(side: 'left' | 'right' = 'left') {
  const onClose = vi.fn()
  render(
    <DragDropProvider>
      <CapturadorDelGestor />
      <Origen />
      <Drawer side={side} label="Jobs" onClose={onClose}>
        <p>Contenido del cajón</p>
      </Drawer>
    </DragDropProvider>,
  )
  return { cajon: screen.getByRole('dialog', { name: 'Jobs' }), onClose }
}

describe('Drawer', () => {
  it('es un diálogo con la etiqueta indicada y muestra su contenido', () => {
    const { cajon } = renderCajon()

    expect(cajon).toHaveTextContent('Contenido del cajón')
  })

  it('el botón "Close" llama a onClose', () => {
    const { onClose } = renderCajon()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('el cajón izquierdo lleva la clase del lado izquierdo', () => {
    const { cajon } = renderCajon('left')
    expect(cajon).toHaveClass(/left/)
    expect(cajon).not.toHaveClass(/right/)
  })

  it('el cajón derecho lleva la clase del lado derecho', () => {
    const { cajon } = renderCajon('right')
    expect(cajon).toHaveClass(/right/)
    expect(cajon).not.toHaveClass(/left/)
  })

  it('sin ningún arrastre en curso no se aparta', () => {
    const { cajon } = renderCajon()

    expect(cajon).not.toHaveClass(/away/)
  })

  for (const side of ['left', 'right'] as const) {
    it(`cajón ${side === 'left' ? 'izquierdo' : 'derecho'}: durante un arrastre se aparta y sigue montado`, async () => {
      const { cajon } = renderCajon(side)

      await empezarArrastre('origen')

      await waitFor(() => expect(cajon).toHaveClass(/away/))
      expect(cajon).toHaveClass(new RegExp(side))
      expect(screen.getByRole('dialog', { name: 'Jobs' })).toBe(cajon)
    })
  }

  it('al soltar vuelve a su sitio', async () => {
    const { cajon } = renderCajon()

    await arrastrar('origen', null)

    await waitFor(() => expect(cajon).not.toHaveClass(/away/))
  })

  it('al cancelar el arrastre vuelve a su sitio', async () => {
    const { cajon } = renderCajon()
    await empezarArrastre('origen')
    await waitFor(() => expect(cajon).toHaveClass(/away/))

    await act(async () => {
      gestorActual().actions.stop({ canceled: true })
    })

    await waitFor(() => expect(cajon).not.toHaveClass(/away/))
  })
})
