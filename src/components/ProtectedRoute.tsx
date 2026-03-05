// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Asegúrate que la ruta sea correcta

const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth(); // 'loading' es el de la carga inicial
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg
          className="animate-spin h-10 w-10 text-primary-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p className="mt-4 text-gray-700">Cargando aplicación...</p>
      </div>
    );
  }

  // Si no está cargando y no hay objeto 'user' (falló fetchUserProfile o no hay sesión)
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si el usuario existe pero no tiene negocioId Y NO está intentando configurar el negocio
  if (!user.negocioId && location.pathname !== '/business-setup') {
    return <Navigate to="/business-setup" state={{ from: location }} replace />;
  }

  // Si el usuario YA tiene negocioId pero intenta acceder a /business-setup o /login
  if (
    user.negocioId &&
    (location.pathname === '/business-setup' || location.pathname === '/login')
  ) {
    return <Navigate to="/" replace />;
  }

  // Si el usuario NO tiene negocioId y está en /login (debería ser redirigido por el if anterior, pero como salvaguarda)
  if (!user.negocioId && location.pathname === '/login') {
    return <Navigate to="/business-setup" state={{ from: location }} replace />;
  }

  return <Outlet />; // El usuario está autenticado y en el lugar correcto
};

export default ProtectedRoute;
