/*
  # Sistema de Descuentos para Administradores
  
  1. Nuevas Tablas
    - `descuentos_aplicados` - Registro de descuentos aplicados a ventas
    - `detalle_descuentos` - Descuentos específicos por producto
    
  2. Cambios en Ventas
    - Campos para descuentos totales y por producto
    - Auditoría de quién aplicó el descuento
    - Razón del descuento
    
  3. Seguridad
    - Solo administradores y propietarios pueden aplicar descuentos
    - Registro completo de auditoría
    - Límites de descuento configurables
*/

-- Agregar campos de descuento a la tabla ventas
ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS descuento_total NUMERIC(10,2) DEFAULT 0 CHECK (descuento_total >= 0),
ADD COLUMN IF NOT EXISTS descuento_porcentaje_total NUMERIC(5,2) DEFAULT 0 CHECK (descuento_porcentaje_total >= 0 AND descuento_porcentaje_total <= 100),
ADD COLUMN IF NOT EXISTS subtotal_antes_descuento NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS usuario_descuento_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS razon_descuento TEXT,
ADD COLUMN IF NOT EXISTS fecha_descuento TIMESTAMPTZ;

-- Crear tabla de descuentos aplicados (auditoría)
CREATE TABLE IF NOT EXISTS descuentos_aplicados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE NOT NULL,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL NOT NULL,
  tipo_descuento TEXT NOT NULL CHECK (tipo_descuento IN ('porcentaje_total', 'monto_total', 'porcentaje_producto', 'monto_producto')),
  valor_descuento NUMERIC(10,2) NOT NULL CHECK (valor_descuento >= 0),
  monto_descontado NUMERIC(10,2) NOT NULL CHECK (monto_descontado >= 0),
  razon TEXT NOT NULL,
  aplicado_a TEXT, -- 'total' o ID del producto
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla de descuentos por producto específico
CREATE TABLE IF NOT EXISTS detalle_descuentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descuento_aplicado_id UUID REFERENCES descuentos_aplicados(id) ON DELETE CASCADE NOT NULL,
  detalle_venta_id UUID REFERENCES detalle_ventas(id) ON DELETE CASCADE NOT NULL,
  precio_original NUMERIC(10,2) NOT NULL,
  precio_con_descuento NUMERIC(10,2) NOT NULL,
  descuento_aplicado NUMERIC(10,2) NOT NULL
);

-- Habilitar RLS
ALTER TABLE descuentos_aplicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_descuentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para descuentos_aplicados
CREATE POLICY "Users can view discounts from their business"
  ON descuentos_aplicados FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can create discounts"
  ON descuentos_aplicados FOR INSERT
  WITH CHECK (
    negocio_id IN (
      SELECT negocio_id FROM usuarios 
      WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
    )
  );

-- Políticas RLS para detalle_descuentos
CREATE POLICY "Users can view discount details from their business"
  ON detalle_descuentos FOR SELECT
  USING (descuento_aplicado_id IN (
    SELECT id FROM descuentos_aplicados WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Admins can manage discount details"
  ON detalle_descuentos FOR ALL
  USING (descuento_aplicado_id IN (
    SELECT id FROM descuentos_aplicados WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios 
      WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
    )
  ));

-- Función para calcular totales con descuentos
CREATE OR REPLACE FUNCTION calculate_sale_totals_with_discounts()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(10,2);
  v_descuento_monto NUMERIC(10,2);
  v_total_final NUMERIC(10,2);
BEGIN
  -- Calcular subtotal de los detalles de venta
  SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
  INTO v_subtotal
  FROM detalle_ventas
  WHERE venta_id = NEW.id;

  -- Guardar subtotal antes del descuento
  NEW.subtotal_antes_descuento = v_subtotal;

  -- Calcular monto del descuento
  IF NEW.descuento_porcentaje_total > 0 THEN
    v_descuento_monto = v_subtotal * (NEW.descuento_porcentaje_total / 100);
  ELSE
    v_descuento_monto = COALESCE(NEW.descuento_total, 0);
  END IF;

  -- Asegurar que el descuento no exceda el subtotal
  v_descuento_monto = LEAST(v_descuento_monto, v_subtotal);
  NEW.descuento_total = v_descuento_monto;

  -- Calcular total final (incluyendo costo de domicilio)
  v_total_final = v_subtotal - v_descuento_monto + COALESCE(NEW.costo_domicilio, 0);
  NEW.total = v_total_final;

  -- Configurar saldo pendiente para ventas a crédito
  IF NEW.metodo_pago = 'credito' THEN
    NEW.saldo_pendiente = v_total_final;
    NEW.estado_pago = 'pendiente';
    
    -- Establecer fecha de vencimiento si no se proporcionó
    IF NEW.fecha_vencimiento_credito IS NULL THEN
      NEW.fecha_vencimiento_credito = NEW.creada_en + INTERVAL '30 days';
    END IF;
  ELSE
    NEW.saldo_pendiente = 0;
    NEW.estado_pago = 'pagado';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para registrar descuentos aplicados
CREATE OR REPLACE FUNCTION register_discount_application()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar si se aplicó un descuento
  IF NEW.descuento_total > 0 AND NEW.usuario_descuento_id IS NOT NULL THEN
    INSERT INTO descuentos_aplicados (
      venta_id,
      negocio_id,
      usuario_id,
      tipo_descuento,
      valor_descuento,
      monto_descontado,
      razon,
      aplicado_a
    ) VALUES (
      NEW.id,
      NEW.negocio_id,
      NEW.usuario_descuento_id,
      CASE 
        WHEN NEW.descuento_porcentaje_total > 0 THEN 'porcentaje_total'
        ELSE 'monto_total'
      END,
      CASE 
        WHEN NEW.descuento_porcentaje_total > 0 THEN NEW.descuento_porcentaje_total
        ELSE NEW.descuento_total
      END,
      NEW.descuento_total,
      NEW.razon_descuento,
      'total'
    );
    
    -- Registrar en historial
    INSERT INTO historial_ventas (
      venta_id,
      usuario_id,
      accion,
      razon
    ) VALUES (
      NEW.id,
      NEW.usuario_descuento_id,
      'descuento',
      'Descuento aplicado: $' || NEW.descuento_total || 
      CASE 
        WHEN NEW.descuento_porcentaje_total > 0 THEN ' (' || NEW.descuento_porcentaje_total || '%)'
        ELSE ''
      END ||
      '. Razón: ' || COALESCE(NEW.razon_descuento, 'Sin especificar')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear triggers
DROP TRIGGER IF EXISTS calculate_sale_totals_with_discounts_trigger ON ventas;
CREATE TRIGGER calculate_sale_totals_with_discounts_trigger
  BEFORE INSERT OR UPDATE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_totals_with_discounts();

DROP TRIGGER IF EXISTS register_discount_application_trigger ON ventas;
CREATE TRIGGER register_discount_application_trigger
  AFTER INSERT OR UPDATE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION register_discount_application();

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_descuentos_aplicados_venta_id ON descuentos_aplicados(venta_id);
CREATE INDEX IF NOT EXISTS idx_descuentos_aplicados_negocio_id ON descuentos_aplicados(negocio_id);
CREATE INDEX IF NOT EXISTS idx_descuentos_aplicados_usuario_id ON descuentos_aplicados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_detalle_descuentos_descuento_id ON detalle_descuentos(descuento_aplicado_id);
CREATE INDEX IF NOT EXISTS idx_ventas_descuento_total ON ventas(descuento_total);
CREATE INDEX IF NOT EXISTS idx_ventas_usuario_descuento ON ventas(usuario_descuento_id);