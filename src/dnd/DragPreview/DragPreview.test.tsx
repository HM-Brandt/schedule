// Tests de la vista previa del arrastre (`DragPreview`) y de su uso en `ScheduleDndProvider`
// con `msw/node`.
//
// La vista previa acompaña al puntero mientras se arrastra un trabajo del catálogo o un empleado
// del panel, para que se vea qué se arrastra aunque el cajón o la hoja inferior se aparten:
// - un trabajo del catálogo (`catalog-job`) muestra una pastilla con su número y su nombre;
// - un empleado del panel (`employee` sin `fromScheduleId`) muestra sus iniciales y su nombre
//   completo, buscándolo entre los empleados que sirve el servidor.
// El proveedor no muestra vista previa para el resto de arrastres (por ejemplo, el chip de un
// empleado dentro de una tarjeta), que se mueven por sí mismos.
//
// La semilla tiene a Ana López con el id 3.
import { useDraggable } from '@dnd-kit/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { setupServer } from 'msw/node'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createQueryClient } from '../../api/queryClient'
import { employeeHue, jobHue } from '../../lib/colors'
import { createHandlers } from '../../mocks/handlers'
import { createSeed } from '../../mocks/seed'
import { CapturadorDelGestor, empezarArrastre, simularApisDeArrastre, soltarSobre } from '../../test/dnd'
import { trabajo } from '../../test/fabricas'
import { UndoProvider } from '../../undo/UndoProvider'
import { ScheduleDndProvider } from '../ScheduleDndProvider'
import { DragPreview } from './DragPreview'

simularApisDeArrastre()

const PINTAR = trabajo(7, 'J-1024', 'Pintar oficina')

const server = setupServer()

let client: QueryClient

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  server.resetHandlers(...createHandlers(createSeed(new Date(2026, 10, 3))))
  client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
})

afterEach(() => {
  client.clear()
})

afterAll(() => {
  server.close()
})

function conConsultas(children: ReactNode) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/** Espera a que lleguen los empleados del servidor. */
async function esperarEmpleados() {
  await waitFor(() => expect(client.getQueryData(['employees'])).toBeDefined())
}

describe('DragPreview', () => {
  it('trabajo del catálogo: pastilla con el número y el nombre, con el tono del trabajo', () => {
    const { container } = render(conConsultas(<DragPreview source={{ data: { kind: 'catalog-job', job: PINTAR } }} />))

    const pastilla = container.firstElementChild as HTMLElement
    expect(within(pastilla).getByText('J-1024')).toBeInTheDocument()
    expect(within(pastilla).getByText('Pintar oficina')).toBeInTheDocument()
    expect(pastilla).toHaveAttribute('data-hue', String(jobHue(7)))
  })

  it('empleado del panel: pastilla con las iniciales "AL" y el nombre completo "Ana López", con el tono del empleado', async () => {
    const { container } = render(conConsultas(<DragPreview source={{ data: { kind: 'employee', employeeId: 3 } }} />))

    expect(await screen.findByText('Ana López')).toBeInTheDocument()
    const pastilla = container.firstElementChild as HTMLElement
    expect(within(pastilla).getByText('AL')).toBeInTheDocument()
    expect(pastilla).toHaveAttribute('data-hue', String(employeeHue(3)))
  })

  it('empleado mientras aún no llegaron los empleados: no muestra nada', () => {
    const { container } = render(conConsultas(<DragPreview source={{ data: { kind: 'employee', employeeId: 3 } }} />))

    expect(container).toBeEmptyDOMElement()
  })

  it('empleado que no está entre los del servidor: no muestra nada', async () => {
    const { container } = render(conConsultas(<DragPreview source={{ data: { kind: 'employee', employeeId: 999 } }} />))
    await esperarEmpleados()

    expect(container).toBeEmptyDOMElement()
  })
})

describe('ScheduleDndProvider: vista previa del arrastre', () => {
  function Arrastrable({ id, data }: { id: string; data: Record<string, unknown> }) {
    const { ref } = useDraggable({ id, type: data.kind as string, data })
    return <div ref={ref}>{`Origen ${id}`}</div>
  }

  /** Monta el proveedor con un trabajo del catálogo, un empleado del panel y el chip de un empleado en una tarjeta. */
  async function renderProveedor() {
    render(
      conConsultas(
        <UndoProvider>
          <ScheduleDndProvider schedules={[]}>
            <CapturadorDelGestor />
            <Arrastrable id="trabajo" data={{ kind: 'catalog-job', job: PINTAR }} />
            <Arrastrable id="empleado" data={{ kind: 'employee', employeeId: 3 }} />
            <Arrastrable id="chip" data={{ kind: 'employee', employeeId: 3, fromScheduleId: 1 }} />
          </ScheduleDndProvider>
        </UndoProvider>,
      ),
    )
    await esperarEmpleados()
  }

  const vistaPrevia = () => document.querySelector('[data-dnd-overlay]') as HTMLElement

  it('sin arrastre no muestra ninguna vista previa', async () => {
    await renderProveedor()

    expect(vistaPrevia()).toBeEmptyDOMElement()
  })

  it('al arrastrar un trabajo del catálogo muestra su número y su nombre, y al soltar desaparece', async () => {
    await renderProveedor()

    await empezarArrastre('trabajo')

    await waitFor(() => expect(within(vistaPrevia()).getByText('J-1024')).toBeInTheDocument())
    expect(within(vistaPrevia()).getByText('Pintar oficina')).toBeInTheDocument()

    await soltarSobre(null)

    await waitFor(() => expect(vistaPrevia()).toBeEmptyDOMElement())
  })

  it('al arrastrar un empleado del panel muestra sus iniciales y su nombre completo', async () => {
    await renderProveedor()

    await empezarArrastre('empleado')

    await waitFor(() => expect(within(vistaPrevia()).getByText('Ana López')).toBeInTheDocument())
    expect(within(vistaPrevia()).getByText('AL')).toBeInTheDocument()
  })

  it('al arrastrar el chip de un empleado de una tarjeta no muestra vista previa', async () => {
    await renderProveedor()

    await empezarArrastre('chip')

    expect(vistaPrevia()).toBeEmptyDOMElement()
  })
})
