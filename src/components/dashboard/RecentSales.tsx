import React from 'react';
import { Eye, FileText, Calendar, Truck } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';

interface Sale {
  id: string;
  creada_en: string;
  usuario: {
    nombre_completo: string;
  };
  total: number;
  metodo_pago: string;
  estado: 'pagada' | 'pendiente' | 'cancelada';
  es_domicilio: boolean;
  costo_domicilio: number;
  cliente?: {
    nombre_completo: string;
    telefono: string;
  };
  detalle_ventas: {
    id: string;
    cantidad: number;
    precio_unitario: number;
    producto: {
      nombre: string;
      sku: string;
    };
  }[];
}

interface RecentSalesProps {
  sales: Sale[];
  onViewSale: (sale: Sale) => void;
  onGeneratePDF: (sale: Sale) => void;
}

const RecentSales: React.FC<RecentSalesProps> = ({ sales, onViewSale, onGeneratePDF }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Ventas Recientes</h2>
        <button className="text-sm text-primary-600 hover:text-primary-700">
          Ver todas
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orden ID
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sales.map((sale) => (
              <tr key={sale.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  #{sale.id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                    {formatDisplayDate(sale.creada_en)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {sale.cliente ? (
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {sale.cliente.nombre_completo}
                      </div>
                      <div className="text-sm text-gray-500">
                        {sale.cliente.telefono}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    sale.es_domicilio ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {sale.es_domicilio ? (
                      <>
                        <Truck className="h-3 w-3 mr-1" />
                        Domicilio
                      </>
                    ) : (
                      'Local'
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    ${sale.total.toLocaleString()}
                  </div>
                  {sale.es_domicilio && (
                    <div className="text-xs text-gray-500">
                      Envío: ${sale.costo_domicilio.toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    sale.estado === 'pagada' ? 'bg-green-100 text-green-800' :
                    sale.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {sale.estado}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button 
                      className="text-primary-600 hover:text-primary-900 group relative"
                      onClick={() => onViewSale(sale)}
                    >
                      <Eye className="h-5 w-5" />
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Previsualizar venta
                      </span>
                    </button>
                    <button 
                      className="text-gray-600 hover:text-gray-900 group relative"
                      onClick={() => onGeneratePDF(sale)}
                    >
                      <FileText className="h-5 w-5" />
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Descargar ticket
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {sales.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-3 text-center text-sm text-gray-500">
                  No hay ventas recientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentSales;