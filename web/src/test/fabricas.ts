// Fábricas de datos de prueba con la forma del backend (`Employee` y `Job` de `api/types.ts`).
//
// Los campos que los tests no miran (`legalName`, `employeeNumber`, `type`, `address`...) se
// rellenan con valores fijos para no repetirlos en cada test.
import type { Employee, EmployeeStatus, Job } from '../api/types'

/** Empleado con id, nombre, apellido, cargo y estado (`Active` por defecto). */
export function empleado(
  employeesId: number,
  firstName: string,
  lastName: string,
  title = 'Ayudante',
  status: EmployeeStatus = 'Active',
): Employee {
  return {
    employeesId,
    legalName: `${firstName} ${lastName}`,
    employeeNumber: `E-${employeesId}`,
    firstName,
    lastName,
    status,
    title,
    user: 'admin',
  }
}

/** Trabajo del catálogo con id, número y nombre; `status` es `Open` salvo que se indique otro. */
export function trabajo(jobsId: number, number: string, name: string, status = 'Open'): Job {
  return {
    jobsId,
    number,
    type: 'Interior',
    name,
    address: 'Calle Mayor 1',
    contractor: 'Contratista',
    contact: 'Contacto',
    status,
    user: 'admin',
  }
}
