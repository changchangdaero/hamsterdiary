// React 애플리케이션을 HTML의 root 요소에 마운트하는 renderer 진입 파일입니다.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
