import React from 'react';
import { Search } from 'lucide-react';

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
  return (
    <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="pl-10 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            placeholder="Buscar por ID, vendedor o cliente..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <select
            className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md"
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value)}
          >
            <option value="all">Todas las fechas</option>
            <option value="today">Hoy</option>
            <option value="yesterday">Ayer</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
          </select>
          
          <select
            className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="pagada">Pagada</option>
            <option value="pendiente">Pendiente</option>
            <option value="cancelada">Cancelada</option>
          </select>
          
          <select
            className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md"
            value={paymentFilter}
            onChange={(e) => onPaymentFilterChange(e.target.value)}
          >
            <option value="all">Todos los pagos</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="bancolombia">Bancolombia</option>
            <option value="nequi">Nequi</option>
            <option value="daviplata">Daviplata</option>
          </select>

          <select
            className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md"
            value={historyFilter}
            onChange={(e) => onHistoryFilterChange(e.target.value)}
          >
            <option value="active">Solo activas</option>
            <option value="all">Todas las ventas</option>
            <option value="edited">Solo editadas</option>
            <option value="deleted">Solo eliminadas</option>
          </select>
          <select
            className="focus:ring-primary-500 focus:border-primary-500 h-full py-2 pl-3 pr-7 border-gray-300 bg-white text-gray-700 sm:text-sm rounded-md"
            value={deliveryFilter}
            onChange={(e) => onDeliveryFilterChange(e.target.value)}
          >
            <option value="all">Todos los tipos</option>
            <option value="local">En local</option>
            <option value="delivery">Domicilios</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default SalesFilters;