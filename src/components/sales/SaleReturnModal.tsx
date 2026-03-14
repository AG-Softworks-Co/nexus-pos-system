import React, { useState, useEffect } from 'react';
import { Minus, Plus, AlertTriangle, X, CheckCircle, RefreshCw, ShoppingBag, Info, History, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Sale } from '../../types/sales';

interface SaleReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onSuccess: () => void;
}

const SaleReturnModal: React.FC<SaleReturnModalProps> = ({ isOpen, onClose, sale, onSuccess }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnType, setReturnType] = useState<'total' | 'parcial'>('parcial');
  const [returnReason, setReturnReason] = useState('');
  const [returnItems, setReturnItems] = useState<{
    id: string;
    detailId: string;
    productId: string;
    name: string;
    originalQuantity: number;
    returnQuantity: number;
    price: number;
  }[]>([]);
  const [returnTotal, setReturnTotal] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sale) {
      const items = (sale.detalle_ventas || []).map(detail => ({
        id: crypto.randomUUID(),
        detailId: detail.id,
        productId: detail.producto?.id || '',
        name: detail.producto?.nombre || 'Producto no identificado',
        originalQuantity: detail.cantidad,
        returnQuantity: returnType === 'total' ? detail.cantidad : 0,
        price: detail.precio_unitario
      }));
      setReturnItems(items);
      setReturnTotal(returnType === 'total' ? sale.total : 0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, sale, returnType]);

  useEffect(() => {
    const total = returnItems.reduce((sum, item) => sum + (item.returnQuantity * item.price), 0);
    setReturnTotal(total);
  }, [returnItems]);

  const handleReturnTypeChange = (type: 'total' | 'parcial') => {
    setReturnType(type);
    setReturnItems(prevItems => 
      prevItems.map(item => ({
        ...item,
        returnQuantity: type === 'total' ? item.originalQuantity : 0
      }))
    );
  };

  const handleQuantityChange = (id: string, newQuantity: number) => {
    setReturnItems(prevItems => 
      prevItems.map(item => {
        if (item.id === id) {
          const validQuantity = Math.max(0, Math.min(newQuantity, item.originalQuantity));
          return { ...item, returnQuantity: validQuantity };
        }
        return item;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!returnReason.trim()) {
      setError('Por favor, ingresa un motivo para la devolución');
      return;
    }

    if (returnType === 'parcial' && returnTotal <= 0) {
      setError('Debes seleccionar al menos un producto para devolver');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: returnData, error: returnError } = await supabase
        .from('devoluciones')
        .insert({
          venta_id: sale.id,
          negocio_id: user?.negocioId,
          usuario_id: user?.id,
          tipo_devolucion: returnType,
          monto_devolucion: returnTotal,
          razon: returnReason,
          estado: 'pendiente'
        })
        .select()
        .single();

      if (returnError) throw returnError;

      const activeReturnItems = returnItems.filter(item => item.returnQuantity > 0);
      if (activeReturnItems.length === 0) {
        throw new Error('Debes seleccionar al menos un producto para devolver');
      }
      
      const returnDetails = activeReturnItems.map(item => ({
        devolucion_id: returnData.id,
        detalle_venta_id: item.detailId,
        cantidad_devuelta: item.returnQuantity,
        precio_unitario: item.price
      }));

      const { error: detailsError } = await supabase
        .from('detalle_devoluciones')
        .insert(returnDetails);

      if (detailsError) throw detailsError;
      
      setSuccessMessage('Solicitud generada con éxito. Pendiente de aprobación administrativa.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error creating return:', err);
      setError(`Error al procesar la devolución: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl animate-in zoom-in slide-in-from-bottom duration-400 flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header Premium */}
        <div className="p-8 pb-6 border-b border-slate-50 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-6">
             <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                <RefreshCw className="h-8 w-8" />
             </div>
             <div>
                <div className="flex items-center gap-2 mb-1">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo de Retorno</span>
                   <span className="px-3 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-widest">Venta #{sale.id.slice(0, 8)}</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 font-outfit leading-none tracking-tight">Procesar Devolución</h3>
                <p className="text-slate-500 font-bold text-[10px] mt-2 flex items-center gap-2 uppercase tracking-tighter">
                   <Info className="h-3 w-3 opacity-40 text-indigo-600" /> Los cambios requieren aprobación administrativa
                </p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-full transition-all border border-transparent hover:border-slate-100">
            <X className="h-6 w-6 text-slate-300" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 scrollbar-hide">
          {error && (
            <div className="bg-rose-50 border border-rose-100 p-5 rounded-[1.5rem] flex items-start gap-4 animate-in slide-in-from-top">
              <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1">Fallo en Proceso</p>
                <p className="text-sm font-black text-rose-900 leading-tight">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2rem] flex flex-col items-center text-center gap-4 animate-in zoom-in">
              <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-black text-emerald-900 font-outfit">¡Operación Registrada!</p>
                <p className="text-sm font-bold text-emerald-600/70 mt-1">{successMessage}</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
             {/* Tipo de Devolución */}
             <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Tipo de Alcance</label>
                <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-50 rounded-[1.5rem] border border-slate-100">
                   <button
                     type="button"
                     className={`flex items-center justify-center gap-2 py-4 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest transition-all ${returnType === 'parcial' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
                     onClick={() => handleReturnTypeChange('parcial')}
                   >
                     <ShoppingBag className="h-4 w-4" />
                     Parcial
                   </button>
                   <button
                     type="button"
                     className={`flex items-center justify-center gap-2 py-4 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest transition-all ${returnType === 'total' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
                     onClick={() => handleReturnTypeChange('total')}
                   >
                     <Package className="h-4 w-4" />
                     Total
                   </button>
                </div>
             </div>

             {/* Motivo */}
             <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Justificación de Retorno <span className="text-rose-500">*</span></label>
                <div className="relative group">
                   <History className="absolute left-6 top-5 h-5 w-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                   <textarea
                     placeholder="Motivo detallado de la devolución..."
                     rows={3}
                     className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all resize-none"
                     value={returnReason}
                     onChange={(e) => setReturnReason(e.target.value)}
                     required
                   />
                </div>
             </div>

             {/* Tabla de Productos Modernizada */}
             <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selección de Items</label>
                   <span className="text-[10px] font-black text-slate-900">{returnItems.length} Referencias</span>
                </div>
                
                <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                   <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-50 grid grid-cols-4 gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <div className="col-span-2">Producto</div>
                      <div className="text-center">Cant.</div>
                      <div className="text-right">Subtotal</div>
                   </div>
                   <div className="divide-y divide-slate-50 max-h-60 overflow-y-auto scrollbar-hide">
                      {returnItems.map((item) => (
                        <div key={item.id} className={`px-6 py-4 transition-colors ${item.returnQuantity > 0 ? 'bg-indigo-50/30' : 'hover:bg-slate-50/30'}`}>
                           <div className="grid grid-cols-4 gap-4 items-center">
                              <div className="col-span-2 min-w-0">
                                 <p className="text-xs font-black text-slate-800 truncate leading-none mb-1">{item.name}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Unit: ${item.price.toLocaleString()}</p>
                              </div>
                              <div className="flex flex-col items-center gap-1.5">
                                 {returnType === 'parcial' ? (
                                   <div className="flex items-center bg-white p-1 rounded-full shadow-sm border border-slate-200">
                                      <button
                                        type="button"
                                        className="h-6 w-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-20 transition-all font-outfit"
                                        onClick={() => handleQuantityChange(item.id, item.returnQuantity - 1)}
                                        disabled={item.returnQuantity <= 0}
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <span className="w-8 text-center text-xs font-black text-slate-900">
                                        {item.returnQuantity}
                                      </span>
                                      <button
                                        type="button"
                                        className="h-6 w-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-20 transition-all font-outfit"
                                        onClick={() => handleQuantityChange(item.id, item.returnQuantity + 1)}
                                        disabled={item.returnQuantity >= item.originalQuantity}
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                   </div>
                                 ) : (
                                   <span className="text-xs font-black text-slate-900 px-3 py-1 bg-white rounded-full shadow-sm border border-slate-100">{item.originalQuantity}</span>
                                 )}
                                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">max: {item.originalQuantity}</span>
                              </div>
                              <div className="text-right">
                                 <p className="text-xs font-black text-slate-900 font-outfit">${(item.returnQuantity * item.price).toLocaleString()}</p>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                   <div className="px-6 py-4 bg-indigo-600/5 flex justify-between items-center text-indigo-700">
                      <span className="text-[10px] font-black uppercase tracking-widest">Impacto Financiero Estimado</span>
                      <span className="text-lg font-black font-outfit">${returnTotal.toLocaleString()}</span>
                   </div>
                </div>
             </div>

             <div className="bg-indigo-50/50 p-6 rounded-[1.5rem] border border-indigo-100/50 flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Información de Auditoría</p>
                   <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight leading-relaxed">
                      El stock y el saldo comercial se ajustarán solo al ser aprobada por Gerencia.
                   </p>
                </div>
             </div>
          </div>
        </div>

        {/* Global Footer Financials */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row-reverse gap-3 shrink-0">
           <button
             onClick={handleSubmit}
             disabled={isSubmitting || returnTotal <= 0}
             className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-300 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-40"
           >
             {isSubmitting ? 'Registrando Devolución...' : 'Aplicar Solicitud'}
           </button>
           <button
             onClick={onClose}
             disabled={isSubmitting}
             className="px-10 py-5 bg-white border border-slate-200 text-slate-400 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-600 transition-all font-outfit"
           >
             Cancelar
           </button>
        </div>
      </div>
    </div>
  );
};

export default SaleReturnModal;