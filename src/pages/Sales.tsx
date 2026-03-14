import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FileSpreadsheet, ArrowLeft, TrendingUp, DollarSign, CreditCard, ShoppingBag, Search, Filter, Calendar as CalendarIcon, RefreshCcw } from 'lucide-react';
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
  const location = useLocation();
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

  useEffect(() => {
    if (!loading && sales.length > 0 && location.state?.highlightSaleId) {
      const saleId = location.state.highlightSaleId;
      const sale = sales.find(s => s.id === saleId);
      if (sale) {
        setSelectedSale(sale);
        setShowDetailModal(true);
        window.history.replaceState({}, document.title);
      }
    }
  }, [loading, sales, location.state]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      let salesData = [];
      if (filters.historyFilter === 'deleted') {
        const { data: historyData, error: historyError } = await supabase
          .from('historial_ventas')
          .select('*')
          .eq('accion', 'cancelada')
          .order('creado_en', { ascending: false });

        if (historyError) throw historyError;
        salesData = historyData?.map(history => ({
          ...history.datos_anteriores,
          _isDeleted: true,
          _deletedAt: history.creado_en,
          _deletedBy: history.usuario_id
        })) || [];
      } else {
        const { data, error } = await supabase
          .from('ventas')
          .select(`
            *,
            usuario:usuario_id (nombre_completo),
            cliente:cliente_id (nombre_completo, telefono, correo),
            direccion_entrega:direccion_entrega_id (direccion, referencias),
            detalle_ventas (
              id,
              cantidad,
              precio_unitario,
              producto:producto_id (nombre, sku)
            )
          `)
          .eq('negocio_id', user?.negocioId)
          .order('creada_en', { ascending: false });

        if (error) throw error;
        const saleIds = data?.map(sale => sale.id) || [];
        let returnsData: any[] = [];
        if (saleIds.length > 0) {
          const { data: returns, error: returnsError } = await supabase
            .from('devoluciones')
            .select('venta_id, monto_devolucion')
            .in('venta_id', saleIds)
            .eq('estado', 'aprobada');
          if (returnsError) throw returnsError;
          returnsData = returns || [];
        }
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
      setError('Error al sincronizar historial de ventas');
    } finally {
      setLoading(false);
    }
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
      const exportData = data.map(sale => {
        const products = sale.detalle_ventas
          .map((detail: any) => `${detail.producto.nombre} (${detail.cantidad}x$${detail.precio_unitario})`)
          .join('\n');

        return {
          'ID Venta': sale.id,
          'Fecha': formatDateForExcel(sale.creada_en),
          'Vendedor': sale.usuario.nombre_completo,
          'Cliente': sale.cliente?.nombre_completo || '-',
          'Tipo': sale.es_domicilio ? 'Domicilio' : 'Local',
          'Dcto': sale.descuento || 0,
          'Total': sale.total,
          'Método': sale.metodo_pago,
          'Estado': sale.estado_pago || sale.estado
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
      const fileName = `ventas_nexus_${formatDateForExcel(startDate.toISOString()).split(' ')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      setShowExportModal(false);
    } catch (err) {
      setError('Falla al exportar reporte comercial');
    }
  };

  const filteredSales = sales.filter(sale => {
    if (filters.historyFilter === 'active' && sale._isDeleted) return false;
    if (filters.historyFilter === 'deleted' && !sale._isDeleted) return false;
    if (filters.historyFilter === 'edited' && (!sale.version || sale.version <= 1) && !sale._isDeleted) return false;

    const matchesSearch = !filters.searchQuery ||
      sale.id.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      sale.usuario.nombre_completo.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      sale.cliente?.nombre_completo.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      sale.cliente?.telefono?.includes(filters.searchQuery);

    let matchesDate = true;
    const saleDate = new Date(sale.creada_en);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filters.dateFilter === 'today') matchesDate = saleDate >= today;
    else if (filters.dateFilter === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      matchesDate = saleDate >= yesterday && saleDate < today;
    } else if (filters.dateFilter === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      matchesDate = saleDate >= weekAgo;
    } else if (filters.dateFilter === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      matchesDate = saleDate >= monthAgo;
    }

    const matchesStatus = filters.statusFilter === 'all' || sale.estado === filters.statusFilter;
    const matchesPayment = filters.paymentFilter === 'all' || sale.metodo_pago === filters.paymentFilter;
    const matchesDelivery = filters.deliveryFilter === 'all' ||
      (filters.deliveryFilter === 'delivery' && sale.es_domicilio) ||
      (filters.deliveryFilter === 'local' && !sale.es_domicilio);

    return matchesSearch && matchesDate && matchesStatus && matchesPayment && matchesDelivery;
  });

  const totals = {
    total: filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0),
    count: filteredSales.length,
    avg: filteredSales.length > 0 ? filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0) / filteredSales.length : 0
  };

  if (loading && sales.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
      <div className="h-12 w-12 rounded-full border-4 border-primary-100 border-t-primary-600 animate-spin"></div>
      <p className="mt-4 text-slate-500 font-black font-outfit uppercase tracking-tighter text-sm">Auditoría de ventas en proceso...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 pb-20 lg:p-6 lg:pb-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
             <div className="h-2 w-2 rounded-full bg-emerald-500" />
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Ledger</p>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight font-outfit uppercase">Cierre de Ventas</h1>
          <p className="text-slate-500 font-medium">Historial completo para la toma de decisiones basada en datos reales.</p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowReturnsListModal(true)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all active:scale-95"
          >
            <RefreshCcw className="h-4 w-4" />
            Devoluciones
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-4 bg-primary-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary-200 hover:bg-primary-700 transition-all active:scale-95"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Enterprise Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group border border-slate-800">
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
             <TrendingUp className="h-24 w-24" />
           </div>
           <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Volumen Comercial</p>
           <p className="text-4xl font-black font-outfit leading-none mb-2">${totals.total.toLocaleString()}</p>
           <p className="text-xs font-bold text-emerald-400 flex items-center gap-2">
             <DollarSign className="h-3 w-3" />
             {totals.count} transacciones procesadas
           </p>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6">
             <ShoppingBag className="h-6 w-6" />
           </div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Ticket Promedio</p>
           <p className="text-3xl font-black text-slate-900 font-outfit">${Math.round(totals.avg).toLocaleString()}</p>
           <p className="text-xs font-bold text-slate-400 mt-2">Valor medio por operación</p>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
           <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-6">
             <CreditCard className="h-6 w-6" />
           </div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Última Actividad</p>
           <p className="text-3xl font-black text-slate-900 font-outfit uppercase">{filteredSales[0] ? new Date(filteredSales[0].creada_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
           <p className="text-xs font-bold text-slate-400 mt-2">Sincronización en tiempo real</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
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

        <div className="animate-in slide-in-from-bottom duration-500">
          <SalesTable
            sales={filteredSales}
            onViewSale={(sale) => { setSelectedSale(sale); setShowDetailModal(true); }}
            onEditSale={(sale) => { setSelectedSale(sale); setShowEditModal(true); }}
            onDeleteSale={(sale) => { setSelectedSale(sale); setShowDeleteModal(true); }}
            onReturnSale={(sale) => { setSelectedSale(sale); setShowReturnModal(true); }}
            onGeneratePDF={generateSaleReceipt}
            historyFilter={filters.historyFilter}
          />
        </div>
      </div>

      {/* Modals Suite */}
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
          onSuccess={fetchSales}
        />
      )}

      {showEditModal && selectedSale && (
        <SaleEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          sale={selectedSale}
          onSuccess={fetchSales}
        />
      )}

      {showDeleteModal && selectedSale && (
        <SaleDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          sale={selectedSale}
          onSuccess={fetchSales}
        />
      )}
    </div>
  );
};

export default Sales;