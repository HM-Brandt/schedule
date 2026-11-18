// Utilidades para usar la semilla de MSW en los tests de componentes y de la caché.
//
// La semilla guarda las programaciones como las envía el backend (`ScheduleResponse`, con
// `jobsId`), pero la caché y los componentes trabajan con `Schedule`, que lleva el objeto `job`.
import type { Schedule, ScheduleResponse } from '../api/types'
import type { createSeed } from '../mocks/seed'

type Semilla = ReturnType<typeof createSeed>

/** Convierte una programación de la semilla en un `Schedule` con el trabajo de su `jobsId`. */
export function conTrabajo(semilla: Semilla, { jobsId, ...resto }: ScheduleResponse): Schedule {
  const job = semilla.jobs.find((candidato) => candidato.jobsId === jobsId)
  if (!job) throw new Error(`La semilla no tiene el trabajo ${jobsId}`)
  return { ...resto, job }
}

/** Programaciones de la semilla como `Schedule[]`, con su `job`. */
export function programacionesConTrabajo(semilla: Semilla): Schedule[] {
  return semilla.schedules.map((programacion) => conTrabajo(semilla, programacion))
}
