export interface CashClosing {
  id: string;
  negocio_id: string;
  usuario_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  monto_apertura: number;
  efectivo_contado: number | null;
  total_ventas: number;
  total_efectivo: number;
  total_otros_medios: number;
  total_ingresos: number;
  total_egresos: number;
  diferencia: number | null;
  estado: 'abierta' | 'cerrada';
  notas: string | null;
  numero_ordenes: number;
  usuario?: {
    nombre_completo: string;
  };
  user_name?: string;
}

export interface CashMovement {
  id: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  creado_en: string;
}

export interface PaymentDetail {
  metodo_pago: string;
  monto: number;
}
