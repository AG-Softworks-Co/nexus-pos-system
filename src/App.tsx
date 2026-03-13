// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Sales from './pages/Sales';
import NewSale from './pages/NewSale';
import Users from './pages/Users';
import Login from './pages/Login';
import BusinessSetup from './pages/BusinessSetup';
import Negocio from './pages/Negocio';
import Utilities from './pages/Utilities';
import CashClosing from './pages/CashClosing';
import Clients from './pages/Clients';
import Credits from './pages/Credits';
import DeliveryTracking from './pages/DeliveryTracking';
import Configuration from './pages/Configuration';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          {/* Rutas fuera del Layout principal */}
          <Route path="/login" element={<Login />} />
          <Route path="/business-setup" element={<BusinessSetup />} />
          {/* Rutas DENTRO del Layout principal */}
          <Route path="/" element={<Layout />}>
            {/* La ruta raíz (Dashboard) */}
            <Route index element={<Dashboard />} />

            {/* Otras rutas anidadas */}
            <Route path="products" element={<Products />} />
            <Route path="categories" element={<Categories />} />
            <Route path="sales" element={<Sales />} />
            <Route path="new-sale" element={<NewSale />} />
            <Route path="clients" element={<Clients />} />
            <Route path="credits" element={<Credits />} />
            <Route path="delivery-tracking" element={<DeliveryTracking />} />
            <Route path="users" element={<Users />} />
            <Route path="utilities" element={<Utilities />} />
            <Route path="configuration" element={<Configuration />} />
            <Route path="Negocio" element={<Negocio />} />
            <Route path="cash-closing" element={<CashClosing />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="flex items-center justify-center h-screen">
                <h1 className="text-2xl font-semibold text-gray-700">
                  404 - Página no encontrada
                </h1>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App