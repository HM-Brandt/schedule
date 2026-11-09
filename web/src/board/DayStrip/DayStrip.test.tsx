// Tests de la tira de días del teléfono (tarea 9.3 de `schedule-assign`).
//
// Cubren el requisito "Tira de días en teléfono" de `specs/weekly-schedule-board/spec.md`: la
// tira muestra los siete días con cuántas programaciones tiene cada uno, tocar un día lo
// selecciona y cada día acepta que se suelte una programación para moverla a ese día.
//
// Se monta dentro del `DragDropProvider` real y el arrastre se maneja con las acciones del
// gestor (ver `src/test/dnd.ts`). Los destinos son `strip-{fecha}`.
import { DragDropProvider, useDraggable } from '@dnd-kit/react'
import type { DragEndEvent } from '@dnd-kit/react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { IsoDate } from '../../api/types'
import { CapturadorDelGestor, arrastrar, empezarArrastre, simularApisDeArrastre } from '../../test/dnd'
import { DayStrip } from './DayStrip'

simularApisDeArrastre()

const DIAS: IsoDate[] = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
const NOMBRES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Programaciones por día de la semilla: dos el lunes, una el martes y una el jueves. */
const CONTADORES: Record<IsoDate, number> = {
  '2026-11-01': 0,
  '2026-11-02': 2,
  '2026-11-03': 1,
  '2026-11-04': 0,
  '2026-11-05': 1,
  '2026-11-06': 0,
  '2026-11-07': 0,
}

/** Origen arrastrable con los datos de una tarjeta de programación. */
function TarjetaArrastrable() {
  const { ref } = useDraggable({
    id: 'schedule-1',
    type: 'schedule-card',
    data: { kind: 'schedule-card', schedule: { id: 1 } },
  })
  return <div ref={ref}>Tarjeta</div>
}

function renderTira({
  selected = '2026-11-03',
  onSelect = vi.fn(),
  onDragEnd,
}: { selected?: IsoDate; onSelect?: (fecha: IsoDate) => void; onDragEnd?: (evento: DragEndEvent) => void } = {}) {
  render(
    <DragDropProvider onDragEnd={onDragEnd}>
      <CapturadorDelGestor />
      <TarjetaArrastrable />
      <DayStrip days={DIAS} today="2026-11-03" selected={selected} counts={CONTADORES} onSelect={onSelect} />
    </DragDropProvider>,
  )
  return { onSelect }
}

/** Botón del día con nombre abreviado `nombre` ("Thu"). */
const diaDeLaTira = (nombre: string) => screen.getByText(nombre, { exact: true }).closest('button') as HTMLElement

/**
 * Botones de los días de la tira: `<button>` con `aria-pressed`. @dnd-kit también da rol de botón
 * y `aria-pressed` a los orígenes arrastrables.
 */
const diasDeLaTira = () =>
  screen.getAllByRole('button').filter((boton) => boton.tagName === 'BUTTON' && boton.hasAttribute('aria-pressed'))

describe('DayStrip', () => {
  it('muestra los siete días en orden, de "Sun 1" a "Sat 7"', () => {
    renderTira()

    const botones = diasDeLaTira()
    expect(botones).toHaveLength(7)
    botones.forEach((boton, indice) => {
      const [nombre, numero] = Array.from(boton.children).map((hijo) => hijo.textContent)
      expect(`${nombre} ${numero}`).toBe(`${NOMBRES[indice]} ${indice + 1}`)
    })
  })

  it('cada día indica cuántas programaciones tiene: "2 jobs" el lunes, "1 job" el martes y el jueves', () => {
    renderTira()

    expect(within(diaDeLaTira('Mon')).getByLabelText('2 jobs')).toHaveTextContent('2')
    expect(within(diaDeLaTira('Tue')).getByLabelText('1 job')).toHaveTextContent('1')
    expect(within(diaDeLaTira('Thu')).getByLabelText('1 job')).toHaveTextContent('1')
  })

  it('los días sin programaciones muestran el contador a cero, "0 jobs"', () => {
    renderTira()

    for (const nombre of ['Sun', 'Wed', 'Fri', 'Sat']) {
      expect(within(diaDeLaTira(nombre)).getByLabelText('0 jobs')).toHaveTextContent('0')
    }
  })

  it('marca con aria-pressed solo el día seleccionado', () => {
    renderTira({ selected: '2026-11-05' })

    const pulsados = diasDeLaTira().filter((boton) => boton.getAttribute('aria-pressed') === 'true')
    expect(pulsados).toEqual([diaDeLaTira('Thu')])
    expect(diaDeLaTira('Tue')).toHaveAttribute('aria-pressed', 'false')
  })

  it('escenario "Cambiar de día": tocar el jueves llama a onSelect con "2026-11-05"', () => {
    const { onSelect } = renderTira()

    fireEvent.click(diaDeLaTira('Thu'))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('2026-11-05')
  })

  it('tocar el día ya seleccionado vuelve a llamar a onSelect con ese día', () => {
    const { onSelect } = renderTira({ selected: '2026-11-03' })

    fireEvent.click(diaDeLaTira('Tue'))

    expect(onSelect).toHaveBeenCalledWith('2026-11-03')
  })

  it('mientras se arrastra una tarjeta los siete días se resaltan como destino válido', async () => {
    renderTira()
    for (const nombre of NOMBRES) expect(diaDeLaTira(nombre)).not.toHaveClass(/accepting/)

    await empezarArrastre('schedule-1')

    await waitFor(() => {
      for (const nombre of NOMBRES) expect(diaDeLaTira(nombre)).toHaveClass(/accepting/)
    })
  })

  it('escenario "Mover soltando sobre la tira": soltar una tarjeta sobre el miércoles deja como destino el día "2026-11-04"', async () => {
    const onDragEnd = vi.fn<(evento: DragEndEvent) => void>()
    renderTira({ onDragEnd })

    await arrastrar('schedule-1', 'strip-2026-11-04')

    expect(onDragEnd).toHaveBeenCalledTimes(1)
    const [evento] = onDragEnd.mock.calls[0]
    expect(evento.canceled).toBe(false)
    expect(evento.operation.target?.data).toEqual({ kind: 'day', date: '2026-11-04' })
  })
})
