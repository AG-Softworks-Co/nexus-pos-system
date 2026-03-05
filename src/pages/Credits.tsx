import React, { useState, useEffect } from 'react';
import { Search, CreditCard, Calendar, User, DollarSign, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDisplayDate } from '../utils/dateUtils';

interface CreditSale {
  id: string;
  creada_en: string;
  total: number;
  saldo_pendiente: number;
  estado_pago: string;
  fecha_vencimiento_credito: string;
  cliente: {
    nombre_completo: string;
    telefono: string;
  };
  usuario: {
    nombre_completo: string;
  };
}

interface PartialPayment {
  id: string;
  monto: number;
  metodo_pago: string;
  fecha_pago: string;
  notas: string;
}

const Credits: React.FC = () => {
  const { user } = useAuth();
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [selectedSale, setSelectedSale] = useState<CreditSale | null>(null);
  const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentData, setPaymentData] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    notas: ''
  });

  useEffect(() => {
    if (user?.negocioId) {
      fetchCreditSales();
    }
  }, [user]);

  const fetchCreditSales = async () => {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          id,
          creada_en,
          total,
          saldo_pendiente,
          estado_pago,
          fecha_vencimiento_credito,
          cliente:cliente_id (
            nombre_completo,
            telefono
          ),
          usuario:usuario_id (
            nombre_completo
          )
        `)
        .eq('negocio_id', user?.negocioId)
        .eq('metodo_pago', 'credito')
        .order('creada_en', { ascending: false });

      if (error) throw error;
      setCreditSales(data || []);
    } catch (err: any) {
      console.error('Error fetching credit sales:', err);
      setError('Error al cargar ventas a crédito');
    } finally {
      setLoading(false);
    }
  };

  const fetchPartialPayments = async (saleId: string) => {
    try {
      const { data, error } = await supabase
        .from('pagos_parciales')
        .select('*')
        .eq('venta_id', saleId)
        .order('fecha_pago', { ascending: false });

      if (error) throw error;
      setPartialPayments(data || []);
    } catch (err: any) {
      console.error('Error fetching partial payments:', err);
      setError('Error al cargar pagos parciales');
    }
  };

  // --- FUNCIÓN CORREGIDA ---
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    // Añadimos una comprobación para asegurarnos de que tenemos toda la información necesaria
    if (!selectedSale || !user?.id || !user?.negocioId) {
      setError("No se pudo procesar el pago: falta información del usuario o de la venta.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const monto = parseFloat(paymentData.monto);

      if (isNaN(monto) || monto <= 0 || monto > selectedSale.saldo_pendiente) {
        throw new Error('El monto debe ser un número válido, mayor a 0 y no exceder el saldo pendiente');
      }

      // Se crea el objeto a insertar con todos los campos requeridos
      const newPayment = {
        venta_id: selectedSale.id,
        usuario_id: user.id,
        negocio_id: user.negocioId, // <-- ✅ ¡ESTA ES LA LÍNEA CLAVE AÑADIDA!
        monto,
        metodo_pago: paymentData.metodo_pago,
        notas: paymentData.notas || null
      };

      const { error } = await supabase
        .from('pagos_parciales')
        .insert([newPayment]); // Se inserta el objeto

      if (error) {
        // Hacemos el log del error más específico para poder depurarlo
        console.error('Error de Supabase al insertar pago:', error);
        throw new Error(`Error al registrar el pago: ${error.message}`);
      }

      // Actualizar saldo_pendiente y estado de la venta
      const nuevoSaldo = selectedSale.saldo_pendiente - monto;
      const updateData: any = {
        saldo_pendiente: Math.max(0, nuevoSaldo),
      };

      if (nuevoSaldo <= 0) {
        // Crédito completamente pagado
        updateData.estado_pago = 'pagado';
        updateData.estado = 'pagada';
      } else {
        // Pago parcial
        updateData.estado_pago = 'parcial';
      }

      const { error: updateError } = await supabase
        .from('ventas')
        .update(updateData)
        .eq('id', selectedSale.id);

      if (updateError) {
        console.error('Error actualizando estado de venta:', updateError);
        // No lanzamos error porque el pago ya se registró exitosamente
      }

      // Si todo sale bien, actualizamos la UI
      await fetchCreditSales();
      if (showPaymentsModal) {
        await fetchPartialPayments(selectedSale.id);
      }
      setShowPaymentModal(false);
      setPaymentData({ monto: '', metodo_pago: 'efectivo', notas: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  // --- FIN DE LA FUNCIÓN CORREGIDA ---

  const handleViewPayments = async (sale: CreditSale) => {
    setSelectedSale(sale);
    await fetchPartialPayments(sale.id);
    setShowPaymentsModal(true);
  };

  const getStatusColor = (estado: string, fechaVencimiento: string) => {
    const isOverdue = new Date(fechaVencimiento) < new Date();

    if (estado === 'pagado') return 'bg-green-100 text-green-800';
    if ((estado === 'vencido' || isOverdue) && estado !== 'pagado') return 'bg-red-100 text-red-800';
    if (estado === 'parcial') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800'; // Cambiado a azul para 'pendiente'
  };

  const getStatusIcon = (estado: string, fechaVencimiento: string) => {
    const isOverdue = new Date(fechaVencimiento) < new Date();

    if (estado === 'pagado') return <CheckCircle className="h-4 w-4" />;
    if ((estado === 'vencido' || isOverdue) && estado !== 'pagado') return <XCircle className="h-4 w-4" />;
    if (estado === 'parcial') return <Clock className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />; // Mantenemos para pendiente
  };

  const filteredSales = creditSales.filter(sale => {
    const saleDate = new Date(sale.fecha_vencimiento_credito);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar para comparar solo la fecha

    const isOverdue = saleDate < today && sale.estado_pago !== 'pagado';

    const matchesSearch = !searchQuery ||
      sale.cliente.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.cliente.telefono?.includes(searchQuery) ||
      sale.id.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'vencido') {
        matchesStatus = isOverdue;
      } else {
        matchesStatus = sale.estado_pago === statusFilter && !isOverdue;
      }
    }

    return matchesSearch && matchesStatus;
  });

  const totalCredits = creditSales.reduce((sum, sale) => sum + sale.saldo_pendiente, 0);
  const overdueCredits = creditSales.filter(sale =>
    new Date(sale.fecha_vencimiento_credito) < new Date() && sale.estado_pago !== 'pagado'
  ).reduce((sum, sale) => sum + sale.saldo_pendiente, 0);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando créditos...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Créditos</h1>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">¡Error!</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total en Créditos</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                ${totalCredits.toLocaleString('es-CO')}
              </p>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Créditos Vencidos</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                ${overdueCredits.toLocaleString('es-CO')}
              </p>
            </div>
            <div className="p-3 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Clientes con Crédito</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {new Set(creditSales.map(sale => sale.cliente.nombre_completo)).size}
              </p>
            </div>
            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
              <User className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 shadow-md rounded-xl border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
              placeholder="Buscar por cliente, teléfono o ID de venta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select
              className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md w-full md:w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
        </div>
      </div>

      {/* Credits Table */}
      <div className="bg-white shadow-md rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Fecha Venta
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Saldo Pendiente
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Vencimiento
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {sale.cliente.nombre_completo}
                      </div>
                      <div className="text-sm text-gray-500">
                        {sale.cliente.telefono || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDisplayDate(sale.creada_en)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${sale.total.toLocaleString('es-CO')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                    ${sale.saldo_pendiente.toLocaleString('es-CO')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDisplayDate(sale.fecha_vencimiento_credito)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sale.estado_pago, sale.fecha_vencimiento_credito)
                      }`}>
                      {getStatusIcon(sale.estado_pago, sale.fecha_vencimiento_credito)}
                      <span className="ml-1 capitalize">{sale.estado_pago === 'pendiente' && new Date(sale.fecha_vencimiento_credito) < new Date() ? 'Vencido' : sale.estado_pago}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                      <button
                        onClick={() => handleViewPayments(sale)}
                        className="text-blue-600 hover:text-blue-900 font-semibold"
                        title="Ver pagos"
                      >
                        Ver Pagos
                      </button>
                      {sale.saldo_pendiente > 0 && (
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setPaymentData({ monto: '', metodo_pago: 'efectivo', notas: '' });
                            setShowPaymentModal(true);
                          }}
                          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg text-xs"
                          title="Agregar pago"
                        >
                          Abonar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-16">
            <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800">No se encontraron créditos</h3>
            <p className="text-sm text-gray-500 mt-1">Intenta ajustar los filtros de búsqueda o de estado.</p>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowPaymentModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">​</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleAddPayment}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-xl font-bold text-gray-900" id="modal-title">
                        Registrar Abono
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Para: {selectedSale.cliente.nombre_completo}</p>
                    </div>
                  </div>

                  <div className="mt-6 mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600">Saldo pendiente actual: <span className="font-bold text-lg text-blue-800">${selectedSale.saldo_pendiente.toLocaleString('es-CO')}</span></p>
                  </div>

                  <div className="space-y-4 mt-5">
                    <div>
                      <label htmlFor="monto" className="block text-sm font-medium text-gray-700">Monto del pago</label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          id="monto"
                          className="pl-7 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={paymentData.monto}
                          onChange={(e) => setPaymentData({ ...paymentData, monto: e.target.value })}
                          max={selectedSale.saldo_pendiente}
                          min="0.01"
                          step="0.01"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="metodo_pago" className="block text-sm font-medium text-gray-700">Método de pago</label>
                      <select
                        id="metodo_pago"
                        className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        value={paymentData.metodo_pago}
                        onChange={(e) => setPaymentData({ ...paymentData, metodo_pago: e.target.value })}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="bancolombia">Bancolombia</option>
                        <option value="nequi">Nequi</option>
                        <option value="daviplata">Daviplata</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="notas" className="block text-sm font-medium text-gray-700">Notas (opcional)</label>
                      <textarea
                        id="notas"
                        rows={3}
                        className="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        value={paymentData.notas}
                        onChange={(e) => setPaymentData({ ...paymentData, notas: e.target.value })}
                        placeholder="Información adicional sobre el pago..."
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
                    {isSubmitting ? 'Procesando...' : 'Registrar Pago'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowPaymentModal(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payments History Modal */}
      {showPaymentsModal && selectedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowPaymentsModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">​</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Historial de Pagos
                  </h3>
                  <button onClick={() => setShowPaymentsModal(false)} className="text-gray-400 hover:text-gray-600">
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <p className="text-md font-semibold text-gray-800">{selectedSale.cliente.nombre_completo}</p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Total de la venta:</p>
                      <p className="text-lg font-bold text-gray-900">${selectedSale.total.toLocaleString('es-CO')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Saldo pendiente:</p>
                      <p className="text-lg font-bold text-red-600">${selectedSale.saldo_pendiente.toLocaleString('es-CO')}</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-80 pr-2">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Monto</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Método</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {partialPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDisplayDate(payment.fecha_pago)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">${payment.monto.toLocaleString('es-CO')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{payment.metodo_pago}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{payment.notas || <span className="text-gray-400">N/A</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {partialPayments.length === 0 && (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-md font-medium text-gray-700">Sin abonos registrados</h4>
                    <p className="text-sm text-gray-500 mt-1">Todavía no se han realizado pagos para esta venta.</p>
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

export default Credits;