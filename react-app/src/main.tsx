import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { StreetProvider } from '@streetjs/react';
import { createStreetClient } from '@streetjs/client';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './styles/global.css';

// StreetJS client – real backend running on localhost:3001
const client = createStreetClient({ baseUrl: 'http://localhost:3001' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StreetProvider client={client}>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </StreetProvider>
  </StrictMode>,
);
