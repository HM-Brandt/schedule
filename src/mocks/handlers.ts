import { http, HttpResponse } from 'msw'
import type { CreateScheduleBody, UpdateScheduleBody } from '../api/types'
import { parseIsoDate } from '../lib/dates'
import type { createSeed } from './seed'

const error = (status: number, message: string) => HttpResponse.json({ error: message }, { status })

const isDate = (value: unknown): value is string => {
  try {
    parseIsoDate(String(value))
    return true
  } catch {
    return false
  }
}

const isTime = (value: unknown): value is string => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))

const normalizeComment = (value: string | null | undefined) => (value?.trim() ? value : null)

export function createHandlers(seed: ReturnType<typeof createSeed>) {
  const { employees, jobs } = seed
  let schedules = seed.schedules.map((schedule) => ({
    ...schedule,
    employeesIds: [...schedule.employeesIds],
  }))
  let nextId = Math.max(0, ...schedules.map((schedule) => schedule.jobSchedulesId)) + 1

  const findSchedule = (id: string) =>
    schedules.find((schedule) => String(schedule.jobSchedulesId) === id)

  const invalidEmployees = (ids: number[], assigned: number[]) => {
    for (const id of ids) {
      const employee = employees.find((candidate) => candidate.employeesId === id)
      if (!employee) return error(422, `No existe el empleado ${id}`)
      if (employee.status === 'Terminated' && !assigned.includes(id)) {
        return error(422, `El empleado ${id} está inactivo`)
      }
    }
  }

  return [
    http.get('*/auth/me', () =>
      HttpResponse.json({
        email: 'demo@hmbrandt.com',
        fullName: 'Demo User',
        id: '1',
        roles: [{ id: 1, name: 'Admin' }],
      }),
    ),

    http.post('*/auth/refresh', () =>
      HttpResponse.json({ token: 'mock-token', refreshToken: 'mock-refresh-token', userId: '1' }),
    ),

    http.get('*/v1/employee', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      if (status !== null && status !== 'Active' && status !== 'Terminated') {
        return error(422, `El estado "${status}" no es válido`)
      }
      return HttpResponse.json(
        employees
          .filter((employee) => !status || employee.status === status)
          .sort(
            (a, b) =>
              a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName),
          ),
      )
    }),

    http.get('*/v1/job', () =>
      HttpResponse.json([...jobs].sort((a, b) => a.number.localeCompare(b.number))),
    ),

    http.get('*/v2/job-management/schedules', ({ request }) => {
      const params = new URL(request.url).searchParams
      const from = params.get('from')
      const to = params.get('to')
      if (!isDate(from) || !isDate(to)) {
        return error(422, 'Los parámetros from y to deben ser fechas AAAA-MM-DD')
      }
      if (from > to) return error(422, 'La fecha from no puede ser posterior a to')
      return HttpResponse.json(
        schedules
          .filter((schedule) => schedule.date >= from && schedule.date <= to)
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) ||
              a.startTime.localeCompare(b.startTime) ||
              a.jobSchedulesId - b.jobSchedulesId,
          ),
      )
    }),

    http.post('*/v2/job-management/schedules', async ({ request }) => {
      const body = (await request.json().catch(() => null)) as Partial<CreateScheduleBody> | null
      if (
        !body ||
        typeof body.jobsId !== 'number' ||
        (body.employeesIds !== undefined && !Array.isArray(body.employeesIds)) ||
        (body.scheduleComment != null && typeof body.scheduleComment !== 'string')
      ) {
        return error(422, 'El cuerpo de la petición no es válido')
      }
      if (!jobs.some((candidate) => candidate.jobsId === body.jobsId)) {
        return error(422, `No existe el trabajo ${body.jobsId}`)
      }
      if (!isDate(body.date)) return error(422, 'La fecha no es válida')
      if (!isTime(body.startTime)) return error(422, 'La hora debe tener el formato HH:mm')
      const employeeIds = [...new Set(body.employeesIds ?? [])]
      const failure = invalidEmployees(employeeIds, [])
      if (failure) return failure
      const schedule = {
        jobSchedulesId: nextId++,
        jobsId: body.jobsId,
        date: body.date,
        startTime: body.startTime,
        employeesIds: employeeIds,
        scheduleComment: normalizeComment(body.scheduleComment),
      }
      schedules.push(schedule)
      return HttpResponse.json(schedule, { status: 201 })
    }),

    http.patch('*/v2/job-management/schedules/:id', async ({ request, params }) => {
      const schedule = findSchedule(String(params.id))
      if (!schedule) return error(404, `No existe la programación ${params.id}`)
      const body = (await request.json().catch(() => null)) as Partial<UpdateScheduleBody> | null
      if (!body) return error(422, 'El cuerpo de la petición no es válido')
      if (body.date === undefined && body.startTime === undefined && body.scheduleComment === undefined) {
        return error(422, 'Debes enviar date, startTime o scheduleComment')
      }
      if (body.date !== undefined && !isDate(body.date)) return error(422, 'La fecha no es válida')
      if (body.startTime !== undefined && !isTime(body.startTime)) {
        return error(422, 'La hora debe tener el formato HH:mm')
      }
      if (body.scheduleComment != null && typeof body.scheduleComment !== 'string') {
        return error(422, 'El comentario no es válido')
      }
      if (body.date !== undefined) schedule.date = body.date
      if (body.startTime !== undefined) schedule.startTime = body.startTime
      if (body.scheduleComment !== undefined) schedule.scheduleComment = normalizeComment(body.scheduleComment)
      return HttpResponse.json(schedule)
    }),

    http.delete('*/v2/job-management/schedules/:id', ({ params }) => {
      const schedule = findSchedule(String(params.id))
      if (!schedule) return error(404, `No existe la programación ${params.id}`)
      schedules = schedules.filter((candidate) => candidate !== schedule)
      return new HttpResponse(null, { status: 204 })
    }),

    http.put('*/v2/job-management/schedules/:id/employees', async ({ request, params }) => {
      const schedule = findSchedule(String(params.id))
      if (!schedule) return error(404, `No existe la programación ${params.id}`)
      const body = (await request.json().catch(() => null)) as { employeesIds?: unknown } | null
      if (!Array.isArray(body?.employeesIds)) {
        return error(422, 'El cuerpo de la petición no es válido')
      }
      const employeeIds = [...new Set<number>(body.employeesIds)]
      const failure = invalidEmployees(employeeIds, schedule.employeesIds)
      if (failure) return failure
      schedule.employeesIds = employeeIds
      return HttpResponse.json(schedule)
    }),
  ]
}
