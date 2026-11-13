import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { DisplaySettingsProvider } from './context/DisplaySettingsContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <DisplaySettingsProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </DisplaySettingsProvider>
);
