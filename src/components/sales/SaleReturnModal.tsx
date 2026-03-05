import React, { useState, useEffect } from 'react';
import { ArrowLeft, Minus, Plus, AlertTriangle, Save, X, CheckCircle } from 'lucide-react';
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
      // Initialize return items from sale details
      const items = sale.detalle_ventas.map(detail => ({
        id: crypto.randomUUID(),
        detailId: detail.id,
        productId: detail.producto.id || '',
        name: detail.producto.nombre,
        originalQuantity: detail.cantidad,
        returnQuantity: returnType === 'total' ? detail.cantidad : 0,
        price: detail.precio_unitario
      }));
      
      setReturnItems(items);
      
      if (returnType === 'total') {
        setReturnTotal(sale.total);
      } else {
        setReturnTotal(0);
      }
    }
  }, [isOpen, sale, returnType]);

  useEffect(() => {
    // Calculate return total based on selected items
    const total = returnItems.reduce((sum, item) => sum + (item.returnQuantity * item.price), 0);
    setReturnTotal(total);
  }, [returnItems]);

  const handleReturnTypeChange = (type: 'total' | 'parcial') => {
    setReturnType(type);
    
    // Update return quantities based on type
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
          // Ensure quantity is within valid range
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
    
    // Validate form
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
      // Create return record
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

      // Create return details for each item with quantity > 0
      if (returnItems.filter(item => item.returnQuantity > 0).length === 0) {
        throw new Error('Debes seleccionar al menos un producto para devolver');
      }
      
      const returnDetails = returnItems
        .filter(item => item.returnQuantity > 0)
        .map(item => ({
          devolucion_id: returnData.id,
          detalle_venta_id: item.detailId,
          cantidad_devuelta: item.returnQuantity,
          precio_unitario: item.price
        }));

      if (returnDetails.length > 0) {
        const { error: detailsError } = await supabase
          .from('detalle_devoluciones')
          .insert(returnDetails);

        if (detailsError) throw detailsError;
      }
      
      setSuccessMessage('Solicitud de devolución enviada correctamente. Un administrador revisará y aprobará la devolución.');
      
      // Wait 2 seconds before closing to show success message
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error creating return:', err);
      setError(`Error al procesar la devolución: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-6 w-6 text-yellow-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg font-medium text-gray-900">
                    Procesar Devolución
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Venta #{sale.id.slice(0, 8)} - {new Date(sale.creada_en).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="mt-4 bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700">{successMessage}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tipo de devolución
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className={`px-4 py-2 border rounded-md text-sm font-medium ${
                        returnType === 'parcial' 
                          ? 'bg-primary-50 border-primary-500 text-primary-700' 
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => handleReturnTypeChange('parcial')}
                    >
                      Devolución Parcial
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 border rounded-md text-sm font-medium ${
                        returnType === 'total' 
                          ? 'bg-primary-50 border-primary-500 text-primary-700' 
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => handleReturnTypeChange('total')}
                    >
                      Devolución Total
                    </button>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="returnReason" className="block text-sm font-medium text-gray-700">
                    Motivo de la devolución <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="returnReason"
                    rows={3}
                    className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Productos a devolver
                    {returnType === 'parcial' && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Producto
                          </th>
                          <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cantidad
                          </th>
                          <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {returnItems.map((item) => (
                          <tr key={item.id} className={returnType === 'total' ? 'bg-gray-50' : ''}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                {returnType === 'parcial' ? (
                                  <>
                                    <button
                                      type="button"
                                      className="text-gray-500 hover:text-primary-600 border border-gray-300 rounded-full p-1 disabled:opacity-50"
                                      onClick={() => handleQuantityChange(item.id, item.returnQuantity - 1)}
                                      disabled={item.returnQuantity <= 0}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="mx-2 text-sm text-gray-900 w-8 text-center">
                                      {item.returnQuantity}
                                    </span>
                                    <button
                                      type="button"
                                      className="text-gray-500 hover:text-primary-600 border border-gray-300 rounded-full p-1 disabled:opacity-50"
                                      onClick={() => handleQuantityChange(item.id, item.returnQuantity + 1)}
                                      disabled={item.returnQuantity >= item.originalQuantity}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-900">
                                    {item.originalQuantity}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 text-center mt-1">
                                de {item.originalQuantity}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                              ${(item.returnQuantity * item.price).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            Total a devolver:
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-right text-primary-600">
                            ${returnTotal.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Información importante</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Las devoluciones deben ser aprobadas por un administrador</li>
                          <li>El stock se actualizará automáticamente una vez aprobada</li>
                          <li>Para ventas a crédito, el saldo pendiente se ajustará</li>
                          <li>No se puede deshacer una devolución una vez aprobada</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isSubmitting || returnTotal <= 0}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                title={returnTotal <= 0 ? "Debes seleccionar al menos un producto para devolver" : ""}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Registrar Devolución
                  </>
                )}
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
                disabled={isSubmitting}
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

export default SaleReturnModal;