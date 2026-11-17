import { delay, http } from 'msw'
import { setupWorker } from 'msw/browser'
import { config } from '../config'
import { createHandlers } from './handlers'
import { createSeed } from './seed'

export const worker = setupWorker(
  http.all('*/v1/*', async () => {
    await delay(config.mockDelay)
  }),
  http.all('*/v2/*', async () => {
    await delay(config.mockDelay)
  }),
  ...createHandlers(createSeed(new Date())),
)
