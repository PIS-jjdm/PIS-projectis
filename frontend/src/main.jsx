import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { ThemeModeProvider } from './contexts/ThemeModeContext'
import { theme } from './theme'

const root = ReactDOM.createRoot(document.getElementById('root'))

function FatalScreen({ title, detail }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f4f7fb',
          padding: '24px',
          fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: 'min(900px, 100%)',
            background: '#fff',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
            padding: '24px',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{title}</h1>
          <pre
            style={{
              margin: '16px 0 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowX: 'auto',
              background: '#0f172a',
              color: '#e2e8f0',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            {detail}
          </pre>
        </div>
      </div>
    </ThemeProvider>
  )
}

function renderFatal(title, error) {
  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}${error.stack ? `\n\n${error.stack}` : ''}`
      : String(error)

  root.render(<FatalScreen title={title} detail={detail} />)
}

window.addEventListener('error', (event) => {
  renderFatal('Frontend runtime error', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  renderFatal('Unhandled promise rejection', event.reason)
})

async function bootstrap() {
  try {
    const [{ default: App }, { AuthProvider }] = await Promise.all([
      import('./App'),
      import('./contexts/AuthContext'),
    ])

    root.render(
      <React.StrictMode>
        <ThemeModeProvider>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ThemeModeProvider>
      </React.StrictMode>,
    )
  } catch (error) {
    renderFatal('Frontend bootstrap failed', error)
  }
}

bootstrap()
