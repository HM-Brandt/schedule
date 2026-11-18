// Test de tipos: la comprobación real la hace el compilador (`npx tsc -b`).
// Vitest solo ejecuta el archivo. Cada `// @ts-expect-error` hace fallar a
// `tsc -b` si la línea siguiente deja de producir un error de tipos.
import { describe, expect, it } from 'vitest'
import type {
  Absence,
  AbsenceType,
  AbsencesQuery,
  ApiErrorBody,
  CreateAbsenceBody,
  CreateAbsenceResponse,
  CreateScheduleBody,
  Employee,
  EmployeeStatus,
  Job,
  ReplaceEmployeesBody,
  Schedule,
  UpdateScheduleBody,
} from './types'

const TRABAJO_7 = {
  jobsId: 7,
  number: 'J-1024',
  type: 'Interior',
  name: 'Pintar oficina',
  address: 'Calle Mayor 1',
  contractor: 'Contratista',
  contact: 'Contacto',
  status: 'Open',
  user: 'admin',
} satisfies Job

describe('tipos del contrato schedule-api', () => {
  describe('Schedule', () => {
    it('acepta la representación del spec "Programación con dos empleados"', () => {
      const programacion = {
        jobSchedulesId: 101,
        job: TRABAJO_7,
        date: '2026-11-02',
        startTime: '08:00',
        employeesIds: [3, 5],
        scheduleComment: null,
      } satisfies Schedule

      expect(programacion.employeesIds).toEqual([3, 5])
    })

    it('acepta una programación con comentario', () => {
      const programacion = {
        jobSchedulesId: 101,
        job: TRABAJO_7,
        date: '2026-11-02',
        startTime: '08:00',
        employeesIds: [3, 5],
        scheduleComment: 'Llevar escalera',
      } satisfies Schedule

      expect(programacion.scheduleComment).toBe('Llevar escalera')
    })

    it('rechaza una programación sin scheduleComment', () => {
      // @ts-expect-error falta scheduleComment (null si no tiene comentario)
      const sinComentario: Schedule = { jobSchedulesId: 101, job: TRABAJO_7, date: '2026-11-02', startTime: '08:00', employeesIds: [] }

      expect(sinComentario.jobSchedulesId).toBe(101)
    })

    it('rechaza una programación sin employeesIds', () => {
      // @ts-expect-error falta employeesIds
      const sinEmpleados: Schedule = { jobSchedulesId: 101, job: TRABAJO_7, date: '2026-11-02', startTime: '08:00' }

      expect(sinEmpleados.jobSchedulesId).toBe(101)
    })

    it('rechaza una programación con los nombres viejos id, start_time y employee_ids', () => {
      // @ts-expect-error los campos se llaman jobSchedulesId, startTime y employeesIds
      const vieja: Schedule = { id: 101, job: TRABAJO_7, date: '2026-11-02', start_time: '08:00', employee_ids: [] }

      expect(vieja.date).toBe('2026-11-02')
    })
  })

  describe('Employee y EmployeeStatus', () => {
    it('acepta un empleado activo', () => {
      const activo = {
        employeesId: 3,
        legalName: 'Ana Ruiz',
        employeeNumber: 'E-3',
        firstName: 'Ana',
        lastName: 'Ruiz',
        title: 'Pintora',
        status: 'Active',
        user: 'admin',
      } satisfies Employee

      expect(activo.status).toBe('Active')
    })

    it('acepta un empleado inactivo', () => {
      const inactivo = {
        employeesId: 9,
        legalName: 'Luis Gómez',
        employeeNumber: 'E-9',
        firstName: 'Luis',
        lastName: 'Gómez',
        title: 'Ayudante',
        status: 'Terminated',
        user: 'admin',
      } satisfies Employee

      expect(inactivo.status).toBe('Terminated')
    })

    it('rechaza un EmployeeStatus fuera de "Active" | "Terminated"', () => {
      // @ts-expect-error 'activo' (el valor viejo) no es un EmployeeStatus
      const estado: EmployeeStatus = 'activo'

      expect(estado).toBe('activo')
    })

    it('rechaza un Employee.status fuera de "Active" | "Terminated"', () => {
      const empleado: Employee = {
        employeesId: 4,
        legalName: 'Eva Soto',
        employeeNumber: 'E-4',
        firstName: 'Eva',
        lastName: 'Soto',
        title: 'Pintora',
        // @ts-expect-error 'baja' no es un EmployeeStatus
        status: 'baja',
        user: 'admin',
      }

      expect(empleado.status).toBe('baja')
    })
  })

  describe('Job', () => {
    it('acepta un trabajo del catálogo con todos sus campos', () => {
      const trabajo = { ...TRABAJO_7 } satisfies Job

      expect(trabajo.number).toBe('J-1024')
    })

    it('acepta un trabajo con status "Done"', () => {
      const terminado = { ...TRABAJO_7, status: 'Done' } satisfies Job

      expect(terminado.status).toBe('Done')
    })

    it('rechaza un trabajo con solo { id, number, name }', () => {
      // @ts-expect-error faltan jobsId y el resto de campos
      const viejo: Job = { id: 7, number: 'J-1024', name: 'Pintar oficina' }

      expect(viejo.number).toBe('J-1024')
    })
  })

  describe('CreateScheduleBody', () => {
    it('acepta el cuerpo de "Creación válida", sin employeesIds', () => {
      const cuerpo = {
        jobsId: 7,
        date: '2026-11-02',
        startTime: '07:00',
      } satisfies CreateScheduleBody

      expect(cuerpo).not.toHaveProperty('employeesIds')
    })

    it('acepta un cuerpo con employeesIds', () => {
      const cuerpo = {
        jobsId: 7,
        date: '2026-11-02',
        startTime: '07:00',
        employeesIds: [3, 5],
      } satisfies CreateScheduleBody

      expect(cuerpo.employeesIds).toEqual([3, 5])
    })

    it('acepta el cuerpo de "Creación con comentario" y scheduleComment null', () => {
      const conComentario = {
        jobsId: 7,
        date: '2026-11-02',
        startTime: '07:00',
        scheduleComment: 'Llevar escalera',
      } satisfies CreateScheduleBody
      const sinComentario = { ...conComentario, scheduleComment: null } satisfies CreateScheduleBody

      expect(conComentario.scheduleComment).toBe('Llevar escalera')
      expect(sinComentario.scheduleComment).toBeNull()
    })

    it('rechaza un scheduleComment que no es texto ni null', () => {
      // @ts-expect-error scheduleComment es string | null
      const numerico: CreateScheduleBody = { jobsId: 7, date: '2026-11-02', startTime: '07:00', scheduleComment: 5 }

      expect(numerico.jobsId).toBe(7)
    })

    it('rechaza un cuerpo sin jobsId', () => {
      // @ts-expect-error falta jobsId
      const sinTrabajo: CreateScheduleBody = { date: '2026-11-02', startTime: '07:00' }

      expect(sinTrabajo.date).toBe('2026-11-02')
    })
  })

  describe('UpdateScheduleBody', () => {
    it('acepta solo date ("Mover a otro día")', () => {
      const cuerpo = { date: '2026-11-04' } satisfies UpdateScheduleBody

      expect(cuerpo.date).toBe('2026-11-04')
    })

    it('acepta solo startTime', () => {
      const cuerpo = { startTime: '09:30' } satisfies UpdateScheduleBody

      expect(cuerpo.startTime).toBe('09:30')
    })

    it('acepta date y startTime a la vez', () => {
      const cuerpo = { date: '2026-11-04', startTime: '09:30' } satisfies UpdateScheduleBody

      expect(cuerpo).toEqual({ date: '2026-11-04', startTime: '09:30' })
    })

    it('acepta solo scheduleComment ("Cambiar el comentario") y scheduleComment null', () => {
      const cambiar = { scheduleComment: 'Entrar por la puerta trasera' } satisfies UpdateScheduleBody
      const borrar = { scheduleComment: null } satisfies UpdateScheduleBody

      expect(cambiar.scheduleComment).toBe('Entrar por la puerta trasera')
      expect(borrar.scheduleComment).toBeNull()
    })

    it('acepta date, startTime y scheduleComment a la vez', () => {
      const cuerpo = { date: '2026-11-04', startTime: '09:30', scheduleComment: 'Llevar andamio' } satisfies UpdateScheduleBody

      expect(cuerpo.scheduleComment).toBe('Llevar andamio')
    })

    it('rechaza un scheduleComment que no es texto ni null', () => {
      // @ts-expect-error scheduleComment es string | null
      const numerico: UpdateScheduleBody = { scheduleComment: 5 }

      expect(numerico.scheduleComment).toBe(5)
    })

    it('el tipo admite un cuerpo vacío: el 422 lo da el servidor (ver mocks/handlers.test.ts)', () => {
      const vacio: UpdateScheduleBody = {}

      expect(vacio).toEqual({})
    })
  })

  describe('ReplaceEmployeesBody', () => {
    it('acepta el cuerpo de "Reemplazo"', () => {
      const cuerpo = { employeesIds: [5, 8] } satisfies ReplaceEmployeesBody

      expect(cuerpo.employeesIds).toEqual([5, 8])
    })

    it('rechaza un cuerpo sin employeesIds', () => {
      // @ts-expect-error falta employeesIds
      const vacio: ReplaceEmployeesBody = {}

      expect(vacio).toEqual({})
    })
  })

  describe('ausencias', () => {
    const AUSENCIA_41 = {
      employeeAbsencesId: 41,
      employeesId: 3,
      date: '2026-11-03',
      absenceType: 'Vacation',
      absenceComment: 'Viaje familiar',
    } satisfies Absence

    it('acepta la representación del spec "Ausencia con comentario" y una sin comentario (null)', () => {
      const sinComentario = { ...AUSENCIA_41, absenceComment: null } satisfies Absence

      expect(AUSENCIA_41.absenceType).toBe('Vacation')
      expect(sinComentario.absenceComment).toBeNull()
    })

    it('acepta los cuatro valores de AbsenceType y rechaza otro', () => {
      const tipos = ['Off', 'Vacation', 'Sick', 'Other'] satisfies AbsenceType[]
      // @ts-expect-error 'Holiday' no es un AbsenceType
      const invalido: AbsenceType = 'Holiday'

      expect(tipos).toHaveLength(4)
      expect(invalido).toBe('Holiday')
    })

    it('rechaza una ausencia sin absenceComment', () => {
      // @ts-expect-error falta absenceComment (null si no tiene comentario)
      const sinComentario: Absence = { employeeAbsencesId: 41, employeesId: 3, date: '2026-11-03', absenceType: 'Off' }

      expect(sinComentario.employeesId).toBe(3)
    })

    it('CreateAbsenceBody acepta el cuerpo sin comentario, con comentario y con null', () => {
      const sinComentario = { employeesId: 3, date: '2026-11-02', absenceType: 'Off' } satisfies CreateAbsenceBody
      const conComentario = { employeesId: 5, date: '2026-11-04', absenceType: 'Sick', absenceComment: 'Gripe' } satisfies CreateAbsenceBody
      const nulo = { ...conComentario, absenceComment: null } satisfies CreateAbsenceBody

      expect(sinComentario).not.toHaveProperty('absenceComment')
      expect(conComentario.absenceComment).toBe('Gripe')
      expect(nulo.absenceComment).toBeNull()
    })

    it('CreateAbsenceBody rechaza un cuerpo sin employeesId', () => {
      // @ts-expect-error falta employeesId
      const sinEmpleado: CreateAbsenceBody = { date: '2026-11-02', absenceType: 'Off' }

      expect(sinEmpleado.date).toBe('2026-11-02')
    })

    it('CreateAbsenceResponse lleva la ausencia y las programaciones actualizadas', () => {
      const respuesta = {
        absence: AUSENCIA_41,
        updatedSchedules: [
          { jobSchedulesId: 101, jobsId: 7, date: '2026-11-02', startTime: '08:00', employeesIds: [5], scheduleComment: null },
        ],
      } satisfies CreateAbsenceResponse

      expect(respuesta.updatedSchedules).toHaveLength(1)
    })

    it('AbsencesQuery usa from y to', () => {
      const consulta = { from: '2026-11-01', to: '2026-11-07' } satisfies AbsencesQuery
      // @ts-expect-error falta to
      const incompleta: AbsencesQuery = { from: '2026-11-01' }

      expect(consulta.to).toBe('2026-11-07')
      expect(incompleta.from).toBe('2026-11-01')
    })
  })

  describe('ApiErrorBody', () => {
    it('acepta un cuerpo de error', () => {
      const error = { error: 'No existe la programación' } satisfies ApiErrorBody

      expect(error.error).toBe('No existe la programación')
    })
  })
})
