import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerLocale, setDefaultLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';

// Register Spanish locale for react-datepicker
registerLocale('es', es);
setDefaultLocale('es');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
