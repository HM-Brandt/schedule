import { addDays } from 'date-fns'
import type { Absence, Employee, EmployeeHours, Job, ScheduleResponse } from '../api/types'
import { getWeekRange, parseIsoDate, toIsoDate } from '../lib/dates'

const JOB_NAMES = [
  'Revisar tejado',
  'Cambiar ventanas',
  'Reparar fuga',
  'Instalar enchufes',
  'Montar estanterías',
  'Limpiar canalones',
  'Pintar oficina',
  'Cambiar cerradura',
  'Revisar caldera',
  'Alicatar baño',
  'Pulir suelo',
  'Instalar lámparas',
  'Reparar persiana',
  'Jardín Pérez',
  'Cambiar grifo',
  'Montar cocina',
  'Revisar cuadro eléctrico',
  'Impermeabilizar terraza',
  'Instalar aire acondicionado',
  'Cambiar puertas',
  'Reparar escalera',
  'Pintar pasillo',
  'Mudanza López',
  'Revisar alarma',
  'Cambiar tuberías',
  'Montar armarios',
  'Reparar valla',
  'Podar jardín',
  'Instalar toldo',
  'Revisar ascensor',
]

export function createSeed(today: Date) {
  const employees: Employee[] = [
    ['Marta', 'Gómez', 'Supervisor'],
    ['Jorge', 'Pérez', 'Labor'],
    ['Ana', 'López', 'Labor'],
    ['Pedro', 'Sánchez', 'Supervisor'],
    ['Luis', 'Martínez', 'Office'],
    ['Elena', 'Díaz', 'Labor'],
    ['Sofía', 'Romero', 'Labor'],
    ['Carlos', 'Ruiz', 'Labor'],
    ['Raúl', 'Torres', 'Labor'],
    ['Lucía', 'Navarro', 'Office'],
  ].map(([firstName, lastName, title], index) => ({
    employeesId: index + 1,
    legalName: `${firstName} ${lastName}`,
    employeeNumber: `E-${index + 1}`,
    firstName,
    lastName,
    status: index < 8 ? 'Active' : 'Terminated',
    title,
    user: 'admin',
  }))
  const jobs: Job[] = JOB_NAMES.map((name, index) => ({
    jobsId: index + 1,
    number: `J-${1018 + index}`,
    type: 'Interior',
    name,
    address: 'Calle Mayor 1',
    contractor: 'Contratista',
    contact: 'Contacto',
    status: index === JOB_NAMES.length - 1 ? 'Done' : 'Open',
    user: 'admin',
  }))
  const sunday = parseIsoDate(getWeekRange(today).from)
  const day = (offset: number) => toIsoDate(addDays(sunday, offset))
  const schedules: ScheduleResponse[] = [
    { jobSchedulesId: 1, jobsId: jobs[6].jobsId, date: day(1), startTime: '07:00', employeesIds: [3, 5], scheduleComment: 'Llevar escalera' },
    { jobSchedulesId: 2, jobsId: jobs[6].jobsId, date: day(1), startTime: '08:00', employeesIds: [3], scheduleComment: null },
    { jobSchedulesId: 3, jobsId: jobs[1].jobsId, date: day(2), startTime: '07:00', employeesIds: [8], scheduleComment: null },
    { jobSchedulesId: 4, jobsId: jobs[11].jobsId, date: day(4), startTime: '09:30', employeesIds: [], scheduleComment: null },
  ]
  const absences: Absence[] = [
    { employeeAbsencesId: 1, employeesId: 7, date: day(3), absenceType: 'Vacation', absenceComment: 'Viaje familiar' },
  ]
  const hours: EmployeeHours[] = [
    { employeesId: 1, name: 'Marta Gómez', totalHrs: 32.5 },
    { employeesId: 2, name: 'Jorge Pérez', totalHrs: 40 },
    { employeesId: 3, name: 'Ana López', totalHrs: 12 },
  ]
  return { employees, jobs, schedules, absences, hours }
}
