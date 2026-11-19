// Tests del aspecto de `AbsenceZone` y de su uso sin `ScheduleDndProvider` (requisito "Zona de
// ausencias por día" de `specs/employee-absences/spec.md`): con ausencias recibe la clase `filled`;
// vacía no; sin proveedor no hay aviso y no rompe.
import { DragDropProvider } from '@dnd-kit/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Absence } from '../../api/types'
import { empleado } from '../../test/fabricas'
import { simularApisDeArrastre } from '../../test/dnd'
import { AbsenceZone } from './AbsenceZone'

simularApisDeArrastre()

const LUNES = '2026-11-02'
const ANA = empleado(3, 'Ana', 'López')
const EMPLEADOS = new Map([[ANA.employeesId, ANA]])
const AUSENCIA: Absence = {
  employeeAbsencesId: 1,
  employeesId: 3,
  date: LUNES,
  absenceType: 'Vacation',
  absenceComment: null,
}

function montar(absences: Absence[]) {
  render(
    <DragDropProvider>
      <AbsenceZone date={LUNES} absences={absences} employeesById={EMPLEADOS} />
    </DragDropProvider>,
  )
  return screen.getByText('Absences').parentElement as HTMLElement
}

describe('AbsenceZone: aspecto', () => {
  it('con ausencias recibe la clase "filled"', () => {
    const zona = montar([AUSENCIA])

    expect(zona).toHaveClass(/filled/)
    expect(screen.getByText('Ana López')).toBeInTheDocument()
  })

  it('vacía no recibe la clase "filled" y muestra "No absences"', () => {
    const zona = montar([])

    expect(zona).not.toHaveClass(/filled/)
    expect(screen.getByText('No absences')).toBeInTheDocument()
  })

  it('sin proveedor de arrastre y soltar no hay aviso y no rompe', () => {
    const zona = montar([AUSENCIA])

    expect(zona).not.toHaveClass(/blocked/)
  })
})
