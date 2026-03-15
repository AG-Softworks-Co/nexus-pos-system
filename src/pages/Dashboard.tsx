import React, { useState, useEffect } from 'react';
import { DollarSign, ShoppingBag, Activity, Calendar, TrendingUp, Users, Package, CreditCard, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import StatsCard from '../components/dashboard/StatsCard';
import WeeklySalesChart from '../components/dashboard/WeeklySalesChart';
import TopProducts from '../components/dashboard/TopProducts';
import DateRangePicker from '../components/dashboard/DateRangePicker';
import ProductQuantityChart from '../components/dashboard/ProductQuantityChart';

import SalePreviewModal from '../components/sales/SalePreviewModal';
import { generateSaleReceipt } from '../utils/pdfUtils';
import { startOfDay, endOfDay, subDays, format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Sale } from '../types/sales';

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  totalClients: number;
  deliveryOrders: number;
  creditSales: number;
  pendingCredits: number;
  topPaymentMethod: string;
}

interface TopProduct {
  id: string;
  name: string;
  quantity: number;
  amount: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [dateMode, setDateMode] = useState<'single' | 'range'>('range');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesData, setSalesData] = useState<{ day: string; amount: number }[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [productQuantities, setProductQuantities] = useState<{ name: string; quantity: number; percentage: number; }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const fetchDashboardData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Determinar el rango de fechas según el modo
      const actualStartDate = dateMode === 'single' ? startDate : startDate;
      const actualEndDate = dateMode === 'single' ? startDate : endDate;
      const periodStart = startOfDay(actualStartDate);
      const periodEnd = endOfDay(actualEndDate);

      // Fetch sales data for selected period
      const { data: salesData, error: salesError } = await supabase
        .from('ventas')
        .select(`
          *,
          usuario:usuario_id (
            nombre_completo
          ),
          cliente:cliente_id (
            nombre_completo,
            telefono,
            correo
          ),
          direccion_entrega:direccion_entrega_id (
            direccion,
            referencias
          ),
          detalle_ventas (
            id,
            cantidad,
            precio_unitario,
            producto:producto_id (
              nombre,
              sku
            )
          )
        `)
        .eq('negocio_id', user?.negocioId)
        .gte('creada_en', periodStart.toISOString())
        .lte('creada_en', periodEnd.toISOString())
        .order('creada_en', { ascending: false });

      if (salesError) throw salesError;

      // Calculate comprehensive stats
      const uniqueClients = new Set();
      let deliveryCount = 0;
      let creditSalesCount = 0;
      let pendingCreditsAmount = 0;
      const paymentMethods = new Map<string, number>();

      salesData?.forEach(sale => {
        if (sale.cliente) {
          uniqueClients.add(sale.cliente.nombre_completo);
        }
        if (sale.es_domicilio) {
          deliveryCount++;
        }
        if (sale.metodo_pago === 'credito') {
          creditSalesCount++;
          if (sale.saldo_pendiente && sale.saldo_pendiente > 0) {
            pendingCreditsAmount += sale.saldo_pendiente;
          }
        }

        const currentAmount = paymentMethods.get(sale.metodo_pago) || 0;
        paymentMethods.set(sale.metodo_pago, currentAmount + sale.total);
      });

      // Get most used payment method
      const topPaymentMethod = Array.from(paymentMethods.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'efectivo';

      const totalSales = salesData?.reduce((sum, sale) => sum + sale.total, 0) || 0;
      const totalOrders = salesData?.length || 0;

      const statsInfo: DashboardStats = {
        totalSales,
        totalOrders,
        averageTicket: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
        totalClients: uniqueClients.size,
        deliveryOrders: deliveryCount,
        creditSales: creditSalesCount,
        pendingCredits: pendingCreditsAmount,
        topPaymentMethod
      };

      // Process product quantities and amounts
      const productStats = new Map<string, { quantity: number; amount: number }>();
      let totalQuantityValue = 0;

      salesData?.forEach(sale => {
        (sale.detalle_ventas as unknown as { producto: { nombre: string }; cantidad: number; precio_unitario: number }[]).forEach((detail) => {
          const productName = detail.producto.nombre;
          const currentStats = productStats.get(productName) || { quantity: 0, amount: 0 };

          currentStats.quantity += detail.cantidad;
          currentStats.amount += detail.cantidad * detail.precio_unitario;
          totalQuantityValue += detail.cantidad;

          productStats.set(productName, currentStats);
        });
      });

      // Convert to arrays and sort
      const topProductsList = Array.from(productStats.entries())
        .map(([name, stats]) => ({
          id: name,
          name,
          quantity: stats.quantity,
          amount: stats.amount
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4);

      const quantitiesList = Array.from(productStats.entries())
        .map(([name, stats]) => ({
          name,
          quantity: stats.quantity,
          percentage: totalQuantityValue > 0 ? (stats.quantity / totalQuantityValue) * 100 : 0
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Process daily sales data for the selected date range
      const dailySales = new Map<string, number>();

      if (dateMode === 'single') {
        // For single day, show hourly data
        for (let hour = 0; hour < 24; hour++) {
          const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
          dailySales.set(hourLabel, 0);
        }

        salesData?.forEach(sale => {
          const hour = new Date(sale.creada_en).getHours();
          const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
          dailySales.set(hourLabel, (dailySales.get(hourLabel) || 0) + sale.total);
        });
      } else {
        // For date range, show daily data
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const day = format(d, 'dd/MM', { locale: es });
          dailySales.set(day, 0);
        }

        salesData?.forEach(sale => {
          const date = new Date(sale.creada_en);
          const day = format(date, 'dd/MM', { locale: es });
          if (dailySales.has(day)) {
            dailySales.set(day, (dailySales.get(day) || 0) + sale.total);
          }
        });
      }

      const processedSalesData = Array.from(dailySales.entries()).map(([day, amount]) => ({
        day,
        amount
      }));

      setStats(statsInfo);
      setSalesData(processedSalesData);
      setTopProducts(topProductsList);
      setProductQuantities(quantitiesList);
      setRecentSales(salesData?.slice(0, 5) || []);

    } catch (err: unknown) {
      console.error('Error fetching dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [user?.negocioId, dateMode, startDate, endDate]);

  // Handle initialization and subsequent updates
  useEffect(() => {
    if (user?.negocioId) {
      fetchDashboardData();
    }
  }, [fetchDashboardData, user?.negocioId]);

  const handleDateRangeChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    if (start) {
      setStartDate(start);
      if (end) {
        setEndDate(end);
        setDateMode('range');
      } else {
        setEndDate(start);
        setDateMode('single');
      }
    }
  };

  const handleQuickDateSelect = (days: number) => {
    if (days === 0) {
      // Hoy
      const today = new Date();
      setStartDate(today);
      setEndDate(today);
      setDateMode('single');
    } else {
      // Rango de días
      const end = new Date();
      const start = subDays(end, days - 1);
      setStartDate(start);
      setEndDate(end);
      setDateMode('range');
    }
  };

  const formatDateRange = () => {
    if (dateMode === 'single') {
      return format(startDate, "d 'de' MMMM 'de' yyyy", { locale: es });
    } else {
      const daysDiff = differenceInDays(endDate, startDate) + 1;
      return `${format(startDate, 'dd/MM', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })} (${daysDiff} días)`;
    }
  };



  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando datos...</p>
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6 min-h-full">
      {/* Header with Date Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-gray-100 relative z-10">
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-1 flex items-center">
              <Activity className="w-6 h-6 text-primary-600 mr-2" />
              Dashboard Ejecutivo
            </h1>
            <p className="text-gray-500 text-sm font-medium">
              {dateMode === 'single' ? 'Análisis del día' : 'Análisis del período'}: <span className="text-gray-900 font-bold">{formatDateRange()}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Botones de selección rápida */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickDateSelect(0)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${dateMode === 'single' && format(startDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ? 'bg-primary-50 text-primary-700 border border-primary-200 shadow-sm'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <Calendar className="h-4 w-4 mr-1.5 inline -mt-0.5" />
                Hoy
              </button>
              <button
                onClick={() => handleQuickDateSelect(7)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${dateMode === 'range' && differenceInDays(endDate, startDate) === 6
                  ? 'bg-primary-50 text-primary-700 border border-primary-200 shadow-sm'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                7 días
              </button>
              <button
                onClick={() => handleQuickDateSelect(30)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${dateMode === 'range' && differenceInDays(endDate, startDate) === 29
                  ? 'bg-primary-50 text-primary-700 border border-primary-200 shadow-sm'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                30 días
              </button>
            </div>

            {/* Selector de fechas personalizado */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateRangeChange}
            />
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 dashboard-content">
        <StatsCard
          title={dateMode === 'single' ? "Ventas del Día" : "Ventas del Período"}
          value={`$${stats.totalSales.toLocaleString()}`}
          icon={<TrendingUp className="h-6 w-6" />}
          subtitle={dateMode === 'single' ?
            `${stats.totalOrders} ${stats.totalOrders === 1 ? 'orden' : 'órdenes'} realizadas` :
            `Promedio: $${Math.round(stats.totalSales / Math.max(differenceInDays(endDate, startDate) + 1, 1)).toLocaleString()}/día`
          }
          iconBgColor="bg-green-100"
          iconTextColor="text-green-600"
          cardBgColor="bg-white"
          borderColor="border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        />

        <StatsCard
          title={dateMode === 'single' ? "Órdenes del Día" : "Total Órdenes"}
          value={stats.totalOrders}
          icon={<ShoppingBag className="h-6 w-6" />}
          subtitle={`${stats.deliveryOrders} domicilios • ${stats.totalOrders - stats.deliveryOrders} locales`}
          iconBgColor="bg-blue-100"
          iconTextColor="text-blue-600"
          cardBgColor="bg-white"
          borderColor="border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        />

        <StatsCard
          title="Ticket Promedio"
          value={`$${stats.averageTicket.toLocaleString()}`}
          icon={<DollarSign className="h-6 w-6" />}
          subtitle={`Método principal: ${stats.topPaymentMethod.toUpperCase()}`}
          iconBgColor="bg-purple-100"
          iconTextColor="text-purple-600"
          cardBgColor="bg-white"
          borderColor="border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        />

        <StatsCard
          title={dateMode === 'single' ? "Clientes Atendidos" : "Total Clientes"}
          value={stats.totalClients}
          icon={<Users className="h-6 w-6" />}
          subtitle={stats.creditSales > 0 ? `${stats.creditSales} ventas a crédito` : 'Sin ventas a crédito'}
          iconBgColor="bg-orange-100"
          iconTextColor="text-orange-600"
          cardBgColor="bg-white"
          borderColor="border-gray-100 shadow-sm hover:shadow-md transition-shadow"
        />
      </div>

      {/* Additional Stats Row for Credits */}
      {stats.pendingCredits > 0 && (
        <div className="bg-white border border-red-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl mr-4">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Créditos Pendientes</h3>
                <p className="text-red-700">
                  {dateMode === 'single' ? 'Saldo pendiente del día seleccionado' : 'Saldo por cobrar en el período'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-red-900">${stats.pendingCredits.toLocaleString()}</p>
              <p className="text-sm text-red-600">{stats.creditSales} ventas a crédito</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Activity className="h-6 w-6 mr-2 text-primary-600" />
              {dateMode === 'single' ? 'Ventas por Hora' : 'Tendencia de Ventas'}
            </h2>
            <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-lg">
              {formatDateRange()}
            </div>
          </div>
          <WeeklySalesChart
            salesData={salesData}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <TopProducts
              products={topProducts}
              title={dateMode === 'single' ? 'Productos del Día' : 'Productos Top'}
            />
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
            <ProductQuantityChart
              products={productQuantities}
              title={dateMode === 'single' ? 'Cantidades del Día' : 'Cantidades Vendidas'}
            />
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Package className="h-6 w-6 mr-2 text-primary-600" />
            {dateMode === 'single' ? 'Ventas del Día' : 'Ventas del Período'}
          </h2>
          <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded-lg">
            {recentSales.length} {recentSales.length === 1 ? 'venta' : 'ventas'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
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
              {recentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    #{sale.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                      {format(new Date(sale.creada_en), 'dd/MM HH:mm')}
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sale.es_domicilio ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sale.estado === 'pagada' ? 'bg-green-100 text-green-800' :
                      sale.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                      {sale.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      className="text-primary-600 hover:text-primary-900 group relative"
                      onClick={() => handleViewSale(sale)}
                    >
                      <Activity className="h-5 w-5" />
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Ver detalles
                      </span>
                    </button>
                  </td>
                </tr>
              ))}

              {recentSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    <div className="flex flex-col items-center">
                      <Package className="h-12 w-12 text-gray-300 mb-3" />
                      <p>No hay ventas en el período seleccionado</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {dateMode === 'single' ? 'Intenta seleccionar otro día' : 'Intenta seleccionar otro rango de fechas'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDetailModal && selectedSale && (
        <SalePreviewModal
          sale={selectedSale}
          onClose={() => setShowDetailModal(false)}
          onGeneratePDF={generateSaleReceipt}
        />
      )}
    </div>
  );
};

export default Dashboard;