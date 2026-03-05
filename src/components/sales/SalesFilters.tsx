import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, Calendar, CreditCard, Truck, Archive, ChevronDown } from 'lucide-react';

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

/* Helper: count active filters (non-"all" / non-"active") */
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
    <div className="sales-filters-root">
      {/* ── Search bar ── */}
      <div className="sales-search-row">
        <div className="sales-search-wrapper">
          <Search className="sales-search-icon" />
          <input
            type="text"
            className="sales-search-input"
            placeholder="Buscar por ID, vendedor o cliente..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              className="sales-search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Toggle filters (mobile) */}
        <button
          className="sales-filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount > 0 && (
            <span className="sales-filter-badge">{activeCount}</span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* ── Filter panel ── */}
      <div className={`sales-filter-panel ${showFilters ? 'sales-filter-panel-open' : ''}`}>
        <div className="sales-filter-grid">
          {/* Date */}
          <div className="sales-filter-item">
            <label className="sales-filter-label">
              <Calendar className="h-3.5 w-3.5" />
              Fecha
            </label>
            <select
              className="sales-filter-select"
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="today">Hoy</option>
              <option value="yesterday">Ayer</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mes</option>
            </select>
          </div>

          {/* Status */}
          <div className="sales-filter-item">
            <label className="sales-filter-label">
              <Archive className="h-3.5 w-3.5" />
              Estado
            </label>
            <select
              className="sales-filter-select"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="pagada">Pagada</option>
              <option value="pendiente">Pendiente</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          {/* Payment */}
          <div className="sales-filter-item">
            <label className="sales-filter-label">
              <CreditCard className="h-3.5 w-3.5" />
              Pago
            </label>
            <select
              className="sales-filter-select"
              value={paymentFilter}
              onChange={(e) => onPaymentFilterChange(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="bancolombia">Bancolombia</option>
              <option value="nequi">Nequi</option>
              <option value="daviplata">Daviplata</option>
            </select>
          </div>

          {/* Delivery */}
          <div className="sales-filter-item">
            <label className="sales-filter-label">
              <Truck className="h-3.5 w-3.5" />
              Tipo
            </label>
            <select
              className="sales-filter-select"
              value={deliveryFilter}
              onChange={(e) => onDeliveryFilterChange(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="local">En local</option>
              <option value="delivery">Domicilios</option>
            </select>
          </div>

          {/* History */}
          <div className="sales-filter-item">
            <label className="sales-filter-label">
              <Archive className="h-3.5 w-3.5" />
              Historial
            </label>
            <select
              className="sales-filter-select"
              value={historyFilter}
              onChange={(e) => onHistoryFilterChange(e.target.value)}
            >
              <option value="active">Solo activas</option>
              <option value="all">Todas</option>
              <option value="edited">Editadas</option>
              <option value="deleted">Eliminadas</option>
            </select>
          </div>
        </div>

        {/* Clear filters */}
        {activeCount > 0 && (
          <button className="sales-filter-clear" onClick={handleClearFilters}>
            <X className="h-3.5 w-3.5" />
            Limpiar filtros ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
};

export default SalesFilters;