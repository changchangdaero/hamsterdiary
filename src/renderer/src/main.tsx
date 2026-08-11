// React 애플리케이션을 HTML의 root 요소에 마운트하는 renderer 진입 파일입니다.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const windowName = new URLSearchParams(window.location.search).get('window')
document.documentElement.classList.add(
  windowName === 'pet'
    ? 'pet-document'
    : windowName === 'schedule-diary'
      ? 'schedule-document'
      : windowName === 'settings'
        ? 'settings-document'
        : windowName === 'onboarding'
          ? 'onboarding-document'
          : windowName === 'help'
            ? 'help-document'
        : 'foundation-document'
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
