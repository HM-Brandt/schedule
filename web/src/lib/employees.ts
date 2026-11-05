import type { Employee } from '../api/types'

export function initials(employee: Employee): string {
  return `${employee.first_name.charAt(0)}${employee.last_name.charAt(0)}`.toUpperCase()
}

export function fullName(employee: Employee): string {
  return `${employee.first_name} ${employee.last_name}`
}
