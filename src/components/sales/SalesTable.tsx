import React from 'react';
import { createPortal } from 'react-dom';
import { Eye, FileText, Edit, Trash2, RefreshCw, User, MoreVertical, ShoppingBag, ArrowRight, X } from 'lucide-react';
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
  const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  const hour = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return { day, month, hour };
};

const getStatusConfig = (sale: Sale) => {
  if (sale._isDeleted) return { label: 'ELIMINADA', class: 'bg-rose-100 text-rose-700 border-rose-200' };
  const status = (sale.estado_pago || sale.estado || 'pendiente').toLowerCase();
  switch (status) {
    case 'pagado':
    case 'pagada':
      return { label: 'PAGADA', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    case 'pendiente':
      return { label: 'PENDIENTE', class: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'parcial':
      return { label: 'PARCIAL', class: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
    case 'vencido':
      return { label: 'VENCIDO', class: 'bg-rose-100 text-rose-700 border-rose-200' };
    case 'cancelada':
      return { label: 'CANCELADA', class: 'bg-slate-100 text-slate-700 border-slate-200' };
    default:
      return { label: status.toUpperCase(), class: 'bg-slate-100 text-slate-700 border-slate-200' };
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

const MobileActions: React.FC<{
  sale: Sale;
  onViewSale: (s: Sale) => void;
  onReturnSale: (s: Sale) => void;
  onEditSale: (s: Sale) => void;
  onDeleteSale: (s: Sale) => void;
  onGeneratePDF: (s: Sale) => void;
}> = ({ sale, onViewSale, onReturnSale, onEditSale, onDeleteSale, onGeneratePDF }) => {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Handle action and close sheet
  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(false);
    setTimeout(action, 100);
  };

  return (
    <>
      <button
        className="p-2.5 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-xl transition-all active:scale-90"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[150] flex items-end justify-center pointer-events-auto overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setOpen(false);
            }}
          />
          
          {/* Bottom Sheet */}
          <div className="relative w-full bg-white rounded-t-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-400 flex flex-col max-h-[85vh]">
            <div className="p-8 pb-10 overflow-y-auto">
              {/* Drag Indicator / Close Helper */}
              <div 
                className="h-1.5 w-12 bg-slate-200 rounded-full mx-auto mb-8 cursor-pointer" 
                onClick={() => setOpen(false)}
              />
              
              <div className="flex justify-between items-center mb-8">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Operación comercial</span>
                  <h3 className="text-2xl font-black text-slate-900 font-outfit leading-none uppercase">#{sale.id.slice(0, 8)}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Monto cierre</span>
                  <p className="text-2xl font-black text-emerald-600 font-outfit leading-none">${sale.total.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={(e) => handleAction(e, () => onViewSale(sale))}
                  className="flex-1 inline-flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-slate-900 hover:text-white transition-all rounded-2xl group border border-transparent active:scale-[0.95]"
                >
                  <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary-600 group-hover:text-slate-900 transition-colors">
                    <Eye className="h-5 w-5" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-tight">Ver Detalle</span>
                </button>

                <button 
                  onClick={(e) => handleAction(e, () => onGeneratePDF(sale))}
                  className="flex-1 inline-flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-slate-900 hover:text-white transition-all rounded-2xl group border border-transparent active:scale-[0.95]"
                >
                  <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-600 group-hover:text-slate-900 transition-colors">
                    <FileText className="h-5 w-5" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-tight">Recibo PDF</span>
                </button>

                {!sale._isDeleted && (
                  <>
                    <button 
                      onClick={(e) => handleAction(e, () => onReturnSale(sale))}
                      className="flex-1 inline-flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-slate-900 hover:text-white transition-all rounded-2xl group border border-transparent active:scale-[0.95]"
                    >
                      <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600 group-hover:text-slate-900 transition-colors">
                        <RefreshCw className="h-5 w-5" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-tight">Devolución</span>
                    </button>

                    <div className="col-span-3 grid grid-cols-2 gap-3 mt-4 pt-6 border-t border-slate-100">
                        {sale.puede_editarse && (
                          <button 
                            onClick={(e) => handleAction(e, () => onEditSale(sale))}
                            className="flex items-center justify-center gap-3 p-5 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all rounded-[1.5rem] group border border-amber-100 active:scale-[0.98]"
                          >
                            <Edit className="h-5 w-5 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Editar Registro</span>
                          </button>
                        )}
                        <button 
                          onClick={(e) => handleAction(e, () => onDeleteSale(sale))}
                          className={`flex items-center justify-center gap-3 p-5 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all rounded-[1.5rem] group border border-rose-100 active:scale-[0.98] ${!sale.puede_editarse ? 'col-span-2' : ''}`}
                        >
                          <Trash2 className="h-5 w-5 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-center">Anular Venta</span>
                        </button>
                    </div>
                  </>
                )}
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setOpen(false);
                }}
                className="w-full mt-6 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Cerrar Menú
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const SalesTable: React.FC<SalesTableProps> = ({
  sales,
  onViewSale,
  onReturnSale,
  onEditSale,
  onDeleteSale,
  onGeneratePDF,
}) => {
  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
        <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
           <ShoppingBag className="h-10 w-10 text-slate-200" />
        </div>
        <h3 className="text-xl font-black text-slate-900 font-outfit uppercase">Cero Transacciones</h3>
        <p className="text-slate-400 font-medium text-xs mt-2 uppercase tracking-widest">No hay registros bajo los criterios actuales de auditoría.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ DESKTOP REFINED TABLE ═══ */}
      <div className="hidden lg:block bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo</th>
              <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor & Cliente</th>
              <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Finanzas</th>
              <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Auditoría</th>
              <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sales.map((sale) => {
              const status = getStatusConfig(sale);
              return (
                <tr key={sale.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-slate-900 font-outfit">#{sale.id.slice(0, 8)}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase truncate max-w-[120px]">{formatDate(sale.creada_en)}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-primary-600 transition-all font-black">
                        {sale.usuario.nombre_completo.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 leading-none">{sale.usuario.nombre_completo}</p>
                        {sale.cliente && (
                          <div className="flex items-center gap-1 mt-1">
                            <User className="h-3 w-3 text-primary-500" />
                            <p className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{sale.cliente.nombre_completo}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-base font-black text-slate-900 font-outfit">${sale.total.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="px-2 py-0.5 bg-slate-100 rounded text-[8px] font-black text-slate-500 uppercase tracking-tighter">{getPaymentLabel(sale.metodo_pago)}</span>
                       {sale.es_domicilio && <span className="px-2 py-0.5 bg-indigo-50 rounded text-[8px] font-black text-indigo-500 uppercase tracking-tighter">Domicilio</span>}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${status.class}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => onViewSale(sale)} 
                        title="Ver Detalle"
                        className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-slate-50 rounded-xl transition-all"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => onGeneratePDF(sale)} 
                        title="Recibo PDF"
                        className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                      >
                        <FileText className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => onReturnSale(sale)} 
                        title="Devolución"
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"
                      >
                        <RefreshCw className="h-5 w-5" />
                      </button>
                      {sale.puede_editarse && (
                        <button 
                          onClick={() => onEditSale(sale)} 
                          title="Editar"
                          className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-slate-50 rounded-xl transition-all"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                      )}
                      <button 
                        onClick={() => onDeleteSale(sale)} 
                        title="Anular"
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-xl transition-all"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ═══ MOBILE TIMELINE CARD LIST ═══ */}
      <div className="lg:hidden space-y-6">
        {sales.map((sale) => {
          const status = getStatusConfig(sale);
          const date = formatShortDate(sale.creada_en);
          return (
            <div
              key={sale.id}
              className={`bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-8 relative overflow-hidden transition-all group active:scale-[0.98] active:bg-slate-50 ${sale._isDeleted ? 'opacity-70 bg-slate-50' : ''}`}
              onClick={() => onViewSale(sale)}
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                 <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-[1.25rem] bg-slate-900 flex flex-col items-center justify-center text-white shadow-lg shadow-slate-200 group-hover:bg-primary-600 transition-colors">
                       <span className="text-xl font-black font-outfit leading-none">{date.day}</span>
                       <span className="text-[10px] font-black uppercase tracking-widest mt-1 opacity-70">{date.month}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Protocolo</span>
                        <h3 className="text-lg font-black text-slate-900 font-outfit leading-none">#{sale.id.slice(0, 8)}</h3>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${status.class}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                 </div>
                 
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

              <div className="space-y-4 mb-6">
                 <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl">
                    <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-slate-400">
                       <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Comprador</p>
                       <p className="text-sm font-black text-slate-800 truncate">{sale.cliente?.nombre_completo || 'Cliente General (Venta Directa)'}</p>
                    </div>
                 </div>

                 <div className="flex items-center gap-4">
                    <div className="flex-1 p-4 bg-slate-50/50 rounded-2xl">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Método</p>
                       <p className="text-sm font-black text-slate-800">{getPaymentLabel(sale.metodo_pago)}</p>
                    </div>
                    {sale.es_domicilio && (
                      <div className="flex-1 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Tipo Envío</p>
                        <p className="text-sm font-black text-indigo-700">Domicilio</p>
                      </div>
                    )}
                 </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cierre Neto</p>
                    <p className="text-3xl font-black text-slate-900 font-outfit leading-none">${sale.total.toLocaleString()}</p>
                 </div>
                 <ArrowRight className="h-6 w-6 text-slate-200 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
              </div>

              <div className="absolute top-0 right-0 h-20 w-20 bg-primary-600 text-white rounded-bl-[4rem] flex items-center justify-center translate-x-10 -translate-y-10 group-hover:translate-x-4 group-hover:-translate-y-4 transition-all duration-500 opacity-10">
                 <ShoppingBag className="h-6 w-6" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SalesTable;