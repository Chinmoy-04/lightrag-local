import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import 'lenis/dist/lenis.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* defaultTheme is a concrete value (not "system") because the installed
        SwitchButton toggle compares `theme === 'dark'` literally; leaving
        the initial resolved theme as the string "system" would make its
        first click a no-op. enableSystem still lets a future toggle add a
        "match OS" option without changing this. */}
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
