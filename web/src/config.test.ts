import { describe, expect, it } from 'vitest'
import { readConfig } from './config'

describe('readConfig', () => {
  it('lee VITE_USE_MOCKS y VITE_API_URL a la vez', () => {
    expect(
      readConfig({ VITE_USE_MOCKS: 'true', VITE_API_URL: 'http://localhost:8080' }),
    ).toEqual({ useMocks: true, apiUrl: 'http://localhost:8080', mockDelay: 300 })
  })

  it('lee las tres variables a la vez', () => {
    expect(
      readConfig({
        VITE_USE_MOCKS: 'true',
        VITE_API_URL: 'http://localhost:8080',
        VITE_MOCK_DELAY: '150',
      }),
    ).toEqual({ useMocks: true, apiUrl: 'http://localhost:8080', mockDelay: 150 })
  })

  describe('mockDelay', () => {
    it('lee el valor numérico de VITE_MOCK_DELAY', () => {
      expect(readConfig({ VITE_MOCK_DELAY: '150' }).mockDelay).toBe(150)
    })

    it('acepta 0 para quitar la latencia', () => {
      expect(readConfig({ VITE_MOCK_DELAY: '0' }).mockDelay).toBe(0)
    })

    it('es 300 cuando falta VITE_MOCK_DELAY', () => {
      expect(readConfig({}).mockDelay).toBe(300)
    })

    it.each([
      ['vacía', ''],
      ['un texto', 'rápido'],
      ['solo espacios', '   '],
    ])('es 300 cuando VITE_MOCK_DELAY es %s', (_descripcion, valor) => {
      expect(readConfig({ VITE_MOCK_DELAY: valor }).mockDelay).toBe(300)
    })
  })

  describe('useMocks', () => {
    it('es true cuando VITE_USE_MOCKS vale "true"', () => {
      expect(readConfig({ VITE_USE_MOCKS: 'true' }).useMocks).toBe(true)
    })

    it.each([
      ['"false"', 'false'],
      ['"TRUE"', 'TRUE'],
      ['"1"', '1'],
      ['vacía', ''],
    ])('es false cuando VITE_USE_MOCKS es %s', (_descripcion, valor) => {
      expect(readConfig({ VITE_USE_MOCKS: valor }).useMocks).toBe(false)
    })

    it('es false cuando falta VITE_USE_MOCKS', () => {
      expect(readConfig({}).useMocks).toBe(false)
    })
  })

  describe('apiUrl', () => {
    it('deja igual una URL sin "/" final', () => {
      expect(readConfig({ VITE_API_URL: 'http://localhost:8080' }).apiUrl).toBe(
        'http://localhost:8080',
      )
    })

    it('quita la "/" final', () => {
      expect(readConfig({ VITE_API_URL: 'http://localhost:8080/' }).apiUrl).toBe(
        'http://localhost:8080',
      )
    })

    it('quita varias "/" finales', () => {
      expect(readConfig({ VITE_API_URL: 'http://x//' }).apiUrl).toBe('http://x')
    })

    it('recorta los espacios alrededor', () => {
      expect(readConfig({ VITE_API_URL: '  http://localhost:8080  ' }).apiUrl).toBe(
        'http://localhost:8080',
      )
    })

    it.each([
      ['vacía', ''],
      ['solo espacios', '   '],
      ['"/"', '/'],
    ])('es "" (mismo origen) cuando VITE_API_URL es %s', (_descripcion, valor) => {
      expect(readConfig({ VITE_API_URL: valor }).apiUrl).toBe('')
    })

    it('es "" (mismo origen) cuando falta VITE_API_URL', () => {
      expect(readConfig({}).apiUrl).toBe('')
    })
  })
})
