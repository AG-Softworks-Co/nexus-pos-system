export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      negocios: {
        Row: {
          id: string
          nombre: string
          logo_url: string | null
          moneda: string
          zona_horaria: string
          creado_en: string
        }
        Insert: {
          id?: string
          nombre: string
          logo_url?: string | null
          moneda?: string
          zona_horaria?: string
          creado_en?: string
        }
        Update: {
          id?: string
          nombre?: string
          logo_url?: string | null
          moneda?: string
          zona_horaria?: string
          creado_en?: string
        }
      }
      usuarios: {
        Row: {
          id: string
          nombre_completo: string
          correo: string
          rol: 'propietario' | 'administrador' | 'cajero'
          negocio_id: string
          creado_en: string
        }
        Insert: {
          id: string
          nombre_completo: string
          correo: string
          rol?: 'propietario' | 'administrador' | 'cajero'
          negocio_id: string
          creado_en?: string
        }
        Update: {
          id?: string
          nombre_completo?: string
          correo?: string
          rol?: 'propietario' | 'administrador' | 'cajero'
          negocio_id?: string
          creado_en?: string
        }
      }
      categorias: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          negocio_id: string
          creado_en: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          negocio_id: string
          creado_en?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          negocio_id?: string
          creado_en?: string
        }
      }
      productos: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          precio_costo: number
          precio_venta: number
          url_imagen: string | null
          categoria_id: string | null
          negocio_id: string
          creado_en: string
          sku: string | null
          stock_actual: number
          stock_minimo: number
          requiere_stock: boolean
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          precio_costo: number
          precio_venta: number
          url_imagen?: string | null
          categoria_id?: string | null
          negocio_id: string
          creado_en?: string
          sku?: string | null
          stock_actual?: number
          stock_minimo?: number
          requiere_stock?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          precio_costo?: number
          precio_venta?: number
          url_imagen?: string | null
          categoria_id?: string | null
          negocio_id?: string
          creado_en?: string
          sku?: string | null
          stock_actual?: number
          stock_minimo?: number
          requiere_stock?: boolean
        }
      }
      ventas: {
        Row: {
          id: string
          usuario_id: string | null
          negocio_id: string
          total: number
          metodo_pago: string
          estado: 'pagada' | 'pendiente' | 'cancelada'
          notas: string | null
          creada_en: string
          es_domicilio: boolean
          cliente_id: string | null
          direccion_entrega_id: string | null
          costo_domicilio: number
        }
        Insert: {
          id?: string
          usuario_id?: string | null
          negocio_id: string
          total: number
          metodo_pago?: string
          estado?: 'pagada' | 'pendiente' | 'cancelada'
          notas?: string | null
          creada_en?: string
          es_domicilio?: boolean
          cliente_id?: string | null
          direccion_entrega_id?: string | null
          costo_domicilio?: number
        }
        Update: {
          id?: string
          usuario_id?: string | null
          negocio_id?: string
          total?: number
          metodo_pago?: string
          estado?: 'pagada' | 'pendiente' | 'cancelada'
          notas?: string | null
          creada_en?: string
          es_domicilio?: boolean
          cliente_id?: string | null
          direccion_entrega_id?: string | null
          costo_domicilio?: number
        }
      }
      detalle_ventas: {
        Row: {
          id: string
          venta_id: string
          producto_id: string | null
          cantidad: number
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          id?: string
          venta_id: string
          producto_id?: string | null
          cantidad: number
          precio_unitario: number
        }
        Update: {
          id?: string
          venta_id?: string
          producto_id?: string | null
          cantidad?: number
          precio_unitario?: number
        }
      }
      clientes: {
        Row: {
          id: string
          nombre_completo: string
          telefono: string | null
          correo: string | null
          direccion: string | null
          negocio_id: string
          creado_en: string
        }
        Insert: {
          id?: string
          nombre_completo: string
          telefono?: string | null
          correo?: string | null
          direccion?: string | null
          negocio_id: string
          creado_en?: string
        }
        Update: {
          id?: string
          nombre_completo?: string
          telefono?: string | null
          correo?: string | null
          direccion?: string | null
          negocio_id?: string
          creado_en?: string
        }
      }
      direcciones_entrega: {
        Row: {
          id: string
          cliente_id: string
          direccion: string
          referencias: string | null
          creado_en: string
        }
        Insert: {
          id?: string
          cliente_id: string
          direccion: string
          referencias?: string | null
          creado_en?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          direccion?: string
          referencias?: string | null
          creado_en?: string
        }
      }
      notificaciones: {
        Row: {
          id: string
          usuario_id: string
          titulo: string
          mensaje: string
          leido: boolean
          creado_en: string
        }
        Insert: {
          id?: string
          usuario_id: string
          titulo: string
          mensaje: string
          leido?: boolean
          creado_en?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          titulo?: string
          mensaje?: string
          leido?: boolean
          creado_en?: string
        }
      }
      stock_alertas: {
        Row: {
          id: string
          producto_id: string
          negocio_id: string
          tipo: 'bajo_stock' | 'sin_stock'
          mensaje: string
          leido: boolean
          creado_en: string
        }
        Insert: {
          id?: string
          producto_id: string
          negocio_id: string
          tipo: 'bajo_stock' | 'sin_stock'
          mensaje: string
          leido?: boolean
          creado_en?: string
        }
        Update: {
          id?: string
          producto_id?: string
          negocio_id?: string
          tipo?: 'bajo_stock' | 'sin_stock'
          mensaje?: string
          leido?: boolean
          creado_en?: string
        }
      }
    }
  }
}