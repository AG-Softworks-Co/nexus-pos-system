import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, TrendingUp, Download, Calendar, DollarSign, Target, PieChart, BarChart3, Activity, AlertTriangle } from 'lucide-react';
import DateRangePicker from '../components/dashboard/DateRangePicker';
import { startOfDay, endOfDay, subDays, format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';
import { UserOptions } from 'jspdf-autotable';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
  lastAutoTable: { finalY: number };
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface UtilityMetrics {
  totalSales: number;
  totalCosts: number;
  profit: number;
  profitMargin: number;
  topProducts: {
    name: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    quantity: number;
  }[];
  dailyProfits: {
    date: string;
    revenue: number;
    cost: number;
    profit: number;
  }[];
  categoryProfits: {
    category: string;
    profit: number;
    margin: number;
    revenue: number;
  }[];
  paymentMethodBreakdown: {
    method: string;
    amount: number;
    percentage: number;
  }[];
}

const Utilities: React.FC = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [metrics, setMetrics] = useState<UtilityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUtilityMetrics = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Determinar el rango de fechas según el modo
      const actualStartDate = dateMode === 'single' ? startDate : startDate;
      const actualEndDate = dateMode === 'single' ? startDate : endDate;

      // Fetch sales with product details for the selected period
      const { data: salesData, error: salesError } = await supabase
        .from('ventas')
        .select(`
          id,
          total,
          metodo_pago,
          creada_en,
          detalle_ventas (
            cantidad,
            precio_unitario,
            producto:producto_id (
              id,
              nombre,
              precio_costo,
              categoria_id,
              categorias:categoria_id (
                nombre
              )
            )
          )
        `)
        .eq('negocio_id', user?.negocioId)
        .gte('creada_en', startOfDay(actualStartDate).toISOString())
        .lte('creada_en', endOfDay(actualEndDate).toISOString())
        .eq('estado', 'pagada');

      if (salesError) throw salesError;

      // Calculate metrics
      let tSales = 0;
      let tCosts = 0;
      const productMetrics: Map<string, {
        name: string;
        revenue: number;
        cost: number;
        quantity: number;
      }> = new Map();

      const categoryMetrics: Map<string, {
        revenue: number;
        cost: number;
      }> = new Map();

      const paymentMethodsMap: Map<string, number> = new Map();
      const dailyMetricsMap: Map<string, { revenue: number; cost: number }> = new Map();

      const data = (salesData as unknown) as Array<{
        total: number;
        metodo_pago: string;
        creada_en: string;
        detalle_ventas: Array<{
          cantidad: number;
          precio_unitario: number;
          producto: {
            id: string;
            nombre: string;
            precio_costo: number | null;
            categorias: { nombre: string } | null;
          } | null;
        }>;
      }>;

      (data || []).forEach((sale) => {
        tSales += sale.total;
        
        // Payment method breakdown
        const currentAmount = paymentMethodsMap.get(sale.metodo_pago) || 0;
        paymentMethodsMap.set(sale.metodo_pago, currentAmount + sale.total);

        // Daily metrics
        const saleDate = format(new Date(sale.creada_en), 'yyyy-MM-dd');
        const dailyData = dailyMetricsMap.get(saleDate) || { revenue: 0, cost: 0 };
        dailyData.revenue += sale.total;
        
        (sale.detalle_ventas || []).forEach((detail) => {
          if (!detail.producto) return;
          const productCost = (detail.producto.precio_costo || 0) * detail.cantidad;
          const productRevenue = detail.precio_unitario * detail.cantidad;
          tCosts += productCost;
          dailyData.cost += productCost;

          // Product metrics
          const existing = productMetrics.get(detail.producto.id) || {
            name: detail.producto.nombre,
            revenue: 0,
            cost: 0,
            quantity: 0
          };

          existing.revenue += productRevenue;
          existing.cost += productCost;
          existing.quantity += detail.cantidad;
          productMetrics.set(detail.producto.id, existing);

          // Category metrics
          const categoryName = detail.producto.categorias?.nombre || 'Sin categoría';
          const categoryDataLine = categoryMetrics.get(categoryName) || { revenue: 0, cost: 0 };
          categoryDataLine.revenue += productRevenue;
          categoryDataLine.cost += productCost;
          categoryMetrics.set(categoryName, categoryDataLine);
        });

        dailyMetricsMap.set(saleDate, dailyData);
      });

      const prof = tSales - tCosts;
      const margin = tSales > 0 ? (prof / tSales) * 100 : 0;

      // Convert to arrays and sort
      const topProducts = Array.from(productMetrics.values())
        .map(product => ({
          name: product.name,
          revenue: product.revenue,
          cost: product.cost,
          profit: product.revenue - product.cost,
          margin: product.revenue > 0 ? ((product.revenue - product.cost) / product.revenue) * 100 : 0,
          quantity: product.quantity
        }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10);

      const categoryProfitsArr = Array.from(categoryMetrics.entries())
        .map(([category, data]) => ({
          category,
          profit: data.revenue - data.cost,
          margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
          revenue: data.revenue
        }))
        .sort((a, b) => b.profit - a.profit);

      const dailyProfitsArr = Array.from(dailyMetricsMap.entries())
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          cost: data.cost,
          profit: data.revenue - data.cost
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const totalPayments = Array.from(paymentMethodsMap.values()).reduce((s, amount) => s + amount, 0);
      const paymentMethodBreakdownArr = Array.from(paymentMethodsMap.entries())
        .map(([method, amount]) => ({
          method,
          amount,
          percentage: totalPayments > 0 ? (amount / totalPayments) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

      setMetrics({
        totalSales: tSales,
        totalCosts: tCosts,
        profit: prof,
        profitMargin: margin,
        topProducts,
        dailyProfits: dailyProfitsArr,
        categoryProfits: categoryProfitsArr,
        paymentMethodBreakdown: paymentMethodBreakdownArr
      });
    } catch (err: unknown) {
      console.error('Error fetching utility metrics:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user?.negocioId, startDate, endDate, dateMode]);

  // Actualizar datos automáticamente cuando cambien las fechas
  useEffect(() => {
    if (user?.negocioId) {
      fetchUtilityMetrics();
    }
  }, [user?.negocioId, fetchUtilityMetrics]);

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

  const generatePDFReport = () => {
    if (!metrics) return;

    const doc = new jsPDF();
    const businessNameLocal = "Mi Negocio";
    console.log(`Generando reporte para ${businessNameLocal}`);

    // Title
    doc.setFontSize(20);
    doc.text('Reporte de Utilidades', 105, 20, { align: 'center' });
    
    // Period
    doc.setFontSize(12);
    doc.text(`Período: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`, 20, 30);

    // Summary
    doc.text('Resumen Financiero', 20, 45);
    doc.setFontSize(10);
    const summaryData = [
      ['Ventas Totales', `$${metrics.totalSales.toLocaleString()}`],
      ['Costos Totales', `$${metrics.totalCosts.toLocaleString()}`],
      ['Utilidad', `$${metrics.profit.toLocaleString()}`],
      ['Margen de Utilidad', `${metrics.profitMargin.toFixed(2)}%`]
    ];

    (doc as jsPDFWithAutoTable).autoTable({
      startY: 50,
      head: [['Métrica', 'Valor']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    // Top Products Table
    doc.setFontSize(12);
    doc.text('Productos más Rentables', 20, (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 20);

    const productData = metrics.topProducts.map(product => [
      product.name,
      `$${product.revenue.toLocaleString()}`,
      `$${product.cost.toLocaleString()}`,
      `$${product.profit.toLocaleString()}`,
      `${product.margin.toFixed(2)}%`
    ]);

    (doc as jsPDFWithAutoTable).autoTable({
      startY: (doc as jsPDFWithAutoTable).lastAutoTable.finalY + 25,
      head: [['Producto', 'Ingresos', 'Costos', 'Utilidad', 'Margen']],
      body: productData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    // Save PDF
    doc.save(`reporte-utilidades-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: 500
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(99, 102, 241, 0.8)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: (item: unknown) => {
            const tooltipItem = item as { raw: number; dataset: { label?: string } };
            const val = tooltipItem.raw;
            return `${tooltipItem.dataset.label}: $${val.toLocaleString()}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: (value: string | number) => `$${Number(value).toLocaleString()}`,
          font: {
            size: 11
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando métricas de utilidades...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Análisis de Utilidades</h1>
          <p className="text-sm text-gray-600 mt-1">
            {dateMode === 'single' ? '📅 Día seleccionado' : '📊 Rango de fechas'}: {formatDateRange()}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Botones de selección rápida */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleQuickDateSelect(0)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                dateMode === 'single' && format(startDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => handleQuickDateSelect(7)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                dateMode === 'range' && differenceInDays(endDate, startDate) === 6
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              7 días
            </button>
            <button
              onClick={() => handleQuickDateSelect(30)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                dateMode === 'range' && differenceInDays(endDate, startDate) === 29
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              30 días
            </button>
          </div>
          
          {/* Selector de fechas personalizado */}
          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 min-w-[200px] relative z-[99999]">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateRangeChange}
            />
          </div>
          
          <button
            onClick={generatePDFReport}
            disabled={!metrics}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-all duration-200 transform hover:scale-105"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generar Reporte
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {metrics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-lg border border-green-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-green-600">Ventas Totales</p>
                  <p className="text-3xl font-bold text-green-900 mt-2">
                    ${metrics.totalSales.toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {dateMode === 'single' ? 'Día seleccionado' : `${differenceInDays(endDate, startDate) + 1} días`}
                  </p>
                </div>
                <div className="p-3 bg-green-500 text-white rounded-xl shadow-lg">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl shadow-lg border border-red-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-red-600">Costos Totales</p>
                  <p className="text-3xl font-bold text-red-900 mt-2">
                    ${metrics.totalCosts.toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {metrics.totalSales > 0 ? `${((metrics.totalCosts / metrics.totalSales) * 100).toFixed(1)}% de ventas` : 'Sin ventas'}
                  </p>
                </div>
                <div className="p-3 bg-red-500 text-white rounded-xl shadow-lg">
                  <Download className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-lg border border-blue-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-blue-600">Utilidad Neta</p>
                  <p className="text-3xl font-bold text-blue-900 mt-2">
                    ${metrics.profit.toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Promedio: ${Math.round(metrics.profit / (differenceInDays(endDate, startDate) + 1)).toLocaleString()}/día
                  </p>
                </div>
                <div className="p-3 bg-blue-500 text-white rounded-xl shadow-lg">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-lg border border-purple-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-purple-600">Margen de Utilidad</p>
                  <p className="text-3xl font-bold text-purple-900 mt-2">
                    {metrics.profitMargin.toFixed(1)}%
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    {metrics.profitMargin >= 50 ? '🎯 Excelente' : 
                     metrics.profitMargin >= 30 ? '✅ Bueno' : 
                     metrics.profitMargin >= 15 ? '⚠️ Regular' : '❌ Bajo'}
                  </p>
                </div>
                <div className="p-3 bg-purple-500 text-white rounded-xl shadow-lg">
                  <Target className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Profit Trend */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-primary-600" />
                  {dateMode === 'single' ? 'Resumen del Día' : 'Tendencia de Utilidad Diaria'}
                </h3>
                <div className="text-sm text-gray-500">
                  {formatDateRange()}
                </div>
              </div>
              <div className="h-80">
                {dateMode === 'single' ? (
                  // Gráfica de barras para un solo día
                  <Bar
                    data={{
                      labels: ['Ingresos', 'Costos', 'Utilidad'],
                      datasets: [
                        {
                          label: 'Monto',
                          data: [
                            metrics.dailyProfits[0]?.revenue || 0,
                            metrics.dailyProfits[0]?.cost || 0,
                            metrics.dailyProfits[0]?.profit || 0
                          ],
                          backgroundColor: [
                            'rgba(34, 197, 94, 0.8)',
                            'rgba(239, 68, 68, 0.8)',
                            'rgba(99, 102, 241, 0.8)'
                          ],
                          borderColor: [
                            'rgb(34, 197, 94)',
                            'rgb(239, 68, 68)',
                            'rgb(99, 102, 241)'
                          ],
                          borderWidth: 2,
                          borderRadius: 8,
                        }
                      ]
                    }}
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        legend: {
                          display: false
                        }
                      }
                    }}
                  />
                ) : (
                  // Gráfica de líneas para rango de fechas
                  <Line
                    data={{
                      labels: metrics.dailyProfits.map(d => format(new Date(d.date), 'dd/MM')),
                      datasets: [
                        {
                          label: 'Ingresos',
                          data: metrics.dailyProfits.map(d => d.revenue),
                          borderColor: 'rgb(34, 197, 94)',
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          tension: 0.4,
                          fill: true,
                          pointBackgroundColor: 'rgb(34, 197, 94)',
                          pointBorderColor: 'white',
                          pointBorderWidth: 2,
                          pointRadius: 4,
                        },
                        {
                          label: 'Costos',
                          data: metrics.dailyProfits.map(d => d.cost),
                          borderColor: 'rgb(239, 68, 68)',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          tension: 0.4,
                          fill: true,
                          pointBackgroundColor: 'rgb(239, 68, 68)',
                          pointBorderColor: 'white',
                          pointBorderWidth: 2,
                          pointRadius: 4,
                        },
                        {
                          label: 'Utilidad',
                          data: metrics.dailyProfits.map(d => d.profit),
                          borderColor: 'rgb(99, 102, 241)',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          tension: 0.4,
                          fill: true,
                          pointBackgroundColor: 'rgb(99, 102, 241)',
                          pointBorderColor: 'white',
                          pointBorderWidth: 2,
                          pointRadius: 4,
                        }
                      ]
                    }}
                    options={chartOptions}
                  />
                )}
              </div>
            </div>

            {/* Revenue vs Costs Comparison */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-primary-600" />
                  {dateMode === 'single' ? 'Productos del Día' : 'Top 5 Productos'} - Ingresos vs Costos
                </h3>
              </div>
              <div className="h-80">
                <Bar
                  data={{
                    labels: metrics.topProducts.slice(0, 5).map(p => p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name),
                    datasets: [
                      {
                        label: 'Ingresos',
                        data: metrics.topProducts.slice(0, 5).map(p => p.revenue),
                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                        borderColor: 'rgb(34, 197, 94)',
                        borderWidth: 1,
                        borderRadius: 4,
                      },
                      {
                        label: 'Costos',
                        data: metrics.topProducts.slice(0, 5).map(p => p.cost),
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: 'rgb(239, 68, 68)',
                        borderWidth: 1,
                        borderRadius: 4,
                      }
                    ]
                  }}
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      legend: {
                        ...chartOptions.plugins.legend,
                        position: 'top' as const,
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Profit Distribution by Category */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <PieChart className="h-5 w-5 mr-2 text-primary-600" />
                  {dateMode === 'single' ? 'Categorías del Día' : 'Utilidad por Categoría'}
                </h3>
              </div>
              <div className="h-80">
                <Doughnut
                  data={{
                    labels: metrics.categoryProfits.slice(0, 6).map(c => c.category),
                    datasets: [
                      {
                        data: metrics.categoryProfits.slice(0, 6).map(c => c.profit),
                        backgroundColor: [
                          'rgba(99, 102, 241, 0.8)',
                          'rgba(34, 197, 94, 0.8)',
                          'rgba(251, 191, 36, 0.8)',
                          'rgba(239, 68, 68, 0.8)',
                          'rgba(147, 51, 234, 0.8)',
                          'rgba(59, 130, 246, 0.8)',
                        ],
                        borderColor: [
                          'rgb(99, 102, 241)',
                          'rgb(34, 197, 94)',
                          'rgb(251, 191, 36)',
                          'rgb(239, 68, 68)',
                          'rgb(147, 51, 234)',
                          'rgb(59, 130, 246)',
                        ],
                        borderWidth: 2,
                        hoverOffset: 8,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                        labels: {
                          usePointStyle: true,
                          padding: 15,
                          font: {
                            size: 11
                          }
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        callbacks: {
                          label: (context: unknown) => {
                            const tooltipContext = context as { 
                              raw: number; 
                              dataset: { data: number[] }; 
                              label: string 
                            };
                            const value = tooltipContext.raw;
                            const total = tooltipContext.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${tooltipContext.label}: $${value.toLocaleString()} (${percentage}%)`;
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-primary-600" />
                  {dateMode === 'single' ? 'Pagos del Día' : 'Métodos de Pago'}
                </h3>
              </div>
              <div className="h-80">
                <Pie
                  data={{
                    labels: metrics.paymentMethodBreakdown.map(p => p.method.toUpperCase()),
                    datasets: [
                      {
                        data: metrics.paymentMethodBreakdown.map(p => p.amount),
                        backgroundColor: [
                          'rgba(34, 197, 94, 0.8)',
                          'rgba(99, 102, 241, 0.8)',
                          'rgba(251, 191, 36, 0.8)',
                          'rgba(239, 68, 68, 0.8)',
                          'rgba(147, 51, 234, 0.8)',
                          'rgba(59, 130, 246, 0.8)',
                        ],
                        borderColor: 'white',
                        borderWidth: 3,
                        hoverOffset: 6,
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                        labels: {
                          usePointStyle: true,
                          padding: 15,
                          font: {
                            size: 11,
                            weight: 500
                          }
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        callbacks: {
                          label: (item: unknown) => {
                            const tooltipItem = item as { raw: number; dataIndex: number; label: string };
                            const val = tooltipItem.raw;
                            const percentage = metrics.paymentMethodBreakdown[tooltipItem.dataIndex].percentage;
                            return `${tooltipItem.label}: $${val.toLocaleString()} (${percentage.toFixed(1)}%)`;
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Profit Margin Analysis */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Target className="h-5 w-5 mr-2 text-primary-600" />
                {dateMode === 'single' ? 'Márgenes del Día' : 'Análisis de Márgenes por Producto'}
              </h3>
            </div>
            <div className="h-96">
              <Bar
                data={{
                  labels: metrics.topProducts.slice(0, 8).map(p => p.name.length > 12 ? p.name.substring(0, 12) + '...' : p.name),
                  datasets: [
                    {
                      label: 'Margen de Utilidad (%)',
                      data: metrics.topProducts.slice(0, 8).map(p => p.margin),
                      backgroundColor: metrics.topProducts.slice(0, 8).map(p => 
                        p.margin >= 50 ? 'rgba(34, 197, 94, 0.8)' :
                        p.margin >= 30 ? 'rgba(251, 191, 36, 0.8)' :
                        p.margin >= 15 ? 'rgba(249, 115, 22, 0.8)' :
                        'rgba(239, 68, 68, 0.8)'
                      ),
                      borderColor: metrics.topProducts.slice(0, 8).map(p => 
                        p.margin >= 50 ? 'rgb(34, 197, 94)' :
                        p.margin >= 30 ? 'rgb(251, 191, 36)' :
                        p.margin >= 15 ? 'rgb(249, 115, 22)' :
                        'rgb(239, 68, 68)'
                      ),
                      borderWidth: 2,
                      borderRadius: 6,
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: 'white',
                      bodyColor: 'white',
                      callbacks: {
                        label: (context: unknown) => {
                          const tooltipContext = context as { dataIndex: number; raw: number };
                          const product = metrics.topProducts[tooltipContext.dataIndex];
                          return [
                            `Margen: ${tooltipContext.raw}%`,
                            `Utilidad: $${product.profit.toLocaleString()}`,
                            `Vendidos: ${product.quantity} unidades`
                          ];
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                      },
                      ticks: {
                        callback: (value: string | number) => `${Number(value)}%`,
                        font: {
                          size: 11
                        }
                      }
                    },
                    x: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        maxRotation: 45,
                        font: {
                          size: 10
                        }
                      }
                    }
                  }
                }}
              />
            </div>

            {/* Category Performance */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-primary-600" />
                  {dateMode === 'single' ? 'Categorías del Día' : 'Rendimiento por Categoría'}
                </h3>
              </div>
              <div className="h-80">
                <Bar
                  data={{
                    labels: metrics.categoryProfits.map(c => c.category),
                    datasets: [
                      {
                        label: 'Utilidad',
                        data: metrics.categoryProfits.map(c => c.profit),
                        backgroundColor: 'rgba(99, 102, 241, 0.8)',
                        borderColor: 'rgb(99, 102, 241)',
                        borderWidth: 2,
                        borderRadius: 6,
                      }
                    ]
                  }}
                  options={{
                    ...chartOptions,
                    indexAxis: 'y' as const,
                    plugins: {
                      ...chartOptions.plugins,
                      legend: {
                        display: false
                      }
                    },
                    scales: {
                      x: {
                        beginAtZero: true,
                        grid: {
                          color: 'rgba(0, 0, 0, 0.1)',
                        },
                        ticks: {
                          callback: (value: string | number) => `$${Number(value).toLocaleString()}`,
                          font: {
                            size: 11
                          }
                        }
                      },
                      y: {
                        grid: {
                          display: false,
                        },
                        ticks: {
                          font: {
                            size: 11
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Detailed Products Table */}
          <div className="bg-white shadow-lg rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-primary-600" />
                {dateMode === 'single' ? 'Productos Vendidos Hoy' : 'Productos más Rentables'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {dateMode === 'single' ? 'Análisis de ventas del día seleccionado' : 'Análisis detallado de rentabilidad por producto'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      #
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Producto
                    </th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Ingresos
                    </th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Costos
                    </th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Utilidad
                    </th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Margen
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {metrics.topProducts.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                          index === 2 ? 'bg-orange-500' :
                          'bg-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.quantity} unidades vendidas</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                        {product.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                        ${product.revenue.toLocaleString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                        ${product.cost.toLocaleString('es-CO')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-bold ${
                          product.profit > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${product.profit.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.margin >= 50 ? 'bg-green-100 text-green-800' :
                          product.margin >= 30 ? 'bg-yellow-100 text-yellow-800' :
                          product.margin >= 15 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {product.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl shadow-lg border border-indigo-200">
              <h4 className="text-lg font-semibold text-indigo-900 mb-4">
                {dateMode === 'single' ? '🌟 Producto del Día' : '📈 Producto Estrella'}
              </h4>
              {metrics.topProducts.length > 0 && (
                <div>
                  <p className="text-xl font-bold text-indigo-800">{metrics.topProducts[0].name}</p>
                  <p className="text-sm text-indigo-600 mt-1">
                    Utilidad: ${metrics.topProducts[0].profit.toLocaleString('es-CO')}
                  </p>
                  <p className="text-sm text-indigo-600">
                    Margen: {metrics.topProducts[0].margin.toFixed(1)}%
                  </p>
                  <p className="text-xs text-indigo-500 mt-2">
                    {metrics.topProducts[0].quantity} unidades vendidas
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-xl shadow-lg border border-emerald-200">
              <h4 className="text-lg font-semibold text-emerald-900 mb-4">💰 Utilidad Promedio</h4>
              <p className="text-2xl font-bold text-emerald-800">
                ${dateMode === 'single' 
                  ? metrics.profit.toLocaleString('es-CO')
                  : Math.round(metrics.profit / (differenceInDays(endDate, startDate) + 1)).toLocaleString('es-CO')
                }
              </p>
              <p className="text-sm text-emerald-600 mt-1">{dateMode === 'single' ? 'del día' : 'promedio por día'}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl shadow-lg border border-amber-200">
              <h4 className="text-lg font-semibold text-amber-900 mb-4">🎯 Meta de Margen</h4>
              <div className="flex items-center">
                <div className="flex-1">
                  <div className="w-full bg-amber-200 rounded-full h-3">
                    <div 
                      className="bg-amber-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((metrics.profitMargin / 50) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-amber-600 mt-2">
                    {metrics.profitMargin.toFixed(1)}% de 50% meta
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Utilities;