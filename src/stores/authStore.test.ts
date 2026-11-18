// Tests del store de autenticación (zustand).
//
// El store lee `auth_token` y `refresh_token` de localStorage al evaluarse el módulo. Para
// probar el estado inicial se prepara localStorage, se vacía la caché de módulos con
// `vi.resetModules()` y se vuelve a importar.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '../types'

const USUARIO: AuthUser = {
  email: 'ana@hmbrandt.com',
  fullName: 'Ana López',
  id: '7',
  roles: [{ id: 1, name: 'Admin' }],
}

/** Importa una copia nueva del store, que lee localStorage en ese momento. */
async function importarStore() {
  vi.resetModules()
  const { useAuthStore } = await import('./authStore')
  return useAuthStore
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('useAuthStore', () => {
  describe('estado inicial', () => {
    it('sin tokens en localStorage arranca sin sesión', async () => {
      const store = await importarStore()

      expect(store.getState()).toMatchObject({
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        user: null,
      })
    })

    it('toma auth_token y refresh_token de localStorage y queda autenticado', async () => {
      localStorage.setItem('auth_token', 'token-guardado')
      localStorage.setItem('refresh_token', 'refresh-guardado')

      const store = await importarStore()

      expect(store.getState()).toMatchObject({
        token: 'token-guardado',
        refreshToken: 'refresh-guardado',
        isAuthenticated: true,
        user: null,
      })
    })

    it('con solo refresh_token guardado no queda autenticado', async () => {
      localStorage.setItem('refresh_token', 'refresh-guardado')

      const store = await importarStore()

      expect(store.getState()).toMatchObject({
        token: null,
        refreshToken: 'refresh-guardado',
        isAuthenticated: false,
      })
    })
  })

  describe('login', () => {
    it('guarda los dos tokens en el estado y en localStorage', async () => {
      const store = await importarStore()

      store.getState().login('token-nuevo', 'refresh-nuevo')

      expect(store.getState()).toMatchObject({
        token: 'token-nuevo',
        refreshToken: 'refresh-nuevo',
        isAuthenticated: true,
      })
      expect(localStorage.getItem('auth_token')).toBe('token-nuevo')
      expect(localStorage.getItem('refresh_token')).toBe('refresh-nuevo')
    })

    it('sustituye los tokens anteriores', async () => {
      localStorage.setItem('auth_token', 'token-viejo')
      localStorage.setItem('refresh_token', 'refresh-viejo')
      const store = await importarStore()

      store.getState().login('token-nuevo', 'refresh-nuevo')

      expect(store.getState().token).toBe('token-nuevo')
      expect(localStorage.getItem('auth_token')).toBe('token-nuevo')
      expect(localStorage.getItem('refresh_token')).toBe('refresh-nuevo')
    })
  })

  describe('logout', () => {
    it('borra los tokens de localStorage y deja token, refreshToken y user en null', async () => {
      localStorage.setItem('auth_token', 'token-guardado')
      localStorage.setItem('refresh_token', 'refresh-guardado')
      localStorage.setItem('otra_clave', 'se conserva')
      const store = await importarStore()
      store.getState().setUser(USUARIO)

      store.getState().logout()

      expect(store.getState()).toMatchObject({
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        user: null,
      })
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
      expect(localStorage.getItem('otra_clave')).toBe('se conserva')
    })

    it('sin sesión no falla y deja el estado vacío', async () => {
      const store = await importarStore()

      store.getState().logout()

      expect(store.getState()).toMatchObject({ token: null, refreshToken: null, isAuthenticated: false, user: null })
    })
  })

  describe('setUser', () => {
    it('guarda el usuario y lo puede volver a poner en null', async () => {
      const store = await importarStore()

      store.getState().setUser(USUARIO)
      expect(store.getState().user).toEqual(USUARIO)

      store.getState().setUser(null)
      expect(store.getState().user).toBeNull()
    })

    it('no cambia los tokens', async () => {
      localStorage.setItem('auth_token', 'token-guardado')
      localStorage.setItem('refresh_token', 'refresh-guardado')
      const store = await importarStore()

      store.getState().setUser(USUARIO)

      expect(store.getState()).toMatchObject({
        token: 'token-guardado',
        refreshToken: 'refresh-guardado',
        isAuthenticated: true,
      })
    })
  })

  describe('clearAuth', () => {
    it('quita el usuario y deja isAuthenticated en false', async () => {
      localStorage.setItem('auth_token', 'token-guardado')
      const store = await importarStore()
      store.getState().setUser(USUARIO)

      store.getState().clearAuth()

      expect(store.getState().user).toBeNull()
      expect(store.getState().isAuthenticated).toBe(false)
    })
  })
})
