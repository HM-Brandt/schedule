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

export function createHandlers(seed: ReturnType<typeof createSeed>) {
  const { employees, jobs } = seed
  let schedules = seed.schedules.map((schedule) => ({
    ...schedule,
    employee_ids: [...schedule.employee_ids],
  }))
  let nextId = Math.max(0, ...schedules.map((schedule) => schedule.id)) + 1

  const findSchedule = (id: string) => schedules.find((schedule) => String(schedule.id) === id)

  const invalidEmployees = (ids: number[], assigned: number[]) => {
    for (const id of ids) {
      const employee = employees.find((candidate) => candidate.id === id)
      if (!employee) return error(422, `No existe el empleado ${id}`)
      if (employee.status === 'inactivo' && !assigned.includes(id)) {
        return error(422, `El empleado ${id} está inactivo`)
      }
    }
  }

  return [
    http.get('/api/employees', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      if (status !== null && status !== 'activo' && status !== 'inactivo') {
        return error(422, `El estado "${status}" no es válido`)
      }
      return HttpResponse.json(
        employees
          .filter((employee) => !status || employee.status === status)
          .sort(
            (a, b) =>
              a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name),
          ),
      )
    }),

    http.get('/api/jobs', ({ request }) => {
      const search = (new URL(request.url).searchParams.get('search') ?? '').toLowerCase()
      return HttpResponse.json(
        jobs
          .filter(
            (job) =>
              job.number.toLowerCase().includes(search) || job.name.toLowerCase().includes(search),
          )
          .sort((a, b) => a.number.localeCompare(b.number)),
      )
    }),

    http.get('/api/schedules', ({ request }) => {
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
              a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.id - b.id,
          ),
      )
    }),

    http.post('/api/schedules', async ({ request }) => {
      const body = (await request.json().catch(() => null)) as Partial<CreateScheduleBody> | null
      if (
        !body ||
        typeof body.job_id !== 'number' ||
        (body.employee_ids !== undefined && !Array.isArray(body.employee_ids))
      ) {
        return error(422, 'El cuerpo de la petición no es válido')
      }
      const job = jobs.find((candidate) => candidate.id === body.job_id)
      if (!job) return error(422, `No existe el trabajo ${body.job_id}`)
      if (!isDate(body.date)) return error(422, 'La fecha no es válida')
      if (!isTime(body.start_time)) return error(422, 'La hora debe tener el formato HH:mm')
      const employeeIds = [...new Set(body.employee_ids ?? [])]
      const failure = invalidEmployees(employeeIds, [])
      if (failure) return failure
      const schedule = {
        id: nextId++,
        job,
        date: body.date,
        start_time: body.start_time,
        employee_ids: employeeIds,
      }
      schedules.push(schedule)
      return HttpResponse.json(schedule, { status: 201 })
    }),

    http.patch('/api/schedules/:id', async ({ request, params }) => {
      const schedule = findSchedule(String(params.id))
      if (!schedule) return error(404, `No existe la programación ${params.id}`)
      const body = (await request.json().catch(() => null)) as Partial<UpdateScheduleBody> | null
      if (!body) return error(422, 'El cuerpo de la petición no es válido')
      if (body.date === undefined && body.start_time === undefined) {
        return error(422, 'Debes enviar date o start_time')
      }
      if (body.date !== undefined && !isDate(body.date)) return error(422, 'La fecha no es válida')
      if (body.start_time !== undefined && !isTime(body.start_time)) {
        return error(422, 'La hora debe tener el formato HH:mm')
      }
      if (body.date !== undefined) schedule.date = body.date
      if (body.start_time !== undefined) schedule.start_time = body.start_time
      return HttpResponse.json(schedule)
    }),

    http.delete('/api/schedules/:id', ({ params }) => {
      const schedule = findSchedule(String(params.id))
      if (!schedule) return error(404, `No existe la programación ${params.id}`)
      schedules = schedules.filter((candidate) => candidate !== schedule)
      return new HttpResponse(null, { status: 204 })
    }),

    http.put('/api/schedules/:id/employees', async ({ request, params }) => {
      const schedule = findSchedule(String(params.id))
      if (!schedule) return error(404, `No existe la programación ${params.id}`)
      const body = (await request.json().catch(() => null)) as { employee_ids?: unknown } | null
      if (!Array.isArray(body?.employee_ids)) {
        return error(422, 'El cuerpo de la petición no es válido')
      }
      const employeeIds = [...new Set<number>(body.employee_ids)]
      const failure = invalidEmployees(employeeIds, schedule.employee_ids)
      if (failure) return failure
      schedule.employee_ids = employeeIds
      return HttpResponse.json(schedule)
    }),
  ]
}
