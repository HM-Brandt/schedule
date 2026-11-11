import type { Employee } from '../api/types'

export function initials(employee: Employee): string {
  return `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase()
}

export function fullName(employee: Employee): string {
  return `${employee.firstName} ${employee.lastName}`
}
