import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Phone, 
  MapPin, 
  User, 
  MessageSquare,
  Star,
  Package,
  ChefHat,
  Navigation,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  Edit,
  Send
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDisplayDate } from '../utils/dateUtils';

interface DeliveryTracking {
  id: string;
  venta_id: string;
  estado_actual: string;
  cliente: {
    nombre_completo: string;
    telefono: string;
  };
  direccion_entrega: {
    direccion: string;
    referencias: string;
  };
  venta: {
    id: string;
    total: number;
    creada_en: string;
  };
  repartidor_nombre: string;
  repartidor_telefono: string;
  fecha_pedido: string;
  fecha_preparacion: string;
  fecha_listo: string;
  fecha_despacho: string;
  fecha_entrega: string;
  tiempo_estimado_entrega: string;
  notas_preparacion: string;
  notas_despacho: string;
  notas_entrega: string;
  calificacion: number;
  comentario_cliente: string;
}

interface DeliveryState {
  estado: string;
  nombre_display: string;
  color_hex: string;
  orden: number;
}

interface WhatsAppNotification {
  id: string;
  telefono_destino: string;
  mensaje: string;
  estado_notificacion: string;
  fecha_envio: string;
}

const DeliveryTracking: React.FC = () => {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryTracking[]>([]);
  const [deliveryStates, setDeliveryStates] = useState<DeliveryState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryTracking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');

  const [editData, setEditData] = useState({
    estado_actual: '',
    repartidor_nombre: '',
    repartidor_telefono: '',
    notas_preparacion: '',
    notas_despacho: '',
    notas_entrega: '',
    tiempo_estimado_entrega: ''
  });

  useEffect(() => {
    if (user?.negocioId) {
      fetchDeliveryStates();
      fetchDeliveries();
    }
  }, [user, statusFilter, dateFilter]);

  const fetchDeliveryStates = async () => {
    try {
      const { data, error } = await supabase
        .from('estados_domicilio')
        .select('*')
        .eq('activo', true)
        .order('orden');

      if (error) throw error;
      setDeliveryStates(data || []);
    } catch (err: any) {
      console.error('Error fetching delivery states:', err);
      setError('Error al cargar estados de domicilio');
    }
  };

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('seguimiento_domicilios')
        .select(`
          *,
          cliente:cliente_id (
            nombre_completo,
            telefono
          ),
          direccion_entrega:direccion_entrega_id (
            direccion,
            referencias
          ),
          venta:venta_id (
            id,
            total,
            creada_en
          )
        `)
        .eq('negocio_id', user?.negocioId);

      // Filtro por estado
      if (statusFilter !== 'all') {
        query = query.eq('estado_actual', statusFilter);
      }

      // Filtro por fecha
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dateFilter === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        query = query.gte('fecha_pedido', today.toISOString())
                    .lt('fecha_pedido', tomorrow.toISOString());
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('fecha_pedido', weekAgo.toISOString());
      }

      query = query.order('fecha_pedido', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setDeliveries(data || []);
    } catch (err: any) {
      console.error('Error fetching deliveries:', err);
      setError('Error al cargar domicilios');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async (deliveryId: string) => {
    try {
      const { data, error } = await supabase
        .from('notificaciones_whatsapp')
        .select('*')
        .eq('seguimiento_id', deliveryId)
        .order('fecha_envio', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError('Error al cargar notificaciones');
    }
  };

  const updateDeliveryStatus = async (deliveryId: string, newStatus: string, notes?: string) => {
    try {
      const updateData: any = {
        estado_actual: newStatus,
        actualizado_en: new Date().toISOString()
      };

      // Agregar notas según el estado
      if (notes) {
        switch (newStatus) {
          case 'preparando':
            updateData.notas_preparacion = notes;
            break;
          case 'despachado':
            updateData.notas_despacho = notes;
            break;
          case 'entregado':
            updateData.notas_entrega = notes;
            break;
        }
      }

      const { error } = await supabase
        .from('seguimiento_domicilios')
        .update(updateData)
        .eq('id', deliveryId);

      if (error) throw error;

      await fetchDeliveries();
      setShowEditModal(false);
    } catch (err: any) {
      console.error('Error updating delivery status:', err);
      setError('Error al actualizar estado del domicilio');
    }
  };

  const sendWhatsAppMessage = async (phone: string, message: string) => {
    // En producción, aquí integrarías con la API de WhatsApp
    const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEditDelivery = (delivery: DeliveryTracking) => {
    setSelectedDelivery(delivery);
    setEditData({
      estado_actual: delivery.estado_actual,
      repartidor_nombre: delivery.repartidor_nombre || '',
      repartidor_telefono: delivery.repartidor_telefono || '',
      notas_preparacion: delivery.notas_preparacion || '',
      notas_despacho: delivery.notas_despacho || '',
      notas_entrega: delivery.notas_entrega || '',
      tiempo_estimado_entrega: delivery.tiempo_estimado_entrega ? 
        new Date(delivery.tiempo_estimado_entrega).toISOString().slice(0, 16) : ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDelivery) return;

    try {
      const { error } = await supabase
        .from('seguimiento_domicilios')
        .update({
          estado_actual: editData.estado_actual,
          repartidor_nombre: editData.repartidor_nombre || null,
          repartidor_telefono: editData.repartidor_telefono || null,
          notas_preparacion: editData.notas_preparacion || null,
          notas_despacho: editData.notas_despacho || null,
          notas_entrega: editData.notas_entrega || null,
          tiempo_estimado_entrega: editData.tiempo_estimado_entrega ? 
            new Date(editData.tiempo_estimado_entrega).toISOString() : null,
          actualizado_en: new Date().toISOString()
        })
        .eq('id', selectedDelivery.id);

      if (error) throw error;

      await fetchDeliveries();
      setShowEditModal(false);
    } catch (err: any) {
      console.error('Error updating delivery:', err);
      setError('Error al actualizar domicilio');
    }
  };

  const getStateColor = (estado: string) => {
    const state = deliveryStates.find(s => s.estado === estado);
    return state?.color_hex || '#6B7280';
  };

  const getStateIcon = (estado: string) => {
    switch (estado) {
      case 'pendiente': return <Clock className="h-5 w-5" />;
      case 'preparando': return <ChefHat className="h-5 w-5" />;
      case 'listo': return <Package className="h-5 w-5" />;
      case 'despachado': return <Truck className="h-5 w-5" />;
      case 'entregado': return <CheckCircle className="h-5 w-5" />;
      case 'cancelado': return <AlertCircle className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesSearch = !searchQuery || 
      delivery.cliente.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.venta.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.cliente.telefono?.includes(searchQuery);
    
    return matchesSearch;
  });

  const getStatusStats = () => {
    const stats = deliveryStates.map(state => ({
      ...state,
      count: deliveries.filter(d => d.estado_actual === state.estado).length
    }));
    return stats;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando seguimiento de domicilios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Seguimiento de Domicilios</h1>
        <button
          onClick={fetchDeliveries}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {getStatusStats().map((stat) => (
          <div key={stat.estado} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div 
                className="p-2 rounded-md"
                style={{ backgroundColor: `${stat.color_hex}20`, color: stat.color_hex }}
              >
                {getStateIcon(stat.estado)}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">{stat.nombre_display}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="Buscar por cliente, teléfono o ID de venta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <select
              className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              {deliveryStates.map(state => (
                <option key={state.estado} value={state.estado}>
                  {state.nombre_display}
                </option>
              ))}
            </select>
            
            <select
              className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="today">Hoy</option>
              <option value="week">Esta semana</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deliveries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDeliveries.map((delivery) => (
          <div key={delivery.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    #{delivery.venta.id.slice(0, 8)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    ${delivery.venta.total.toLocaleString()}
                  </p>
                </div>
                <span 
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: getStateColor(delivery.estado_actual) }}
                >
                  {getStateIcon(delivery.estado_actual)}
                  <span className="ml-1">
                    {deliveryStates.find(s => s.estado === delivery.estado_actual)?.nombre_display || delivery.estado_actual}
                  </span>
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <User className="h-4 w-4 mr-2" />
                  {delivery.cliente.nombre_completo}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {delivery.cliente.telefono}
                </div>
                <div className="flex items-start text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2 mt-0.5" />
                  <span className="line-clamp-2">{delivery.direccion_entrega.direccion}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  {formatDisplayDate(delivery.fecha_pedido)}
                </div>
              </div>

              {delivery.repartidor_nombre && (
                <div className="mb-4 p-2 bg-blue-50 rounded-md">
                  <p className="text-sm font-medium text-blue-900">
                    Repartidor: {delivery.repartidor_nombre}
                  </p>
                  {delivery.repartidor_telefono && (
                    <p className="text-xs text-blue-700">{delivery.repartidor_telefono}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleEditDelivery(delivery)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    setSelectedDelivery(delivery);
                    fetchNotifications(delivery.id);
                    setShowNotificationsModal(true);
                  }}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-green-300 shadow-sm text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredDeliveries.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No hay domicilios</h3>
            <p className="text-sm text-gray-500 mt-1">
              No se encontraron domicilios con los filtros seleccionados.
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedDelivery && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowEditModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Editar Domicilio #{selectedDelivery.venta.id.slice(0, 8)}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Estado</label>
                    <select
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      value={editData.estado_actual}
                      onChange={(e) => setEditData({...editData, estado_actual: e.target.value})}
                    >
                      {deliveryStates.map(state => (
                        <option key={state.estado} value={state.estado}>
                          {state.nombre_display}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Repartidor</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={editData.repartidor_nombre}
                        onChange={(e) => setEditData({...editData, repartidor_nombre: e.target.value})}
                        placeholder="Nombre del repartidor"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                      <input
                        type="tel"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={editData.repartidor_telefono}
                        onChange={(e) => setEditData({...editData, repartidor_telefono: e.target.value})}
                        placeholder="Teléfono del repartidor"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tiempo estimado de entrega</label>
                    <input
                      type="datetime-local"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      value={editData.tiempo_estimado_entrega}
                      onChange={(e) => setEditData({...editData, tiempo_estimado_entrega: e.target.value})}
                    />
                  </div>

                  {editData.estado_actual === 'preparando' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notas de preparación</label>
                      <textarea
                        rows={3}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={editData.notas_preparacion}
                        onChange={(e) => setEditData({...editData, notas_preparacion: e.target.value})}
                        placeholder="Notas sobre la preparación..."
                      />
                    </div>
                  )}

                  {editData.estado_actual === 'despachado' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notas de despacho</label>
                      <textarea
                        rows={3}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={editData.notas_despacho}
                        onChange={(e) => setEditData({...editData, notas_despacho: e.target.value})}
                        placeholder="Notas sobre el despacho..."
                      />
                    </div>
                  )}

                  {editData.estado_actual === 'entregado' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notas de entrega</label>
                      <textarea
                        rows={3}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        value={editData.notas_entrega}
                        onChange={(e) => setEditData({...editData, notas_entrega: e.target.value})}
                        placeholder="Notas sobre la entrega..."
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleSaveEdit}
                >
                  Guardar Cambios
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Notifications Modal */}
      {showNotificationsModal && selectedDelivery && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowNotificationsModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Notificaciones WhatsApp - {selectedDelivery.cliente.nombre_completo}
                  </h3>
                  <button
                    onClick={() => sendWhatsAppMessage(
                      selectedDelivery.cliente.telefono,
                      `Hola ${selectedDelivery.cliente.nombre_completo}, tu pedido #${selectedDelivery.venta.id.slice(0, 8)} está siendo procesado.`
                    )}
                    className="inline-flex items-center px-3 py-2 border border-green-300 shadow-sm text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Enviar Mensaje
                  </button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No hay notificaciones enviadas</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div key={notification.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {notification.telefono_destino}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            notification.estado_notificacion === 'enviado' ? 'bg-green-100 text-green-800' :
                            notification.estado_notificacion === 'fallido' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {notification.estado_notificacion}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{notification.mensaje}</p>
                        <p className="text-xs text-gray-500">
                          {formatDisplayDate(notification.fecha_envio)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowNotificationsModal(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryTracking;