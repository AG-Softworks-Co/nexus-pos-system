import React, { useState, useEffect } from 'react';
import { Edit3, Save, X, AlertCircle } from 'lucide-react';
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
    }
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
      const updateData: any = {
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
    } catch (err: any) {
      console.error('Error updating sale:', err);
      setError(`Error al actualizar la venta: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true" onClick={onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">​</span>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 sm:mx-0 sm:h-10 sm:w-10">
                  <Edit3 className="h-6 w-6 text-primary-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg font-medium text-gray-900" id="modal-title">
                    Editar Venta
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    ID: {sale.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="razon_edicion" className="block text-sm font-medium text-gray-700">
                    Razón de la edición <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="razon_edicion"
                    rows={2}
                    className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    value={formData.razon_edicion}
                    onChange={(e) => setFormData({...formData, razon_edicion: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="notas" className="block text-sm font-medium text-gray-700">
                    Notas de la venta
                  </label>
                  <textarea
                    id="notas"
                    rows={3}
                    className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    value={formData.notas}
                    onChange={(e) => setFormData({...formData, notas: e.target.value})}
                  />
                </div>
                
                {sale.metodo_pago === 'credito' && (
                  <div>
                    <label htmlFor="fecha_vencimiento" className="block text-sm font-medium text-gray-700">
                      Fecha de vencimiento
                    </label>
                    <input
                      type="date"
                      id="fecha_vencimiento"
                      className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={formData.fecha_vencimiento_credito}
                      onChange={(e) => setFormData({...formData, fecha_vencimiento_credito: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SaleEditModal;