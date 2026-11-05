// Tests del cliente de TanStack Query y del mensaje de error al guardar
// (tareas 1.6, 4.1 y 4.2 de `schedule-assign`). El texto de la interfaz está en inglés
// y el detalle que envía el servidor en `{"error"}` se añade tal cual llega.
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './client'
import { createQueryClient, mutationErrorMessage } from './queryClient'

describe('mutationErrorMessage', () => {
  it('añade el mensaje de un ApiError tal cual, aunque venga en español', () => {
    const error = new ApiError('http', 500, 'La base de datos no responde')

    expect(mutationErrorMessage(error)).toBe("Couldn't save the change. La base de datos no responde")
  })

  it('añade el mensaje de un ApiError de validación', () => {
    const error = new ApiError('validation', 422, 'El empleado 9 está inactivo')

    expect(mutationErrorMessage(error)).toBe("Couldn't save the change. El empleado 9 está inactivo")
  })

  it('añade el mensaje por defecto en inglés de un ApiError de red', () => {
    const error = new ApiError('network', null, "Couldn't connect to the server")

    expect(mutationErrorMessage(error)).toBe("Couldn't save the change. Couldn't connect to the server")
  })

  it('un ApiError sin mensaje da solo el texto genérico', () => {
    expect(mutationErrorMessage(new ApiError('http', 500, ''))).toBe("Couldn't save the change.")
  })

  it('un error que no es ApiError da solo el texto genérico', () => {
    expect(mutationErrorMessage(new Error('fallo interno'))).toBe("Couldn't save the change.")
    expect(mutationErrorMessage('texto')).toBe("Couldn't save the change.")
    expect(mutationErrorMessage(undefined)).toBe("Couldn't save the change.")
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
    expect(onMutationError).toHaveBeenCalledWith("Couldn't save the change. Fallo simulado")
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
