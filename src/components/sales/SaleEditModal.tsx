import React, { useState, useEffect } from 'react';
import { Edit3, X, AlertCircle, Calendar, FileText, Info, History } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Sale } from '../../types/sales';

interface SaleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onSuccess: () => void;
}

const SaleEditModal: React.FC<SaleEditModalProps> = ({ isOpen, onClose, sale, onSuccess }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    razon_edicion: '',
    notas: sale.notas || '',
    fecha_vencimiento_credito: sale.fecha_vencimiento_credito ? new Date(sale.fecha_vencimiento_credito).toISOString().split('T')[0] : ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        razon_edicion: '',
        notas: sale.notas || '',
        fecha_vencimiento_credito: sale.fecha_vencimiento_credito ? new Date(sale.fecha_vencimiento_credito).toISOString().split('T')[0] : ''
      });
      setError(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, sale]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.razon_edicion.trim()) {
      setError('Debes proporcionar una razón para la edición');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: {
        notas: string | null;
        editada_por: string | undefined;
        razon_edicion: string;
        fecha_vencimiento_credito?: string;
      } = {
        notas: formData.notas || null,
        editada_por: user?.id,
        razon_edicion: formData.razon_edicion
      };

      if (sale.metodo_pago === 'credito' && formData.fecha_vencimiento_credito) {
        updateData.fecha_vencimiento_credito = new Date(formData.fecha_vencimiento_credito).toISOString();
      }

      const { error: updateError } = await supabase
        .from('ventas')
        .update(updateData)
        .eq('id', sale.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error updating sale:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al actualizar la venta: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl animate-in zoom-in slide-in-from-bottom duration-400 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Premium */}
        <div className="p-8 pb-6 border-b border-slate-50 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-6">
             <div className="h-16 w-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-inner">
                <Edit3 className="h-8 w-8" />
             </div>
             <div>
                <div className="flex items-center gap-2 mb-1">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Módulo de Corrección</span>
                   <span className="px-3 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-widest">Venta #{sale.id.slice(0, 8)}</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 font-outfit leading-none tracking-tight">Editar Registro</h3>
                <p className="text-slate-500 font-bold text-[10px] mt-2 flex items-center gap-2 uppercase tracking-tighter">
                   <History className="h-3 w-3 opacity-40 text-amber-600" /> Los cambios quedarán auditados en el historial
                </p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-full transition-all border border-transparent hover:border-slate-100">
            <X className="h-6 w-6 text-slate-300" />
          </button>
        </div>

        {/* Cuerpo del Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
           {error && (
              <div className="bg-rose-50 border border-rose-100 p-5 rounded-[1.5rem] flex items-start gap-4 animate-in slide-in-from-top">
                <AlertCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-none mb-1">Error Detectado</p>
                  <p className="text-sm font-black text-rose-900 leading-tight">{error}</p>
                </div>
              </div>
           )}

           <div className="space-y-6">
              {/* Razón de Edición (Campo Crítico) */}
              <div className="space-y-3">
                 <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Justificación Auditoría <span className="text-rose-500">*</span></label>
                 </div>
                 <div className="relative group">
                    <History className="absolute left-6 top-5 h-5 w-5 text-slate-300 group-focus-within:text-amber-500 transition-colors" />
                    <textarea
                      placeholder="Ej: Error en el precio unitario pactado..."
                      rows={3}
                      className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-amber-50 focus:border-amber-200 transition-all resize-none"
                      value={formData.razon_edicion}
                      onChange={(e) => setFormData({...formData, razon_edicion: e.target.value})}
                      required
                    />
                 </div>
              </div>

              {/* Notas de la Venta */}
              <div className="space-y-3">
                 <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contexto Transaccional (Opcional)</label>
                 </div>
                 <div className="relative group">
                    <FileText className="absolute left-6 top-5 h-5 w-5 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
                    <textarea
                      placeholder="Información adicional sobre la venta..."
                      rows={4}
                      className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-primary-50 focus:border-primary-200 transition-all resize-none"
                      value={formData.notas}
                      onChange={(e) => setFormData({...formData, notas: e.target.value})}
                    />
                 </div>
              </div>

              {/* Fecha de Vencimiento (Solo Crédito) */}
              {sale.metodo_pago === 'credito' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                   <div className="flex items-center justify-between px-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Corte de Vencimiento de Crédito</label>
                   </div>
                   <div className="relative group">
                      <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        type="date"
                        className="w-full pl-16 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all uppercase tracking-widest"
                        value={formData.fecha_vencimiento_credito}
                        onChange={(e) => setFormData({...formData, fecha_vencimiento_credito: e.target.value})}
                        min={new Date().toISOString().split('T')[0]}
                      />
                   </div>
                </div>
              )}
           </div>

           <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-start gap-4">
              <Info className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                 Esta acción solo modifica los metadatos de la venta. Para cambios en productos o montos, use el módulo de devoluciones.
              </p>
           </div>
        </form>

        {/* Footer de Acciones */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row-reverse gap-3 shrink-0">
           <button
             onClick={handleSubmit}
             disabled={isSubmitting}
             className="flex-1 py-5 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-300 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-40"
           >
             {isSubmitting ? 'Guardando Cambios...' : 'Actualizar Registro'}
           </button>
           <button
             onClick={onClose}
             disabled={isSubmitting}
             className="px-10 py-5 bg-white border border-slate-200 text-slate-400 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:text-slate-600 transition-all font-outfit"
           >
             Descartar
           </button>
        </div>
      </div>
    </div>
  );
};

export default SaleEditModal;