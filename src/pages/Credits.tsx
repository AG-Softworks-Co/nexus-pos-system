import React, { useState, useEffect } from 'react';
import { Search, CreditCard, Calendar, User, DollarSign, AlertTriangle, CheckCircle, Clock, XCircle, ArrowRight, MoreVertical, Wallet, TrendingUp, History, Info, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDisplayDate } from '../utils/dateUtils';

interface CreditSale {
  id: string;
  creada_en: string;
  total: number;
  saldo_pendiente: number;
  estado_pago: string;
  fecha_vencimiento_credito: string;
  cliente: {
    nombre_completo: string;
    telefono: string;
  };
  usuario: {
    nombre_completo: string;
  };
}

interface PartialPayment {
  id: string;
  monto: number;
  metodo_pago: string;
  fecha_pago: string;
  notas: string;
}

const Credits: React.FC = () => {
  const { user } = useAuth();
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [selectedSale, setSelectedSale] = useState<CreditSale | null>(null);
  const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentData, setPaymentData] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    notas: ''
  });

  useEffect(() => {
    if (user?.negocioId) {
      fetchCreditSales();
    }
  }, [user]);

  const fetchCreditSales = async () => {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          id,
          creada_en,
          total,
          saldo_pendiente,
          estado_pago,
          fecha_vencimiento_credito,
          cliente:cliente_id (
            nombre_completo,
            telefono
          ),
          usuario:usuario_id (
            nombre_completo
          )
        `)
        .eq('negocio_id', user?.negocioId)
        .eq('metodo_pago', 'credito')
        .order('creada_en', { ascending: false });

      if (error) throw error;
      setCreditSales((data || []).map((sale: any) => ({
        ...sale,
        cliente: Array.isArray(sale.cliente) ? sale.cliente[0] : sale.cliente,
        usuario: Array.isArray(sale.usuario) ? sale.usuario[0] : sale.usuario
      })));
    } catch (err: any) {
      console.error('Error fetching credit sales:', err);
      setError('Error al cargar ventas a crédito');
    } finally {
      setLoading(false);
    }
  };

  const fetchPartialPayments = async (saleId: string) => {
    try {
      const { data, error } = await supabase
        .from('pagos_parciales')
        .select('*')
        .eq('venta_id', saleId)
        .order('fecha_pago', { ascending: false });

      if (error) throw error;
      setPartialPayments(data || []);
    } catch (err: any) {
      console.error('Error fetching partial payments:', err);
      setError('Error al cargar pagos parciales');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale || !user?.id || !user?.negocioId) {
      setError("No se pudo procesar el pago: falta información.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const monto = parseFloat(paymentData.monto);
      if (isNaN(monto) || monto <= 0 || monto > selectedSale.saldo_pendiente) {
        throw new Error('Monto inválido');
      }

      const { error } = await supabase
        .from('pagos_parciales')
        .insert([{
          venta_id: selectedSale.id,
          usuario_id: user.id,
          negocio_id: user.negocioId,
          monto,
          metodo_pago: paymentData.metodo_pago,
          notas: paymentData.notas || null
        }]);

      if (error) throw error;

      const nuevoSaldo = Math.max(0, selectedSale.saldo_pendiente - monto);
      const updateData: any = { saldo_pendiente: nuevoSaldo };

      if (nuevoSaldo <= 0) {
        updateData.estado_pago = 'pagado';
        updateData.estado = 'pagada';
      } else {
        updateData.estado_pago = 'parcial';
      }

      await supabase.from('ventas').update(updateData).eq('id', selectedSale.id);

      await fetchCreditSales();
      if (showPaymentsModal) await fetchPartialPayments(selectedSale.id);
      setShowPaymentModal(false);
      setPaymentData({ monto: '', metodo_pago: 'efectivo', notas: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewPayments = async (sale: CreditSale) => {
    setSelectedSale(sale);
    await fetchPartialPayments(sale.id);
    setShowPaymentsModal(true);
  };

  const getStatusConfig = (sale: CreditSale) => {
    const isOverdue = new Date(sale.fecha_vencimiento_credito) < new Date() && sale.estado_pago !== 'pagado';
    if (sale.estado_pago === 'pagado') return { label: 'Pagado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle };
    if (isOverdue) return { label: 'Vencido', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle };
    if (sale.estado_pago === 'parcial') return { label: 'Parcial', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock };
    return { label: 'Pendiente', color: 'bg-sky-100 text-sky-700 border-sky-200', icon: Info };
  };

  const filteredSales = creditSales.filter(sale => {
    const isOverdue = new Date(sale.fecha_vencimiento_credito) < new Date() && sale.estado_pago !== 'pagado';
    const matchesSearch = !searchQuery ||
      sale.cliente.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'vencido') matchesStatus = isOverdue;
      else matchesStatus = sale.estado_pago === statusFilter && !isOverdue;
    }
    return matchesSearch && matchesStatus;
  });

  const totalCredits = creditSales.reduce((sum, s) => sum + s.saldo_pendiente, 0);
  const overdueCredits = creditSales.filter(s => new Date(s.fecha_vencimiento_credito) < new Date() && s.estado_pago !== 'pagado')
    .reduce((sum, s) => sum + s.saldo_pendiente, 0);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-100 border-t-primary-600"></div>
      <p className="mt-4 text-gray-500 font-medium font-outfit">Preparando estados de cuenta...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 p-4 pb-24 lg:pb-8">
      {/* Header & Hero Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-outfit">Mis Créditos</h1>
          <p className="text-slate-500 mt-1">Gestión enterprise de cuentas por cobrar y abonos.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Clock className="h-3 w-3" /> Actualizado ahora
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Wallet className="h-16 w-16 text-primary-600" />
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Cartera Total</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900">${totalCredits.toLocaleString('es-CO')}</span>
            <span className="text-xs font-bold text-slate-400">COP</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-full">
            <TrendingUp className="h-3 w-3" /> +2.5% vs ayer
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-rose-600">
            <AlertTriangle className="h-16 w-16" />
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Morosidad Crítica</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-rose-600">${overdueCredits.toLocaleString('es-CO')}</span>
            <span className="text-xs font-bold text-slate-400">COP</span>
          </div>
          <p className="mt-4 text-xs font-medium text-slate-400">Vencimientos mayores a 24h</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden group sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Base de Clientes</p>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {new Set(creditSales.map(s => s.cliente.nombre_completo)).size}
          </div>
          <div className="mt-4 flex -space-x-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">US</div>
            ))}
            <div className="h-8 w-8 rounded-full border-2 border-white bg-primary-50 flex items-center justify-center text-[10px] font-bold text-primary-600">+12</div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-2 sm:p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente o folio..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 text-sm font-medium transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <select
              className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-600 focus:ring-2 focus:ring-primary-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Filtro: Todos</option>
              <option value="pendiente">Solo Pendientes</option>
              <option value="parcial">Solo Parciales</option>
              <option value="vencido">Solo Vencidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Feed / Desktop Table View */}
      <div className="space-y-4">
        {/* Desktop Table Header (Visible only on lg+) */}
        <div className="hidden lg:grid grid-cols-7 gap-4 px-6 py-4 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
          <div className="col-span-2">Información del Cliente</div>
          <div>Fecha Folio</div>
          <div>Total Venta</div>
          <div>Saldo Moroso</div>
          <div>Estado</div>
          <div className="text-right">Gestión</div>
        </div>

        {filteredSales.map((sale) => {
          const status = getStatusConfig(sale);
          const Icon = status.icon;
          const progress = ((sale.total - sale.saldo_pendiente) / sale.total) * 100;

          return (
            <div key={sale.id} className="bg-white lg:hover:bg-slate-50 transition-all rounded-3xl border border-slate-100 shadow-sm overflow-hidden group">
              {/* Desktop Row Content */}
              <div className="hidden lg:grid grid-cols-7 gap-4 p-6 items-center">
                <div className="col-span-2 flex items-center gap-4">
                  <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-black text-sm">
                    {sale.cliente.nombre_completo.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{sale.cliente.nombre_completo}</div>
                    <div className="text-xs text-slate-400">{sale.cliente.telefono || 'Sin contacto'}</div>
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-600">
                  {formatDisplayDate(sale.creada_en)}
                  <div className="text-[10px] text-slate-400 mt-1 uppercase">Folio: #{sale.id.slice(0,6)}</div>
                </div>
                <div className="text-sm font-bold text-slate-900">${sale.total.toLocaleString()}</div>
                <div className="text-sm font-black text-rose-600">${sale.saldo_pendiente.toLocaleString()}</div>
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${status.color}`}>
                    <Icon className="h-3 w-3" /> {status.label}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleViewPayments(sale)}
                    className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                    title="Historial de abonos"
                  >
                    <History className="h-5 w-5" />
                  </button>
                  {sale.saldo_pendiente > 0 && (
                    <button
                      onClick={() => { setSelectedSale(sale); setPaymentData({ monto: '', metodo_pago: 'efectivo', notas: '' }); setShowPaymentModal(true); }}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary-200"
                    >
                      Abonar
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile Card Content */}
              <div className="lg:hidden p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-lg">
                      {sale.cliente.nombre_completo.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight">{sale.cliente.nombre_completo}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">#{sale.id.slice(0,8)} • {formatDisplayDate(sale.creada_en)}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Total Cartera</p>
                    <p className="text-sm font-bold text-slate-900">${sale.total.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Saldo Moroso</p>
                    <p className="text-sm font-black text-rose-600">${sale.saldo_pendiente.toLocaleString()}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5 uppercase">
                    <span>Progreso de Pago</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleViewPayments(sale)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
                  >
                    <History className="h-4 w-4" /> Historial
                  </button>
                  {sale.saldo_pendiente > 0 && (
                    <button
                      onClick={() => { setSelectedSale(sale); setPaymentData({ monto: '', metodo_pago: 'efectivo', notas: '' }); setShowPaymentModal(true); }}
                      className="flex-1 py-3 bg-primary-600 rounded-xl text-xs font-bold text-white shadow-lg shadow-primary-200"
                    >
                      Realizar Abono
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredSales.length === 0 && (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Operación sin resultados</h3>
            <p className="max-w-[280px] text-sm text-slate-400 mt-1">No hemos encontrado créditos que coincidan con los criterios actuales.</p>
          </div>
        )}
      </div>

      {/* Payment Modal Refined */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowPaymentModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Registrar Abono</h3>
                  <p className="text-slate-500 text-sm font-medium">Folio: #{selectedSale.id.slice(0,8)} • {selectedSale.cliente.nombre_completo}</p>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <XCircle className="h-6 w-6 text-slate-300" />
                </button>
              </div>

              <div className="bg-primary-50 p-6 rounded-2xl border border-primary-100 mb-8">
                <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest leading-none mb-2">Deuda Pendiente</p>
                <p className="text-3xl font-black text-slate-900">${selectedSale.saldo_pendiente.toLocaleString('es-CO')}</p>
              </div>

              <form onSubmit={handleAddPayment} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Monto a Abonar</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">$</span>
                    <input
                      type="number"
                      className="w-full pl-10 pr-5 py-5 bg-slate-50 border-none rounded-2xl text-2xl font-black text-slate-900 focus:ring-2 focus:ring-primary-500 transition-all placeholder:text-slate-300"
                      placeholder="0.00"
                      value={paymentData.monto}
                      onChange={(e) => setPaymentData({ ...paymentData, monto: e.target.value })}
                      max={selectedSale.saldo_pendiente}
                      step="0.01"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2">Método</label>
                    <select
                      className="w-full py-4 px-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-primary-500"
                      value={paymentData.metodo_pago}
                      onChange={(e) => setPaymentData({ ...paymentData, metodo_pago: e.target.value })}
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="bancolombia">Puntos Libres</option>
                      <option value="nequi">Nequi</option>
                      <option value="daviplata">Daviplata</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2">Concepto</label>
                    <input
                      type="text"
                      className="w-full py-4 px-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 placeholder:font-medium"
                      placeholder="Abono semanal..."
                      value={paymentData.notas}
                      onChange={(e) => setPaymentData({ ...paymentData, notas: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-5 bg-primary-600 rounded-3xl text-lg font-black text-white hover:bg-primary-700 transition-all shadow-xl shadow-primary-200 disabled:opacity-50 mt-4 active:scale-[0.98]"
                >
                  {isSubmitting ? 'Verificando Fondos...' : 'Confirmar Abono Bancario'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Payments Model */}
      {showPaymentsModal && selectedSale && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowPaymentsModal(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Historial de Transacciones</h3>
                <p className="text-slate-400 font-medium text-sm capitalize">{selectedSale.cliente.nombre_completo}</p>
              </div>
              <button onClick={() => setShowPaymentsModal(false)} className="p-3 hover:bg-slate-50 rounded-full transition-colors">
                <XCircle className="h-6 w-6 text-slate-300" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
              <div className="flex items-center gap-6 p-6 bg-slate-900 text-white rounded-[2rem]">
                 <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="h-8 w-8 text-white" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Recuperado</p>
                    <p className="text-3xl font-black">${(selectedSale.total - selectedSale.saldo_pendiente).toLocaleString()}</p>
                 </div>
              </div>

              <div className="space-y-6 relative pl-8">
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-100" />
                
                {partialPayments.map((payment, idx) => (
                  <div key={payment.id} className="relative animate-in slide-in-from-left duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="absolute -left-[32px] top-1.5 h-4 w-4 rounded-full border-4 border-white bg-emerald-500 shadow-sm" />
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 mb-1">{formatDisplayDate(payment.fecha_pago)}</p>
                          <p className="text-sm font-bold text-slate-900 capitalize">Recibo via {payment.metodo_pago}</p>
                          {payment.notas && <p className="text-xs text-slate-500 mt-1 font-medium italic">"{payment.notas}"</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-emerald-600">+${payment.monto.toLocaleString()}</p>
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md uppercase">Efectivo</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {partialPayments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 ml-[-32px]">
                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <History className="h-8 w-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-bold">Sin movimientos registrados</p>
                    <p className="text-xs text-slate-400 mt-1">El cliente aún no ha realizado abonos previos.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Estado Final</p>
                <p className="text-xl font-black text-rose-600 underline decoration-rose-200 decoration-4 underline-offset-4">Por Cobrar: ${selectedSale.saldo_pendiente.toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setShowPaymentsModal(false)}
                className="px-8 py-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-600 hover:bg-white shadow-sm"
              >
                Cerrar Reporte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Credits;