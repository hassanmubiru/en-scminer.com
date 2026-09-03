import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { StreetProvider } from '@streetjs/react';
import { createStreetClient } from '@streetjs/client';
import { CartProvider } from './context/CartContext';
import App from './App';
import './styles/global.css';

// StreetJS client – real backend running on localhost:3001
const client = createStreetClient({ baseUrl: 'http://localhost:3001' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StreetProvider client={client}>
      <CartProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CartProvider>
    </StreetProvider>
  </StrictMode>,
);
