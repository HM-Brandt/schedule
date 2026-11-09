// Tests del catálogo de trabajos (tareas 5.3 y 9.6 de `schedule-assign`) con `msw/node`.
//
// Cubren "Catálogo de trabajos" e "Indicador de trabajo en uso" de
// `specs/weekly-schedule-board/spec.md`. La semilla tiene 30 trabajos, de "J-1018" a
// "J-1047"; los que contienen "pintar" son J-1024 y J-1039.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createQueryClient } from '../../api/queryClient'
import { jobHue } from '../../lib/colors'
import { createHandlers } from '../../mocks/handlers'
import { createSeed } from '../../mocks/seed'
import { JobCatalog } from './JobCatalog'

const MENSAJE_500 = 'Fallo simulado del servidor'

const server = setupServer()

let client: QueryClient

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  server.resetHandlers(...createHandlers(createSeed(new Date(2026, 10, 3))))
  client = createQueryClient()
  // Sin reintentos, para que el error de carga se vea al momento.
  client.setDefaultOptions({ queries: { retry: false } })
})

afterEach(() => {
  client.clear()
})

afterAll(() => {
  server.close()
})

function renderCatalogo(counts = new Map<number, number>()) {
  return render(
    <QueryClientProvider client={client}>
      <JobCatalog counts={counts} />
    </QueryClientProvider>,
  )
}

const elementos = () => within(screen.getByRole('list')).queryAllByRole('listitem')

const numeros = () => elementos().map((elemento) => within(elemento).getByText(/^J-\d+$/).textContent)

const buscador = () => screen.getByRole('searchbox', { name: 'Search jobs' })

function buscar(texto: string) {
  fireEvent.change(buscador(), { target: { value: texto } })
}

/** Elemento del catálogo cuyo número es `numero`. */
function trabajo(numero: string): HTMLElement {
  return within(screen.getByRole('list')).getByText(numero).closest('li') as HTMLElement
}

