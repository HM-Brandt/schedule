// El código de `page.evaluate` corre en el navegador: necesita los tipos del DOM,
// que tsconfig.node.json no incluye.
/// <reference lib="dom" />
import { expect, test } from '@playwright/test'

test('la página inicial muestra el título y usa los tokens de estilo', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { level: 1, name: 'Planificación semanal' }),
  ).toBeVisible()

  // `getPropertyValue('--x')` devuelve el texto del CSS (`#f6f7f9`), mientras que
  // `getComputedStyle(body)` devuelve el valor calculado (`rgb(...)`). Para comparar
  // se aplica cada variable a un elemento de prueba y se lee su valor calculado.
  const estilos = await page.evaluate(() => {
    const raiz = getComputedStyle(document.documentElement)
    const body = getComputedStyle(document.body)

    const prueba = document.createElement('div')
    document.body.appendChild(prueba)
    prueba.style.backgroundColor = raiz.getPropertyValue('--color-bg')
    prueba.style.color = raiz.getPropertyValue('--color-text')
    prueba.style.fontFamily = raiz.getPropertyValue('--font-family')
    const esperado = getComputedStyle(prueba)

    const resultado = {
      variables: [
        raiz.getPropertyValue('--color-bg').trim(),
        raiz.getPropertyValue('--color-text').trim(),
        raiz.getPropertyValue('--font-family').trim(),
      ],
      body: {
        backgroundColor: body.backgroundColor,
        color: body.color,
        fontFamily: body.fontFamily,
      },
      tokens: {
        backgroundColor: esperado.backgroundColor,
        color: esperado.color,
        fontFamily: esperado.fontFamily,
      },
    }
    prueba.remove()
    return resultado
  })

  // Si una variable no existiera, el elemento de prueba heredaría el valor del
  // `body` y la comparación pasaría igual: se comprueba antes que las tres existen.
  for (const valor of estilos.variables) {
    expect(valor).not.toBe('')
  }
  expect(estilos.body).toEqual(estilos.tokens)
})
