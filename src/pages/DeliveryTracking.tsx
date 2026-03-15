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
  ChefHat,
  Package,
  Calendar,
  Search,
  RefreshCw,
  Edit,
  Send,
  X
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
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryTracking | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifications, setNotifications] = useState<WhatsAppNotification[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [isUpdating, setIsUpdating] = useState(false);

  const [editData, setEditData] = useState({
    estado_actual: '',
    repartidor_nombre: '',
    repartidor_telefono: '',
    notas_preparacion: '',
    notas_despacho: '',
    notas_entrega: '',
    tiempo_estimado_entrega: ''
  });

  const fetchDeliveryStates = React.useCallback(async () => {
    try {
      const { data, error: statesError } = await supabase
        .from('estados_domicilio')
        .select('*')
        .eq('activo', true)
        .order('orden');

      if (statesError) throw statesError;
      setDeliveryStates(data || []);
    } catch (err: unknown) {
      console.error('Error fetching delivery states:', err);
    }
  }, []);

  const fetchDeliveries = React.useCallback(async () => {
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

      if (statusFilter !== 'all') {
        query = query.eq('estado_actual', statusFilter);
      }

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

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setDeliveries(data || []);
    } catch (err: unknown) {
      console.error('Error fetching deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.negocioId, statusFilter, dateFilter]);

  useEffect(() => {
    if (user?.negocioId) {
      fetchDeliveryStates();
      fetchDeliveries();
    }
  }, [user?.negocioId, fetchDeliveryStates, fetchDeliveries]);

  const fetchNotifications = React.useCallback(async (deliveryId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('notificaciones_whatsapp')
        .select('*')
        .eq('seguimiento_id', deliveryId)
        .order('fecha_envio', { ascending: false });

      if (fetchError) throw fetchError;
      setNotifications(data || []);
    } catch (err: unknown) {
      console.error('Error fetching notifications:', err);
    }
  }, []);

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
    setIsUpdating(true);
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
    } catch (err: unknown) {
      console.error('Error updating delivery:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const sendWhatsAppMessage = async (phone: string, message: string) => {
    const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
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

  const stats = deliveryStates.map(state => ({
    ...state,
    count: deliveries.filter(d => d.estado_actual === state.estado).length
  }));

  if (loading && deliveries.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
      <div className="h-12 w-12 rounded-full border-4 border-primary-100 border-t-primary-600 animate-spin"></div>
      <p className="mt-4 text-slate-500 font-black font-outfit uppercase tracking-tighter">Sincronizando flota...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 pb-20 lg:p-6 lg:pb-8 animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight font-outfit uppercase">Logística de Entrega</h1>
          <p className="text-slate-500 font-medium">Monitoreo en tiempo real de tu operación logística y satisfacción del cliente.</p>
        </div>
        
        <button
          onClick={fetchDeliveries}
          className="group relative inline-flex items-center gap-2 px-6 py-4 bg-white border border-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-slate-900 hover:text-white transition-all active:scale-95"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      {/* Enterprise Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.estado} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 group hover:border-primary-100 transition-all relative overflow-hidden">
             <div 
                className="h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${stat.color_hex}15`, color: stat.color_hex }}
              >
                {getStateIcon(stat.estado)}
              </div>
              <p className="text-xl font-black text-slate-900 font-outfit leading-none">{stat.count}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 truncate">{stat.nombre_display}</p>
              
              <div 
                className="absolute top-0 right-0 h-1 w-full opacity-30"
                style={{ backgroundColor: stat.color_hex }}
              />
          </div>
        ))}
      </div>

      {/* Modern Filter Suite */}
      <div className="bg-white p-3 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            className="w-full pl-14 pr-4 py-4 bg-slate-50 border-none focus:ring-2 focus:ring-primary-500 text-sm font-bold text-slate-700 placeholder:text-slate-400 rounded-[1.5rem] transition-all"
            placeholder="ID de Venta, Cliente o Teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
          <select
            className="bg-slate-50 border-none rounded-2xl py-4 px-6 text-xs font-black uppercase tracking-widest text-slate-600 focus:ring-2 focus:ring-primary-500 cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">TODOS LOS ESTADOS</option>
            {deliveryStates.map(state => (
              <option key={state.estado} value={state.estado}>{state.nombre_display.toUpperCase()}</option>
            ))}
          </select>
          
          <div className="flex bg-slate-50 p-1 rounded-2xl shrink-0">
             {['today', 'week', 'all'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    dateFilter === filter ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {filter === 'today' ? 'Hoy' : filter === 'week' ? 'Semana' : 'Histórico'}
                </button>
             ))}
          </div>
        </div>
      </div>

      {/* Advanced Delivery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredDeliveries.map((delivery) => (
          <div key={delivery.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_8px_25px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_45px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-tighter">Orden</span>
                    <h3 className="text-xl font-black text-slate-900 font-outfit leading-none">#{delivery.venta.id.slice(0, 8)}</h3>
                  </div>
                  <p className="text-sm font-bold text-primary-600 font-outfit">${delivery.venta.total.toLocaleString()}</p>
                </div>
                
                <div 
                  className="px-4 py-2 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg"
                  style={{ backgroundColor: getStateColor(delivery.estado_actual), boxShadow: `0 8px 20px ${getStateColor(delivery.estado_actual)}30` }}
                >
                  {getStateIcon(delivery.estado_actual)}
                  {deliveryStates.find(s => s.estado === delivery.estado_actual)?.nombre_display || delivery.estado_actual}
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-transparent group-hover:border-slate-100 transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Destinatario</p>
                    <p className="text-sm font-black text-slate-800 truncate">{delivery.cliente.nombre_completo}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-slate-50/50 rounded-2xl border border-transparent group-hover:border-slate-100 transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Punto de Entrega</p>
                    <p className="text-sm font-bold text-slate-600 line-clamp-2 leading-snug">{delivery.direccion_entrega.direccion}</p>
                    {delivery.direccion_entrega.referencias && (
                       <p className="text-[10px] font-medium text-slate-400 mt-1 italic">Ref: {delivery.direccion_entrega.referencias}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-transparent group-hover:border-slate-100 transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Solicitado</p>
                    <p className="text-sm font-bold text-slate-800">{formatDisplayDate(delivery.fecha_pedido)}</p>
                  </div>
                  {delivery.tiempo_estimado_entrega && (
                     <div className="text-right">
                       <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Promesa</p>
                       <p className="text-[10px] font-black text-slate-900">{new Date(delivery.tiempo_estimado_entrega).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                     </div>
                  )}
                </div>
              </div>

              {delivery.repartidor_nombre && (
                <div className="mb-6 p-4 bg-primary-50 rounded-3xl border border-primary-100 flex items-center gap-4">
                   <div className="h-10 w-10 rounded-2xl bg-primary-600 flex items-center justify-center text-white">
                      <Truck className="h-5 w-5" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest leading-none mb-1">Transportista</p>
                     <p className="text-sm font-black text-slate-900">{delivery.repartidor_nombre}</p>
                   </div>
                   {delivery.repartidor_telefono && (
                      <button 
                        onClick={() => window.open(`tel:${delivery.repartidor_telefono}`)}
                        className="p-2 text-primary-600 hover:bg-white rounded-xl transition-all"
                      >
                         <Phone className="h-5 w-5" />
                      </button>
                   )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => handleEditDelivery(delivery)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  <Edit className="h-4 w-4" />
                  Actualizar
                </button>
                <button
                  onClick={() => {
                    setSelectedDelivery(delivery);
                    fetchNotifications(delivery.id);
                    setShowNotificationsModal(true);
                  }}
                  className="inline-flex items-center justify-center px-6 py-4 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredDeliveries.length === 0 && (
          <div className="col-span-full py-24 flex flex-col items-center text-center">
            <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Truck className="h-12 w-12 text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-900 font-outfit">Silo Logístico Vacío</h3>
            <p className="text-slate-400 font-medium max-w-xs mt-2 uppercase text-[10px] tracking-widest">No hay movimientos operativos registrados en este periodo.</p>
          </div>
        )}
      </div>

      {/* Modern Status Update Modal */}
      {showEditModal && selectedDelivery && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300 overflow-hidden">
            <div className="p-8 pb-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2 w-2 rounded-full bg-primary-600 animate-pulse" />
                    <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest">Punto de Control Logístico</p>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight font-outfit">
                    Orden #{selectedDelivery.venta.id.slice(0, 8)}
                  </h3>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <X className="h-6 w-6 text-slate-300" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Estado de la Operación</label>
                  <div className="grid grid-cols-2 gap-3">
                     {deliveryStates.map(state => (
                        <button
                          key={state.estado}
                          onClick={() => setEditData({...editData, estado_actual: state.estado})}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                            editData.estado_actual === state.estado 
                            ? 'border-primary-600 bg-primary-50/30' 
                            : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                          }`}
                        >
                           <div 
                              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${state.color_hex}15`, color: state.color_hex }}
                           >
                              {getStateIcon(state.estado)}
                           </div>
                           <span className={`text-[10px] font-black uppercase tracking-tight text-left ${editData.estado_actual === state.estado ? 'text-primary-700' : 'text-slate-500'}`}>
                              {state.nombre_display}
                           </span>
                        </button>
                     ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Repartidor Asignado</label>
                    <input
                      type="text"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-sm"
                      value={editData.repartidor_nombre}
                      onChange={(e) => setEditData({...editData, repartidor_nombre: e.target.value})}
                      placeholder="Nombre del operario"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirmación Promesa</label>
                    <input
                      type="datetime-local"
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-sm"
                      value={editData.tiempo_estimado_entrega}
                      onChange={(e) => setEditData({...editData, tiempo_estimado_entrega: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Bitácora de Eventos (Opcional)</label>
                   <textarea
                     rows={3}
                     className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-sm"
                     value={
                       editData.estado_actual === 'preparando' ? editData.notas_preparacion :
                       editData.estado_actual === 'despachado' ? editData.notas_despacho :
                       editData.notas_entrega
                     }
                     onChange={(e) => {
                       const val = e.target.value;
                       if (editData.estado_actual === 'preparando') setEditData({...editData, notas_preparacion: val});
                       else if (editData.estado_actual === 'despachado') setEditData({...editData, notas_despacho: val});
                       else setEditData({...editData, notas_entrega: val});
                     }}
                     placeholder="Registra incidencias o detalles del cambio de estado..."
                   />
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isUpdating}
                    className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isUpdating ? 'Actualizando...' : 'Confirmar Estado'}
                  </button>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="py-5 px-8 bg-slate-50 text-slate-400 rounded-[2rem] text-sm font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Salir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise Notification Panel */}
      {showNotificationsModal && selectedDelivery && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowNotificationsModal(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-emerald-50/30">
              <div className="flex items-center gap-6">
                 <div className="h-16 w-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-emerald-600">
                    <MessageSquare className="h-8 w-8" />
                 </div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight font-outfit uppercase">Canal WhatsApp</h3>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Gestión de comunicación directa</p>
                 </div>
              </div>
              <button 
                onClick={() => sendWhatsAppMessage(
                  selectedDelivery.cliente.telefono,
                  `Hola ${selectedDelivery.cliente.nombre_completo}, tu pedido #${selectedDelivery.venta.id.slice(0, 8)} está: ${deliveryStates.find(s => s.estado === selectedDelivery.estado_actual)?.nombre_display || selectedDelivery.estado_actual}. Gracias por preferirnos!`
                )}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
              >
                <Send className="h-4 w-4" />
                Enviar Update
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-6 scrollbar-hide">
              {notifications.length === 0 ? (
                <div className="py-20 flex flex-col items-center opacity-30 text-center">
                  <MessageSquare className="h-16 w-16 mb-4" />
                  <p className="font-black uppercase tracking-widest text-[10px]">Sin historial de notificaciones digitales</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div key={notification.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-black text-slate-900">{notification.telefono_destino}</span>
                      <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest ${
                        notification.estado_notificacion === 'enviado' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {notification.estado_notificacion}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-600 border-l-2 border-slate-200 pl-4 py-1 italic">"{notification.mensaje}"</p>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <Calendar className="h-3 w-3" />
                       {formatDisplayDate(notification.fecha_envio)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowNotificationsModal(false)}
                className="px-8 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryTracking;