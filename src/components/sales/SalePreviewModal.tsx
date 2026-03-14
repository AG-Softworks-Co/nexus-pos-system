import React, { useState, useEffect } from 'react';
import { X, Calendar, Phone, MapPin, RefreshCw, Percent, User, Package, ShoppingBag, CreditCard, FileText, DollarSign } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';
import type { Sale } from '../../types/sales';
import { supabase } from '../../lib/supabase';

interface SalePreviewModalProps {
  sale: Sale;
  onClose: () => void;
  onGeneratePDF: (sale: Sale) => void;
}

interface PartialPayment {
  id: string;
  monto: number;
  metodo_pago: string;
  fecha_pago: string;
  notas: string;
}

const SalePreviewModal: React.FC<SalePreviewModalProps> = ({ sale, onClose, onGeneratePDF }) => {
  const [returnInfo, setReturnInfo] = useState<{
    id: string;
    tipo_devolucion: string;
    monto_devolucion: number;
    estado: string;
    detalle_devoluciones: {
      detalle_venta_id: string;
      cantidad_devuelta: number;
    }[];
  } | null>(null);
  const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);

  useEffect(() => {
    fetchReturnInfo();
    if (sale.metodo_pago === 'credito') {
      fetchPartialPayments();
    }
  }, [sale.id, sale.metodo_pago]);

  const fetchReturnInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('devoluciones')
        .select(`
          id,
          tipo_devolucion,
          monto_devolucion,
          estado,
          detalle_devoluciones (
            detalle_venta_id,
            cantidad_devuelta
          )
        `)
        .eq('venta_id', sale.id)
        .eq('estado', 'aprobada')
        .maybeSingle();

      if (error) throw error;
      setReturnInfo(data);
    } catch (err) {
      console.error('Error fetching return info:', err);
    }
  };

  const fetchPartialPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('pagos_parciales')
        .select('*')
        .eq('venta_id', sale.id)
        .order('fecha_pago', { ascending: false });

      if (error) throw error;
      setPartialPayments(data || []);
    } catch (err) {
      console.error('Error fetching partial payments:', err);
    }
  };

  const returnedQuantities: Record<string, number> = {};
  if (returnInfo?.detalle_devoluciones) {
    returnInfo.detalle_devoluciones.forEach(detail => {
      returnedQuantities[detail.detalle_venta_id] = detail.cantidad_devuelta;
    });
  }

  const effectiveTotal = returnInfo ? sale.total - returnInfo.monto_devolucion : sale.total;
  const totalPagado = partialPayments.reduce((sum, p) => sum + p.monto, 0);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl bg-white rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl animate-in zoom-in slide-in-from-bottom duration-400 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Premium */}
        <div className="p-8 pb-6 border-b border-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
             <div className="h-20 w-20 rounded-[1.5rem] bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
                <ShoppingBag className="h-10 w-10" />
             </div>
             <div>
                <div className="flex items-center gap-2 mb-1">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo de Operación</span>
                   <span className={`px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${sale.estado === 'cancelada' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {sale.estado === 'cancelada' ? 'Cancelada' : 'Confirmada'}
                   </span>
                </div>
                <h3 className="text-3xl font-black text-slate-900 font-outfit leading-none tracking-tight uppercase">Venta #{sale.id.slice(0, 8)}</h3>
                <p className="text-slate-500 font-bold text-xs mt-2 flex items-center gap-2">
                   <Calendar className="h-3.5 w-3.5 opacity-40 text-primary-600" /> {formatDisplayDate(sale.creada_en)}
                </p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-full transition-all border border-transparent hover:border-slate-100">
            <X className="h-6 w-6 text-slate-300" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 scrollbar-hide">
          {/* Alerts Section (Returns & Discounts) */}
          <div className="space-y-3">
             {returnInfo ? (
              <div className="bg-rose-50 border border-rose-100 p-5 rounded-[1.5rem] flex items-start gap-4 animate-in slide-in-from-top">
                <RefreshCw className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1">Devolución Detectada</p>
                  <p className="text-sm font-black text-rose-900 leading-tight">Monto acreditado: ${returnInfo.monto_devolucion.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-rose-400 mt-1 uppercase">Aprobada comercialmente</p>
                </div>
              </div>
            ) : null}

            {sale.descuento_total && sale.descuento_total > 0 ? (
              <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-[1.5rem] flex items-start gap-4 animate-in slide-in-from-top">
                <Percent className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Beneficio Comercial</p>
                  <p className="text-sm font-black text-emerald-900 leading-tight">Descuento aplicado: ${sale.descuento_total.toLocaleString()} ({sale.descuento_porcentaje_total}%)</p>
                  {sale.razon_descuento && <p className="text-[10px] font-bold text-emerald-400 mt-1 uppercase">Razón: {sale.razon_descuento}</p>}
                </div>
              </div>
            ) : null}
          </div>

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-5">
                <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                    <User className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Responsable</p>
                   <p className="text-sm font-black text-slate-900 uppercase truncate">{sale.usuario?.nombre_completo || 'N/A'}</p>
                </div>
             </div>
             <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-5">
                <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                    <CreditCard className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Modalidad de Pago</p>
                   <p className="text-sm font-black text-slate-900 uppercase font-outfit truncate">{getPaymentLabel(sale.metodo_pago)} - {sale.estado_pago || sale.estado}</p>
                </div>
             </div>
          </div>

          {/* Client Details Section */}
          {sale.cliente ? (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Datos del Cliente</h4>
              <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm flex flex-col sm:flex-row justify-between gap-6 items-start sm:items-center group">
                 <div className="flex items-center gap-5">
                    <div className="h-14 w-14 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-200 font-black text-xl">
                       {sale.cliente.nombre_completo.charAt(0)}
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 font-outfit">{sale.cliente.nombre_completo}</p>
                      <div className="flex items-center gap-4 mt-1">
                         <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <Phone className="h-3.5 w-3.5 text-primary-400" /> {sale.cliente.telefono || 'Sin teléfono'}
                         </div>
                      </div>
                    </div>
                 </div>
                 
                 {sale.es_domicilio && sale.direccion_entrega ? (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl max-w-sm">
                       <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-1" />
                       <div className="min-w-0">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entrega Logistic</p>
                          <p className="text-xs font-bold text-slate-700 line-clamp-2 leading-relaxed">{sale.direccion_entrega.direccion}</p>
                       </div>
                    </div>
                 ) : null}
              </div>
            </div>
          ) : null}

          {/* Advanced Product Table */}
          <div className="space-y-4">
             <div className="flex items-center justify-between ml-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Composición de Productos</h4>
                <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-full">{sale.detalle_ventas?.length || 0} Items</span>
             </div>
             
             <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden">
                <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-50 grid grid-cols-4 gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                   <div className="col-span-2">Producto / Especificación</div>
                   <div className="text-center">Cant.</div>
                   <div className="text-right">Monto Unit.</div>
                </div>
                <div className="divide-y divide-slate-50">
                   {sale.detalle_ventas && sale.detalle_ventas.length > 0 ? (
                     sale.detalle_ventas.map((item) => {
                        const returnedQty = returnedQuantities[item.id] || 0;
                        const hasReturn = returnedQty > 0;
                        return (
                          <div key={item.id} className="px-8 py-5 group hover:bg-slate-50/30 transition-colors">
                             <div className="grid grid-cols-4 gap-4 items-center">
                                <div className="col-span-2">
                                   <p className="text-sm font-black text-slate-800 leading-none mb-1 group-hover:text-primary-600 transition-colors">{item.producto?.nombre || 'Producto no disponible'}</p>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">SKU: {item.producto?.sku || 'N/A'}</p>
                                </div>
                                <div className="text-center">
                                   <p className={`text-sm font-black font-outfit ${hasReturn ? 'text-rose-600' : 'text-slate-800'}`}>
                                      {item.cantidad - returnedQty}
                                      {hasReturn ? <span className="text-[10px] opacity-40 ml-1">(-{returnedQty})</span> : null}
                                   </p>
                                </div>
                                <div className="text-right">
                                   <p className="text-sm font-black text-slate-900 font-outfit">${item.precio_unitario.toLocaleString()}</p>
                                </div>
                             </div>
                          </div>
                        );
                     })
                   ) : (
                     <div className="px-8 py-10 text-center">
                        <Package className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay detalles de productos disponibles</p>
                     </div>
                   )}
                </div>
             </div>
          </div>

          {/* Nested Payment History (for Credit) */}
          {sale.metodo_pago === 'credito' && partialPayments.length > 0 ? (
             <div className="space-y-4 animate-in slide-in-from-bottom duration-700">
                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] ml-2">Trazabilidad de Abonos</h4>
                <div className="bg-emerald-50/30 border border-emerald-100 rounded-[2.5rem] overflow-hidden">
                   <div className="p-8 space-y-4">
                      {partialPayments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-emerald-100 transition-all hover:scale-[1.01]">
                           <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
                                 <DollarSign className="h-5 w-5" />
                              </div>
                              <div>
                                 <p className="text-xs font-black text-slate-900 uppercase">{payment.metodo_pago}</p>
                                 <p className="text-[10px] font-bold text-slate-400">{formatDisplayDate(payment.fecha_pago)}</p>
                              </div>
                           </div>
                           <p className="text-lg font-black text-emerald-600 font-outfit">${payment.monto.toLocaleString()}</p>
                        </div>
                      ))}
                   </div>
                   <div className="px-8 py-5 bg-emerald-600/5 flex justify-between items-center text-emerald-700">
                      <span className="text-[10px] font-black uppercase tracking-widest">Total Amortizado</span>
                      <span className="text-xl font-black font-outfit">${totalPagado.toLocaleString()}</span>
                   </div>
                </div>
             </div>
          ) : null}
        </div>

        {/* Global Footer Financials */}
        <div className="p-8 pt-6 bg-slate-50 border-t border-slate-100 shrink-0">
           <div className="max-w-md ml-auto space-y-3">
              <div className="flex justify-between items-center">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Imponible</span>
                 <span className="text-sm font-bold text-slate-600">${sale.total.toLocaleString()}</span>
              </div>
              
              {returnInfo ? (
                <div className="flex justify-between items-center text-rose-600">
                   <span className="text-[10px] font-black uppercase tracking-widest">Ajuste por Devolución</span>
                   <span className="text-sm font-black">- ${returnInfo.monto_devolucion.toLocaleString()}</span>
                </div>
              ) : null}

              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                 <span className="text-base font-black text-slate-900 font-outfit uppercase">Total Neto de Cierre</span>
                 <span className="text-3xl font-black text-slate-900 font-outfit tracking-tighter">${effectiveTotal.toLocaleString()}</span>
              </div>

              {sale.metodo_pago === 'credito' && sale.saldo_pendiente !== undefined && sale.saldo_pendiente !== null ? (
                 <div className="flex justify-between items-center p-3 bg-amber-100 rounded-xl text-amber-700 animate-pulse">
                    <span className="text-[10px] font-black uppercase tracking-widest">Exposición de Riesgo (Saldo)</span>
                    <span className="text-lg font-black font-outfit">${sale.saldo_pendiente.toLocaleString()}</span>
                 </div>
              ) : null}
           </div>

           <div className="mt-10 flex flex-col sm:flex-row-reverse gap-3">
              <button
                onClick={() => onGeneratePDF(sale)}
                className="flex-1 inline-flex items-center justify-center gap-3 py-5 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-300 hover:bg-slate-800 transition-all active:scale-[0.98]"
              >
                <FileText className="h-5 w-5" />
                Audit PDF Receipt
              </button>
              <button
                onClick={onClose}
                className="px-10 py-5 bg-white border border-slate-200 text-slate-400 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-600 transition-all"
              >
                Finalizar Auditoría
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const getPaymentLabel = (method: string) => {
  const map: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    bancolombia: 'Bancolombia',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    credito: 'Crédito',
  };
  return map[method] || method;
};

export default SalePreviewModal;