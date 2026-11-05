import axios from 'axios'
import type { AxiosError } from 'axios'
import { config } from '../config'
import { normalizeTime } from '../lib/dates'
import type {
  CreateScheduleBody,
  Employee,
  EmployeesQuery,
  Job,
  JobsQuery,
  ReplaceEmployeesBody,
  Schedule,
  SchedulesQuery,
  UpdateScheduleBody,
} from './types'

/**
 * Tipo de error de la API:
 * - `not_found`: el backend respondió 404;
 * - `validation`: el backend respondió 422;
 * - `http`: cualquier otro código de error de la respuesta;
 * - `network`: no hubo respuesta (error de red o tiempo agotado).
 */
export type ApiErrorKind = 'not_found' | 'validation' | 'http' | 'network'

/**
 * Error de una llamada a la API. `status` es el código HTTP de la respuesta,
 * o `null` si no llegó respuesta. `message` es el `error` del cuerpo si el backend
 * lo envió, o un texto por defecto en inglés.
 */
export class ApiError extends Error {
  name = 'ApiError'
  /** Tipo de error. */
  kind: ApiErrorKind
  /** Código HTTP de la respuesta, o `null` si no hubo respuesta. */
  status: number | null

  constructor(kind: ApiErrorKind, status: number | null, message: string) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

/** Devuelve el `error` del cuerpo `{"error": "<texto>"}` si existe y es un texto no vacío. */
function readBodyMessage(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const message = (data as { error: unknown }).error
    if (typeof message === 'string' && message.trim() !== '') {
      return message
    }
  }
  return null
}

/** Convierte un error de axios en un `ApiError` según el código de la respuesta. */
function toApiError(error: AxiosError): ApiError {
  const response = error.response
  if (!response) {
    return new ApiError('network', null, "Couldn't connect to the server")
  }
  const status = response.status
  const bodyMessage = readBodyMessage(response.data)
  if (status === 404) {
    return new ApiError('not_found', 404, bodyMessage ?? 'Resource not found')
  }
  if (status === 422) {
    return new ApiError('validation', 422, bodyMessage ?? 'Invalid data')
  }
  return new ApiError('http', status, bodyMessage ?? `Server error (${status})`)
}

/** Deja la hora de inicio de una programación en `HH:mm`, aunque el backend envíe segundos. */
function normalizeSchedule(schedule: Schedule): Schedule {
  return { ...schedule, start_time: normalizeTime(schedule.start_time) }
}

/**
 * Crea el cliente de la API para la URL base indicada. Con `baseURL` vacía,
 * las rutas `/api/...` van al mismo origen. Los errores de axios se convierten
 * en `ApiError`; los demás errores se relanzan tal cual.
 */
export function createApiClient(baseURL: string) {
  const http = axios.create({
    baseURL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  })

  http.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        return Promise.reject(toApiError(error))
      }
      return Promise.reject(error)
    },
  )

  return {
    /** `GET /api/employees`. Envía `status` solo si viene. */
    async getEmployees(params?: EmployeesQuery): Promise<Employee[]> {
      const query = params?.status !== undefined ? { status: params.status } : undefined
      const response = await http.get<Employee[]>('/api/employees', { params: query })
      return response.data
    },

    /** `GET /api/jobs`. Envía `search` solo si viene. */
    async getJobs(params?: JobsQuery): Promise<Job[]> {
      const query = params?.search !== undefined ? { search: params.search } : undefined
      const response = await http.get<Job[]>('/api/jobs', { params: query })
      return response.data
    },

    /** `GET /api/schedules?from&to`. Programaciones del rango, ambos días incluidos. */
    async getSchedules(params: SchedulesQuery): Promise<Schedule[]> {
      const response = await http.get<Schedule[]>('/api/schedules', {
        params: { from: params.from, to: params.to },
      })
      return response.data.map(normalizeSchedule)
    },

    /** `POST /api/schedules`. Crea una programación y la devuelve. */
    async createSchedule(body: CreateScheduleBody): Promise<Schedule> {
      const response = await http.post<Schedule>('/api/schedules', body)
      return normalizeSchedule(response.data)
    },

    /** `PATCH /api/schedules/{id}`. Cambia la fecha, la hora o ambas, y devuelve la programación. */
    async updateSchedule(id: number, body: UpdateScheduleBody): Promise<Schedule> {
      const response = await http.patch<Schedule>(`/api/schedules/${id}`, body)
      return normalizeSchedule(response.data)
    },

    /** `DELETE /api/schedules/{id}`. Elimina la programación; el backend responde 204 sin cuerpo. */
    async deleteSchedule(id: number): Promise<void> {
      await http.delete(`/api/schedules/${id}`)
    },

    /** `PUT /api/schedules/{id}/employees`. Reemplaza el conjunto de empleados y devuelve la programación. */
    async replaceScheduleEmployees(id: number, body: ReplaceEmployeesBody): Promise<Schedule> {
      const response = await http.put<Schedule>(`/api/schedules/${id}/employees`, body)
      return normalizeSchedule(response.data)
    },
  }
}

/** Cliente de la API creado por `createApiClient`. */
export type ApiClient = ReturnType<typeof createApiClient>

/** Instancia de la API de la aplicación, con la URL base de la configuración. */
export const api = createApiClient(config.apiUrl)
