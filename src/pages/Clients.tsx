import React, { useState, useEffect } from 'react';
import { Search, User, Phone, Mail, MapPin, Calendar, ShoppingCart, CreditCard, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDisplayDate } from '../utils/dateUtils';

interface Client {
  id: string;
  nombre_completo: string;
  telefono: string | null;
  correo: string | null;
  direccion?: string | null;
  creado_en: string;
  total_ventas?: number;
  total_credito?: number;
  ultima_venta?: string;
}

interface ClientSale {
  id: string;
  creada_en: string;
  total: number;
  metodo_pago: string;
  estado: string;
  estado_pago?: string;
  saldo_pendiente?: number;
}

const Clients: React.FC = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSales, setClientSales] = useState<ClientSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    nombre_completo: '',
    telefono: '',
    correo: '',
    direccion: ''
  });

  useEffect(() => {
    if (user?.negocioId) {
      fetchClients();
    }
  }, [user]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          *,
          ventas:ventas(count),
          ventas_totales:ventas(total),
          ventas_credito:ventas(total, saldo_pendiente)
        `)
        .eq('negocio_id', user?.negocioId)
        .order('creado_en', { ascending: false });

      if (error) throw error;

      const processedClients = data?.map(client => ({
        ...client,
        total_ventas: client.ventas_totales?.reduce((sum: number, venta: any) => sum + venta.total, 0) || 0,
        total_credito: client.ventas_credito?.reduce((sum: number, venta: any) => sum + (venta.saldo_pendiente || 0), 0) || 0,
        ultima_venta: client.ventas_totales?.[0]?.creada_en
      })) || [];

      setClients(processedClients);
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientSales = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('id, creada_en, total, metodo_pago, estado, estado_pago, saldo_pendiente')
        .eq('cliente_id', clientId)
        .order('creada_en', { ascending: false });

      if (error) throw error;
      setClientSales(data || []);
    } catch (err: any) {
      console.error('Error fetching client sales:', err);
      setError('Error al cargar ventas del cliente');
    }
  };

  const handleViewSales = async (client: Client) => {
    setSelectedClient(client);
    await fetchClientSales(client.id);
    setShowSalesModal(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      nombre_completo: client.nombre_completo,
      telefono: client.telefono || '',
      correo: client.correo || '',
      direccion: client.direccion || ''
    });
    setShowClientModal(true);
  };

  const handleAddNew = () => {
    setEditingClient(null);
    setFormData({
      nombre_completo: '',
      telefono: '',
      correo: '',
      direccion: ''
    });
    setShowClientModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const clientData = {
        nombre_completo: formData.nombre_completo,
        telefono: formData.telefono || null,
        correo: formData.correo || null,
        direccion: formData.direccion || null,
        negocio_id: user?.negocioId
      };

      if (editingClient) {
        const { error } = await supabase
          .from('clientes')
          .update(clientData)
          .eq('id', editingClient.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([clientData]);

        if (error) throw error;
      }

      await fetchClients();
      setShowClientModal(false);
      setFormData({ nombre_completo: '', telefono: '', correo: '', direccion: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.telefono?.includes(searchQuery) ||
    client.correo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando clientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Mis Clientes</h1>
        
        <button
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          onClick={handleAddNew}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="pl-10 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            placeholder="Buscar clientes por nombre, teléfono o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <div key={client.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">{client.nombre_completo}</h3>
                  <p className="text-sm text-gray-500">Cliente desde {new Date(client.creado_en).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleViewSales(client)}
                  className="text-primary-600 hover:text-primary-900"
                  title="Ver ventas"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleEditClient(client)}
                  className="text-gray-600 hover:text-gray-900"
                  title="Editar cliente"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {client.telefono && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {client.telefono}
                </div>
              )}
              {client.correo && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {client.correo}
                </div>
              )}
              {client.direccion && (
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2" />
                  {client.direccion}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">${client.total_ventas?.toLocaleString() || 0}</p>
                  <p className="text-xs text-gray-500">Total Ventas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">${client.total_credito?.toLocaleString() || 0}</p>
                  <p className="text-xs text-gray-500">Saldo Pendiente</p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => handleViewSales(client)}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Ver Historial de Ventas
              </button>
            </div>
          </div>
        ))}

        {filteredClients.length === 0 && (
          <div className="col-span-full text-center py-12">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No se encontraron clientes</p>
            <p className="text-sm text-gray-400">Intenta con otra búsqueda o agrega un nuevo cliente</p>
          </div>
        )}
      </div>

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowClientModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="nombre_completo" className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre completo
                      </label>
                      <input
                        type="text"
                        id="nombre_completo"
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        value={formData.nombre_completo}
                        onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        id="telefono"
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        value={formData.telefono}
                        onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-1">
                        Dirección
                      </label>
                      <input
                        type="text"
                        id="direccion"
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        value={formData.direccion}
                        onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="correo" className="block text-sm font-medium text-gray-700 mb-1">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        id="correo"
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        value={formData.correo}
                        onChange={(e) => setFormData({...formData, correo: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : editingClient ? 'Guardar cambios' : 'Crear cliente'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowClientModal(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Sales Modal */}
      {showSalesModal && selectedClient && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={() => setShowSalesModal(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    Historial de Ventas - {selectedClient.nombre_completo}
                  </h3>
                  <button
                    onClick={() => setShowSalesModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Cerrar</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Método de Pago
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Saldo Pendiente
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {clientSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDisplayDate(sale.creada_en)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ${sale.total.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                            {sale.metodo_pago}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              sale.estado_pago === 'pagado' ? 'bg-green-100 text-green-800' :
                              sale.estado_pago === 'parcial' ? 'bg-yellow-100 text-yellow-800' :
                              sale.estado_pago === 'vencido' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {sale.estado_pago || sale.estado}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sale.saldo_pendiente ? `$${sale.saldo_pendiente.toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {clientSales.length === 0 && (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Este cliente no tiene ventas registradas</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;