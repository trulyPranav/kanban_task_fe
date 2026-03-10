import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CurrentUserProvider } from './contexts/CurrentUserContext.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CurrentUserProvider>
        <App />
      </CurrentUserProvider>
    </ErrorBoundary>
  </StrictMode>,
)
