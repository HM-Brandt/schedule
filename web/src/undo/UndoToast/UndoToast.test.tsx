// Tests del aviso de deshacer (tarea 8.3 de `schedule-assign`) con `msw/node`.
//
// Cubren el requisito "Deshacer" de `specs/weekly-schedule-board/spec.md` ("tras cada acción
// SHALL mostrarse un aviso breve con la opción Undo") y "Respuesta inmediata y error al guardar"
// (el mensaje de error se muestra hasta que la persona lo cierra).
//
// Se monta `UndoToast` dentro de `UndoProvider` con dos botones de prueba: uno apila una acción
// cuya inversa es `DELETE /v1/schedules/4` y otro muestra un error.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../api/queryClient'
import { createHandlers } from '../../mocks/handlers'
import { createSeed } from '../../mocks/seed'
import { UndoProvider, useUndo } from '../UndoProvider'
import { UndoToast } from './UndoToast'

const MENSAJE_ERROR = "Couldn't save the change. Fallo simulado del servidor"

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
    http.delete('/v1/schedules/:id', ({ request }) => {
      peticiones.push({ metodo: request.method, ruta: new URL(request.url).pathname })
      return undefined
    }),
    ...createHandlers(createSeed(new Date(2026, 10, 3))),
  )
})

afterEach(() => {
  vi.useRealTimers()
  client.clear()
})

afterAll(() => {
  server.close()
})

function Arnes() {
  const { push, showError, stack } = useUndo()
  return (
    <>
      <button type="button" onClick={() => push({ label: 'Job moved', ops: [{ kind: 'delete', id: 4 }] })}>
        Mover
      </button>
      <button type="button" onClick={() => push({ label: 'Job removed', ops: [{ kind: 'delete', id: 4 }] })}>
        Quitar
      </button>
      <button type="button" onClick={() => showError(MENSAJE_ERROR)}>
        Fallar
      </button>
      <output aria-label="Entradas">{stack.length}</output>
      <UndoToast />
    </>
  )
}

function renderAviso() {
  render(
    <QueryClientProvider client={client}>
      <UndoProvider>
        <Arnes />
      </UndoProvider>
    </QueryClientProvider>,
  )
}

const pulsar = (nombre: string) => fireEvent.click(screen.getByRole('button', { name: nombre }))

/** El aviso de acción (`role="status"`) que contiene `texto`, o `undefined` si no está. */
const avisoDeAccion = (texto: string) =>
  screen.queryAllByRole('status').find((aviso) => aviso.textContent?.includes(texto))

const entradas = () => screen.getByRole('status', { name: 'Entradas' })

describe('UndoToast', () => {
  it('sin acciones no muestra ningún aviso', () => {
    renderAviso()

    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  describe('aviso de acción', () => {
    it('tras una acción muestra su texto con el botón "Undo"', () => {
      renderAviso()

      pulsar('Mover')

      const aviso = avisoDeAccion('Job moved')
      expect(aviso).toBeInTheDocument()
      expect(aviso).toContainElement(screen.getByRole('button', { name: 'Undo' }))
    })

    it('se oculta solo a los 5 s', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderAviso()
      pulsar('Mover')

      act(() => {
        vi.advanceTimersByTime(4999)
      })
      expect(avisoDeAccion('Job moved')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(avisoDeAccion('Job moved')).toBeUndefined()
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
      // Ocultar el aviso no vacía la pila: se puede seguir deshaciendo con el atajo.
      expect(entradas()).toHaveTextContent('1')
    })

    it('una acción nueva sustituye el aviso y vuelve a contar 5 s', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderAviso()
      pulsar('Mover')
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      pulsar('Quitar')

      expect(avisoDeAccion('Job moved')).toBeUndefined()
      expect(avisoDeAccion('Job removed')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(4999)
      })
      expect(avisoDeAccion('Job removed')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(avisoDeAccion('Job removed')).toBeUndefined()
    })

    it('"Undo" ejecuta la inversa de la última acción y cierra el aviso', async () => {
      renderAviso()
      pulsar('Mover')
      expect(entradas()).toHaveTextContent('1')

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

      expect(avisoDeAccion('Job moved')).toBeUndefined()
      await waitFor(() => expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v1/schedules/4' }]))
      expect(entradas()).toHaveTextContent('0')
    })
  })

  describe('aviso de error', () => {
    it('muestra el mensaje con el botón "Dismiss" y sin "Undo"', () => {
      renderAviso()

      pulsar('Fallar')

      const aviso = screen.getByRole('alert')
      expect(aviso).toHaveTextContent(MENSAJE_ERROR)
      expect(aviso).toContainElement(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
    })

    it('no se oculta solo', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderAviso()
      pulsar('Fallar')

      act(() => {
        vi.advanceTimersByTime(60_000)
      })

      expect(screen.getByRole('alert')).toHaveTextContent(MENSAJE_ERROR)
    })

    it('"Dismiss" lo cierra', () => {
      renderAviso()
      pulsar('Fallar')

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('sustituye al aviso de una acción anterior, que ya no lo cierra a los 5 s', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderAviso()
      pulsar('Mover')
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      pulsar('Fallar')
      act(() => {
        vi.advanceTimersByTime(10_000)
      })

      expect(avisoDeAccion('Job moved')).toBeUndefined()
      expect(screen.getByRole('alert')).toHaveTextContent(MENSAJE_ERROR)
    })
  })
})
