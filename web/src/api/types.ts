
export type IsoDate = string

export type StartTime = string

/** Estado del empleado. Contrato: "Listar empleados". */
export type EmployeeStatus = 'Active' | 'Terminated'

export interface Employee {
  employeesId: number
  legalName: string
  employeeNumber: string
  firstName: string
  lastName: string
  status: EmployeeStatus
  title: string
  user: string
}

export interface Job {
  jobsId: number
  number: string
  type: string
  name: string
  address: string
  contractor: string
  contact: string
  status: string
  user: string
}

export interface Schedule {
  jobSchedulesId: number
  job: Job
  date: IsoDate
  startTime: StartTime
  employeesIds: number[]
  scheduleComment: string | null
}

export type ScheduleResponse = Omit<Schedule, 'job'> & { jobsId: number }

export interface CreateScheduleBody {
  jobsId: number
  date: IsoDate
  startTime: StartTime
  employeesIds?: number[]
  scheduleComment?: string | null
}

export type UpdateScheduleBody = { date?: IsoDate; startTime?: StartTime; scheduleComment?: string | null }

export interface ReplaceEmployeesBody {
  employeesIds: number[]
}

export interface ApiErrorBody {
  error: string
}

/** Parámetros de `GET /api/employees`. Sin `status` se devuelven todos. Contrato: "Listar empleados". */
export interface EmployeesQuery {
  /** Filtra por estado del empleado. */
  status?: EmployeeStatus
}

/** Parámetros de `GET /api/schedules`. Contrato: "Listar programaciones de un rango de fechas". */
export interface SchedulesQuery {
  /** Primer día del rango, incluido. */
  from: IsoDate
  /** Último día del rango, incluido. */
  to: IsoDate
}
