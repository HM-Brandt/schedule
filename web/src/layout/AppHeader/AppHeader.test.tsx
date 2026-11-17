// Tests del encabezado de la aplicación con `msw/node`.
//
// El usuario sale de `GET /auth/me` (manejador de `web/src/mocks/handlers.ts`, que devuelve
// "Demo User"); para probar otros nombres o un error se sobrescribe ese manejador.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../api/queryClient'
import { HOME_URL, LOGIN_URL } from '../../auth/session'
import { createHandlers } from '../../mocks/handlers'
import { createSeed } from '../../mocks/seed'
import { useAuthStore } from '../../stores/authStore'
import { simularNavegacion } from '../../test/navegacion'
import { AppHeader } from './AppHeader'

const server = setupServer()

let client: QueryClient

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  server.resetHandlers(...createHandlers(createSeed(new Date(2026, 10, 3))))
  client = createQueryClient()
  // Sin reintentos, para que el error de carga del usuario se vea al momento.
  client.setDefaultOptions({ queries: { retry: false } })
})

afterEach(() => {
  client.clear()
  useAuthStore.setState({ token: null, refreshToken: null, isAuthenticated: false, user: null })
  localStorage.clear()
  vi.unstubAllGlobals()
})

afterAll(() => {
  server.close()
})

function renderHeader() {
  return render(
    <QueryClientProvider client={client}>
      <AppHeader />
    </QueryClientProvider>,
  )
}

/** Hace que `GET /auth/me` devuelva un usuario con el nombre indicado. */
function usuarioConNombre(fullName: string) {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({ email: 'x@hmbrandt.com', fullName, id: '9', roles: [] }),
    ),
  )
}

/**
 * Avatar: el primer elemento dentro del bloque que muestra el nombre. Testing Library compara
 * el texto con los espacios ya colapsados, así que el nombre se busca normalizado.
 */
async function avatarDe(fullName: string): Promise<HTMLElement> {
  const nombre = await screen.findByText(fullName.replace(/\s+/g, ' ').trim())
  const avatar = nombre.firstElementChild
  if (!(avatar instanceof HTMLElement)) throw new Error('No se encontró el avatar')
  return avatar
}

describe('AppHeader', () => {
  describe('marca', () => {
    it('muestra el logo "HM Brandt Demolition" enlazado a HOME_URL', () => {
      renderHeader()

      const logo = screen.getByRole('img', { name: 'HM Brandt Demolition' })
      const enlace = screen.getByRole('link', { name: 'HM Brandt Demolition' })
      expect(enlace).toHaveAttribute('href', HOME_URL)
      expect(enlace).toContainElement(logo)
      expect(logo.getAttribute('src')).toBeTruthy()
    })

    it('el encabezado principal se llama exactamente "Weekly schedule" y no contiene el logo', () => {
      renderHeader()

      const titulo = screen.getByRole('heading', { level: 1 })
      expect(titulo).toHaveAccessibleName('Weekly schedule')
      expect(within(titulo).queryByRole('img')).not.toBeInTheDocument()
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    })
  })

  describe('enlace Home', () => {
    it('tiene la etiqueta "Home" y apunta a HOME_URL', () => {
      renderHeader()

      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', HOME_URL)
    })
  })

  describe('usuario', () => {
    it('con el usuario de /auth/me muestra su nombre "Demo User" y las iniciales "DU"', async () => {
      renderHeader()

      const avatar = await avatarDe('Demo User')
      expect(avatar).toHaveTextContent(/^DU$/)
      expect(avatar.parentElement).toHaveTextContent(/^DUDemo User$/)
    })

    it('guarda el usuario en el store', async () => {
      renderHeader()

      await waitFor(() => expect(useAuthStore.getState().user?.fullName).toBe('Demo User'))
    })

    it.each([
      ['un nombre de tres palabras', 'ana maría lópez', 'AM'],
      ['un solo nombre', 'Carlos', 'C'],
      ['minúsculas', 'luis martínez', 'LM'],
    ])('con %s ("%s") las iniciales son "%s"', async (_descripcion, nombre, iniciales) => {
      usuarioConNombre(nombre)
      renderHeader()

      const avatar = await avatarDe(nombre)
      expect(avatar.textContent).toBe(iniciales)
    })

    it('con espacios de más entre palabras toma igualmente la inicial de las dos primeras ("Ana  López" -> "AL")', async () => {
      usuarioConNombre('Ana  López')
      renderHeader()

      const avatar = await avatarDe('Ana  López')
      expect(avatar.textContent).toBe('AL')
    })

    it('mientras no hay usuario no muestra nombre ni avatar', () => {
      server.use(http.get('*/auth/me', () => new Promise<Response>(() => {})))
      renderHeader()

      expect(screen.queryByText('Demo User')).not.toBeInTheDocument()
      expect(screen.queryByText('DU')).not.toBeInTheDocument()
    })

    it('si /auth/me falla no muestra nombre ni avatar, y sí el resto del encabezado', async () => {
      server.use(http.get('*/auth/me', () => HttpResponse.json({ error: 'Fallo' }, { status: 500 })))
      renderHeader()

      await waitFor(() => expect(client.getQueryState(['me'])?.status).toBe('error'))
      expect(screen.queryByText('Demo User')).not.toBeInTheDocument()
      expect(screen.queryByText('DU')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Weekly schedule' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
    })
  })

  describe('Logout', () => {
    it('es un botón con la etiqueta y el título "Logout"', () => {
      renderHeader()

      const boton = screen.getByRole('button', { name: 'Logout' })
      expect(boton).toHaveAttribute('type', 'button')
      expect(boton).toHaveAttribute('title', 'Logout')
    })

    it('al pulsarlo cierra la sesión y navega a LOGIN_URL', async () => {
      const assign = simularNavegacion()
      useAuthStore.getState().login('t-1', 'r-1')
      renderHeader()
      await avatarDe('Demo User')

      fireEvent.click(screen.getByRole('button', { name: 'Logout' }))

      expect(assign).toHaveBeenCalledTimes(1)
      expect(assign).toHaveBeenCalledWith(LOGIN_URL)
      expect(useAuthStore.getState()).toMatchObject({
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        user: null,
      })
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
      // Sin usuario en el store, el encabezado deja de mostrar su nombre.
      await waitFor(() => expect(screen.queryByText('Demo User')).not.toBeInTheDocument())
    })
  })
})