describe('JobCatalog', () => {
  it('muestra el título "Jobs" y la búsqueda con etiqueta y texto de ayuda "Search jobs"', () => {
    renderCatalogo()

    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument()
    expect(buscador()).toHaveAttribute('placeholder', 'Search jobs')
    expect(buscador()).toHaveValue('')
  })

  it('lista los 30 trabajos con su número y su nombre', async () => {
    renderCatalogo()

    await waitFor(() => expect(elementos()).toHaveLength(30))
    expect(trabajo('J-1018')).toHaveTextContent('Revisar tejado')
    expect(trabajo('J-1024')).toHaveTextContent('Pintar oficina')
    expect(trabajo('J-1047')).toHaveTextContent('Revisar ascensor')
  })

  describe('búsqueda', () => {
    it('al escribir "1024" deja solo los trabajos cuyo número o nombre lo contiene', async () => {
      renderCatalogo()
      await waitFor(() => expect(elementos()).toHaveLength(30))

      buscar('1024')

      await waitFor(() => expect(numeros()).toEqual(['J-1024']))
      expect(trabajo('J-1024')).toHaveTextContent('Pintar oficina')
    })

    it('busca también por nombre sin distinguir mayúsculas: "PINTAR"', async () => {
      renderCatalogo()
      await waitFor(() => expect(elementos()).toHaveLength(30))

      buscar('PINTAR')

      await waitFor(() => expect(numeros()).toEqual(['J-1024', 'J-1039']))
    })

    it('al vaciar la búsqueda vuelven todos los trabajos', async () => {
      renderCatalogo()
      buscar('1024')
      await waitFor(() => expect(elementos()).toHaveLength(1))

      buscar('')

      await waitFor(() => expect(elementos()).toHaveLength(30))
    })

    it('una búsqueda solo con espacios muestra todos los trabajos', async () => {
      renderCatalogo()

      buscar('   ')

      await waitFor(() => expect(elementos()).toHaveLength(30))
      expect(screen.queryByText('No jobs found')).not.toBeInTheDocument()
    })

    it('sin resultados muestra "No jobs found" y ningún trabajo', async () => {
      renderCatalogo()
      await waitFor(() => expect(elementos()).toHaveLength(30))

      buscar('zzz')

      expect(await screen.findByText('No jobs found')).toBeInTheDocument()
      expect(elementos()).toHaveLength(0)
    })

    it('con resultados no muestra "No jobs found"', async () => {
      renderCatalogo()

      await waitFor(() => expect(elementos()).toHaveLength(30))
      expect(screen.queryByText('No jobs found')).not.toBeInTheDocument()
    })
  })

  describe('indicador de trabajo en uso', () => {
    it('un trabajo programado dos veces en la semana aparece atenuado con "x2"', async () => {
      // J-1024 tiene id 7 en la semilla.
      renderCatalogo(new Map([[7, 2]]))

      await waitFor(() => expect(elementos()).toHaveLength(30))
      expect(trabajo('J-1024')).toHaveAttribute('data-in-use', 'true')
      expect(within(trabajo('J-1024')).getByText('x2')).toBeInTheDocument()
    })

    it('un trabajo sin programaciones en la semana tiene su tono normal y ningún contador', async () => {
      renderCatalogo(new Map([[7, 2]]))

      await waitFor(() => expect(elementos()).toHaveLength(30))
      expect(trabajo('J-1018')).not.toHaveAttribute('data-in-use')
      expect(within(trabajo('J-1018')).queryByText(/^x\d+$/)).not.toBeInTheDocument()
    })

    it('un contador de 0 equivale a no estar en uso', async () => {
      renderCatalogo(new Map([[7, 0]]))

      await waitFor(() => expect(elementos()).toHaveLength(30))
      expect(trabajo('J-1024')).not.toHaveAttribute('data-in-use')
      expect(within(trabajo('J-1024')).queryByText(/^x\d+$/)).not.toBeInTheDocument()
    })

    it('solo los trabajos con contador aparecen en uso', async () => {
      renderCatalogo(new Map([[7, 2], [2, 1], [12, 1]]))

      await waitFor(() => expect(elementos()).toHaveLength(30))
      const enUso = elementos().filter((elemento) => elemento.getAttribute('data-in-use') === 'true')
      expect(enUso.map((elemento) => within(elemento).getByText(/^J-\d+$/).textContent)).toEqual([
        'J-1019',
        'J-1024',
        'J-1029',
      ])
    })

    it('un trabajo programado sigue en el catálogo y en la búsqueda', async () => {
      renderCatalogo(new Map([[7, 2]]))
      await waitFor(() => expect(elementos()).toHaveLength(30))

      buscar('1024')

      await waitFor(() => expect(numeros()).toEqual(['J-1024']))
      expect(trabajo('J-1024')).toHaveAttribute('data-in-use', 'true')
      expect(within(trabajo('J-1024')).getByText('x2')).toBeInTheDocument()
    })

    it('al cambiar los contadores se actualiza el indicador', async () => {
      const { rerender } = renderCatalogo(new Map([[7, 2]]))
      await waitFor(() => expect(elementos()).toHaveLength(30))

      rerender(
        <QueryClientProvider client={client}>
          <JobCatalog counts={new Map()} />
        </QueryClientProvider>,
      )

      expect(trabajo('J-1024')).not.toHaveAttribute('data-in-use')
      expect(within(trabajo('J-1024')).queryByText(/^x\d+$/)).not.toBeInTheDocument()
    })
  })

  // Tarea 9.6: cada trabajo del catálogo lleva el tono de su trabajo, el mismo que su tarjeta.
  describe('tonos', () => {
    it('cada trabajo lleva el tono de su id: J-1024 (id 7) y J-1018 (id 1)', async () => {
      renderCatalogo()

      await waitFor(() => expect(elementos()).toHaveLength(30))
      expect(trabajo('J-1024')).toHaveAttribute('data-hue', String(jobHue(7)))
      expect(trabajo('J-1018')).toHaveAttribute('data-hue', String(jobHue(1)))
    })

    it('todos los trabajos llevan un tono de 1 a 8 y los 30 usan los 8 tonos', async () => {
      renderCatalogo()

      await waitFor(() => expect(elementos()).toHaveLength(30))
      const tonos = elementos().map((elemento) => elemento.getAttribute('data-hue'))
      expect(new Set(tonos)).toEqual(new Set(['1', '2', '3', '4', '5', '6', '7', '8']))
    })

    it('un trabajo en uso conserva su tono', async () => {
      renderCatalogo(new Map([[7, 2]]))

      await waitFor(() => expect(elementos()).toHaveLength(30))
      expect(trabajo('J-1024')).toHaveAttribute('data-in-use', 'true')
      expect(trabajo('J-1024')).toHaveAttribute('data-hue', String(jobHue(7)))
    })
  })

  it('con un 500 en GET /api/jobs muestra el aviso "Couldn\'t load jobs." con el detalle', async () => {
    server.use(http.get('/api/jobs', () => HttpResponse.json({ error: MENSAJE_500 }, { status: 500 })))
    renderCatalogo()

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent(`Couldn't load jobs. ${MENSAJE_500}`)
    expect(elementos()).toHaveLength(0)
    expect(screen.queryByText('No jobs found')).not.toBeInTheDocument()
  })

  it('con un 200 en HTML en GET /api/jobs (Vite sin backend) muestra el aviso de carga y no se rompe', async () => {
    server.use(
      http.get('/api/jobs', () =>
        HttpResponse.html('<!doctype html><html><body><div id="root"></div></body></html>'),
      ),
    )
    renderCatalogo()

    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent("Couldn't load jobs. Unexpected response from the server")
    expect(elementos()).toHaveLength(0)
    expect(screen.queryByText('No jobs found')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument()
  })
})
