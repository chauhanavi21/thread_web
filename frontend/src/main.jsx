import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/instrument-sans';
import '@fontsource/instrument-serif';
import '@fontsource/instrument-serif/400-italic.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { SiteProvider } from './context/SiteContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SiteProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </SiteProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
