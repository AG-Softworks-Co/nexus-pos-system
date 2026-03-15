import React, { useState, useEffect } from 'react';
import { Search, User, Phone, Mail, MapPin, Calendar, ShoppingCart, CreditCard, Edit, ArrowRight, UserPlus, Users, Wallet, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDisplayDate } from '../utils/dateUtils';

interface Client {
  id: string;
  nombre_completo: string;
  telefono: string | null;
  correo: string | null;
  direccion?: string | null;
  creado_en: string;
  total_ventas?: number;
  total_credito?: number;
  ultima_venta?: string;
}

interface ClientSale {
  id: string;
  creada_en: string;
  total: number;
  metodo_pago: string;
  estado: string;
  estado_pago?: string;
  saldo_pendiente?: number;
}

const Clients: React.FC = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSales, setClientSales] = useState<ClientSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    nombre_completo: '',
    telefono: '',
    correo: '',
    direccion: ''
  });

  const fetchClients = React.useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('clientes')
        .select(`
          *,
          ventas:ventas(count),
          ventas_totales:ventas(total),
          ventas_credito:ventas(total, saldo_pendiente)
        `)
        .eq('negocio_id', user?.negocioId)
        .order('creado_en', { ascending: false });

      if (fetchError) throw fetchError;

      const processedClients = data?.map(client => ({
        ...client,
        total_ventas: (client.ventas_totales as unknown as { total: number }[])?.reduce((sum: number, venta) => sum + venta.total, 0) || 0,
        total_credito: (client.ventas_credito as unknown as { saldo_pendiente: number }[])?.reduce((sum: number, venta) => sum + (venta.saldo_pendiente || 0), 0) || 0,
        ultima_venta: client.ventas_totales?.[0]?.creada_en
      })) || [];

      setClients(processedClients);
    } catch (err: unknown) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.negocioId]);

  const fetchClientSales = React.useCallback(async (clientId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('ventas')
        .select('id, creada_en, total, metodo_pago, estado, estado_pago, saldo_pendiente')
        .eq('cliente_id', clientId)
        .order('creada_en', { ascending: false });

      if (fetchError) throw fetchError;
      setClientSales(data || []);
    } catch (err: unknown) {
      console.error('Error fetching client sales:', err);
    }
  }, []);

  useEffect(() => {
    if (user?.negocioId) {
      fetchClients();
    }
  }, [user?.negocioId, fetchClients]);



  const handleViewSales = async (client: Client) => {
    setSelectedClient(client);
    await fetchClientSales(client.id);
    setShowSalesModal(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      nombre_completo: client.nombre_completo,
      telefono: client.telefono || '',
      correo: client.correo || '',
      direccion: client.direccion || ''
    });
    setShowClientModal(true);
  };

  const handleAddNew = () => {
    setEditingClient(null);
    setFormData({
      nombre_completo: '',
      telefono: '',
      correo: '',
      direccion: ''
    });
    setShowClientModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const clientData = {
        nombre_completo: formData.nombre_completo,
        telefono: formData.telefono || null,
        correo: formData.correo || null,
        direccion: formData.direccion || null,
        negocio_id: user?.negocioId
      };

      if (editingClient) {
        const { error } = await supabase
          .from('clientes')
          .update(clientData)
          .eq('id', editingClient.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([clientData]);

        if (error) throw error;
      }

      await fetchClients();
      setShowClientModal(false);
      setFormData({ nombre_completo: '', telefono: '', correo: '', direccion: '' });
    } catch (err: unknown) {
      console.error('Error submitting client:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.telefono?.includes(searchQuery) ||
    client.correo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: clients.length,
    withDebt: clients.filter(c => (c.total_credito || 0) > 0).length,
    topSpender: clients.reduce((prev, current) => ((prev.total_ventas || 0) > (current.total_ventas || 0) ? prev : current), clients[0] || {} as Client)
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
      <div className="h-12 w-12 rounded-full border-4 border-primary-100 border-t-primary-600 animate-spin"></div>
      <p className="mt-4 text-slate-500 font-medium font-outfit">Sincronizando base de clientes...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 pb-20 lg:p-6 lg:pb-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight font-outfit">Directorio de Clientes</h1>
          <p className="text-slate-500 font-medium">Gestiona tu base de clientes y su historial comercial con precisión.</p>
        </div>
        
        <button
          className="group relative inline-flex items-center gap-2 px-6 py-4 bg-primary-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-primary-200 hover:bg-primary-700 transition-all hover:scale-[1.02] active:scale-95"
          onClick={handleAddNew}
        >
          <UserPlus className="h-5 w-5" />
          Nuevo Cliente
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
          </span>
        </button>
      </div>

      {/* Enterprise Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Users className="h-24 w-24 text-slate-900" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Base de Datos</p>
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.total} <span className="text-sm font-bold text-slate-400">Registros</span></p>
          <p className="text-xs text-slate-400 mt-2 font-medium">Clientes activos en tu ecosistema</p>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Wallet className="h-24 w-24 text-rose-600" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
              <Wallet className="h-6 w-6" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cuentas por Cobrar</p>
          </div>
          <p className="text-3xl font-black text-rose-600">{stats.withDebt} <span className="text-sm font-bold text-slate-400">Deudores</span></p>
          <p className="text-xs text-rose-400 mt-2 font-semibold">Requiere gestión de cobranza</p>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative group sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <CreditCard className="h-24 w-24 text-emerald-600" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CreditCard className="h-6 w-6" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cliente Estrella</p>
          </div>
          <p className="text-sm font-black text-slate-900 truncate leading-tight">{stats.topSpender.nombre_completo || 'N/A'}</p>
          <p className="text-xs text-emerald-600 mt-1 font-bold">${(stats.topSpender.total_ventas || 0).toLocaleString()} en compras</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-3xl shadow-sm border border-slate-100 flex items-center relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
        <input
          type="text"
          className="w-full pl-14 pr-4 py-4 bg-slate-50 md:bg-white border-none focus:ring-0 text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium rounded-2xl transition-all"
          placeholder="Busca por nombre, teléfono o correo de identificación..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <div key={client.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_8px_25px_rgb(0,0,0,0.02)] hover:shadow-[0_15px_35px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 p-8 flex flex-col group">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-[1.25rem] bg-slate-900 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-slate-200">
                  {client.nombre_completo.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-primary-600 transition-colors">{client.nombre_completo}</h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Desde {new Date(client.creado_en).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEditClient(client)}
                  className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                  title="Editar Perfil"
                >
                  <Edit className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl group/link cursor-default">
                <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                  <Phone className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold text-slate-600">{client.telefono || 'Sin teléfono'}</span>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl">
                <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                  <Mail className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold text-slate-600 truncate">{client.correo || 'Sin correo electrónico'}</span>
              </div>

              {client.direccion && (
                <div className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-2xl">
                  <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 flex-shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-600 line-clamp-1">{client.direccion}</span>
                </div>
              )}
            </div>

            <div className="mt-auto grid grid-cols-2 gap-4 border-t border-slate-50 pt-6">
              <div className="p-4 bg-slate-50 rounded-3xl relative overflow-hidden">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Compras Totales</p>
                <p className="text-lg font-black text-slate-900">${client.total_ventas?.toLocaleString() || 0}</p>
                <div className="absolute -bottom-2 -right-2 opacity-[0.05]">
                  <ShoppingCart className="h-10 w-10 text-slate-900" />
                </div>
              </div>
              <div className={`p-4 rounded-3xl relative overflow-hidden ${ (client.total_credito || 0) > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                <p className={`text-[10px] font-black uppercase mb-1 ${ (client.total_credito || 0) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>Saldo Pendiente</p>
                <p className={`text-lg font-black ${ (client.total_credito || 0) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>${client.total_credito?.toLocaleString() || 0}</p>
                <div className="absolute -bottom-2 -right-2 opacity-[0.05]">
                  <CreditCard className={`h-10 w-10 ${ (client.total_credito || 0) > 0 ? 'text-rose-600' : 'text-slate-900'}`} />
                </div>
              </div>
            </div>

            <button
              onClick={() => handleViewSales(client)}
              className="mt-6 w-full flex items-center justify-between px-6 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98]"
            >
              Historial Comercial
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}

        {filteredClients.length === 0 && (
          <div className="col-span-full py-24 flex flex-col items-center text-center">
            <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <User className="h-12 w-12 text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-900">Operación sin resultados</h3>
            <p className="text-slate-400 font-medium max-w-xs mt-2">No hemos encontrado clientes que coincidan con los criterios de búsqueda actuales.</p>
          </div>
        )}
      </div>

      {/* Client Edit/Add Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowClientModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300 overflow-hidden">
            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                    {editingClient ? 'Ajustar Perfil' : 'Registro Maestro'}
                  </h3>
                  <p className="text-slate-500 font-medium mt-1">Completa la ficha técnica del cliente comercial.</p>
                </div>
                <button onClick={() => setShowClientModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <X className="h-6 w-6 text-slate-300" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre Completo <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                    <input
                      type="text"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-[1.5rem] font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-sm"
                      value={formData.nombre_completo}
                      onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})}
                      required
                      placeholder="Ej. Andres Olivarez"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Teléfono Móvil</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                      <input
                        type="tel"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-[1.5rem] font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-sm"
                        value={formData.telefono}
                        onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                        placeholder="300 000 0000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Corporativo</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                      <input
                        type="email"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-[1.5rem] font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-sm"
                        value={formData.correo}
                        onChange={(e) => setFormData({...formData, correo: e.target.value})}
                        placeholder="cliente@dominio.com"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Dirección de Entrega</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 h-5 w-5 text-slate-300" />
                    <textarea
                      rows={2}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-[1.5rem] font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-sm"
                      value={formData.direccion}
                      onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                      placeholder="Dirección completa, barrio y ciudad..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                   <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Sincronizando...' : editingClient ? 'Guardar Cambios' : 'Finalizar Registro'}
                  </button>
                  <button
                    type="button"
                    className="py-5 px-8 bg-slate-50 text-slate-400 rounded-[2rem] text-sm font-black uppercase tracking-widest hover:bg-slate-100 transition-all font-outfit"
                    onClick={() => setShowClientModal(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Sales History Modal (Timeline Look) */}
      {showSalesModal && selectedClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSalesModal(false)} />
          <div className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-6">
                 <div className="h-20 w-20 rounded-[1.5rem] bg-white shadow-xl flex items-center justify-center text-primary-600 font-black text-3xl font-outfit">
                    {selectedClient.nombre_completo.charAt(0)}
                 </div>
                 <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">{selectedClient.nombre_completo}</h3>
                    <p className="text-slate-400 font-bold mt-2 flex items-center gap-2">
                       <ShoppingCart className="h-4 w-4" /> Traza Histórica Comercial
                    </p>
                 </div>
              </div>
              <button onClick={() => setShowSalesModal(false)} className="p-3 hover:bg-white rounded-full transition-all shadow-sm border border-slate-100">
                <X className="h-6 w-6 text-slate-300" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Volumen de Compra</p>
                    <p className="text-3xl font-black font-outfit">${selectedClient.total_ventas?.toLocaleString()}</p>
                 </div>
                 <div className="bg-rose-600 p-6 rounded-[2rem] text-white">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Cartera Morosa</p>
                    <p className="text-3xl font-black font-outfit">${selectedClient.total_credito?.toLocaleString()}</p>
                 </div>
              </div>

              <div className="relative pl-8 space-y-6">
                <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-slate-100" />
                
                {clientSales.map((sale, idx) => (
                  <div key={sale.id} className="relative group animate-in slide-in-from-left duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="absolute -left-[32px] top-2 h-4 w-4 rounded-full border-4 border-white bg-slate-200 group-hover:bg-primary-500 transition-colors shadow-sm" />
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 hover:bg-white hover:border-slate-200 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{formatDisplayDate(sale.creada_en)} • #{sale.id.slice(0,8)}</p>
                        <p className="text-sm font-bold text-slate-700 capitalize">Pago via <span className="text-primary-600">{sale.metodo_pago}</span></p>
                      </div>
                      
                      <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900">${sale.total.toLocaleString()}</p>
                          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase border mt-1 ${
                            sale.estado_pago === 'pagado' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            sale.estado_pago === 'parcial' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-rose-100 text-rose-700 border-rose-200'
                          }`}>
                            {sale.estado_pago || sale.estado}
                          </span>
                        </div>
                        <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-primary-600 transition-colors hidden sm:block" />
                      </div>
                    </div>
                  </div>
                ))}

                {clientSales.length === 0 && (
                  <div className="py-20 flex flex-col items-center opacity-40">
                    <ShoppingCart className="h-16 w-16 mb-4" />
                    <p className="font-bold">No se registran transacciones</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center shrink-0">
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Cierre de Auditoría</p>
                  <p className="text-xl font-black text-slate-900">Total {clientSales.length} Operaciones</p>
               </div>
               <button 
                onClick={() => setShowSalesModal(false)}
                className="px-8 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
              >
                Finalizar Reporte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;