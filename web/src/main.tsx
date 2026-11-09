import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { LucideProvider } from 'lucide-react'
import './styles/tokens.css'
import './styles/global.css'
import App from './App.tsx'
import { config } from './config'
import { createQueryClient } from './api/queryClient'

if (config.useMocks) {
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass' })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <LucideProvider size={16} strokeWidth={1.75}>
        <App />
      </LucideProvider>
    </QueryClientProvider>
  </StrictMode>,
)
