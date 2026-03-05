export interface Sale {
  id: string;
  creada_en: string;
  usuario: {
    nombre_completo: string;
  };
  usuario_id?: string;
  total: number;
  metodo_pago: string;
  estado: 'pagada' | 'pendiente' | 'cancelada';
  estado_pago?: 'pendiente' | 'parcial' | 'pagado' | 'vencido';
  puede_editarse?: boolean;
  saldo_pendiente?: number;
  descuento_total?: number;
  descuento_porcentaje_total?: number;
  subtotal_antes_descuento?: number;
  usuario_descuento_id?: string;
  razon_descuento?: string;
  fecha_descuento?: string;
  es_domicilio: boolean;
  costo_domicilio: number;
  notas?: string | null;
  fecha_vencimiento_credito?: string;
  negocio_id?: string;
  _isDeleted?: boolean;
  _hasReturns?: boolean;
  _returnAmount?: number;
  version?: number;
  cliente?: {
    nombre_completo: string;
    telefono: string;
    correo: string;
  };
  direccion_entrega?: {
    direccion: string;
    referencias: string;
  };
  detalle_ventas: SaleDetail[];
}

export interface SaleDetail {
  id: string;
  cantidad: number;
  precio_unitario: number;
  cantidad_devuelta?: number;
  producto: {
    nombre: string;
    sku: string;
    id?: string;
  };
}

export interface SaleFilters {
  searchQuery: string;
  dateFilter: 'all' | 'today' | 'yesterday' | 'week' | 'month';
  statusFilter: 'all' | 'pagada' | 'pendiente' | 'cancelada';
  paymentFilter: 'all' | 'efectivo' | 'tarjeta';
  deliveryFilter: 'all' | 'delivery' | 'local';
  historyFilter: 'active' | 'all' | 'edited' | 'deleted';
}