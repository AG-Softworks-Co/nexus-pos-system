import React from 'react';
import { Eye, FileText, Calendar, Edit, Trash2, RefreshCw, User, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Sale } from '../../types/sales';

interface SalesTableProps {
  sales: Sale[];
  onViewSale: (sale: Sale) => void;
  onReturnSale: (sale: Sale) => void;
  onReturnSale: (sale: Sale) => void;
  onEditSale: (sale: Sale) => void;
  onGeneratePDF: (sale: Sale) => void;
  historyFilter?: string;
}

export const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(dateString).toLocaleDateString('es-ES', options);
};

const SalesTable: React.FC<SalesTableProps> = ({ sales, onViewSale, onReturnSale, onEditSale, onDeleteSale, onGeneratePDF, historyFilter }) => {
  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha y Hora
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendedor
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Historial
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sales.map((sale) => (
              <tr key={sale.id} className={`hover:bg-gray-50 ${sale._isDeleted ? 'bg-red-50' : sale.version && sale.version > 1 ? 'bg-yellow-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  #{sale.id.slice(0, 8)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                    {formatDate(sale.creada_en)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {sale.usuario.nombre_completo}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {sale.cliente ? (
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-1 text-gray-400" />
                      <div className="text-sm font-medium text-gray-900">
                        {sale.cliente.nombre_completo}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    ${sale.total.toLocaleString()}
                  </div>
                  {sale._hasReturns && (
                    <div className="text-xs text-red-500 flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Con devolución
                    </div>
                  )}
                  {sale.es_domicilio && (
                    <div className="text-xs text-gray-500">
                      Envío: ${sale.costo_domicilio.toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    sale._isDeleted ? 'bg-red-100 text-red-800' :
                    sale.estado_pago === 'pagado' ? 'bg-green-100 text-green-800' :
                    sale.estado_pago === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    sale.estado_pago === 'parcial' ? 'bg-blue-100 text-blue-800' :
                    sale.estado_pago === 'vencido' ? 'bg-red-100 text-red-800' :
                    sale.estado_pago === 'pagado' ? 'bg-green-100 text-green-800' :
                    sale.estado_pago === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    sale.estado_pago === 'parcial' ? 'bg-blue-100 text-blue-800' :
                    sale.estado_pago === 'vencido' ? 'bg-red-100 text-red-800' :
                    sale.estado === 'pagada' ? 'bg-green-100 text-green-800' :
                    sale.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {sale._isDeleted ? 'Eliminada' : sale.estado_pago || sale.estado}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col space-y-1">
                    {sale._isDeleted && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Eliminada
                      </span>
                    )}
                    {sale.version && sale.version > 1 && !sale._isDeleted && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        Editada (v{sale.version})
                      </span>
                    )}
                    {!sale._isDeleted && (!sale.version || sale.version <= 1) && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        Original
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {sale._isDeleted ? (
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        className="text-gray-600 hover:text-gray-900 group relative p-1"
                        onClick={() => onViewSale(sale)}
                      >
                        <Eye className="h-5 w-5" />
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Ver venta eliminada
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        className="text-primary-600 hover:text-primary-900 group relative p-1"
                        onClick={() => onViewSale(sale)}
                      >
                        <Eye className="h-5 w-5" />
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Previsualizar venta
                        </span>
                      </button>
                      <button 
                        className="text-gray-600 hover:text-gray-900 group relative p-1"
                        onClick={() => {
                          console.log('🎫 Botón PDF clickeado desde tabla, sale:', sale);
                          onGeneratePDF(sale);
                        }}
                      >
                        <FileText className="h-5 w-5" />
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Descargar ticket
                        </span>
                      </button>
                      <button 
                        className="text-blue-600 hover:text-blue-900 group relative p-1"
                        onClick={() => onReturnSale(sale)}
                      >
                        <RefreshCw className="h-5 w-5" />
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Devolución
                        </span>
                      </button>
                      {sale.puede_editarse && (
                        <button 
                          className="text-blue-600 hover:text-blue-900 group relative p-1"
                          onClick={() => onEditSale(sale)}
                        >
                          <Edit className="h-5 w-5" />
                          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            Editar venta
                          </span>
                        </button>
                      )}
                      <button 
                        className="text-red-600 hover:text-red-900 group relative p-1"
                        onClick={() => onDeleteSale(sale)}
                      >
                        <Trash2 className="h-5 w-5" />
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Eliminar venta
                        </span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            
            {sales.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                  No se encontraron ventas con los filtros seleccionados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesTable;