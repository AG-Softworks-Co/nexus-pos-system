// src/components/Layout.tsx
import React, { useState } from 'react'; // Importar useState
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import NotificationsPanel, { NotificationItem } from './NotificationsPanel';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { subscribeUserToPush } from '../utils/push';

const Layout: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
          .eq('negocio_id', user.negocioId)
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
            createdAt: sale.creada_en || new Date().toISOString(),
            saleId: sale.id
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
    // Request permission and subscribe to push
    if (user && user.negocioId) {
      subscribeUserToPush(user.id, user.negocioId);
    }
    
    // Request permission for native system notifications on component mount
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, [user]);

  // --- Realtime Sales Subscription ---
  React.useEffect(() => {
    if (!user) return; // Only listen if authenticated

    const channel = supabase
      .channel('ventas-alertas') // Un nombre dinámico pero consistente para el canal
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ventas',
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          const eventType = payload.eventType;

          // Filtering by business - Important!
          // For INSERT/UPDATE, we check the new record.
          if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRecord.negocio_id !== user.negocioId) {
            return;
          }

          // For DELETE, we might not have negocio_id unless replica identity is FULL.
          // Fallback: we check if we already have this sale in our local notifications.
          if (eventType === 'DELETE') {
            const saleId = oldRecord.id;
            const exists = notifications.some(n => n.saleId === saleId);
            if (!exists) return; // If we didn't know about it, it's likely not ours or not relevant.
          }

          let title = '';
          let message = '';
          let saleId = (newRecord || oldRecord)?.id;

          const totalFormatted = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
          }).format((newRecord || oldRecord)?.total || 0);

          if (eventType === 'INSERT') {
            if (newRecord.usuario_id === user.id) return; // Don't notify the one who made the sale
            title = '💰 ¡Nueva Venta!';
            message = `Se registró una venta por ${totalFormatted}`;
          } else if (eventType === 'UPDATE') {
            title = '📝 Venta Editada';
            message = `Se actualizó la venta por ${totalFormatted}`;
          } else if (eventType === 'DELETE') {
            title = '🗑️ Venta Eliminada';
            message = `Se eliminó una venta por ${totalFormatted}`;
          }

          // In-App Notification
          const newNotification: NotificationItem = {
            id: `${saleId}-${Date.now()}`,
            title,
            message,
            read: false,
            createdAt: new Date().toISOString(),
            saleId,
            actionType: eventType.toLowerCase() as any
          };
          setNotifications(prev => [newNotification, ...prev]);

          // Toast Alert
          toast.success(message, {
            icon: eventType === 'INSERT' ? '💰' : eventType === 'UPDATE' ? '📝' : '🗑️',
            duration: 5000
          });

          // System Notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: message });
          }
        }
      )
      .subscribe();

    // --- Realtime Cash Register Subscription (Only for Admins/Owners) ---
    const cashChannel = supabase
      .channel('caja-alertas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cierres_caja' },
        (payload) => {
          // If not Owner/Admin, ignore
          if (user.rol !== 'propietario' && user.rol !== 'administrador') return;

          const newRecord = payload.new as any;
          if (newRecord.negocio_id !== user.negocioId) return;

          let title = '';
          let message = '';
          const eventType = payload.eventType;

          if (eventType === 'INSERT') {
            title = '🔐 Caja Abierta';
            message = `Se ha abierto una nueva caja con base de $${(newRecord.monto_apertura || 0).toLocaleString()}`;
          } else if (eventType === 'UPDATE') {
            const oldRecord = payload.old as any;
            if (newRecord.estado === 'completado' && oldRecord.estado === 'pendiente') {
              title = '🔒 Caja Cerrada';
              message = `Se cerró la caja con efectivo real de $${(newRecord.efectivo_contado || 0).toLocaleString()}`;
            } else if (newRecord.estado === 'completado' && oldRecord.estado === 'completado') {
              // This is an edit of a past closure
              title = '📝 Caja Editada';
              message = `Administrador corrigió un cierre. Nuevo efectivo real: $${(newRecord.efectivo_contado || 0).toLocaleString()}`;
            } else {
              return;
            }
          } else {
            return;
          }

          const newNotification: NotificationItem = {
            id: `caja-${newRecord.id}-${Date.now()}`,
            title,
            message,
            read: false,
            createdAt: new Date().toISOString()
          };
          setNotifications(prev => [newNotification, ...prev]);

          toast(message, { icon: eventType === 'INSERT' ? '🔐' : '🔒', duration: 6000 });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: message });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'movimientos_caja' },
        (payload) => {
          // If not Owner/Admin, ignore
          if (user.rol !== 'propietario' && user.rol !== 'administrador') return;

          const newRecord = payload.new as any;
          if (newRecord.negocio_id !== user.negocioId) return;

          const isIngreso = newRecord.tipo === 'ingreso';
          const title = isIngreso ? '💵 Ingreso Extra de Caja' : '💸 Gasto / Egreso de Caja';
          const message = `Se registró un ${newRecord.tipo} por $${newRecord.monto?.toLocaleString()}: ${newRecord.descripcion}`;

          const newNotification: NotificationItem = {
            id: `mov-${newRecord.id}-${Date.now()}`,
            title,
            message,
            read: false,
            createdAt: new Date().toISOString()
          };
          setNotifications(prev => [newNotification, ...prev]);

          toast(message, { icon: isIngreso ? '💵' : '💸', duration: 6000 });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: message });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(cashChannel);
    };
  }, [user, notifications]); // Added notifications to dependency for DELETE filter logic

  const handleNotificationClick = (n: NotificationItem) => {
    // Marcar como leída
    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));

    // Si es una venta, navegar al historial de ventas y resaltar la venta
    if (n.saleId) {
      navigate('/sales', { state: { highlightSaleId: n.saleId } });
      setNotificationsOpen(false);
    }
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

      {/* Panel de Notificaciones */}
      <NotificationsPanel
        open={notificationsOpen}
        setOpen={setNotificationsOpen}
        notifications={notifications}
        markAllAsRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
        onNotificationClick={handleNotificationClick}
      />
    </div>
  );
};

export default Layout;
