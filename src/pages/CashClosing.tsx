import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, History, Plus, Lock, Unlock, ArrowUpCircle, ArrowDownCircle, AlertCircle, TrendingUp, Edit3, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import CashMovementModal from '../components/cash/CashMovementModal';
import CashClosingHistoryModal from '../components/CashClosingHistoryModal';
import EditClosingModal from '../components/EditClosingModal';
import toast from 'react-hot-toast';

interface CashMovement {
  id: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  creado_en: string;
}

interface CashClosingStats {
  totalSales: number;
  cashSales: number;
  otherPaymentSales: {
    method: string;
    amount: number;
  }[];
  orderCount: number;
  topProducts: {
    name: string;
    quantity: number;
    total: number;
  }[];
}

interface CashClosing {
  id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  monto_apertura: number;
  total_ingresos: number;
  total_egresos: number;
  total_ventas: number;
  total_efectivo: number;
  efectivo_contado: number;
  diferencia: number;
  estado: 'pendiente' | 'completado' | 'anulado';
  usuario: {
    nombre_completo: string;
  };
}

const CashClosing: React.FC = () => {
  const { user } = useAuth();
  
  // States for Active Register
  const [activeRegister, setActiveRegister] = useState<CashClosing | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  
  // States for Opening Register
  const [baseAmount, setBaseAmount] = useState<string>('');
  
  // States for Closing Register
  const [stats, setStats] = useState<CashClosingStats | null>(null);
  const [countedCash, setCountedCash] = useState<string>('');
  const [notes, setNotes] = useState('');
  
  // General States
  const [loading, setLoading] = useState(true);
  const [previousClosings, setPreviousClosings] = useState<CashClosing[]>([]);
  const [selectedHistoryClosing, setSelectedHistoryClosing] = useState<CashClosing | null>(null);
  const [editingClosing, setEditingClosing] = useState<CashClosing | null>(null);
  const [historyFilterDate, setHistoryFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchActiveRegister = async () => {
    if (!user?.negocioId) return;
    setLoading(true);
    try {
      // Find open register (estado = 'pendiente')
      const { data, error } = await supabase
        .from('cierres_caja')
        .select(`
          *,
          usuario:usuario_id (nombre_completo)
        `)
        .eq('negocio_id', user.negocioId)
        .eq('estado', 'pendiente')
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // Ignore not found
      
      setActiveRegister(data || null);

      if (data) {
        // Fetch movements for this open register
        const { data: movData, error: movError } = await supabase
          .from('movimientos_caja')
          .select('*')
          .eq('cierre_caja_id', data.id)
          .order('creado_en', { ascending: false });
          
        if (movError) throw movError;
        setMovements(movData || []);
        
        // Fetch current stats based on open register start date and current time
        await fetchClosingStats(data.fecha_inicio, new Date().toISOString());
      }
    } catch (err: any) {
      console.error('Error fetching active register:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviousClosings = async () => {
    if (!user?.negocioId) return;
    try {
      const { data, error } = await supabase
        .from('cierres_caja')
        .select(`
          *,
          usuario:usuario_id (nombre_completo)
        `)
        .eq('negocio_id', user.negocioId)
        .eq('estado', 'completado')
        .order('fecha_fin', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPreviousClosings(data || []);
    } catch (err) {
      console.error('Error fetching previous closings:', err);
      toast.error('Error al cargar historial');
    }
  };

  useEffect(() => {
    fetchActiveRegister();
    fetchPreviousClosings();
  }, [user]);

  // Refetch history when filter changes (optional, or just filter client side)
  // For simplicity and since limit is 10, let's keep it simple for now or fetch all.
  // Actually, let's fetch based on date if we want "filtrar por dia".
  
  const fetchFilteredHistory = async (date: string) => {
    if (!user?.negocioId) return;
    try {
      const { data, error } = await supabase
        .from('cierres_caja')
        .select(`
          *,
          usuario:usuario_id (nombre_completo)
        `)
        .eq('negocio_id', user.negocioId)
        .eq('estado', 'completado')
        .gte('fecha_inicio', `${date}T00:00:00`)
        .lte('fecha_inicio', `${date}T23:59:59`)
        .order('fecha_fin', { ascending: false });

      if (error) throw error;
      setPreviousClosings(data || []);
    } catch (err) {
      console.error('Error filtering history:', err);
    }
  };

  const fetchClosingStats = async (startISO: string, endISO: string) => {
    if (!user?.negocioId) return;

    try {
      const { data: salesData, error: salesError } = await supabase
        .from('ventas')
        .select(`
          id,
          total,
          metodo_pago,
          detalle_ventas (
            cantidad,
            precio_unitario,
            producto:producto_id (nombre)
          )
        `)
        .eq('negocio_id', user.negocioId)
        .gte('creada_en', startISO)
        .lte('creada_en', endISO);

      if (salesError) throw salesError;

      let totalSales = 0;
      let cashSales = 0;
      const paymentMethods = new Map<string, number>();
      const products = new Map<string, { quantity: number; total: number }>();

      salesData?.forEach(sale => {
        totalSales += sale.total;
        if (sale.metodo_pago === 'efectivo') {
          cashSales += sale.total;
        } else {
          const currentAmount = paymentMethods.get(sale.metodo_pago) || 0;
          paymentMethods.set(sale.metodo_pago, currentAmount + sale.total);
        }

        sale.detalle_ventas.forEach((detail: any) => {
          // detalle_ventas may return producto as an object or array depending on the join
          const productName = Array.isArray(detail.producto) 
            ? detail.producto[0]?.nombre 
            : detail.producto?.nombre || 'Producto Desconocido';
            
          const current = products.get(productName) || { quantity: 0, total: 0 };
          products.set(productName, {
            quantity: current.quantity + detail.cantidad,
            total: current.total + (detail.cantidad * detail.precio_unitario)
          });
        });
      });

      setStats({
        totalSales,
        cashSales,
        otherPaymentSales: Array.from(paymentMethods.entries()).map(([method, amount]) => ({ method, amount })),
        orderCount: salesData?.length || 0,
        topProducts: Array.from(products.entries())
          .map(([name, s]) => ({ name, ...s }))
          .sort((a, b) => b.total - a.total).slice(0, 10)
      });
    } catch (err: any) {
      console.error('Error fetching closing stats:', err);
      toast.error('Error al calcular ventas actuales');
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.negocioId) return;

    if (activeRegister) {
      toast.error('Ya existe una caja abierta para este negocio. Ciérrela antes de abrir una nueva.');
      return;
    }
    
    const amountNum = parseFloat(baseAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      toast.error('Ingrese un monto base válido');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('cierres_caja')
        .insert({
          negocio_id: user.negocioId,
          usuario_id: user.id,
          fecha_inicio: new Date().toISOString(),
          monto_apertura: amountNum,
          total_ventas: 0,
          total_efectivo: 0,
          total_otros_medios: 0,
          numero_ordenes: 0,
          estado: 'pendiente'
        });

      if (error) throw error;
      toast.success('Caja abierta exitosamente');
      setBaseAmount('');
      fetchActiveRegister();
    } catch (err: any) {
      console.error('Error opening register:', err);
      toast.error('Error al abrir la caja');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRegister = async () => {
    if (!user?.negocioId || !activeRegister || !stats) return;
    if (!countedCash) {
      toast.error('Por favor ingrese el efectivo contado');
      return;
    }

    setLoading(true);
    try {
      const counted = parseFloat(countedCash || '0');
      const endISO = new Date().toISOString();
      
      // Calculate totals from movements
      const totalIngresos = movements.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + m.monto, 0);
      const totalEgresos = movements.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + m.monto, 0);
      
      // Expected cash = Base + Cash Sales + Extra Income - Expenses
      const expectedCash = activeRegister.monto_apertura + stats.cashSales + totalIngresos - totalEgresos;
      const difference = counted - expectedCash;

      // Validation logic moved here for better UX (feedback via toasts)
      if (!countedCash || isNaN(counted)) {
        toast.error('Por favor ingrese el monto real de efectivo contado.');
        setLoading(false);
        return;
      }

      if (difference !== 0) {
        if (!user.rol || !['propietario', 'administrador'].includes(user.rol.toLowerCase())) {
          toast.error(`Descuadre detectado ($${difference.toLocaleString()}). Solo un administrador puede cerrar la caja con diferencias.`);
          setLoading(false);
          return;
        }

        if (!notes || notes.trim() === '') {
          toast.error('Descuadre detectado. Debe ingresar una observación explicando el motivo.');
          setLoading(false);
          return;
        }
      }

      const { error: closingError } = await supabase
        .from('cierres_caja')
        .update({
          fecha_fin: endISO,
          total_ventas: stats.totalSales,
          total_efectivo: stats.cashSales,
          efectivo_contado: counted,
          total_otros_medios: stats.totalSales - stats.cashSales,
          numero_ordenes: stats.orderCount,
          total_ingresos: totalIngresos,
          total_egresos: totalEgresos,
          notas: notes || null,
          estado: 'completado'
        })
        .eq('id', activeRegister.id)
        .eq('negocio_id', user.negocioId);

      if (closingError) {
        console.error('Supabase update error:', closingError);
        throw new Error(closingError.message || 'Error al actualizar registro en base de datos');
      }

      // Save breakdown
      if (stats.otherPaymentSales.length > 0) {
        const breakdownData = stats.otherPaymentSales.map(payment => ({
          cierre_id: activeRegister.id,
          metodo_pago: payment.method,
          monto: payment.amount
        }));

        await supabase.from('detalle_cierre_caja').insert(breakdownData);
      }

      toast.success('Cierre de caja guardado exitosamente');
      
      // Pass the fully updated object to PDF generation
      generatePDF({
        ...activeRegister,
        fecha_fin: endISO,
        efectivo_contado: counted,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        total_ventas: stats.totalSales,
        total_efectivo: stats.cashSales,
        diferencia: difference,
        estado: 'completado'
      }, stats, movements);
      
      setCountedCash('');
      setNotes('');
      setActiveRegister(null);
      setStats(null);
      fetchPreviousClosings();
      
    } catch (err: any) {
      console.error('Error saving closing:', err);
      toast.error(err.message || 'Error al cerrar la caja');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (register: CashClosing, currentStats: CashClosingStats, currentMovements: CashMovement[]) => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Cierre de Caja', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Apertura: ${format(parseISO(register.fecha_inicio), 'dd/MM/yyyy HH:mm')}`, 20, 30);
    if (register.fecha_fin) {
      doc.text(`Cierre: ${format(parseISO(register.fecha_fin), 'dd/MM/yyyy HH:mm')}`, 120, 30);
    }
    doc.text(`Usuario: ${register.usuario?.nombre_completo || 'N/A'}`, 20, 38);

    doc.setFontSize(14);
    doc.text('Resumen de Efectivo', 20, 50);
    doc.setFontSize(10);
    
    const expectedCash = register.monto_apertura + currentStats.cashSales + register.total_ingresos - register.total_egresos;
    
    const summaryData = [
      ['Base de Apertura', `$${register.monto_apertura.toLocaleString()}`],
      ['Ventas en Efectivo', `+$${currentStats.cashSales.toLocaleString()}`],
      ['Ingresos Extra (Mvts)', `+$${register.total_ingresos.toLocaleString()}`],
      ['Egresos / Gastos (Mvts)', `-$${register.total_egresos.toLocaleString()}`],
      ['Efectivo Esperado en Caja', `$${expectedCash.toLocaleString()}`],
      ['Efectivo Contado Real', `$${register.efectivo_contado.toLocaleString()}`],
      ['Diferencia (Sobrante/Faltante)', `$${register.diferencia.toLocaleString()}`]
    ];

    (doc as any).autoTable({
      startY: 55,
      head: [['Concepto', 'Valor']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] } // Indigo 600
    });

    let currentY = (doc as any).lastAutoTable.finalY + 15;

    // Ventas Totales
    doc.setFontSize(14);
    doc.text('Resumen de Ventas', 20, currentY);
    
    const ventasData = [
      ['Ventas en Efectivo (Caja)', `$${currentStats.cashSales.toLocaleString()}`],
      ['Otras Formas de Pago', `$${(currentStats.totalSales - currentStats.cashSales).toLocaleString()}`],
      ['Ventas Totales', `$${currentStats.totalSales.toLocaleString()}`],
      ['Total de Órdenes', currentStats.orderCount.toString()]
    ];

    (doc as any).autoTable({
      startY: currentY + 5,
      body: ventasData,
      theme: 'plain'
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Movimientos Detalles
    if (currentMovements.length > 0) {
      doc.setFontSize(14);
      doc.text('Detalle de Movimientos de Caja', 20, currentY);
      
      const movsData = currentMovements.map(m => [
        format(parseISO(m.creado_en), 'HH:mm'),
        m.tipo.toUpperCase(),
        m.descripcion,
        `$${m.monto.toLocaleString()}`
      ]);

      (doc as any).autoTable({
        startY: currentY + 5,
        head: [['Hora', 'Tipo', 'Descripción', 'Monto']],
        body: movsData,
        theme: 'grid',
        headStyles: { fillColor: [107, 114, 128] } // Gray 500
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    if (notes) {
      doc.setFontSize(12);
      doc.text('Notas / Observaciones:', 20, currentY);
      doc.setFontSize(10);
      doc.text(notes, 20, currentY + 10, { maxWidth: 170 });
    }

    doc.save(`cierre-caja-${format(parseISO(register.fecha_inicio), 'yyyyMMdd_HHmm')}.pdf`);
  };

  // UI Compon  // UI Components
  const renderHistory = () => {
    // Basic role safety
    if (!user?.rol || !['propietario', 'administrador'].includes(user.rol.toLowerCase())) return null;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center bg-gray-50 gap-4">
           <h3 className="text-lg font-medium text-gray-900 flex items-center">
             <History className="w-5 h-5 mr-2 text-primary-600" /> Historial de Cierres Diarios
           </h3>
           
           <div className="flex items-center space-x-2">
             <label className="text-sm text-gray-500">Filtrar por día:</label>
             <input 
               type="date" 
               value={historyFilterDate}
               onChange={(e) => {
                 setHistoryFilterDate(e.target.value);
                 fetchFilteredHistory(e.target.value);
               }}
               className="text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
             />
             <button 
               onClick={() => fetchPreviousClosings()}
               className="p-1 px-2 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
             >
               Ver últimos 10
             </button>
           </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          {previousClosings.length === 0 ? (
            <div className="p-20 text-center">
                <div className="bg-slate-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                   <History className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-400 font-bold tracking-tight">No se encontraron registros de caja</p>
                <p className="text-slate-300 text-xs mt-1">Intenta con otros criterios de búsqueda</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
              <tr className="bg-slate-50/30">
                <th scope="col" className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Apertura</th>
                <th scope="col" className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cierre</th>
                <th scope="col" className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cajero</th>
                <th scope="col" className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas Efectivo</th>
                <th scope="col" className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Diferencia</th>
                <th scope="col" className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {previousClosings.map((closing) => (
                <tr key={closing.id} className="hover:bg-slate-50/50 transition-all duration-200 group">
                  <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-slate-600">
                    <div className="flex flex-col">
                       <span>{format(parseISO(closing.fecha_inicio), 'dd/MM/yyyy')}</span>
                       <span className="text-[10px] text-slate-400 font-medium">{format(parseISO(closing.fecha_inicio), 'HH:mm')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-sm text-slate-500 font-medium">
                    {closing.fecha_fin ? (
                      <div className="flex flex-col">
                         <span className="text-slate-600 font-bold">{format(parseISO(closing.fecha_fin), 'dd/MM/yy')}</span>
                         <span className="text-[10px]">{format(parseISO(closing.fecha_fin), 'HH:mm')}</span>
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full uppercase border border-amber-100">Pendiente</span>
                    )}
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-slate-900 capitalize">
                    {closing.usuario?.nombre_completo || 'N/A'}
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-sm font-black text-slate-900 text-right">
                    ${(closing.total_efectivo || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-center">
                    <span className={`px-4 py-1.5 inline-flex text-[10px] font-black rounded-2xl border ${
                      (closing.diferencia || 0) === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      (closing.diferencia || 0) > 0 ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      ${(closing.diferencia || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setSelectedHistoryClosing(closing)}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                        title="Ver Análisis Detallado"
                      >
                        <TrendingUp className="w-5 h-5" />
                      </button>
                      {['propietario', 'administrador'].includes(user?.rol || '') && (
                        <button 
                          onClick={() => setEditingClosing(closing)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          title="Editar Registro"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  if (loading && !activeRegister && previousClosings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando módulo de caja...</p>
      </div>
    );
  }

  // Calculate current totals if open
  const totalIngresos = movements.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + m.monto, 0);
  const totalEgresos = movements.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + m.monto, 0);
  const expectedCash = activeRegister ? (activeRegister.monto_apertura + (stats?.cashSales || 0) + totalIngresos - totalEgresos) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4 sm:px-6">
      {!activeRegister ? (
        /* --- VIEW: REGISTER CLOSED (Needs to open) --- */
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Control de Caja</h1>
          </div>
          
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden text-center py-16 px-4">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-slate-50 mb-6 border border-slate-100">
              <Lock className="h-10 w-10 text-slate-300" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">La caja está cerrada</h2>
            <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm font-medium">
              Abre la caja ingresando el monto base inicial con el que empiezas el turno para empezar a registrar ventas y movimientos.
            </p>
            
            <form onSubmit={handleOpenRegister} className="max-w-sm mx-auto">
              <div className="mb-6 text-left">
                <label htmlFor="baseAmount" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Monto Base de Apertura</label>
                <div className="mt-1 relative rounded-2xl shadow-sm overflow-hidden border border-slate-200 focus-within:border-primary-500 transition-all">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-bold">$</span>
                  </div>
                  <input
                    type="number"
                    id="baseAmount"
                    required
                    min="0"
                    step="1"
                    className="focus:ring-0 focus:border-none block w-full pl-10 py-4 text-lg border-none font-black text-slate-700 placeholder-slate-300 bg-slate-50/30"
                    placeholder="0"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center items-center px-6 py-4 border border-transparent text-sm font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary-200 text-white bg-primary-600 hover:bg-primary-700 transform hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
              >
                {loading ? 'Abriendo...' : (
                  <>
                    <Unlock className="w-4 h-4 mr-2" />
                    Abrir Caja Ahora
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* --- VIEW: REGISTER OPEN --- */
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center tracking-tight">
                Gestión de Caja <span className="ml-3 inline-flex items-center px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100"><Unlock className="w-3 h-3 mr-1.5"/> Activa</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Desde el {format(parseISO(activeRegister.fecha_inicio), "d 'de' MMMM, HH:mm", { locale: es })} • {activeRegister.usuario?.nombre_completo}
              </p>
            </div>
            
            <button
              onClick={() => setIsMovementModalOpen(true)}
              className="inline-flex items-center px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Plus className="h-4 w-4 mr-2 text-primary-500" />
              Notificar Movimiento
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-100 group hover:border-slate-200 transition-all">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Base Inicial</p>
              <p className="text-2xl font-black text-slate-800">${activeRegister.monto_apertura.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-md border border-emerald-100 bg-emerald-50/30">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Ventas Efectivo</p>
              <p className="text-2xl font-black text-emerald-700">+ ${stats?.cashSales.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center">Otros Métodos <span className="ml-1 opacity-60">*(no suman)*</span></p>
              <p className="text-2xl font-black text-slate-600">${((stats?.totalSales || 0) - (stats?.cashSales || 0)).toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-primary-100 bg-primary-50/30">
              <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">Efectivo Esperado</p>
              <p className="text-3xl font-black text-primary-700">${expectedCash.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Movements */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Actividad del Turno</h3>
                   <div className="text-[10px] font-black uppercase tracking-widest flex gap-4">
                     <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Ingresos: +${totalIngresos.toLocaleString()}</span>
                     <span className="text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">Egresos: -${totalEgresos.toLocaleString()}</span>
                   </div>
                </div>
                
                <div className="p-0">
                  {movements.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 opacity-40">
                         <Activity className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-slate-400 text-xs font-bold tracking-tight">Sin movimientos registrados aún</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {movements.map((mov) => (
                        <li key={mov.id} className="px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
                          <div className="flex items-center">
                            {mov.tipo === 'ingreso' ? (
                              <div className="flex-shrink-0 bg-emerald-100 rounded-xl p-2.5">
                                <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
                              </div>
                            ) : (
                              <div className="flex-shrink-0 bg-rose-100 rounded-xl p-2.5">
                                <ArrowDownCircle className="h-5 w-5 text-rose-600" />
                              </div>
                            )}
                            <div className="ml-4">
                              <p className="text-sm font-bold text-slate-700">{mov.descripcion}</p>
                              <p className="text-[10px] text-slate-400 font-medium tracking-wide">{format(parseISO(mov.creado_en), 'HH:mm')}</p>
                            </div>
                          </div>
                          <div className={`text-base font-black ${mov.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                             {mov.tipo === 'ingreso' ? '+' : '-'}${mov.monto.toLocaleString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Close Action */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 sticky top-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center">
                  <Lock className="w-4 h-4 mr-2 text-primary-500" />
                  Corte de Turno
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      Efectivo Real Contado
                    </label>
                    <div className="mt-1 relative rounded-2xl shadow-sm overflow-hidden border border-slate-200 focus-within:border-primary-500 transition-all">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <DollarSign className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="number"
                        value={countedCash}
                        onChange={(e) => setCountedCash(e.target.value)}
                        className="focus:ring-0 focus:border-none block w-full pl-10 py-4 text-xl border-none font-black text-slate-700 placeholder-slate-300 bg-slate-50/30"
                        placeholder="0"
                        required
                      />
                    </div>
                  </div>

                  {countedCash && (
                     <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                         <span className="text-slate-400">En Sistema:</span>
                         <span className="text-slate-700">${expectedCash.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                         <span className="text-slate-400">En Caja:</span>
                         <span className="text-slate-700">${parseFloat(countedCash).toLocaleString()}</span>
                       </div>
                       <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Diferencia:</span>
                         <span className={`text-xl font-black ${
                            parseFloat(countedCash) - expectedCash === 0 ? 'text-emerald-600' :
                            parseFloat(countedCash) - expectedCash > 0 ? 'text-blue-600' :
                            'text-rose-600'
                          }`}>
                           ${(parseFloat(countedCash) - expectedCash).toLocaleString()}
                         </span>
                       </div>
                     </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                      Observaciones {countedCash && parseFloat(countedCash) - expectedCash !== 0 && <span className="text-rose-500 font-black">*</span>}
                    </label>
                    <textarea
                      rows={3}
                      className="block w-full border-slate-200 rounded-2xl shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm p-4 bg-slate-50/30 font-medium placeholder-slate-300"
                      placeholder="Algún motivo del descuadre..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      required={!!(countedCash && parseFloat(countedCash) - expectedCash !== 0)}
                    />
                  </div>

                  {countedCash && parseFloat(countedCash) - expectedCash !== 0 && (!user?.rol || !['propietario', 'administrador'].includes(user.rol.toLowerCase())) && (
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                      <div className="flex">
                        <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                        <p className="ml-3 text-[10px] font-black text-rose-700 uppercase tracking-tight leading-4">
                          Caja descuadrada. Solo un Administrador puede autorizar este cierre.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleCloseRegister}
                    disabled={loading || (!!countedCash && parseFloat(countedCash) - expectedCash !== 0 && (!user?.rol || !['propietario', 'administrador'].includes(user.rol.toLowerCase())))}
                    className="w-full justify-center inline-flex items-center px-6 py-4 border border-transparent rounded-2xl shadow-lg shadow-primary-100 text-sm font-black uppercase tracking-widest text-white bg-primary-600 hover:bg-primary-700 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:grayscale disabled:hover:translate-y-0"
                  >
                    {loading ? 'Procesando...' : 'Cerrar Turno y PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* History Section - Always rendered for admins, internal check in renderHistory */}
      {renderHistory()}

      {/* Modals - Always rendered to ensure they work in all states */}
      <CashMovementModal 
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        cierreId={activeRegister?.id || ''}
        onSuccess={() => fetchActiveRegister()} 
      />

      <CashClosingHistoryModal
        isOpen={!!selectedHistoryClosing}
        onClose={() => setSelectedHistoryClosing(null)}
        closing={selectedHistoryClosing}
        onEdit={(c) => {
          setSelectedHistoryClosing(null);
          setEditingClosing(c);
        }}
        userRole={user?.rol}
      />

      <EditClosingModal
        isOpen={!!editingClosing}
        onClose={() => setEditingClosing(null)}
        closing={editingClosing}
        onSuccess={() => {
          fetchPreviousClosings();
          if (historyFilterDate) fetchFilteredHistory(historyFilterDate);
        }}
      />
    </div>
  );
};

export default CashClosing;