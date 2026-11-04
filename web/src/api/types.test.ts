// Test de tipos: la comprobación real la hace el compilador (`npx tsc -b`).
// Vitest solo ejecuta el archivo. Cada `// @ts-expect-error` hace fallar a
// `tsc -b` si la línea siguiente deja de producir un error de tipos.
import { describe, expect, it } from 'vitest'
import type {
  ApiErrorBody,
  CreateScheduleBody,
  Employee,
  EmployeeStatus,
  Job,
  ReplaceEmployeesBody,
  Schedule,
  UpdateScheduleBody,
} from './types'

describe('tipos del contrato schedule-api', () => {
  describe('Schedule', () => {
    it('acepta la representación del spec "Programación con dos empleados"', () => {
      const programacion = {
        id: 101,
        job: { id: 7, number: 'J-1024', name: 'Pintar oficina' },
        date: '2026-11-02',
        start_time: '08:00',
        employee_ids: [3, 5],
      } satisfies Schedule

      expect(programacion.employee_ids).toEqual([3, 5])
    })

    it('rechaza una programación sin employee_ids', () => {
      // @ts-expect-error falta employee_ids
      const sinEmpleados: Schedule = { id: 101, job: { id: 7, number: 'J-1024', name: 'Pintar oficina' }, date: '2026-11-02', start_time: '08:00' }

      expect(sinEmpleados.id).toBe(101)
    })
  })

  describe('Employee y EmployeeStatus', () => {
    it('acepta un empleado activo', () => {
      const activo = {
        id: 3,
        first_name: 'Ana',
        last_name: 'Ruiz',
        title: 'Pintora',
        status: 'activo',
      } satisfies Employee

      expect(activo.status).toBe('activo')
    })

    it('acepta un empleado inactivo', () => {
      const inactivo = {
        id: 9,
        first_name: 'Luis',
        last_name: 'Gómez',
        title: 'Ayudante',
        status: 'inactivo',
      } satisfies Employee

      expect(inactivo.status).toBe('inactivo')
    })

    it('rechaza un EmployeeStatus fuera de "activo" | "inactivo"', () => {
      // @ts-expect-error 'baja' no es un EmployeeStatus
      const estado: EmployeeStatus = 'baja'

      expect(estado).toBe('baja')
    })

    it('rechaza un Employee.status fuera de "activo" | "inactivo"', () => {
      // @ts-expect-error 'baja' no es un EmployeeStatus
      const empleado: Employee = { id: 4, first_name: 'Eva', last_name: 'Soto', title: 'Pintora', status: 'baja' }

      expect(empleado.status).toBe('baja')
    })
  })

  describe('Job', () => {
    it('acepta un trabajo del catálogo', () => {
      const trabajo = { id: 7, number: 'J-1024', name: 'Pintar oficina' } satisfies Job

      expect(trabajo.number).toBe('J-1024')
    })
  })

  describe('CreateScheduleBody', () => {
    it('acepta el cuerpo de "Creación válida", sin employee_ids', () => {
      const cuerpo = {
        job_id: 7,
        date: '2026-11-02',
        start_time: '07:00',
      } satisfies CreateScheduleBody

      expect(cuerpo).not.toHaveProperty('employee_ids')
    })

    it('acepta un cuerpo con employee_ids', () => {
      const cuerpo = {
        job_id: 7,
        date: '2026-11-02',
        start_time: '07:00',
        employee_ids: [3, 5],
      } satisfies CreateScheduleBody

      expect(cuerpo.employee_ids).toEqual([3, 5])
    })

    it('rechaza un cuerpo sin job_id', () => {
      // @ts-expect-error falta job_id
      const sinTrabajo: CreateScheduleBody = { date: '2026-11-02', start_time: '07:00' }

      expect(sinTrabajo.date).toBe('2026-11-02')
    })
  })

  describe('UpdateScheduleBody', () => {
    it('acepta solo date ("Mover a otro día")', () => {
      const cuerpo = { date: '2026-11-04' } satisfies UpdateScheduleBody

      expect(cuerpo.date).toBe('2026-11-04')
    })

    it('acepta solo start_time', () => {
      const cuerpo = { start_time: '09:30' } satisfies UpdateScheduleBody

      expect(cuerpo.start_time).toBe('09:30')
    })

    it('acepta date y start_time a la vez', () => {
      const cuerpo = { date: '2026-11-04', start_time: '09:30' } satisfies UpdateScheduleBody

      expect(cuerpo).toEqual({ date: '2026-11-04', start_time: '09:30' })
    })

    it('rechaza un cuerpo vacío', () => {
      // @ts-expect-error debe llevar date, start_time o ambos
      const vacio: UpdateScheduleBody = {}

      expect(vacio).toEqual({})
    })
  })

  describe('ReplaceEmployeesBody', () => {
    it('acepta el cuerpo de "Reemplazo"', () => {
      const cuerpo = { employee_ids: [5, 8] } satisfies ReplaceEmployeesBody

      expect(cuerpo.employee_ids).toEqual([5, 8])
    })

    it('rechaza un cuerpo sin employee_ids', () => {
      // @ts-expect-error falta employee_ids
      const vacio: ReplaceEmployeesBody = {}

      expect(vacio).toEqual({})
    })
  })

  describe('ApiErrorBody', () => {
    it('acepta un cuerpo de error', () => {
      const error = { error: 'No existe la programación' } satisfies ApiErrorBody

      expect(error.error).toBe('No existe la programación')
    })
  })
})
