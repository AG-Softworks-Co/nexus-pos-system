import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SalesTable from '../components/sales/SalesTable';
import SaleReturnModal from '../components/sales/SaleReturnModal';
import SaleDeleteModal from '../components/sales/SaleDeleteModal';
import SaleEditModal from '../components/sales/SaleEditModal';
import SalesFilters from '../components/sales/SalesFilters';
import ExportModal from '../components/sales/ExportModal';
import SalePreviewModal from '../components/sales/SalePreviewModal';
import ReturnsListModal from '../components/sales/ReturnsListModal';
import { generateSaleReceipt } from '../utils/pdfUtils';
import { formatDateForExcel } from '../utils/dateUtils';
import type { Sale, SaleFilters as FilterState } from '../types/sales';
import * as XLSX from 'xlsx';
import { startOfDay, endOfDay, subDays } from 'date-fns';

const Sales: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReturnsListModal, setShowReturnsListModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<[Date | null, Date | null]>([
    subDays(new Date(), 30),
    new Date()
  ]);

  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    dateFilter: 'all',
    statusFilter: 'all',
    paymentFilter: 'all',
    deliveryFilter: 'all',
    historyFilter: 'active'
  });

  useEffect(() => {
    if (user?.negocioId) {
      fetchSales();
    }
  }, [user, filters.historyFilter]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      let salesData = [];
      
      if (filters.historyFilter === 'deleted') {
        // Fetch deleted sales from history
        const { data: historyData, error: historyError } = await supabase
          .from('historial_ventas')
          .select('*')
          .eq('accion', 'cancelada')
          .order('creado_en', { ascending: false });

        if (historyError) throw historyError;
        
        // Transform history data to match sales structure
        salesData = historyData?.map(history => ({
          ...history.datos_anteriores,
          _isDeleted: true,
          _deletedAt: history.creado_en,
          _deletedBy: history.usuario_id
        })) || [];
      } else {
        // Fetch active sales
        const { data, error } = await supabase
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
          .order('creada_en', { ascending: false });

        if (error) throw error;
        
        // Fetch return information for these sales
        const saleIds = data?.map(sale => sale.id) || [];
        let returnsData = [];
        
        if (saleIds.length > 0) {
          const { data: returns, error: returnsError } = await supabase
            .from('devoluciones')
            .select('venta_id, monto_devolucion')
            .in('venta_id', saleIds)
            .eq('estado', 'aprobada');
            
          if (returnsError) throw returnsError;
          returnsData = returns || [];
        }
        
        // Mark sales that have returns
        salesData = data?.map(sale => {
          const saleReturns = returnsData.filter(r => r.venta_id === sale.id);
          return {
            ...sale,
            _hasReturns: saleReturns.length > 0,
            _returnAmount: saleReturns.reduce((sum, r) => sum + r.monto_devolucion, 0)
          };
        }) || [];
      }
      
      setSales(salesData);
    } catch (err: any) {
      console.error('Error fetching sales:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale);
    setShowDetailModal(true);
  };

  const handleReturnSale = (sale: Sale) => {
    setSelectedSale(sale);
    setShowReturnModal(true);
  };

  const handleViewReturns = (saleId?: string) => {
    if (saleId) {
      setSelectedSale(sales.find(s => s.id === saleId) || null);
    }
    setShowReturnsListModal(true);
  };

  const handleEditSale = (sale: Sale) => {
    setSelectedSale(sale);
    setShowEditModal(true);
  };

  const handleDeleteSale = (sale: Sale) => {
    setSelectedSale(sale);
    setShowDeleteModal(true);
  };

  const handleSaleUpdated = () => {
    fetchSales();
  };

  const handleExportExcel = async () => {
    if (!exportDateRange[0] || !exportDateRange[1]) return;

    const startDate = startOfDay(exportDateRange[0]);
    const endDate = endOfDay(exportDateRange[1]);

    try {
      const { data, error } = await supabase
        .from('ventas')
        .select(`
          *,
          usuario:usuario_id (nombre_completo),
          cliente:cliente_id (nombre_completo, telefono),
          direccion_entrega:direccion_entrega_id (direccion),
          detalle_ventas (
            cantidad,
            precio_unitario,
            producto:producto_id (nombre, sku)
          )
        `)
        .eq('negocio_id', user?.negocioId)
        .gte('creada_en', startDate.toISOString())
        .lte('creada_en', endDate.toISOString())
        .order('creada_en', { ascending: false });

      if (error) throw error;

      // Prepare data for export
      const exportData = data.map(sale => {
        const products = sale.detalle_ventas
          .map(detail => `${detail.producto.nombre} (${detail.cantidad}x$${detail.precio_unitario})`)
          .join('\n');

        return {
          'ID Venta': sale.id,
          'Fecha': formatDateForExcel(sale.creada_en),
          'Vendedor': sale.usuario.nombre_completo,
          'Cliente': sale.cliente?.nombre_completo || '-',
          'Teléfono': sale.cliente?.telefono || '-',
          'Tipo': sale.es_domicilio ? 'Domicilio' : 'Local',
          'Dirección': sale.es_domicilio ? sale.direccion_entrega?.direccion || '-' : '-',
          'Productos': products,
          'Método de Pago': sale.metodo_pago,
          'Subtotal': sale.total - (sale.es_domicilio ? sale.costo_domicilio : 0),
          'Costo Domicilio': sale.es_domicilio ? sale.costo_domicilio : 0,
          'Total': sale.total,
          'Estado': sale.estado_pago || sale.estado
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas');

      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 20)
      }));
      ws['!cols'] = colWidths;

      // Generate file name with date range
      const fileName = `ventas_${formatDateForExcel(startDate.toISOString()).split(' ')[0]}_${
        formatDateForExcel(endDate.toISOString()).split(' ')[0]
      }.xlsx`;

      XLSX.writeFile(wb, fileName);
      setShowExportModal(false);
    } catch (err) {
      console.error('Error exporting sales:', err);
      setError('Error al exportar las ventas');
    }
  };

  const filteredSales = sales.filter(sale => {
    // Filter by history type
    if (filters.historyFilter === 'active' && sale._isDeleted) {
      return false;
    }
    if (filters.historyFilter === 'deleted' && !sale._isDeleted) {
      return false;
    }
    if (filters.historyFilter === 'edited' && (!sale.version || sale.version <= 1) && !sale._isDeleted) {
      return false;
    }
    
    const matchesSearch = !filters.searchQuery || 
      sale.id.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      sale.usuario.nombre_completo.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      sale.cliente?.nombre_completo.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      sale.cliente?.telefono?.includes(filters.searchQuery);
    
    let matchesDate = true;
    const saleDate = new Date(sale.creada_en);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    if (filters.dateFilter === 'today') {
      matchesDate = saleDate >= today;
    } else if (filters.dateFilter === 'yesterday') {
      matchesDate = saleDate >= yesterday && saleDate < today;
    } else if (filters.dateFilter === 'week') {
      matchesDate = saleDate >= weekAgo;
    } else if (filters.dateFilter === 'month') {
      matchesDate = saleDate >= monthAgo;
    }
    
    const matchesStatus = filters.statusFilter === 'all' || sale.estado === filters.statusFilter;
    const matchesPayment = filters.paymentFilter === 'all' || sale.metodo_pago === filters.paymentFilter;
    const matchesDelivery = filters.deliveryFilter === 'all' || 
      (filters.deliveryFilter === 'delivery' && sale.es_domicilio) ||
      (filters.deliveryFilter === 'local' && !sale.es_domicilio);
    
    return matchesSearch && matchesDate && matchesStatus && matchesPayment && matchesDelivery;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Cargando ventas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Historial de Ventas</h1>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleViewReturns()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Ver Devoluciones
          </button>
          
          <button 
          onClick={() => setShowExportModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar a Excel
          </button>
        </div>
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

      <SalesFilters
        searchQuery={filters.searchQuery}
        onSearchChange={(value) => setFilters({ ...filters, searchQuery: value })}
        dateFilter={filters.dateFilter}
        onDateFilterChange={(value) => setFilters({ ...filters, dateFilter: value as any })}
        statusFilter={filters.statusFilter}
        onStatusFilterChange={(value) => setFilters({ ...filters, statusFilter: value as any })}
        paymentFilter={filters.paymentFilter}
        onPaymentFilterChange={(value) => setFilters({ ...filters, paymentFilter: value as any })}
        deliveryFilter={filters.deliveryFilter}
        onDeliveryFilterChange={(value) => setFilters({ ...filters, deliveryFilter: value as any })}
        historyFilter={filters.historyFilter}
        onHistoryFilterChange={(value) => setFilters({ ...filters, historyFilter: value as any })}
      />

      <SalesTable
        sales={filteredSales}
        onViewSale={handleViewSale}
        onEditSale={handleEditSale}
        onDeleteSale={handleDeleteSale}
        onReturnSale={handleReturnSale}
        onGeneratePDF={generateSaleReceipt}
        historyFilter={filters.historyFilter}
      />

      {showDetailModal && selectedSale && (
        <SalePreviewModal
          sale={selectedSale}
          onClose={() => setShowDetailModal(false)}
          onGeneratePDF={generateSaleReceipt}
        />
      )}

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        dateRange={exportDateRange}
        onDateRangeChange={setExportDateRange}
        onExport={handleExportExcel}
      />

      <ReturnsListModal
        isOpen={showReturnsListModal}
        onClose={() => setShowReturnsListModal(false)}
        saleId={selectedSale?.id}
      />

      {showReturnModal && selectedSale && (
        <SaleReturnModal
          isOpen={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          sale={selectedSale}
          onSuccess={handleSaleUpdated}
        />
      )}

      {showEditModal && selectedSale && (
        <SaleEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          sale={selectedSale}
          onSuccess={handleSaleUpdated}
        />
      )}

      {showDeleteModal && selectedSale && (
        <SaleDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          sale={selectedSale}
          onSuccess={handleSaleUpdated}
        />
      )}
    </div>
  );
};

export default Sales;