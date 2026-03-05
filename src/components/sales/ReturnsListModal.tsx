import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Eye, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDisplayDate } from '../../utils/dateUtils';
import ReturnApprovalModal from './ReturnApprovalModal';

interface Return {
  id: string;
  venta_id: string;
  tipo_devolucion: string;
  monto_devolucion: number;
  razon: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  usuario: {
    nombre_completo: string;
  };
  creado_en: string;
}

interface ReturnsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId?: string;
}

const ReturnsListModal: React.FC<ReturnsListModalProps> = ({ isOpen, onClose, saleId }) => {
  const { user } = useAuth();
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (isOpen && user?.negocioId) {
      fetchReturns();
    }
  }, [isOpen, user, saleId, statusFilter, refreshTrigger]);

  const fetchReturns = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('devoluciones')
        .select(`
          *,
          usuario:usuario_id (nombre_completo)
        `)
        .eq('negocio_id', user?.negocioId);
      
      if (saleId) {
        query = query.eq('venta_id', saleId);
      }
      
      if (statusFilter !== 'all') {
        query = query.eq('estado', statusFilter);
      }
      
      query = query.order('creado_en', { ascending: false });
      
      const { data, error } = await query;

      if (error) throw error;
      setReturns(data || []);
    } catch (err: any) {
      console.error('Error fetching returns:', err);
      setError(`Error al cargar las devoluciones: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReturn = (returnId: string) => {
    setSelectedReturnId(returnId);
    setShowApprovalModal(true);
  };
  
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendiente':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Pendiente
          </span>
        );
      case 'aprobada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Aprobada
          </span>
        );
      case 'rechazada':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rechazada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" onClick={onClose}>
            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
          </div>
          
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-6 w-6 text-blue-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 className="text-lg font-medium text-gray-900">
                    {saleId ? 'Devoluciones de esta venta' : 'Todas las devoluciones'}
                  </h3>
                  
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center">
                        <p className="text-sm text-gray-500 mr-2">
                          {returns.length} devoluciones encontradas
                        </p>
                        <button 
                          onClick={handleRefresh}
                          className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                          title="Actualizar"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <select
                        className="focus:ring-primary-500 focus:border-primary-500 h-full py-0 pl-2 pr-7 border-gray-300 bg-white text-gray-500 sm:text-sm rounded-md"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="all">Todos los estados</option>
                        <option value="pendiente">Pendientes</option>
                        <option value="aprobada">Aprobadas</option>
                        <option value="rechazada">Rechazadas</option>
                      </select>
                    </div>
                    
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      </div>
                    ) : error ? (
                      <div className="bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                          </div>
                        </div>
                      </div>
                    ) : returns.length === 0 ? (
                      <div className="text-center py-8">
                        <ArrowLeft className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No se encontraron devoluciones</p>
                        {statusFilter !== 'all' && (
                          <p className="text-sm text-gray-400 mt-2">
                            Prueba cambiando el filtro de estado
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Solicitante
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Tipo
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Monto
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estado
                              </th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {returns.map((returnItem) => (
                              <tr key={returnItem.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatDisplayDate(returnItem.creado_en)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {returnItem.usuario.nombre_completo}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                  {returnItem.tipo_devolucion}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  ${returnItem.monto_devolucion.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {getStatusBadge(returnItem.estado)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleViewReturn(returnItem.id)}
                                    className="text-primary-600 hover:text-primary-900 p-1 rounded-full hover:bg-primary-50"
                                    title="Ver detalles"
                                  >
                                    <Eye className="h-5 w-5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {showApprovalModal && selectedReturnId && (
        <ReturnApprovalModal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          returnId={selectedReturnId}
          onSuccess={() => {
            handleRefresh();
            setShowApprovalModal(false);
          }}
        />
      )}
    </>
  );
};

export default ReturnsListModal;