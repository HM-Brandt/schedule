// Tests del diálogo de ausencia (tarea 4.2 de `employee-absences`).
//
// Cubren el requisito "Diálogo de ausencia" de `specs/employee-absences/spec.md`: nombre del
// empleado y día, tipo con `Off` por defecto, comentario opcional, "Save" con el tipo y el
// comentario elegidos y "Cancel" (o Escape) sin cambios.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { empleado } from '../../test/fabricas'
import { AbsenceDialog } from './AbsenceDialog'

const ANA = empleado(3, 'Ana', 'López', 'Labor')
const MARTES = '2026-11-03'

function renderDialogo() {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<AbsenceDialog employee={ANA} date={MARTES} onSave={onSave} onCancel={onCancel} />)
  return { onSave, onCancel }
}

const dialogo = () => screen.getByRole('dialog', { name: 'Mark absence' })
const tipo = (nombre: string) => within(dialogo()).getByRole('radio', { name: nombre })
const campoComentario = () => within(dialogo()).getByLabelText('Comment')

describe('AbsenceDialog', () => {
  it('muestra el título, el nombre del empleado y el día', () => {
    renderDialogo()

    expect(within(dialogo()).getByRole('heading', { name: 'Mark absence' })).toBeInTheDocument()
    expect(within(dialogo()).getByText('Ana López · Tue, Nov 3')).toBeInTheDocument()
  })

  it('ofrece los cuatro tipos en orden y "Off" viene seleccionado por defecto', () => {
    renderDialogo()

    const grupo = within(dialogo()).getByRole('group', { name: 'Type' })
    expect(within(grupo).getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'Off',
      'Vacation',
      'Sick',
      'Other',
    ])
    expect(tipo('Off')).toBeChecked()
    for (const otro of ['Vacation', 'Sick', 'Other']) expect(tipo(otro)).not.toBeChecked()
  })

  it('tiene el campo de comentario vacío y las acciones "Save" y "Cancel"', () => {
    renderDialogo()

    expect(campoComentario()).toHaveValue('')
    expect(within(dialogo()).getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(within(dialogo()).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('elegir un tipo deselecciona el anterior', () => {
    renderDialogo()

    fireEvent.click(tipo('Sick'))

    expect(tipo('Sick')).toBeChecked()
    expect(tipo('Off')).not.toBeChecked()
  })

  it('escenario "Guardar con tipo y comentario": "Vacation" y "Viaje familiar" se guardan tal cual', () => {
    const { onSave, onCancel } = renderDialogo()

    fireEvent.click(tipo('Vacation'))
    fireEvent.change(campoComentario(), { target: { value: 'Viaje familiar' } })
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ absenceType: 'Vacation', absenceComment: 'Viaje familiar' })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('guardar sin tocar nada guarda "Off" sin comentario', () => {
    const { onSave } = renderDialogo()

    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith({ absenceType: 'Off', absenceComment: null })
  })

  it('un comentario vacío o solo con espacios se guarda como null', () => {
    const { onSave } = renderDialogo()

    fireEvent.change(campoComentario(), { target: { value: '   ' } })
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith({ absenceType: 'Off', absenceComment: null })
  })

  it('"Cancel" cierra sin guardar', () => {
    const { onSave, onCancel } = renderDialogo()

    fireEvent.click(tipo('Sick'))
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('Escape cancela sin guardar', () => {
    const { onSave, onCancel } = renderDialogo()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('otras teclas no cancelan', () => {
    const { onCancel } = renderDialogo()

    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'a' })

    expect(onCancel).not.toHaveBeenCalled()
  })
})
