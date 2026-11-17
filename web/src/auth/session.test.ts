// Tests de la sesión: URLs del portal y `goToLogin`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../stores/authStore'
import { simularNavegacion } from '../test/navegacion'
import { goToLogin, HOME_URL, LOGIN_URL } from './session'

beforeEach(() => {
  localStorage.setItem('auth_token', 'token-guardado')
  localStorage.setItem('refresh_token', 'refresh-guardado')
  useAuthStore.getState().login('token-guardado', 'refresh-guardado')
  useAuthStore.getState().setUser({ email: 'demo@hmbrandt.com', fullName: 'Demo User', id: '1', roles: [] })
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('URLs del portal', () => {
  it('HOME_URL y LOGIN_URL apuntan al portal de HM Brandt', () => {
    expect(HOME_URL).toBe('https://ckarlosdev.github.io/HMBrandt/')
    expect(LOGIN_URL).toBe('https://ckarlosdev.github.io/login/')
  })
})

describe('goToLogin', () => {
  it('cierra la sesión y navega a LOGIN_URL', () => {
    const assign = simularNavegacion()

    goToLogin()

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
  })

  it('cierra la sesión antes de navegar', () => {
    const assign = simularNavegacion()
    let tokenAlNavegar: string | null | undefined
    assign.mockImplementation(() => {
      tokenAlNavegar = useAuthStore.getState().token
    })

    goToLogin()

    expect(tokenAlNavegar).toBeNull()
  })
})
