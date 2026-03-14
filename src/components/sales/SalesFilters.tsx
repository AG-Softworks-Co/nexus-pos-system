import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, Calendar, CreditCard, Truck, Archive, ChevronDown, Check } from 'lucide-react';

interface SalesFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  paymentFilter: string;
  onPaymentFilterChange: (value: string) => void;
  deliveryFilter: string;
  onDeliveryFilterChange: (value: string) => void;
  historyFilter: string;
  onHistoryFilterChange: (value: string) => void;
}

const countActiveFilters = (
  dateFilter: string,
  statusFilter: string,
  paymentFilter: string,
  deliveryFilter: string,
  historyFilter: string
) =>
  [dateFilter !== 'all', statusFilter !== 'all', paymentFilter !== 'all', deliveryFilter !== 'all', historyFilter !== 'active']
    .filter(Boolean).length;

const SalesFilters: React.FC<SalesFiltersProps> = ({
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  statusFilter,
  onStatusFilterChange,
  paymentFilter,
  onPaymentFilterChange,
  deliveryFilter,
  onDeliveryFilterChange,
  historyFilter,
  onHistoryFilterChange,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = countActiveFilters(dateFilter, statusFilter, paymentFilter, deliveryFilter, historyFilter);

  const handleClearFilters = () => {
    onDateFilterChange('all');
    onStatusFilterChange('all');
    onPaymentFilterChange('all');
    onDeliveryFilterChange('all');
    onHistoryFilterChange('active');
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top duration-500">
      {/* Search & Toggle Row */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary-600 transition-colors" />
          <input
            type="text"
            className="w-full pl-14 pr-12 py-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm focus:ring-2 focus:ring-primary-500 font-bold text-sm text-slate-700 placeholder:text-slate-400 transition-all"
            placeholder="Buscar por ID, vendedor, cliente o teléfono..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-50 rounded-full transition-all"
              onClick={() => onSearchChange('')}
            >
              <X className="h-4 w-4 text-slate-300" />
            </button>
          )}
        </div>

        <button
          className={`flex items-center justify-center gap-3 px-8 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all shadow-sm ${
            showFilters ? 'bg-slate-900 text-white shadow-slate-200' : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
          }`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Parámetros de Auditoría
          {activeCount > 0 && (
            <span className="flex items-center justify-center h-5 min-w-5 px-1.5 bg-primary-600 text-white rounded-full text-[9px] font-black leading-none">
              {activeCount}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expandable Filter Panel */}
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${showFilters ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* Date Filter */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                <Calendar className="h-3 w-3" /> Periodo
              </label>
              <select
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 cursor-pointer transition-all"
                value={dateFilter}
                onChange={(e) => onDateFilterChange(e.target.value)}
              >
                <option value="all">Todo el tiempo</option>
                <option value="today">Hoy</option>
                <option value="yesterday">Ayer</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                <Archive className="h-3 w-3" /> Estado Pago
              </label>
              <select
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 cursor-pointer transition-all"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
              >
                <option value="all">Cualquier estado</option>
                <option value="pagada">Pagada</option>
                <option value="pendiente">Pendiente</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                <CreditCard className="h-3 w-3" /> Método
              </label>
              <select
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 cursor-pointer transition-all"
                value={paymentFilter}
                onChange={(e) => onPaymentFilterChange(e.target.value)}
              >
                <option value="all">Todos los medios</option>
                <option value="efectivo">Efectivo</option>
                <option value="nequi">Nequi</option>
                <option value="bancolombia">Bancolombia</option>
                <option value="daviplata">Daviplata</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                <Truck className="h-3 w-3" /> Modalidad
              </label>
              <select
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 cursor-pointer transition-all"
                value={deliveryFilter}
                onChange={(e) => onDeliveryFilterChange(e.target.value)}
              >
                <option value="all">Local & Domicilio</option>
                <option value="local">Punto de Venta</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>

            {/* History Filter */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                <Archive className="h-3 w-3" /> Historial
              </label>
              <select
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 cursor-pointer transition-all"
                value={historyFilter}
                onChange={(e) => onHistoryFilterChange(e.target.value)}
              >
                <option value="active">Activas actuales</option>
                <option value="edited">Modificadas</option>
                <option value="deleted">Auditadas (Eliminadas)</option>
                <option value="all">Listado global</option>
              </select>
            </div>
          </div>

          {activeCount > 0 && (
            <div className="pt-6 border-t border-slate-50 flex justify-end">
              <button 
                onClick={handleClearFilters}
                className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
              >
                <X className="h-4 w-4" />
                Remover todos los filtros ({activeCount})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesFilters;