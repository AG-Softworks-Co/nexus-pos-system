import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Sale } from '../../types/sales';

interface SaleDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onSuccess: () => void;
}

const SaleDeleteModal: React.FC<SaleDeleteModalProps> = ({ isOpen, onClose, sale, onSuccess }) => {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (confirmText !== 'ELIMINAR') {
      setError('Por favor, escribe "ELIMINAR" para confirmar');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Delete the sale - the trigger will handle related records
      const { error: saleError } = await supabase
        .from('ventas')
        .delete()
        .eq('id', sale.id);

      if (saleError) throw saleError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error deleting sale:', err);
      setError(`Error al eliminar la venta: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true" onClick={onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">​</span>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-red-50 px-4 py-5 sm:p-6">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                <Trash2 className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg font-bold text-red-800" id="modal-title">
                  Eliminar Venta
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-red-700">
                    ¿Estás seguro de que deseas eliminar esta venta? Esta acción no se puede deshacer.
                  </p>
                  <div className="mt-4 p-4 bg-red-100 rounded-md border border-red-300">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">Advertencia:</p>
                        <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                          <li>Se eliminarán todos los detalles de la venta</li>
                          <li>Se eliminarán todos los pagos parciales asociados</li>
                          <li>Esta acción no puede deshacerse</li>
                          <li>No se restaurará automáticamente el stock de productos</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label htmlFor="confirm-delete" className="block text-sm font-medium text-red-700">
                    Escribe "ELIMINAR" para confirmar:
                  </label>
                  <input
                    type="text"
                    id="confirm-delete"
                    className="mt-1 focus:ring-red-500 focus:border-red-500 block w-full shadow-sm sm:text-sm border-red-300 rounded-md"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                </div>
                
                {error && (
                  <div className="mt-3 text-sm text-red-600">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== 'ELIMINAR'}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar Venta'}
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleDeleteModal;