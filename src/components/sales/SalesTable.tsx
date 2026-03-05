import React from 'react';
import { Eye, FileText, Calendar, Edit, Trash2, RefreshCw, User, AlertTriangle, DollarSign, MoreVertical, ShoppingBag } from 'lucide-react';
import type { Sale } from '../../types/sales';

interface SalesTableProps {
  sales: Sale[];
  onViewSale: (sale: Sale) => void;
  onReturnSale: (sale: Sale) => void;
  onDeleteSale: (sale: Sale) => void;
  onEditSale: (sale: Sale) => void;
  onGeneratePDF: (sale: Sale) => void;
  historyFilter?: string;
}

export const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date(dateString).toLocaleDateString('es-ES', options);
};

const formatShortDate = (dateString: string) => {
  const d = new Date(dateString);
  const day = d.getDate();
  const month = d.toLocaleDateString('es-ES', { month: 'short' });
  const hour = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return { day, month, hour };
};

const getStatusConfig = (sale: Sale) => {
  if (sale._isDeleted) return { label: 'Eliminada', class: 'sale-status-deleted' };
  const status = sale.estado_pago || sale.estado;
  switch (status) {
    case 'pagado':
    case 'pagada':
      return { label: 'Pagada', class: 'sale-status-paid' };
    case 'pendiente':
      return { label: 'Pendiente', class: 'sale-status-pending' };
    case 'parcial':
      return { label: 'Parcial', class: 'sale-status-partial' };
    case 'vencido':
      return { label: 'Vencido', class: 'sale-status-overdue' };
    case 'cancelada':
      return { label: 'Cancelada', class: 'sale-status-deleted' };
    default:
      return { label: status || 'N/A', class: 'sale-status-pending' };
  }
};

const getPaymentLabel = (method: string) => {
  const map: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    bancolombia: 'Bancolombia',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    credito: 'Crédito',
  };
  return map[method] || method;
};

/* ── Mobile Action Menu ── */
const MobileActions: React.FC<{
  sale: Sale;
  onViewSale: (s: Sale) => void;
  onReturnSale: (s: Sale) => void;
  onEditSale: (s: Sale) => void;
  onDeleteSale: (s: Sale) => void;
  onGeneratePDF: (s: Sale) => void;
}> = ({ sale, onViewSale, onReturnSale, onEditSale, onDeleteSale, onGeneratePDF }) => {
  const [open, setOpen] = React.useState(false);

  // Prevent body scroll when bottom sheet is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="sale-actions-wrapper">
      <button
        className="sale-actions-trigger"
        onClick={() => setOpen(!open)}
        aria-label="Más opciones"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Full-screen backdrop */}
          <div className="sale-sheet-backdrop" onClick={() => setOpen(false)} />

          {/* Bottom sheet */}
          <div className="sale-sheet">
            {/* Handle bar */}
            <div className="sale-sheet-handle">
              <div className="sale-sheet-handle-bar" />
            </div>

            {/* Sale info header */}
            <div className="sale-sheet-header">
              <span className="sale-sheet-id">#{sale.id.slice(0, 8)}</span>
              <span className="sale-sheet-total">${sale.total.toLocaleString()}</span>
            </div>

            {/* Actions */}
            <div className="sale-sheet-actions">
              <button onClick={() => { onViewSale(sale); setOpen(false); }}>
                <Eye className="h-5 w-5 text-primary-600" />
                <div>
                  <span>Ver detalle</span>
                  <small>Previsualizar la venta completa</small>
                </div>
              </button>
              <button onClick={() => { onGeneratePDF(sale); setOpen(false); }}>
                <FileText className="h-5 w-5 text-gray-600" />
                <div>
                  <span>Descargar ticket</span>
                  <small>Generar PDF del recibo</small>
                </div>
              </button>
              {!sale._isDeleted && (
                <>
                  <button onClick={() => { onReturnSale(sale); setOpen(false); }}>
                    <RefreshCw className="h-5 w-5 text-blue-600" />
                    <div>
                      <span>Devolución</span>
                      <small>Procesar devolución de productos</small>
                    </div>
                  </button>
                  {sale.puede_editarse && (
                    <button onClick={() => { onEditSale(sale); setOpen(false); }}>
                      <Edit className="h-5 w-5 text-amber-600" />
                      <div>
                        <span>Editar venta</span>
                        <small>Modificar datos de la venta</small>
                      </div>
                    </button>
                  )}
                  <button onClick={() => { onDeleteSale(sale); setOpen(false); }} className="sale-sheet-danger">
                    <Trash2 className="h-5 w-5" />
                    <div>
                      <span>Eliminar venta</span>
                      <small>Esta acción no se puede deshacer</small>
                    </div>
                  </button>
                </>
              )}
            </div>

            {/* Cancel button */}
            <button className="sale-sheet-cancel" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   SALES TABLE / CARD LIST
   ═══════════════════════════════════════════════════════ */
const SalesTable: React.FC<SalesTableProps> = ({
  sales,
  onViewSale,
  onReturnSale,
  onEditSale,
  onDeleteSale,
  onGeneratePDF,
  historyFilter,
}) => {
  /* ── Empty state ── */
  if (sales.length === 0) {
    return (
      <div className="sale-empty-state">
        <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto" />
        <p className="mt-3 text-sm text-gray-500 font-medium">No se encontraron ventas</p>
        <p className="text-xs text-gray-400 mt-1">Intenta ajustar los filtros</p>
      </div>
    );
  }

  return (
    <>
      {/* ═══ DESKTOP TABLE (hidden on mobile) ═══ */}
      <div className="sale-desktop-table">
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y Hora</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendedor</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Historial</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id} className={`hover:bg-gray-50 ${sale._isDeleted ? 'bg-red-50' : sale.version && sale.version > 1 ? 'bg-yellow-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{sale.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                        {formatDate(sale.creada_en)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{sale.usuario.nombre_completo}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sale.cliente ? (
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1 text-gray-400" />
                          <div className="text-sm font-medium text-gray-900">{sale.cliente.nombre_completo}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">${sale.total.toLocaleString()}</div>
                      {sale._hasReturns && (
                        <div className="text-xs text-red-500 flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />Con devolución
                        </div>
                      )}
                      {sale.es_domicilio && (
                        <div className="text-xs text-gray-500">Envío: ${sale.costo_domicilio.toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${sale._isDeleted ? 'bg-red-100 text-red-800' :
                        sale.estado_pago === 'pagado' ? 'bg-green-100 text-green-800' :
                          sale.estado_pago === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                            sale.estado_pago === 'parcial' ? 'bg-blue-100 text-blue-800' :
                              sale.estado_pago === 'vencido' ? 'bg-red-100 text-red-800' :
                                sale.estado === 'pagada' ? 'bg-green-100 text-green-800' :
                                  sale.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                        }`}>
                        {sale._isDeleted ? 'Eliminada' : sale.estado_pago || sale.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        {sale._isDeleted && (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Eliminada</span>
                        )}
                        {sale.version && sale.version > 1 && !sale._isDeleted && (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Editada (v{sale.version})</span>
                        )}
                        {!sale._isDeleted && (!sale.version || sale.version <= 1) && (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Original</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {sale._isDeleted ? (
                        <div className="flex items-center justify-end space-x-2">
                          <button className="text-gray-600 hover:text-gray-900 group relative p-1" onClick={() => onViewSale(sale)}>
                            <Eye className="h-5 w-5" />
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Ver venta eliminada</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end space-x-2">
                          <button className="text-primary-600 hover:text-primary-900 group relative p-1" onClick={() => onViewSale(sale)}>
                            <Eye className="h-5 w-5" />
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Previsualizar venta</span>
                          </button>
                          <button className="text-gray-600 hover:text-gray-900 group relative p-1" onClick={() => onGeneratePDF(sale)}>
                            <FileText className="h-5 w-5" />
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Descargar ticket</span>
                          </button>
                          <button className="text-blue-600 hover:text-blue-900 group relative p-1" onClick={() => onReturnSale(sale)}>
                            <RefreshCw className="h-5 w-5" />
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Devolución</span>
                          </button>
                          {sale.puede_editarse && (
                            <button className="text-blue-600 hover:text-blue-900 group relative p-1" onClick={() => onEditSale(sale)}>
                              <Edit className="h-5 w-5" />
                              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Editar venta</span>
                            </button>
                          )}
                          <button className="text-red-600 hover:text-red-900 group relative p-1" onClick={() => onDeleteSale(sale)}>
                            <Trash2 className="h-5 w-5" />
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Eliminar venta</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══ MOBILE CARD LIST (hidden on desktop) ═══ */}
      <div className="sale-mobile-list">
        {sales.map((sale) => {
          const status = getStatusConfig(sale);
          const date = formatShortDate(sale.creada_en);

          return (
            <div
              key={sale.id}
              className={`sale-card ${sale._isDeleted ? 'sale-card-deleted' : ''}`}
              onClick={() => onViewSale(sale)}
            >
              {/* ── Top row: date badge + ID + actions ── */}
              <div className="sale-card-header">
                <div className="sale-card-date">
                  <span className="sale-card-date-day">{date.day}</span>
                  <span className="sale-card-date-month">{date.month}</span>
                </div>

                <div className="sale-card-meta">
                  <div className="sale-card-id">#{sale.id.slice(0, 8)}</div>
                  <div className="sale-card-time">
                    <Calendar className="h-3 w-3" />
                    {date.hour}
                  </div>
                </div>

                <div className="sale-card-right">
                  <span className={`sale-status-badge ${status.class}`}>
                    {status.label}
                  </span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <MobileActions
                      sale={sale}
                      onViewSale={onViewSale}
                      onReturnSale={onReturnSale}
                      onEditSale={onEditSale}
                      onDeleteSale={onDeleteSale}
                      onGeneratePDF={onGeneratePDF}
                    />
                  </div>
                </div>
              </div>

              {/* ── Body: info rows ── */}
              <div className="sale-card-body">
                <div className="sale-card-row">
                  <div className="sale-card-info">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    <span className="sale-card-info-label">Vendedor:</span>
                    <span className="sale-card-info-value">{sale.usuario.nombre_completo}</span>
                  </div>
                </div>

                {sale.cliente && (
                  <div className="sale-card-row">
                    <div className="sale-card-info">
                      <User className="h-3.5 w-3.5 text-primary-400" />
                      <span className="sale-card-info-label">Cliente:</span>
                      <span className="sale-card-info-value">{sale.cliente.nombre_completo}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer: total + tags ── */}
              <div className="sale-card-footer">
                <div className="sale-card-total">
                  <DollarSign className="h-4 w-4" />
                  <span>${sale.total.toLocaleString()}</span>
                </div>

                <div className="sale-card-tags">
                  <span className="sale-tag sale-tag-payment">
                    {getPaymentLabel(sale.metodo_pago)}
                  </span>
                  {sale.es_domicilio && (
                    <span className="sale-tag sale-tag-delivery">Domicilio</span>
                  )}
                  {sale._hasReturns && (
                    <span className="sale-tag sale-tag-return">
                      <AlertTriangle className="h-3 w-3" /> Dev.
                    </span>
                  )}
                  {sale.version && sale.version > 1 && !sale._isDeleted && (
                    <span className="sale-tag sale-tag-edited">v{sale.version}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default SalesTable;