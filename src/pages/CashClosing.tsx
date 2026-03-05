import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Calendar, FileText, AlertCircle, CheckCircle, Download, History } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { es } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface CashClosingStats {
  totalSales: number;
  cashSales: number;
  otherPaymentSales: {
    method: string;
    amount: number;
  }[];
  orderCount: number;
  topProducts: {
    name: string;
    quantity: number;
    total: number;
  }[];
}

interface CashClosing {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_ventas: number;
  total_efectivo: number;
  efectivo_contado: number;
  diferencia: number;
  estado: 'pendiente' | 'completado' | 'anulado';
  usuario: {
    nombre_completo: string;
  };
}

const CashClosing: React.FC = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [stats, setStats] = useState<CashClosingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [previousClosings, setPreviousClosings] = useState<CashClosing[]>([]);
  const [countedCash, setCountedCash] = useState<string>('');

  const fetchPreviousClosings = async () => {
    if (!user?.negocioId) return;
    try {
      const { data, error } = await supabase
        .from('cierres_caja')
        .select(`
          id,
          fecha_inicio,
          fecha_fin,
          total_ventas,
          total_efectivo,
          efectivo_contado,
          diferencia,
          estado,
          usuario:usuario_id (
            nombre_completo
          )
        `)
        .eq('negocio_id', user.negocioId)
        .order('fecha_inicio', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPreviousClosings(data || []);
    } catch (err) {
      console.error('Error fetching previous closings:', err);
    }
  };

  useEffect(() => {
    fetchPreviousClosings();
  }, [user]);

  const fetchClosingStats = async () => {
    if (!user?.negocioId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: salesData, error: salesError } = await supabase
        .from('ventas')
        .select(`
          id,
          total,
          metodo_pago,
          detalle_ventas (
            cantidad,
            precio_unitario,
            producto:producto_id (
              nombre
            )
          )
        `)
        .eq('negocio_id', user.negocioId)
        .gte('creada_en', startDate.toISOString())
        .lte('creada_en', endDate.toISOString());

      if (salesError) throw salesError;

      let totalSales = 0;
      let cashSales = 0;
      const paymentMethods = new Map<string, number>();
      const products = new Map<string, { quantity: number; total: number }>();

      salesData?.forEach(sale => {
        totalSales += sale.total;
        
        if (sale.metodo_pago === 'efectivo') {
          cashSales += sale.total;
        } else {
          const currentAmount = paymentMethods.get(sale.metodo_pago) || 0;
          paymentMethods.set(sale.metodo_pago, currentAmount + sale.total);
        }

        sale.detalle_ventas.forEach(detail => {
          const productName = detail.producto.nombre;
          const current = products.get(productName) || { quantity: 0, total: 0 };
          products.set(productName, {
            quantity: current.quantity + detail.cantidad,
            total: current.total + (detail.cantidad * detail.precio_unitario)
          });
        });
      });

      const otherPaymentSales = Array.from(paymentMethods.entries())
        .map(([method, amount]) => ({ method, amount }));

      const topProducts = Array.from(products.entries())
        .map(([name, stats]) => ({
          name,
          quantity: stats.quantity,
          total: stats.total
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      setStats({
        totalSales,
        cashSales,
        otherPaymentSales,
        orderCount: salesData?.length || 0,
        topProducts
      });
    } catch (err: any) {
      console.error('Error fetching closing stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClosing = async () => {
    if (!user?.negocioId || !stats) return;
    if (!countedCash) {
      setError('Por favor ingrese el efectivo contado');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const counted = parseFloat(countedCash);
      
      const { data: closingData, error: closingError } = await supabase
        .from('cierres_caja')
        .insert({
          negocio_id: user.negocioId,
          usuario_id: user.id,
          fecha_inicio: startDate.toISOString(),
          fecha_fin: endDate.toISOString(),
          total_ventas: stats.totalSales,
          total_efectivo: stats.cashSales,
          efectivo_contado: counted,
          total_otros_medios: stats.totalSales - stats.cashSales,
          numero_ordenes: stats.orderCount,
          notas: notes || null,
          estado: 'completado'
        })
        .select()
        .single();

      if (closingError) throw closingError;

      const breakdownData = stats.otherPaymentSales.map(payment => ({
        cierre_id: closingData.id,
        metodo_pago: payment.method,
        monto: payment.amount
      }));

      const { error: breakdownError } = await supabase
        .from('detalle_cierre_caja')
        .insert(breakdownData);

      if (breakdownError) throw breakdownError;

      setSuccess('Cierre de caja guardado exitosamente');
      generatePDF();
      fetchPreviousClosings();
      
      setCountedCash('');
      setNotes('');
    } catch (err: any) {
      console.error('Error saving closing:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!stats) return;

    const doc = new jsPDF();
    const businessName = "Mi Negocio";

    doc.setFontSize(20);
    doc.text('Cierre de Caja', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Período: ${format(startDate, 'dd/MM/yyyy HH:mm')} - ${format(endDate, 'dd/MM/yyyy HH:mm')}`, 20, 30);

    doc.text('Resumen de Ventas', 20, 45);
    doc.setFontSize(10);
    const summaryData = [
      ['Ventas Totales', `$${stats.totalSales.toLocaleString()}`],
      ['Ventas en Efectivo', `$${stats.cashSales.toLocaleString()}`],
      ['Otros Medios de Pago', `$${(stats.totalSales - stats.cashSales).toLocaleString()}`],
      ['Número de Órdenes', stats.orderCount.toString()]
    ];

    (doc as any).autoTable({
      startY: 50,
      head: [['Concepto', 'Valor']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    doc.setFontSize(12);
    doc.text('Desglose por Método de Pago', 20, (doc as any).lastAutoTable.finalY + 20);

    const paymentData = stats.otherPaymentSales.map(payment => [
      payment.method,
      `$${payment.amount.toLocaleString()}`
    ]);

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 25,
      head: [['Método de Pago', 'Monto']],
      body: paymentData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    doc.setFontSize(12);
    doc.text('Productos Más Vendidos', 20, (doc as any).lastAutoTable.finalY + 20);

    const productData = stats.topProducts.map(product => [
      product.name,
      product.quantity.toString(),
      `$${product.total.toLocaleString()}`
    ]);

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 25,
      head: [['Producto', 'Cantidad', 'Total']],
      body: productData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    if (notes) {
      doc.setFontSize(12);
      doc.text('Notas:', 20, (doc as any).lastAutoTable.finalY + 20);
      doc.setFontSize(10);
      doc.text(notes, 20, (doc as any).lastAutoTable.finalY + 30);
    }

    doc.save(`cierre-caja-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchClosingStats();
    }
  }, [startDate, endDate]);

  if (loading && !stats) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Cierre de Caja</h1>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <History className="h-4 w-4 mr-2" />
            {showHistory ? 'Ocultar Historial' : 'Ver Historial'}
          </button>
          
          {stats && (
            <button
              onClick={generatePDF}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Éxito</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>{success}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Historial de Cierres</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Ventas</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Efectivo</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contado</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diferencia</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {previousClosings.map((closing) => (
                <tr key={closing.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(parseISO(closing.fecha_inicio), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {closing.usuario.nombre_completo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${closing.total_ventas.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${closing.total_efectivo.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${closing.efectivo_contado.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      closing.diferencia === 0 ? 'bg-green-100 text-green-800' :
                      closing.diferencia > 0 ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      ${closing.diferencia.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      closing.estado === 'completado' ? 'bg-green-100 text-green-800' :
                      closing.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {closing.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Período del Cierre</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y hora inicial
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <DatePicker
                selected={startDate}
                onChange={(date) => date && setStartDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="dd/MM/yyyy HH:mm"
                className="pl-10 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                locale={es}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y hora final
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <DatePicker
                selected={endDate}
                onChange={(date) => date && setEndDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="dd/MM/yyyy HH:mm"
                className="pl-10 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                locale={es}
                minDate={startDate}
              />
            </div>
          </div>
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Ventas Totales</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${stats.totalSales.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-green-50 text-green-600 rounded-md">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Ventas en Efectivo</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${stats.cashSales.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-primary-50 text-primary-600 rounded-md">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Número de Órdenes</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.orderCount}
                  </p>
                </div>
                <div className="p-2 bg-yellow-50 text-yellow-600 rounded-md">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Desglose por Método de Pago
              </h3>
              <div className="space-y-4">
                {stats.otherPaymentSales.map((payment) => (
                  <div key={payment.method} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {payment.method}
                    </span>
                    <span className="text-sm text-gray-500">
                      ${payment.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Productos Más Vendidos
              </h3>
              <div className="space-y-4">
                {stats.topProducts.slice(0, 5).map((product) => (
                  <div key={product.name} className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {product.name}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({product.quantity} unidades)
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      ${product.total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Conteo de Efectivo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ventas en Efectivo
                </label>
                <div className="text-2xl font-bold text-gray-900">
                  ${stats.cashSales.toLocaleString()}
                </div>
              </div>
              
              <div>
                <label htmlFor="countedCash" className="block text-sm font-medium text-gray-700 mb-1">
                  Efectivo Contado
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    id="countedCash"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    className="pl-7 focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diferencia
                </label>
                <div className={`text-2xl font-bold ${
                  !countedCash ? 'text-gray-400' :
                  parseFloat(countedCash) - stats.cashSales === 0 ? 'text-green-600' :
                  parseFloat(countedCash) - stats.cashSales > 0 ? 'text-blue-600' :
                  'text-red-600'
                }`}>
                  ${countedCash ? (parseFloat(countedCash) - stats.cashSales).toLocaleString() : '0'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Notas Adicionales
            </h3>
            <textarea
              rows={4}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Agregar notas o comentarios sobre el cierre..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveClosing}
              disabled={loading || !countedCash}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Cierre de Caja'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CashClosing;