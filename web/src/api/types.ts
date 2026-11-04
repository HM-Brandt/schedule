
export type IsoDate = string

export type StartTime = string

/** Estado del empleado. Contrato: "Listar empleados". */
export type EmployeeStatus = 'activo' | 'inactivo'

export interface Employee {
  id: number
  first_name: string
  last_name: string
  title: string
  status: EmployeeStatus
}

export interface Job {
  id: number
  number: string
  name: string
}

export interface Schedule {
  id: number
  job: Job
  date: IsoDate
  start_time: StartTime
  employee_ids: number[]
}

export interface CreateScheduleBody {
  job_id: number
  date: IsoDate
  start_time: StartTime
  employee_ids?: number[]
}

export type UpdateScheduleBody =
  | { date: IsoDate; start_time?: StartTime }
  | { date?: IsoDate; start_time: StartTime }

export interface ReplaceEmployeesBody {
  employee_ids: number[]
}

export interface ApiErrorBody {
  error: string
}

/** Parámetros de `GET /api/employees`. Sin `status` se devuelven todos. Contrato: "Listar empleados". */
export interface EmployeesQuery {
  /** Filtra por estado del empleado. */
  status?: EmployeeStatus
}

/** Parámetros de `GET /api/jobs`. Contrato: "Listar y buscar trabajos". */
export interface JobsQuery {
  /** Texto que debe contener el número o el nombre del trabajo, sin distinguir mayúsculas. */
  search?: string
}

/** Parámetros de `GET /api/schedules`. Contrato: "Listar programaciones de un rango de fechas". */
export interface SchedulesQuery {
  /** Primer día del rango, incluido. */
  from: IsoDate
  /** Último día del rango, incluido. */
  to: IsoDate
}
