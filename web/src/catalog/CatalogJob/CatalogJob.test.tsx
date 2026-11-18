// Tests de un trabajo del catálogo: la segunda línea con la dirección y el texto emergente (`title`).
//
// Cada trabajo muestra en su primera línea el punto de color, el número, el nombre y, si está en
// uso, "xN"; debajo, en letra pequeña y una sola línea, su dirección. Si la dirección viene vacía no
// hay segunda línea. El `title` es "número nombre" y, si hay dirección, la añade en otra línea.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Job } from '../../api/types'
import { trabajo } from '../../test/fabricas'
import { CatalogJob } from './CatalogJob'

const PINTAR: Job = { ...trabajo(7, 'J-1024', 'Pintar oficina'), address: 'Calle Mayor 1, Madrid' }
const SIN_DIRECCION: Job = { ...PINTAR, address: '' }

function renderTrabajo(job: Job, count = 0) {
  render(
    <ul>
      <CatalogJob job={job} count={count} />
    </ul>,
  )
  return screen.getByRole('listitem')
}

/** `true` si `a` aparece antes que `b` en el documento. */
const antesQue = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('CatalogJob', () => {
  describe('dirección', () => {
    it('muestra la dirección del trabajo en su propio elemento', () => {
      const elemento = renderTrabajo(PINTAR)

      expect(within(elemento).getByText('Calle Mayor 1, Madrid')).toBeInTheDocument()
    })

    it('la dirección va después del número y el nombre', () => {
      const elemento = renderTrabajo(PINTAR)

      const numero = within(elemento).getByText('J-1024')
      const nombre = within(elemento).getByText('Pintar oficina')
      const direccion = within(elemento).getByText('Calle Mayor 1, Madrid')
      expect(antesQue(numero, nombre)).toBe(true)
      expect(antesQue(nombre, direccion)).toBe(true)
    })

    it('en un trabajo en uso la dirección va después del contador "x2"', () => {
      const elemento = renderTrabajo(PINTAR, 2)

      const contador = within(elemento).getByText('x2')
      const direccion = within(elemento).getByText('Calle Mayor 1, Madrid')
      expect(antesQue(contador, direccion)).toBe(true)
      expect(elemento).toHaveAttribute('data-in-use', 'true')
    })

    it('no muestra la segunda línea si la dirección viene vacía', () => {
      const elemento = renderTrabajo(SIN_DIRECCION)

      expect(within(elemento).getByText('J-1024')).toBeInTheDocument()
      expect(within(elemento).getByText('Pintar oficina')).toBeInTheDocument()
      // Solo quedan el número y el nombre: ningún elemento vacío en lugar de la dirección.
      expect(elemento.children).toHaveLength(2)
      expect(elemento).toHaveTextContent(/^J-1024Pintar oficina$/)
    })

    it('con la dirección vacía y en uso solo muestra número, nombre y contador', () => {
      const elemento = renderTrabajo(SIN_DIRECCION, 3)

      expect(elemento.children).toHaveLength(3)
      expect(elemento).toHaveTextContent(/^J-1024Pintar oficinax3$/)
    })
  })

  describe('texto emergente (title)', () => {
    it('con dirección es "número nombre" y la dirección en otra línea', () => {
      const elemento = renderTrabajo(PINTAR)

      expect(elemento).toHaveAttribute('title', 'J-1024 Pintar oficina\nCalle Mayor 1, Madrid')
    })

    it('sin dirección es solo "número nombre", sin salto de línea', () => {
      const elemento = renderTrabajo(SIN_DIRECCION)

      expect(elemento).toHaveAttribute('title', 'J-1024 Pintar oficina')
    })

    it('el contador de uso no entra en el texto emergente', () => {
      const elemento = renderTrabajo(PINTAR, 2)

      expect(elemento).toHaveAttribute('title', 'J-1024 Pintar oficina\nCalle Mayor 1, Madrid')
    })
  })
})
