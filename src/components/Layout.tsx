// src/components/Layout.tsx
import React, { useState } from 'react'; // Importar useState
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import NotificationsPanel, { NotificationItem } from './NotificationsPanel';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const Layout: React.FC = () => {
  const { user, loading } = useAuth();

  // Estado para controlar la visibilidad del sidebar en móvil
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estado para el panel de notificaciones
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Funciones para controlar el sidebar móvil
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // --- Backfill Notifications (fetch recent sales) ---
  React.useEffect(() => {
    if (!user) return;

    const fetchRecentSales = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from('ventas')
          .select('*')
          .gte('creada_en', today.toISOString())
          .order('creada_en', { ascending: false })
          .limit(10);

        if (error) throw error;

        if (data) {
          const historicalNotifications: NotificationItem[] = data.map(sale => ({
            id: sale.id || Date.now().toString(),
            title: '💰 Venta Registrada',
            message: `Se registró una venta por ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(sale.total || 0)}.`,
            read: true,
            createdAt: sale.creada_en || new Date().toISOString()
          }));

          setNotifications(historicalNotifications);
        }
      } catch (err) {
        console.error('Error fetching recent sales for notifications', err);
      }
    };

    fetchRecentSales();
  }, [user]);

  // --- Realtime Notifications Request ---
  React.useEffect(() => {
    // Request permission for native system notifications on component mount
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  // --- Realtime Sales Subscription ---
  React.useEffect(() => {
    if (!user) return; // Only listen if authenticated

    const channel = supabase
      .channel('ventas-alertas') // Un nombre dinámico pero consistente para el canal
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ventas',
        },
        (payload) => {
          const newSale = payload.new as any;

          // No notificar al mismo cajero que acaba de hacer la venta en ESTE equipo
          if (newSale.cajero_id === user.id) return;

          // Construct the notification message
          const totalFormatted = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
          }).format(newSale.total || 0);

          const message = `Se registró una venta por ${totalFormatted}`;
          const title = '💰 ¡Nueva Venta!';

          // Agregar al historial del panel
          const newNotification: NotificationItem = {
            id: newSale.id || Date.now().toString(),
            title,
            message,
            read: false,
            createdAt: new Date().toISOString()
          };
          setNotifications(prev => [newNotification, ...prev]);

          // 1. Show In-App Toast
          toast.success(message, {
            duration: 6000,
            position: 'top-right',
            icon: '🔔',
            style: {
              background: '#fff',
              color: '#1f2937',
              fontWeight: '500',
              border: '1px solid #e5e7eb',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            },
          });

          // 2. Trigger System/Mobile Push Notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body: message,
                icon: '/nexus-icon.png' // Assuming you have a PWA icon here
              });
            } catch (e) {
              console.error('Error triggering push notification', e);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

      {/* Panel de Notificaciones */}
      <NotificationsPanel
        open={notificationsOpen}
        setOpen={setNotificationsOpen}
        notifications={notifications}
        markAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
      />
    </div>
  );
};

export default Layout;
