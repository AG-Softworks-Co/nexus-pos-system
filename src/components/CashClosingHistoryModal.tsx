import React, { useState, useEffect } from 'react';
import { X, Download, DollarSign, Activity, History as HistoryIcon, TrendingUp, CreditCard, Wallet, Edit3, User, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';

interface CashMovement {
  id: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  creado_en: string;
}

interface PaymentDetail {
  metodo_pago: string;
  monto: number;
}

interface CashClosingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  closing: any | null;
  onEdit?: (closing: any) => void;
  userRole?: string;
}

const CashClosingHistoryModal: React.FC<CashClosingHistoryModalProps> = ({ isOpen, onClose, closing, onEdit, userRole }) => {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!closing) return;
      setLoading(true);
      try {
        // Fetch movements
        const { data: movs, error: movsError } = await supabase
          .from('movimientos_caja')
          .select('*')
          .eq('cierre_caja_id', closing.id)
          .order('creado_en', { ascending: true });

        if (movsError) throw movsError;
        setMovements(movs || []);

        // Fetch payment method breakdown
        const { data: details, error: detailsError } = await supabase
          .from('detalle_cierre_caja')
          .select('metodo_pago, monto')
          .eq('cierre_id', closing.id);

        if (detailsError) throw detailsError;
        setPaymentDetails(details || []);

      } catch (err) {
        console.error('Error fetching closing details:', err);
        toast.error('Error al cargar detalles del cierre');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && closing) {
      fetchDetails();
    }
  }, [isOpen, closing]);

  if (!isOpen || !closing) return null;

  const expectedCash = (closing.monto_apertura || 0) + (closing.total_efectivo || 0) + (closing.total_ingresos || 0) - (closing.total_egresos || 0);
  const isDiffStable = (closing.diferencia || 0) === 0;
  const isDiffPositive = (closing.diferencia || 0) > 0;

  const downloadPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Header
      doc.setFillColor(79, 70, 229); // primary-600
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('REPORTE DE CIERRE DE CAJA', pageWidth / 2, 25, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - 20, 45, { align: 'right' });

      // Info Basic
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMACIÓN GENERAL', 20, 55);
      doc.line(20, 57, 80, 57);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Cajero: ${closing.usuario?.nombre_completo || 'N/A'}`, 20, 65);
      doc.text(`Fecha Apertura: ${format(parseISO(closing.fecha_inicio), 'dd/MM/yyyy HH:mm')}`, 20, 72);
      if (closing.fecha_fin) {
        doc.text(`Fecha Cierre: ${format(parseISO(closing.fecha_fin), 'dd/MM/yyyy HH:mm')}`, 20, 79);
      }

      // Summary Table
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMEN FINANCIERO', 20, 95);
      
      const summaryTable = [
        ['Base de Apertura', `$${(closing.monto_apertura || 0).toLocaleString()}`],
        ['Ventas en Efectivo', `+$${(closing.total_efectivo || 0).toLocaleString()}`],
        ['Inyecciones de Capital (+)', `+$${(closing.total_ingresos || 0).toLocaleString()}`],
        ['Retiros / Gastos (-)', `-$${(closing.total_egresos || 0).toLocaleString()}`],
        [{ content: 'Efectivo Esperado', styles: { fontStyle: 'bold' } }, { content: `$${expectedCash.toLocaleString()}`, styles: { fontStyle: 'bold' } }],
        [{ content: 'Efectivo Contado Real', styles: { fontStyle: 'bold' } }, { content: `$${(closing.efectivo_contado || 0).toLocaleString()}`, styles: { fontStyle: 'bold' } }],
        [{ content: 'Diferencia Final', styles: { fontStyle: 'bold', textColor: isDiffStable ? [22, 101, 52] : [153, 27, 27] } }, { content: `$${(closing.diferencia || 0).toLocaleString()}`, styles: { fontStyle: 'bold', textColor: isDiffStable ? [22, 101, 52] : [153, 27, 27] } }]
      ];

      (doc as any).autoTable({
        startY: 100,
        body: summaryTable,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } }
      });

      let nextY = (doc as any).lastAutoTable.finalY + 15;

      // Other Payment Methods
      if (paymentDetails.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DESGLOSE POR OTROS MEDIOS DE PAGO', 20, nextY);
        
        const paymentsData = paymentDetails.map(p => [p.metodo_pago, `$${p.monto.toLocaleString()}`]);
        (doc as any).autoTable({
          startY: nextY + 5,
          head: [['Método de Pago', 'Monto']],
          body: paymentsData,
          theme: 'grid',
          headStyles: { fillColor: [100, 116, 139] }
        });
        nextY = (doc as any).lastAutoTable.finalY + 15;
      }

      // Movements
      if (movements.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('MOVIMIENTOS DE CAJA', 20, nextY);
        
        const movData = movements.map(m => [
          format(parseISO(m.creado_en), 'HH:mm'),
          m.tipo.toUpperCase(),
          m.descripcion,
          `$${m.monto.toLocaleString()}`
        ]);

        (doc as any).autoTable({
          startY: nextY + 5,
          head: [['Hora', 'Tipo', 'Descripción', 'Monto']],
          body: movData,
          theme: 'striped',
          headStyles: { fillColor: [51, 65, 85] }
        });
        nextY = (doc as any).lastAutoTable.finalY + 15;
      }

      if (closing.notas) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('OBSERVACIONES:', 20, nextY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(closing.notas, 20, nextY + 8, { maxWidth: 170 });
      }

      doc.save(`cierre_caja_${format(parseISO(closing.fecha_inicio), 'yyyyMMdd_HHmm')}.pdf`);
      toast.success('Reporte generado correctamente');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Error al generar PDF');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-5xl bg-slate-50 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-white/20">
        
        {/* Header - Premium Gradient */}
        <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 px-6 py-5 shrink-0 flex items-center justify-between text-white border-b border-primary-800/20">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
              <HistoryIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Análisis de Cierre</h3>
              <p className="text-primary-100 text-xs font-medium uppercase tracking-widest flex items-center mt-0.5">
                <Calendar className="w-3 h-3 mr-1 opacity-70" />
                {format(parseISO(closing.fecha_inicio), "EEEE, d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
               onClick={downloadPDF}
               className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 border border-white/10 shadow-lg group"
               title="Descargar Reporte PDF"
            >
              <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-red-400/10 hover:bg-red-500 text-white rounded-xl transition-all duration-200 border border-white/10 shadow-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* content wrapper */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-8 space-y-8">
            
            {/* Top Cards: Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Cajero Responsable</p>
                <p className="text-slate-900 font-bold truncate">{closing.user_name || closing.usuario?.nombre_completo || 'N/A'}</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Volumen de Ventas</p>
                <div className="flex items-baseline space-x-1">
                   <p className="text-slate-900 font-bold text-lg">${(closing.total_ventas || 0).toLocaleString()}</p>
                   <p className="text-slate-400 text-xs">({closing.numero_ordenes || 0} tickets)</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Efectivo Turno</p>
                <p className="text-emerald-700 font-black text-lg">+${(closing.total_efectivo || 0).toLocaleString()}</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-slate-100 transition-colors">
                  <CreditCard className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Otros Medios</p>
                <p className="text-slate-900 font-bold text-lg">${(closing.total_otros_medios || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Main Layout: Math vs Detailed Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Detailed Breakdown (8/12) */}
              <div className="lg:col-span-8 space-y-8">
                
                {/* Math Verification Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
                  <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
                    <h4 className="font-bold flex items-center">
                      <TrendingUp className="w-4 h-4 mr-2 text-indigo-400" />
                      Auditoría de Cuadre
                    </h4>
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/5">Calculado por Sistema</span>
                  </div>
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600 text-sm">Fondo de Apertura</span>
                          <span className="font-bold text-slate-900">${(closing.monto_apertura || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600 text-sm">Ventas Efectivo</span>
                          <span className="font-bold text-emerald-600">+${(closing.total_efectivo || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="text-slate-600 text-sm">Ingresos Extra</span>
                          <span className="font-bold text-indigo-500">+${(closing.total_ingresos || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600 text-sm">Gastos / Egresos</span>
                          <span className="font-bold text-rose-500">-${(closing.total_egresos || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center space-y-6">
                        <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-1">
                             <TrendingUp className="w-12 h-12 text-slate-100" />
                           </div>
                           <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo Esperado</p>
                           <p className="text-3xl font-black text-slate-900">${expectedCash.toLocaleString()}</p>
                        </div>
                        <div className={`text-center p-6 rounded-2xl border-2 transition-all duration-300 ${
                          isDiffStable ? 'bg-emerald-50/50 border-emerald-500/30' : 
                          isDiffPositive ? 'bg-blue-50/50 border-blue-500/30' : 
                          'bg-red-50/50 border-red-500/30'
                        }`}>
                           <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                             isDiffStable ? 'text-emerald-600' : isDiffPositive ? 'text-blue-600' : 'text-red-600'
                           }`}>
                             Contado Real: <span className="text-slate-900">${(closing.efectivo_contado || 0).toLocaleString()}</span>
                           </p>
                           <div className="flex items-center justify-center space-x-2">
                             <span className={`text-3xl font-black ${
                               isDiffStable ? 'text-emerald-700' : isDiffPositive ? 'text-blue-700' : 'text-red-700'
                             }`}>
                               ${(closing.diferencia || 0).toLocaleString()}
                             </span>
                             {isDiffStable ? (
                               <div className="bg-emerald-500 text-white p-1 rounded-full"><Activity className="w-4 h-4" /></div>
                             ) : (
                               <div className={`${isDiffPositive ? 'bg-blue-500' : 'bg-red-500'} text-white p-1 rounded-full`}>
                                 <AlertTriangle className="w-4 h-4" />
                               </div>
                             )}
                           </div>
                           <p className="text-[10px] mt-2 font-bold opacity-60">DIFERENCIA FINAL</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Movements List - Premium Style */}
                {loading ? (
                  <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                ) : movements.length > 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 transition-all">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 flex items-center">
                         <Activity className="w-4 h-4 mr-2 text-primary-500" />
                         Log de Movimientos Manuales
                      </h4>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg">{movements.length} REGISTROS</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Hora</th>
                            <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Concepto</th>
                            <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {movements.map((mov) => (
                            <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500">
                                {format(parseISO(mov.creado_en), 'HH:mm')}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-800">{mov.descripcion}</span>
                                  <span className={`text-[9px] font-black uppercase tracking-tight ${mov.tipo === 'ingreso' ? 'text-emerald-500' : 'text-rose-400'}`}>
                                    {mov.tipo === 'ingreso' ? 'Inyección de Capital' : 'Salida de Efectivo'}
                                  </span>
                                </div>
                              </td>
                              <td className={`px-6 py-4 text-right font-black ${mov.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {mov.tipo === 'ingreso' ? '+' : '-'}${mov.monto.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-10 text-center">
                    <HistoryIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-bold">No hubo movimientos manuales en este turno</p>
                  </div>
                )}
              </div>

              {/* Right Column: Payments & Actions (4/12) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Payment Breakdown Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
                   <div className="absolute top-0 right-0 p-4 opacity-5">
                      <CreditCard className="w-16 h-16" />
                   </div>
                   <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center">
                      <Wallet className="w-4 h-4 mr-2 text-primary-500" />
                      Medios de Pago
                   </h4>
                   
                   <div className="space-y-4">
                      {/* Efectivo Always first */}
                      <div className="flex items-center justify-between p-3 bg-emerald-50/30 rounded-2xl border border-emerald-100">
                         <div className="flex items-center space-x-3">
                            <div className="bg-emerald-500 p-2 rounded-xl"><DollarSign className="w-4 h-4 text-white" /></div>
                            <span className="text-sm font-bold text-emerald-900">Efectivo</span>
                         </div>
                         <span className="font-black text-emerald-700">${(closing.total_efectivo || 0).toLocaleString()}</span>
                      </div>

                      {/* Dynamic methods */}
                      {paymentDetails.map((pd, idx) => (
                         <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center space-x-3">
                               <div className="bg-slate-400 p-2 rounded-xl"><CreditCard className="w-4 h-4 text-white" /></div>
                               <span className="text-sm font-bold text-slate-700">{pd.metodo_pago}</span>
                            </div>
                            <span className="font-black text-slate-900">${(pd.monto || 0).toLocaleString()}</span>
                         </div>
                      ))}

                      {paymentDetails.length === 0 && (
                        <p className="text-xs text-center text-slate-400 italic py-4">No se registraron otros medios de pago</p>
                      )}
                   </div>
                </div>

                {/* Admin Actions */}
                {['propietario', 'administrador'].includes(userRole || '') && onEdit && (
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 shadow-lg shadow-amber-200 text-white group cursor-pointer hover:scale-[1.02] transition-all"
                       onClick={() => onEdit(closing)}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-white/20 p-2 rounded-xl"><Edit3 className="w-5 h-5 text-white" /></div>
                      <span className="text-[10px] font-black bg-black/10 px-2 py-0.5 rounded-full uppercase">Modo Auditor</span>
                    </div>
                    <h4 className="text-lg font-bold mb-1">Corregir Cierre</h4>
                    <p className="text-amber-50 text-xs font-medium leading-relaxed opacity-90">
                      ¿Detectaste un error? Haz clic aquí para ajustar el efectivo contado y las observaciones de este turno.
                    </p>
                  </div>
                )}

                {/* Notes if any */}
                {closing.notas && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 relative">
                     <div className="absolute top-4 right-4"><Activity className="w-4 h-4 text-slate-200" /></div>
                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Observaciones de Cierre</h4>
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-sm text-slate-700 italic leading-relaxed">"{closing.notas}"</p>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AlertTriangle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export default CashClosingHistoryModal;
