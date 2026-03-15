import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Sale } from '../../types/sales';

interface SaleDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onSuccess: () => void;
}

const SaleDeleteModal: React.FC<SaleDeleteModalProps> = ({ isOpen, onClose, sale, onSuccess }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setError(null);
      // Lock body scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmText.toUpperCase() !== 'ELIMINAR') {
      setError('Por favor, escribe "ELIMINAR" para confirmar');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // The trigger handles related records, but we ensure clean deletion
      const { error: saleError } = await supabase
        .from('ventas')
        .delete()
        .eq('id', sale.id);

      if (saleError) throw saleError;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error deleting sale:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error al anular la venta: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl animate-in zoom-in slide-in-from-bottom duration-400 overflow-hidden">
        {/* Header de Riesgo */}
        <div className="bg-rose-50 p-8 pb-10 border-b border-rose-100 flex flex-col items-center text-center">
           <div className="h-20 w-20 rounded-[2rem] bg-rose-100 flex items-center justify-center text-rose-600 mb-6 shadow-inner ring-8 ring-rose-50">
              <ShieldAlert className="h-10 w-10 animate-pulse" />
           </div>
           
           <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em]">Protocolo de Seguridad</span>
           </div>
           <h3 className="text-3xl font-black text-rose-900 font-outfit leading-none mb-3">Anular Operación</h3>
           <p className="text-rose-700/60 font-medium text-sm max-w-[280px]">Estás a punto de eliminar de forma permanente la Venta <span className="font-black text-rose-900">#{sale.id.slice(0, 8)}</span></p>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-8 space-y-6">
           <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="h-8 w-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-rose-500 shrink-0 mt-1">
                    <AlertTriangle className="h-4 w-4" />
                 </div>
                 <div className="space-y-2">
                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Impacto en el Sistema</p>
                    <ul className="space-y-1.5">
                       <li className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                          <div className="h-1 w-1 rounded-full bg-rose-400" /> Se eliminarán todos los pagos asociados
                       </li>
                       <li className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                          <div className="h-1 w-1 rounded-full bg-rose-400" /> El registro contable será borrado permanentemente
                       </li>
                       <li className="flex items-center gap-2 text-[11px] font-bold text-slate-500 font-black text-rose-600">
                          <div className="h-1 w-1 rounded-full bg-rose-600" /> Esta acción NO restaura el stock automáticamente
                       </li>
                    </ul>
                 </div>
              </div>

              <div className="space-y-3">
                 <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmación Requerida</label>
                    <span className="text-[10px] font-bold text-rose-500 uppercase">Input Crítico</span>
                 </div>
                 <div className="relative group">
                    <input
                      type="text"
                      placeholder='Escribe "ELIMINAR" para proceder'
                      className={`w-full px-6 py-5 bg-slate-50 border-2 ${error ? 'border-rose-500' : 'border-slate-100'} rounded-[1.5rem] text-sm font-black uppercase tracking-widest text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all text-center`}
                      value={confirmText}
                      onChange={(e) => {
                        setConfirmText(e.target.value);
                        if (error) setError(null);
                      }}
                    />
                    {confirmText.toUpperCase() === 'ELIMINAR' && (
                       <div className="absolute right-6 top-1/2 -translate-y-1/2 animate-in zoom-in">
                          <AlertCircle className="h-5 w-5 text-emerald-500" />
                       </div>
                    )}
                 </div>
              </div>

              {error && (
                <div className="animate-in slide-in-from-top-2 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3">
                   <Info className="h-4 w-4 text-rose-500 shrink-0" />
                   <p className="text-xs font-black text-rose-700 uppercase">{error}</p>
                </div>
              )}
           </div>

           <div className="flex flex-col gap-3">
              <button
                onClick={handleDelete}
                disabled={isDeleting || confirmText.toUpperCase() !== 'ELIMINAR'}
                className="w-full py-5 bg-rose-600 text-white rounded-[1.8rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-200 hover:bg-rose-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:scale-100 disabled:shadow-none"
              >
                {isDeleting ? 'Procesando Anulación...' : 'Confirmar Eliminación'}
              </button>
              <button
                onClick={onClose}
                disabled={isDeleting}
                className="w-full py-5 bg-white border-2 border-slate-50 text-slate-400 rounded-[1.8rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-50 hover:text-slate-600 transition-all font-outfit"
              >
                Cancelar Operación
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SaleDeleteModal;