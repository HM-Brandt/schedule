// Tests del atajo de deshacer (tarea 8.3 de `schedule-assign`) con `msw/node`.
//
// Cubren el requisito "Deshacer" de `specs/weekly-schedule-board/spec.md`: en escritorio
// funciona Ctrl+Z (Cmd+Z en macOS) en orden inverso a las acciones. El atajo no actúa con
// Shift (Ctrl+Shift+Z suele ser "rehacer") ni cuando el foco está en un campo de texto, una
// lista desplegable o un área de texto, para no robar el deshacer propio del campo.
//
// Se monta `useUndoShortcut` dentro de `UndoProvider` con un botón de prueba que apila una
// acción cuya inversa es `DELETE /v2/job-management/schedules/4`.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createQueryClient } from '../api/queryClient'
import { createHandlers } from '../mocks/handlers'
import { createSeed } from '../mocks/seed'
import { UndoProvider, useUndo } from './UndoProvider'
import { useUndoShortcut } from './useUndoShortcut'

type Peticion = { metodo: string; ruta: string }

const server = setupServer()

let client: QueryClient
let peticiones: Peticion[]

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  peticiones = []
  client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  server.resetHandlers(
    http.all('/v2/job-management/schedules/*', ({ request }) => {
      peticiones.push({ metodo: request.method, ruta: new URL(request.url).pathname })
      return undefined
    }),
    ...createHandlers(createSeed(new Date(2026, 10, 3))),
  )
})

afterEach(() => {
  client.clear()
})

afterAll(() => {
  server.close()
})

function Arnes() {
  useUndoShortcut()
  const { push, stack } = useUndo()
  return (
    <>
      <button
        type="button"
        onClick={() => push({ label: 'Job removed', ops: [{ kind: 'delete', id: stack.length === 0 ? 4 : 3 }] })}
      >
        Acción
      </button>
      <input aria-label="Campo" />
      <select aria-label="Lista">
        <option>Uno</option>
      </select>
      <textarea aria-label="Notas" />
      <output aria-label="Entradas">{stack.length}</output>
    </>
  )
}

function renderAtajo() {
  render(
    <QueryClientProvider client={client}>
      <UndoProvider>
        <Arnes />
      </UndoProvider>
    </QueryClientProvider>,
  )
}

const apilar = () => fireEvent.click(screen.getByRole('button', { name: 'Acción' }))

const entradas = () => screen.getByRole('status', { name: 'Entradas' })

/** Comprueba que no se deshizo nada: ninguna petición y la pila intacta. */
async function sinDeshacer(total = 1) {
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(peticiones).toEqual([])
  expect(entradas()).toHaveTextContent(String(total))
}

describe('useUndoShortcut', () => {
  it('Ctrl+Z deshace la última acción', async () => {
    renderAtajo()
    apilar()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    await waitFor(() => expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/schedules/4' }]))
    expect(entradas()).toHaveTextContent('0')
  })

  it('Cmd+Z (macOS) deshace la última acción', async () => {
    renderAtajo()
    apilar()

    fireEvent.keyDown(window, { key: 'z', metaKey: true })

    await waitFor(() => expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/schedules/4' }]))
    expect(entradas()).toHaveTextContent('0')
  })

  it('Ctrl+Z con Bloq Mayús ("Z") también deshace', async () => {
    renderAtajo()
    apilar()

    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true })

    await waitFor(() => expect(peticiones).toHaveLength(1))
  })

  it('pulsado dos veces deshace en orden inverso: primero la última acción', async () => {
    renderAtajo()
    apilar()
    apilar()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    await waitFor(() => expect(entradas()).toHaveTextContent('1'))
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    await waitFor(() =>
      expect(peticiones).toEqual([
        { metodo: 'DELETE', ruta: '/v2/job-management/schedules/3' },
        { metodo: 'DELETE', ruta: '/v2/job-management/schedules/4' },
      ]),
    )
    expect(entradas()).toHaveTextContent('0')
  })

  it('pulsado sobre un botón de la página también deshace', async () => {
    renderAtajo()
    apilar()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Acción' }), { key: 'z', ctrlKey: true })

    await waitFor(() => expect(peticiones).toHaveLength(1))
  })

  it('Ctrl+Shift+Z no deshace', async () => {
    renderAtajo()
    apilar()

    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true })
    fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })

    await sinDeshacer()
  })

  it('Z sin Ctrl ni Cmd no deshace', async () => {
    renderAtajo()
    apilar()

    fireEvent.keyDown(window, { key: 'z' })
    fireEvent.keyDown(window, { key: 'z', altKey: true })

    await sinDeshacer()
  })

  it('Ctrl con otra tecla no deshace', async () => {
    renderAtajo()
    apilar()

    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })

    await sinDeshacer()
  })

  it.each([
    ['un campo de texto', 'textbox', 'Campo'],
    ['una lista desplegable', 'combobox', 'Lista'],
    ['un área de texto', 'textbox', 'Notas'],
  ] as const)('con el foco en %s, Ctrl+Z no deshace', async (_caso, rol, nombre) => {
    renderAtajo()
    apilar()
    const campo = screen.getByRole(rol, { name: nombre })
    campo.focus()

    fireEvent.keyDown(campo, { key: 'z', ctrlKey: true })

    await sinDeshacer()
  })

  it('con la pila vacía no envía nada', async () => {
    renderAtajo()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    await sinDeshacer(0)
  })
})
