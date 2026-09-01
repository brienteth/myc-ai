import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { TranslationProvider } from './hooks/useTranslation'

window.getBackendUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const hostParam = params.get('host');
  if (hostParam) return `http://${hostParam}:8420`;
  
  try {
    const storedIp = localStorage.getItem('myca_desktop_ip');
    if (storedIp) return `http://${storedIp}:8420`;
  } catch (e) {}
  
  const isElectron = /Electron/i.test(navigator.userAgent);
  const isFileProtocol = window.location.protocol === 'file:';
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isLocalHost || isElectron || isFileProtocol || !window.location.hostname) {
    return 'http://127.0.0.1:8420';
  }
  
  if (window.location.hostname.includes('mycai.pro') || window.location.hostname.includes('vercel.app')) {
    return window.location.origin;
  }
  
  return `http://${window.location.hostname}:8420`;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TranslationProvider>
      <App />
    </TranslationProvider>
  </StrictMode>,
)
