import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Check, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDisplayDate } from '../../utils/dateUtils';

interface Return {
  id: string;
  venta_id: string;
  tipo_devolucion: 'total' | 'parcial';
  monto_devolucion: number;
  razon: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  usuario: {
    nombre_completo: string;
  };
  creado_en: string;
  detalles: {
    id: string;
    detalle_venta_id: string;
    cantidad_devuelta: number;
    precio_unitario: number;
    producto: {
      nombre: string;
    };
  }[];
}

interface ReturnApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnId: string;
  onSuccess: () => void;
}

const ReturnApprovalModal: React.FC<ReturnApprovalModalProps> = ({ isOpen, onClose, returnId, onSuccess }) => {
  const { user } = useAuth();
  const [returnData, setReturnData] = useState<Return | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (isOpen && returnId) {
      fetchReturnDetails();
    }
  }, [isOpen, returnId]);

  const fetchReturnDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch return data
      const { data: returnData, error: returnError } = await supabase
        .from('devoluciones')
        .select(`
          *,
          usuario:usuario_id (nombre_completo)
        `)
        .eq('id', returnId)
        .single();

      if (returnError) throw returnError;

      // Fetch return details with product info
      const { data: detailsData, error: detailsError } = await supabase
        .from('detalle_devoluciones')
        .select(`
          *,
          producto:detalle_ventas!inner(
            producto:producto_id(nombre)
          )
        `)
        .eq('devolucion_id', returnId);

      if (detailsError) throw detailsError;

      // Format details data
      const formattedDetails = detailsData.map(detail => ({
        id: detail.id,
        detalle_venta_id: detail.detalle_venta_id,
        cantidad_devuelta: detail.cantidad_devuelta,
        precio_unitario: detail.precio_unitario,
        producto: {
          nombre: detail.producto.producto.nombre
        }
      }));

      setReturnData({
        ...returnData,
        detalles: formattedDetails
      });
    } catch (err: any) {
      console.error('Error fetching return details:', err);
      setError(`Error al cargar los detalles de la devolución: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!user?.id) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('devoluciones')
        .update({
          estado: 'aprobada',
          aprobada_por: user.id,
          fecha_aprobacion: new Date().toISOString()
        })
        .eq('id', returnId);

      if (error) throw error;
      
      onSuccess();
      setSuccessMessage('Devolución aprobada correctamente. Se ha actualizado el stock y ajustado el saldo de la venta.');
      
      // Wait 2 seconds before closing to show success message
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error approving return:', err);
      setError(`Error al aprobar la devolución: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Por favor, ingresa un motivo para rechazar la devolución');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('devoluciones')
        .update({
          estado: 'rechazada',
          aprobada_por: user?.id,
          fecha_aprobacion: new Date().toISOString(),
          notas: rejectReason
        })
        .eq('id', returnId);

      if (error) throw error;
      
      onSuccess();
      setSuccessMessage('Devolución rechazada correctamente.');
      
      // Wait 2 seconds before closing to show success message
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error rejecting return:', err);
      setError(`Error al rechazar la devolución: ${err.message}`);
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
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                <ArrowLeft className="h-6 w-6 text-yellow-600" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg font-medium text-gray-900">
                  Revisar Solicitud de Devolución
                </h3>
                {loading ? (
                  <div className="mt-4 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : error ? (
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
                ) : returnData && (
                  <>
                  {successMessage && (
                    <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
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
                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Tipo de devolución</p>
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            {returnData.tipo_devolucion}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Monto a devolver</p>
                          <p className="text-sm font-medium text-gray-900">
                            ${returnData.monto_devolucion.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Solicitado por</p>
                          <p className="text-sm font-medium text-gray-900">
                            {returnData.usuario.nombre_completo}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Fecha de solicitud</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDisplayDate(returnData.creado_en)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm text-gray-500">Motivo</p>
                        <p className="text-sm font-medium text-gray-900">
                          {returnData.razon}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">
                        Productos a devolver
                      </h4>
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
                            {returnData.detalles.map((detail) => (
                              <tr key={detail.id}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {detail.producto.nombre}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                                  {detail.cantidad_devuelta}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                                  ${(detail.cantidad_devuelta * detail.precio_unitario).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan={2} className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                                Total:
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-right text-primary-600">
                                ${returnData.monto_devolucion.toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                    
                    {showRejectForm ? (
                      <div>
                        <label htmlFor="rejectReason" className="block text-sm font-medium text-gray-700">
                          Motivo del rechazo <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id="rejectReason"
                          rows={3}
                          className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          required
                        />
                        <div className="mt-3 flex justify-end space-x-3">
                          <button
                            type="button"
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            onClick={() => setShowRejectForm(false)}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                            onClick={handleReject}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? 'Procesando...' : 'Confirmar Rechazo'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-yellow-400" />
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Información importante</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                              <ul className="list-disc pl-5 space-y-1">
                                <li>Al aprobar, se restaurará el stock de los productos devueltos</li>
                                <li>Si es una devolución total, la venta se marcará como cancelada</li>
                                <li>Si es una devolución parcial, se ajustará el total de la venta</li>
                                <li>Esta acción no se puede deshacer</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {!showRejectForm && !loading && !successMessage && returnData?.estado === 'pendiente' && (
              <>
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Procesando...' : 'Aprobar Devolución'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isSubmitting}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </button>
              </>
            )}
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:w-auto sm:text-sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReturnApprovalModal;