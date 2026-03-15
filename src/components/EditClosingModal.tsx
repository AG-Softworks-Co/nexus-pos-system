import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign, AlertTriangle, Edit3, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

import { CashClosing } from '../types/cash';

interface EditClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  closing: CashClosing | null;
  onSuccess: () => void;
}

const EditClosingModal: React.FC<EditClosingModalProps> = ({ isOpen, onClose, closing, onSuccess }) => {
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (closing) {
      setCountedCash((closing.efectivo_contado || 0).toString());
      setNotes(closing.notas || '');
    }
  }, [closing]);

  if (!isOpen || !closing) return null;

  // Expected cash calculation (same logic as in summary)
  const expectedCash = (closing.monto_apertura || 0) + 
                       (closing.total_efectivo || 0) + 
                       (closing.total_ingresos || 0) - 
                       (closing.total_egresos || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const newCounted = parseFloat(countedCash);
      if (isNaN(newCounted)) {
         toast.error('Ingrese un monto válido');
         setLoading(false);
         return;
      }

      const { error } = await supabase
        .from('cierres_caja')
        .update({
          efectivo_contado: newCounted,
          notas: notes
        })
        .eq('id', closing.id);

      if (error) throw error;

      toast.success('Cierre actualizado correctamente');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating closing:', err);
      toast.error('Error al actualizar el cierre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
             <div className="bg-amber-100 p-2 rounded-xl">
                <Edit3 className="h-5 w-5 text-amber-600" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-900">Corregir Turno</h3>
                <p className="text-xs text-slate-500 font-medium">Auditoría administrativa de caja</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* Alert Card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex space-x-4">
            <div className="shrink-0 bg-amber-500/10 p-2 h-fit rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900 leading-tight">Acción Irreversible</p>
              <p className="text-xs text-amber-700 leading-relaxed font-medium">
                Estás modificando un registro histórico. El sistema recalculará la diferencia final basada en el nuevo monto contado ingresado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Expected Info */}
             <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                   <Info className="w-3 h-3 mr-1" /> Caja Sistema
                </div>
                <p className="text-xl font-black text-slate-900">${expectedCash.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-1">Monto esperado según transacciones</p>
             </div>

             {/* Input Field */}
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Efectivo Real Contado</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  </div>
                  <input
                    type="number"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    step="any"
                    className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-slate-900 font-bold transition-all"
                    required
                    placeholder="0.00"
                  />
                </div>
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Notas de Corrección / Justificación</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="block w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 text-sm text-slate-700 transition-all resize-none"
              placeholder="Especifique el motivo de este cambio para el historial de auditoría..."
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex justify-center items-center px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-primary-200 transition-all disabled:opacity-50 disabled:grayscale"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Procesando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditClosingModal;
