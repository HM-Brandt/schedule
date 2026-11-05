// Tests de la página inicial (tareas 1.6 y 5.1 de `schedule-assign`).
//
// La fecha del sistema se fija en el martes 2026-11-03 a las 10:00 hora local. Solo se
// simula `Date`: los temporizadores siguen siendo reales para no interferir con React.
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const NOMBRES_DE_DIA = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/

/** Encabezados de los días en el orden del tablero, como `"Sun 1"`, `"Mon 2"`… */
function diasVisibles(): string[] {
  return screen.getAllByText(NOMBRES_DE_DIA).map((nombre) => {
    const texto = (nombre.parentElement as HTMLElement).textContent ?? ''
    return texto.replace(/^([A-Za-z]{3})(\d+)$/, '$1 $2')
  })
}

/** Encabezados de día marcados como día actual. */
function diasResaltados(): HTMLElement[] {
  return screen
    .getAllByText(NOMBRES_DE_DIA)
    .map((nombre) => nombre.parentElement as HTMLElement)
    .filter((encabezado) => encabezado.getAttribute('aria-current') === 'date')
}

const rangoVisible = () => screen.getByRole('heading', { level: 2 })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 3, 10, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('App', () => {
  it('muestra el título "Weekly schedule" como encabezado principal', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Weekly schedule' })).toBeInTheDocument()
  })

  describe('apertura el martes 2026-11-03', () => {
    it('el encabezado indica el rango "Nov 1 - 7, 2026"', () => {
      render(<App />)

      expect(rangoVisible()).toHaveTextContent('Nov 1 - 7, 2026')
    })

    it('muestra los 7 días en orden de domingo 1 a sábado 7', () => {
      render(<App />)

      expect(diasVisibles()).toEqual(['Sun 1', 'Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7'])
    })

    it('resalta solo el martes 3 como día actual', () => {
      render(<App />)

      const resaltados = diasResaltados()
      expect(resaltados).toHaveLength(1)
      expect(within(resaltados[0]).getByText('Tue')).toBeInTheDocument()
      expect(within(resaltados[0]).getByText('3')).toBeInTheDocument()
    })

    it('muestra los botones "Previous week", "Today" y "Next week"', () => {
      render(<App />)

      expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument()
    })
  })

  describe('navegación entre semanas', () => {
    it('"Next week" muestra del domingo 8 al sábado 14 sin ningún día resaltado', () => {
      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))

      expect(rangoVisible()).toHaveTextContent('Nov 8 - 14, 2026')
      expect(diasVisibles()).toEqual(['Sun 8', 'Mon 9', 'Tue 10', 'Wed 11', 'Thu 12', 'Fri 13', 'Sat 14'])
      expect(diasResaltados()).toHaveLength(0)
    })

    it('"Previous week" desde la semana actual muestra "Oct 25 - 31, 2026"', () => {
      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))

      expect(rangoVisible()).toHaveTextContent('Oct 25 - 31, 2026')
      expect(diasVisibles()).toEqual(['Sun 25', 'Mon 26', 'Tue 27', 'Wed 28', 'Thu 29', 'Fri 30', 'Sat 31'])
      expect(diasResaltados()).toHaveLength(0)
    })

    it('"Next week" cuatro veces cruza de mes: "Nov 29 - Dec 5, 2026"', () => {
      render(<App />)
      const siguiente = screen.getByRole('button', { name: 'Next week' })

      for (let vez = 0; vez < 4; vez++) {
        fireEvent.click(siguiente)
      }

      expect(rangoVisible()).toHaveTextContent('Nov 29 - Dec 5, 2026')
    })

    it('"Today" tras ir a la semana siguiente vuelve a "Nov 1 - 7, 2026" con el martes 3 resaltado', () => {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))

      fireEvent.click(screen.getByRole('button', { name: 'Today' }))

      expect(rangoVisible()).toHaveTextContent('Nov 1 - 7, 2026')
      const resaltados = diasResaltados()
      expect(resaltados).toHaveLength(1)
      expect(within(resaltados[0]).getByText('Tue')).toBeInTheDocument()
      expect(within(resaltados[0]).getByText('3')).toBeInTheDocument()
    })

    it('"Today" tras ir a la semana anterior vuelve a "Nov 1 - 7, 2026"', () => {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))

      fireEvent.click(screen.getByRole('button', { name: 'Today' }))

      expect(rangoVisible()).toHaveTextContent('Nov 1 - 7, 2026')
      expect(diasVisibles()).toEqual(['Sun 1', 'Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7'])
    })

    it('"Today" en la semana actual la deja igual', () => {
      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: 'Today' }))

      expect(rangoVisible()).toHaveTextContent('Nov 1 - 7, 2026')
      expect(diasResaltados()).toHaveLength(1)
    })
  })
})
