import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('muestra el título "Planificación semanal" como encabezado principal', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Planificación semanal' }),
    ).toBeInTheDocument()
  })
})
