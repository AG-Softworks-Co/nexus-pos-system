import React, { useState, useEffect } from 'react';
import { X, Calendar, Phone, MapPin, Truck, RefreshCw, ArrowLeft, Percent, DollarSign } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';
import type { Sale } from '../../types/sales';
import { supabase } from '../../lib/supabase';

interface SalePreviewModalProps {
  sale: Sale;
  onClose: () => void;
  onGeneratePDF: (sale: Sale) => void;
}

interface PartialPayment {
  id: string;
  monto: number;
  metodo_pago: string;
  fecha_pago: string;
  notas: string;
}

const SalePreviewModal: React.FC<SalePreviewModalProps> = ({ sale, onClose, onGeneratePDF }) => {
  const [returnInfo, setReturnInfo] = useState<{
    id: string;
    tipo_devolucion: string;
    monto_devolucion: number;
    estado: string;
    detalle_devoluciones: {
      detalle_venta_id: string;
      cantidad_devuelta: number;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);

  useEffect(() => {
    fetchReturnInfo();
    if (sale.metodo_pago === 'credito') {
      fetchPartialPayments();
    }
  }, [sale.id]);

  const fetchReturnInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('devoluciones')
        .select(`
          id,
          tipo_devolucion,
          monto_devolucion,
          estado,
          detalle_devoluciones (
            detalle_venta_id,
            cantidad_devuelta
          )
        `)
        .eq('venta_id', sale.id)
        .eq('estado', 'aprobada')
        .maybeSingle();

      if (error) throw error;
      setReturnInfo(data);
    } catch (err) {
      console.error('Error fetching return info:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartialPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('pagos_parciales')
        .select('*')
        .eq('venta_id', sale.id)
        .order('fecha_pago', { ascending: false });

      if (error) throw error;
      setPartialPayments(data || []);
    } catch (err) {
      console.error('Error fetching partial payments:', err);
    }
  };

  // Create a map of returned quantities by detail_id
  const returnedQuantities: Record<string, number> = {};
  if (returnInfo?.detalle_devoluciones) {
    returnInfo.detalle_devoluciones.forEach(detail => {
      returnedQuantities[detail.detalle_venta_id] = detail.cantidad_devuelta;
    });
  }

  // Calculate subtotal from products
  const subtotalProductos = sale.detalle_ventas.reduce((sum, item) => {
    const returnedQty = returnedQuantities[item.id] || 0;
    const effectiveQty = item.cantidad - returnedQty;
    return sum + (effectiveQty * item.precio_unitario);
  }, 0);

  // Calculate effective total after returns
  const effectiveTotal = returnInfo ? sale.total - returnInfo.monto_devolucion : sale.total;

  // Calculate total paid from partial payments
  const totalPagado = partialPayments.reduce((sum, p) => sum + p.monto, 0);

  const handleDownloadPDF = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('🎫 MODAL: Botón PDF clickeado, iniciando descarga...');
    console.log('📊 MODAL: Datos de la venta:', sale);

    try {
      onGeneratePDF(sale);
      console.log('✅ MODAL: Función onGeneratePDF llamada exitosamente');
    } catch (error) {
      console.error('❌ MODAL: Error al llamar onGeneratePDF:', error);
      alert('Error al generar el PDF: ' + (error as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto modal-backdrop">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg sm:my-16 modal-content">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              onClick={onClose}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Detalle de Venta #{sale.id.slice(0, 8)}
              </h3>
              {sale.estado === 'cancelada' && (
                <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  VENTA CANCELADA
                </div>
              )}
            </div>
            <div className="flex items-center">
              <button
                onClick={() => { fetchReturnInfo(); if (sale.metodo_pago === 'credito') fetchPartialPayments(); }}
                className="mr-2 p-1 rounded-full hover:bg-gray-100"
                title="Actualizar información"
              >
                <RefreshCw className="h-4 w-4 text-gray-500" />
              </button>
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${sale.estado === 'pagada' ? 'bg-green-100 text-green-800' :
                  sale.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                }`}>
                {sale.estado}
              </span>
            </div>
          </div>

          {returnInfo && (
            <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
              <div className="flex">
                <ArrowLeft className="h-5 w-5 text-yellow-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Devolución {returnInfo.tipo_devolucion} por ${returnInfo.monto_devolucion.toLocaleString()}
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Esta venta tiene una devolución aprobada. Los valores mostrados reflejan los ajustes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Información de descuento si existe */}
          {sale.descuento_total && sale.descuento_total > 0 && (
            <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4 rounded-md">
              <div className="flex">
                <Percent className="h-5 w-5 text-green-400 mr-2" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Descuento aplicado: ${sale.descuento_total.toLocaleString()}
                    {sale.descuento_porcentaje_total && sale.descuento_porcentaje_total > 0 && (
                      <span className="ml-1">({sale.descuento_porcentaje_total}%)</span>
                    )}
                  </p>
                  {sale.razon_descuento && (
                    <p className="text-xs text-green-700 mt-1">
                      Razón: {sale.razon_descuento}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Sale Info */}
            <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="h-4 w-4 mr-2" />
                  {formatDisplayDate(sale.creada_en)}
                </div>
                <div className="mt-2 text-sm font-medium">
                  Vendedor: {sale.usuario.nombre_completo}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Método de pago: <span className="capitalize">{sale.metodo_pago}</span>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Estado: <span className="capitalize">{sale.estado_pago || sale.estado}</span>
                </div>
              </div>
            </div>

            {/* Client Info */}
            {sale.cliente && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Información del Cliente</h4>
                <div className="space-y-2">
                  <p className="text-sm">{sale.cliente.nombre_completo}</p>
                  {sale.cliente.telefono && (
                    <div className="flex items-center text-sm text-gray-500">
                      <Phone className="h-4 w-4 mr-2" />
                      {sale.cliente.telefono}
                    </div>
                  )}
                  {sale.es_domicilio && sale.direccion_entrega && (
                    <div className="mt-3">
                      <div className="flex items-start text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-2 mt-0.5" />
                        <div>
                          <p>{sale.direccion_entrega.direccion}</p>
                          {sale.direccion_entrega.referencias && (
                            <p className="mt-1 text-xs">Ref: {sale.direccion_entrega.referencias}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Products */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Productos</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-gray-500 uppercase">
                    <div>Producto</div>
                    <div className="text-right">Cantidad</div>
                    <div className="hidden sm:block text-right">Precio Unit.</div>
                    <div className="text-right">Subtotal</div>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {sale.detalle_ventas.map((item) => {
                    const returnedQty = returnedQuantities[item.id] || 0;
                    const effectiveQty = item.cantidad - returnedQty;
                    const effectiveSubtotal = effectiveQty * item.precio_unitario;

                    return (
                      <div key={item.id} className="px-4 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.producto.nombre}</p>
                            {item.producto.sku && (
                              <p className="text-xs text-gray-500">SKU: {item.producto.sku}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm">
                              {effectiveQty}
                              {returnedQty > 0 && (
                                <span className="text-red-600 ml-1">(-{returnedQty})</span>
                              )}
                            </p>
                          </div>
                          <div className="hidden sm:block text-right">
                            <p className="text-sm">${item.precio_unitario.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              ${effectiveSubtotal.toLocaleString()}
                              {returnedQty > 0 && (
                                <span className="text-xs text-red-600 block">
                                  (${(item.cantidad * item.precio_unitario).toLocaleString()} - ${(returnedQty * item.precio_unitario).toLocaleString()})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-200 pt-4">
              <div className="space-y-2">
                {/* Subtotal original */}
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>${(sale.subtotal_antes_descuento || subtotalProductos).toLocaleString()}</span>
                </div>

                {/* Descuento si aplica */}
                {sale.descuento_total && sale.descuento_total > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-green-600">
                      <div className="flex items-center">
                        <span>Descuento aplicado</span>
                        {sale.descuento_porcentaje_total && sale.descuento_porcentaje_total > 0 && (
                          <span className="ml-1 text-xs">({sale.descuento_porcentaje_total}%)</span>
                        )}
                      </div>
                      <span>-${sale.descuento_total.toLocaleString()}</span>
                    </div>
                    {sale.razon_descuento && (
                      <div className="text-xs text-gray-500 italic pl-4">
                        Razón: {sale.razon_descuento}
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal con descuento</span>
                      <span>${((sale.subtotal_antes_descuento || subtotalProductos) - (sale.descuento_total || 0)).toLocaleString()}</span>
                    </div>
                  </>
                )}

                {/* Domicilio si aplica */}
                {sale.es_domicilio && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <div className="flex items-center">
                      <Truck className="h-4 w-4 mr-1" />
                      <span>Domicilio</span>
                    </div>
                    <span>${sale.costo_domicilio.toLocaleString()}</span>
                  </div>
                )}

                {/* Devolución si aplica */}
                {returnInfo && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Devolución {returnInfo.tipo_devolucion}</span>
                    <span>-${returnInfo.monto_devolucion.toLocaleString()}</span>
                  </div>
                )}

                {/* Total final */}
                <div className="flex justify-between text-base font-medium text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>${effectiveTotal.toLocaleString()}</span>
                </div>

                {/* Saldo pendiente para créditos */}
                {sale.metodo_pago === 'credito' && sale.saldo_pendiente !== undefined && sale.saldo_pendiente !== null && (
                  <div className="flex justify-between text-sm font-medium text-orange-600">
                    <span>Saldo pendiente</span>
                    <span>${sale.saldo_pendiente.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment History for Credit Sales */}
            {sale.metodo_pago === 'credito' && partialPayments.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <DollarSign className="h-4 w-4 mr-1 text-green-600" />
                  Historial de Pagos ({partialPayments.length})
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <div className="grid grid-cols-3 gap-4 text-xs font-medium text-gray-500 uppercase">
                      <div>Fecha</div>
                      <div className="text-right">Monto</div>
                      <div className="text-right">Método</div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200 max-h-40 overflow-y-auto">
                    {partialPayments.map((payment) => (
                      <div key={payment.id} className="px-4 py-2">
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <div className="text-xs text-gray-500">{formatDisplayDate(payment.fecha_pago)}</div>
                          <div className="text-right text-sm font-medium text-green-600">${payment.monto.toLocaleString()}</div>
                          <div className="text-right text-xs text-gray-500 capitalize">{payment.metodo_pago}</div>
                        </div>
                        {payment.notas && (
                          <p className="text-xs text-gray-400 mt-1 italic">{payment.notas}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="bg-green-50 px-4 py-2 border-t border-gray-200">
                    <div className="flex justify-between text-sm font-medium text-green-700">
                      <span>Total pagado:</span>
                      <span>${totalPagado.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3">
              <button
                type="button"
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:w-auto"
                onClick={handleDownloadPDF}
              >
                Descargar Ticket
              </button>
              <button
                type="button"
                className="w-full inline-flex justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:w-auto"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalePreviewModal;