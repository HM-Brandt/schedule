// Tests de las utilidades de nombre de empleado (tarea 5.2 de `schedule-assign`).
//
// Cubren "Empleados en la tarjeta" de `specs/employee-assignment/spec.md`: las tarjetas
// muestran las iniciales y el nombre completo al pasar el puntero.
import { describe, expect, it } from 'vitest'
import type { Employee } from '../api/types'
import { fullName, initials } from './employees'
import { empleado as crearEmpleado } from '../test/fabricas'

function empleado(firstName: string, lastName: string): Employee {
  return crearEmpleado(1, firstName, lastName, 'Pintora')
}

describe('initials', () => {
  it('toma la primera letra del nombre y del apellido: "Ana López" da "AL"', () => {
    expect(initials(empleado('Ana', 'López'))).toBe('AL')
  })

  it('"Luis Martínez" da "LM"', () => {
    expect(initials(empleado('Luis', 'Martínez'))).toBe('LM')
  })

  it('conserva las letras con tilde y las pasa a mayúscula: "ángel úbeda" da "ÁÚ"', () => {
    expect(initials(empleado('ángel', 'úbeda'))).toBe('ÁÚ')
  })

  it('pasa a mayúscula las iniciales escritas en minúscula: "sofía romero" da "SR"', () => {
    expect(initials(empleado('sofía', 'romero'))).toBe('SR')
  })

  it('con ñ inicial: "Íñigo Ñúñez" da "ÍÑ"', () => {
    expect(initials(empleado('Íñigo', 'Ñúñez'))).toBe('ÍÑ')
  })

  it('con nombre y apellido compuestos usa solo la primera letra de cada campo', () => {
    expect(initials(empleado('María José', 'de la Fuente'))).toBe('MD')
  })
})

describe('fullName', () => {
  it('une nombre y apellido con un espacio: "Ana López"', () => {
    expect(fullName(empleado('Ana', 'López'))).toBe('Ana López')
  })

  it('conserva mayúsculas, tildes y nombres compuestos tal como llegan', () => {
    expect(fullName(empleado('María José', 'de la Fuente'))).toBe('María José de la Fuente')
  })

  it('usa firstName y lastName aunque legalName sea distinto', () => {
    const conNombreLegal: Employee = { ...empleado('Ana', 'López'), legalName: 'Ana María López García' }

    expect(fullName(conNombreLegal)).toBe('Ana López')
    expect(initials(conNombreLegal)).toBe('AL')
  })
})
