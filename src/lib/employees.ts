import type { Employee } from '../api/types'

export function initials(employee: Employee): string {
  return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase()
}

export function fullName(employee: Employee): string {
  return `${employee.firstName} ${employee.lastName}`
}

export function formatHours(hours: number): string {
  return `${Math.round(hours * 10) / 10} h`
}

const TITLE_ORDER = ['supervisor', 'labor']

export function panelEmployees(employees: Employee[]): Employee[] {
  const rank = (employee: Employee) => TITLE_ORDER.indexOf(employee.title.trim().toLowerCase())
  return employees
    .filter((employee) => employee.status === 'Active' && rank(employee) !== -1)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.firstName.localeCompare(b.firstName) ||
        a.lastName.localeCompare(b.lastName),
    )
}
