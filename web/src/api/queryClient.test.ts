// Tests del cliente de TanStack Query y del mensaje de error al guardar
// (tareas 4.1 y 4.2 de `schedule-assign`).
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './client'
import { createQueryClient, mutationErrorMessage } from './queryClient'

describe('mutationErrorMessage', () => {
  it('añade el mensaje de un ApiError', () => {
    const error = new ApiError('http', 500, 'La base de datos no responde')

    expect(mutationErrorMessage(error)).toBe('No se pudo guardar el cambio. La base de datos no responde')
  })

  it('añade el mensaje de un ApiError de validación', () => {
    const error = new ApiError('validation', 422, 'El empleado 9 está inactivo')

    expect(mutationErrorMessage(error)).toBe('No se pudo guardar el cambio. El empleado 9 está inactivo')
  })

  it('un ApiError sin mensaje da solo el texto genérico', () => {
    expect(mutationErrorMessage(new ApiError('http', 500, ''))).toBe('No se pudo guardar el cambio.')
  })

  it('un error que no es ApiError da solo el texto genérico', () => {
    expect(mutationErrorMessage(new Error('fallo interno'))).toBe('No se pudo guardar el cambio.')
    expect(mutationErrorMessage('texto')).toBe('No se pudo guardar el cambio.')
    expect(mutationErrorMessage(undefined)).toBe('No se pudo guardar el cambio.')
  })
})

describe('createQueryClient', () => {
  it('llama a onMutationError con el mensaje cuando falla una mutación', async () => {
    const onMutationError = vi.fn()
    const client = createQueryClient({ onMutationError })

    const ejecucion = client
      .getMutationCache()
      .build(client, {
        mutationFn: () => Promise.reject(new ApiError('http', 500, 'Fallo simulado')),
      })
      .execute(undefined)

    await expect(ejecucion).rejects.toBeInstanceOf(ApiError)
    expect(onMutationError).toHaveBeenCalledTimes(1)
    expect(onMutationError).toHaveBeenCalledWith('No se pudo guardar el cambio. Fallo simulado')
  })

  it('no llama a onMutationError cuando la mutación sale bien', async () => {
    const onMutationError = vi.fn()
    const client = createQueryClient({ onMutationError })

    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.resolve('ok') })
      .execute(undefined)

    expect(onMutationError).not.toHaveBeenCalled()
  })

  it('sin opciones, una mutación fallida no lanza nada extra', async () => {
    const client = createQueryClient()

    const ejecucion = client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(new Error('fallo')) })
      .execute(undefined)

    await expect(ejecucion).rejects.toThrow('fallo')
  })
})
