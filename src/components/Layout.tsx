// src/components/Layout.tsx
import React, { useState } from 'react'; // Importar useState
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import NotificationsPanel from './NotificationsPanel';

const Layout: React.FC = () => {
  const { user, loading } = useAuth();

  // Estado para controlar la visibilidad del sidebar en móvil
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estado para el panel de notificaciones (se mantiene igual)
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Funciones para controlar el sidebar móvil
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // --- Lógica de Autenticación y Carga (sin cambios) ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    // Añadir replace para mejor manejo del historial
    return <Navigate to="/login" replace />;
  }

  // --- Renderizado del Layout ---
  return (
    // Contenedor principal: flex y altura completa, previene scroll general
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar: Pasa el estado `isOpen` y la función `onClose` */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        // Si tenías otras props como onOpenMyBusinessModal, pásalas aquí también
      />

      {/* Overlay: Se muestra detrás del sidebar en móvil cuando está abierto */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" // z-index menor que sidebar (z-40)
          onClick={closeSidebar} // Cierra el sidebar al hacer clic en el overlay
          aria-hidden="true"
        ></div>
      )}

      {/* Contenedor del Header y Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {' '}
        {/* Permite que el header sea fijo y el main haga scroll */}
        {/* Header: Pasa la función `toggleSidebar` */}
        <Header
          onToggleSidebar={toggleSidebar} // Header ahora usa esta función para el botón de menú
          openNotifications={() => setNotificationsOpen(true)} // Mantenemos la lógica de notificaciones
        />
        {/* Contenido Principal: Permite scroll vertical */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 sm:p-6 md:p-8">
          <Outlet /> {/* El contenido de la ruta actual se renderiza aquí */}
        </main>
      </div>

      {/* Panel de Notificaciones (sin cambios) */}
      <NotificationsPanel
        open={notificationsOpen}
        setOpen={setNotificationsOpen}
      />
    </div>
  );
};

export default Layout;
