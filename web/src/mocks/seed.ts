import { addDays } from 'date-fns'
import type { Employee, Job, Schedule } from '../api/types'
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
    { id: 1, first_name: 'Marta', last_name: 'Gómez', title: 'Encargada', status: 'activo' },
    { id: 2, first_name: 'Jorge', last_name: 'Pérez', title: 'Fontanero', status: 'activo' },
    { id: 3, first_name: 'Ana', last_name: 'López', title: 'Pintora', status: 'activo' },
    { id: 4, first_name: 'Pedro', last_name: 'Sánchez', title: 'Albañil', status: 'activo' },
    { id: 5, first_name: 'Luis', last_name: 'Martínez', title: 'Electricista', status: 'activo' },
    { id: 6, first_name: 'Elena', last_name: 'Díaz', title: 'Carpintera', status: 'activo' },
    { id: 7, first_name: 'Sofía', last_name: 'Romero', title: 'Pintora', status: 'activo' },
    { id: 8, first_name: 'Carlos', last_name: 'Ruiz', title: 'Ayudante', status: 'activo' },
    { id: 9, first_name: 'Raúl', last_name: 'Torres', title: 'Fontanero', status: 'inactivo' },
    { id: 10, first_name: 'Lucía', last_name: 'Navarro', title: 'Ayudante', status: 'inactivo' },
  ]
  const jobs: Job[] = JOB_NAMES.map((name, index) => ({
    id: index + 1,
    number: `J-${1018 + index}`,
    name,
  }))
  const sunday = parseIsoDate(getWeekRange(today).from)
  const day = (offset: number) => toIsoDate(addDays(sunday, offset))
  const schedules: Schedule[] = [
    { id: 1, job: jobs[6], date: day(1), start_time: '07:00', employee_ids: [3, 5] },
    { id: 2, job: jobs[6], date: day(1), start_time: '08:00', employee_ids: [3] },
    { id: 3, job: jobs[1], date: day(2), start_time: '07:00', employee_ids: [8] },
    { id: 4, job: jobs[11], date: day(4), start_time: '09:30', employee_ids: [] },
  ]
  return { employees, jobs, schedules }
}
