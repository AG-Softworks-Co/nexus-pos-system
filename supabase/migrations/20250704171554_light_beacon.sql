/*
  # Fix Credit Sales Management System
  
  1. New Tables
    - `pagos_parciales` - Partial payments tracking
    - `devoluciones` - Returns/refunds tracking
    - `detalle_devoluciones` - Return details
    - `historial_ventas` - Sales history tracking for auditing

  2. Changes
    - Add fields to ventas table for credit management
    - Add return/refund functionality
    - Add sale editing capabilities for admins
    - Add client credit tracking enhancements
    - Fix saldo_pendiente column issue

  3. Security
    - Only admins can edit/delete sales
    - Only credit sales can be modified
    - Proper audit trail for all changes
*/

-- Add return/refund status enum
DO $$ BEGIN
  CREATE TYPE estado_devolucion AS ENUM ('pendiente', 'aprobada', 'rechazada', 'completada');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add payment status enum
DO $$ BEGIN
  CREATE TYPE estado_pago AS ENUM ('pendiente', 'parcial', 'pagado', 'vencido');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add fields to ventas table for better credit management
ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS puede_editarse BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS editada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fecha_ultima_edicion TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS razon_edicion TEXT,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS estado_pago estado_pago DEFAULT 'pagado',
ADD COLUMN IF NOT EXISTS fecha_vencimiento_credito TIMESTAMPTZ;

-- Only add saldo_pendiente if it doesn't exist
DO $$ BEGIN
  ALTER TABLE ventas ADD COLUMN saldo_pendiente NUMERIC(10,2) DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Create partial payments table
CREATE TABLE IF NOT EXISTS pagos_parciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  metodo_pago TEXT NOT NULL,
  fecha_pago TIMESTAMPTZ DEFAULT now(),
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create returns/refunds table
CREATE TABLE IF NOT EXISTS devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo_devolucion TEXT NOT NULL CHECK (tipo_devolucion IN ('total', 'parcial')),
  monto_devolucion NUMERIC(10,2) NOT NULL CHECK (monto_devolucion > 0),
  razon TEXT NOT NULL,
  estado estado_devolucion DEFAULT 'pendiente',
  aprobada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_aprobacion TIMESTAMPTZ,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create return details table
CREATE TABLE IF NOT EXISTS detalle_devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id UUID REFERENCES devoluciones(id) ON DELETE CASCADE,
  detalle_venta_id UUID REFERENCES detalle_ventas(id) ON DELETE CASCADE,
  cantidad_devuelta INTEGER NOT NULL CHECK (cantidad_devuelta > 0),
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal_devolucion NUMERIC(10,2) GENERATED ALWAYS AS (cantidad_devuelta * precio_unitario) STORED
);

-- Create sales history table for audit trail
CREATE TABLE IF NOT EXISTS historial_ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  accion TEXT NOT NULL CHECK (accion IN ('creada', 'editada', 'cancelada', 'devolucion')),
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  razon TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE pagos_parciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_ventas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pagos_parciales
CREATE POLICY "Users can view partial payments from their business"
  ON pagos_parciales FOR SELECT
  USING (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can create partial payments"
  ON pagos_parciales FOR INSERT
  WITH CHECK (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

-- RLS Policies for devoluciones
CREATE POLICY "Users can view returns from their business"
  ON devoluciones FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create returns"
  ON devoluciones FOR INSERT
  WITH CHECK (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage returns"
  ON devoluciones FOR UPDATE
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

-- RLS Policies for detalle_devoluciones
CREATE POLICY "Users can view return details from their business"
  ON detalle_devoluciones FOR SELECT
  USING (devolucion_id IN (
    SELECT id FROM devoluciones WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage return details"
  ON detalle_devoluciones FOR ALL
  USING (devolucion_id IN (
    SELECT id FROM devoluciones WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

-- RLS Policies for historial_ventas
CREATE POLICY "Users can view sales history from their business"
  ON historial_ventas FOR SELECT
  USING (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "System can create sales history"
  ON historial_ventas FOR INSERT
  WITH CHECK (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

-- Function to set credit sales as editable and manage payment status
CREATE OR REPLACE FUNCTION set_credit_sale_properties()
RETURNS TRIGGER AS $$
BEGIN
  -- Only credit sales can be edited
  IF NEW.metodo_pago = 'credito' THEN
    NEW.puede_editarse = true;
    NEW.saldo_pendiente = NEW.total;
    NEW.estado_pago = 'pendiente';
    
    -- Set credit due date if not provided (30 days from creation)
    IF NEW.fecha_vencimiento_credito IS NULL THEN
      NEW.fecha_vencimiento_credito = NEW.creada_en + INTERVAL '30 days';
    END IF;
  ELSE
    NEW.puede_editarse = false;
    NEW.saldo_pendiente = 0;
    NEW.estado_pago = 'pagado';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update payment status based on partial payments
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_pagado NUMERIC(10,2);
  v_total_venta NUMERIC(10,2);
  v_nuevo_estado estado_pago;
  v_nuevo_saldo NUMERIC(10,2);
BEGIN
  -- Get sale total
  SELECT total INTO v_total_venta
  FROM ventas
  WHERE id = NEW.venta_id;

  -- Calculate total paid
  SELECT COALESCE(SUM(monto), 0)
  INTO v_total_pagado
  FROM pagos_parciales
  WHERE venta_id = NEW.venta_id;

  -- Determine new status and balance
  v_nuevo_saldo = v_total_venta - v_total_pagado;
  
  IF v_nuevo_saldo <= 0 THEN
    v_nuevo_estado = 'pagado';
    v_nuevo_saldo = 0;
  ELSIF v_total_pagado > 0 THEN
    v_nuevo_estado = 'parcial';
  ELSE
    v_nuevo_estado = 'pendiente';
  END IF;

  -- Update sale
  UPDATE ventas
  SET 
    estado_pago = v_nuevo_estado,
    saldo_pendiente = v_nuevo_saldo
  WHERE id = NEW.venta_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create sales history record
CREATE OR REPLACE FUNCTION create_sales_history()
RETURNS TRIGGER AS $$
DECLARE
  v_accion TEXT;
  v_datos_anteriores JSONB;
  v_datos_nuevos JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_accion = 'creada';
    v_datos_anteriores = NULL;
    v_datos_nuevos = to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_accion = 'editada';
    v_datos_anteriores = to_jsonb(OLD);
    v_datos_nuevos = to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_accion = 'cancelada';
    v_datos_anteriores = to_jsonb(OLD);
    v_datos_nuevos = NULL;
  END IF;

  -- Insert history record
  INSERT INTO historial_ventas (
    venta_id,
    usuario_id,
    accion,
    datos_anteriores,
    datos_nuevos,
    razon
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.editada_por, NEW.usuario_id, OLD.usuario_id),
    v_accion,
    v_datos_anteriores,
    v_datos_nuevos,
    COALESCE(NEW.razon_edicion, NULL)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to handle returns and restore stock
CREATE OR REPLACE FUNCTION process_return()
RETURNS TRIGGER AS $$
DECLARE
  v_detalle RECORD;
BEGIN
  -- Only process approved returns
  IF NEW.estado = 'aprobada' AND (OLD.estado IS NULL OR OLD.estado != 'aprobada') THEN
    
    -- Restore stock for returned items
    FOR v_detalle IN (
      SELECT 
        dd.cantidad_devuelta,
        dv.producto_id
      FROM detalle_devoluciones dd
      JOIN detalle_ventas dv ON dd.detalle_venta_id = dv.id
      WHERE dd.devolucion_id = NEW.id
    ) LOOP
      -- Restore product stock
      UPDATE productos
      SET stock_actual = stock_actual + v_detalle.cantidad_devuelta
      WHERE id = v_detalle.producto_id
      AND requiere_stock = true;
    END LOOP;

    -- Update sale total if partial return
    IF NEW.tipo_devolucion = 'parcial' THEN
      UPDATE ventas
      SET 
        total = total - NEW.monto_devolucion,
        saldo_pendiente = GREATEST(0, saldo_pendiente - NEW.monto_devolucion)
      WHERE id = NEW.venta_id;
    ELSE
      -- Full return - cancel the sale
      UPDATE ventas
      SET 
        estado = 'cancelada',
        saldo_pendiente = 0
      WHERE id = NEW.venta_id;
    END IF;

    -- Create history record for return
    INSERT INTO historial_ventas (
      venta_id,
      usuario_id,
      accion,
      razon
    ) VALUES (
      NEW.venta_id,
      NEW.aprobada_por,
      'devolucion',
      'Devolución ' || NEW.tipo_devolucion || ' por: ' || NEW.razon
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update sale edit tracking
CREATE OR REPLACE FUNCTION track_sale_edit()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track edits, not initial creation
  IF TG_OP = 'UPDATE' THEN
    NEW.fecha_ultima_edicion = now();
    NEW.version = OLD.version + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS set_credit_sale_editable_trigger ON ventas;
DROP TRIGGER IF EXISTS set_credit_sale_properties_trigger ON ventas;
DROP TRIGGER IF EXISTS update_payment_status_trigger ON pagos_parciales;
DROP TRIGGER IF EXISTS create_sales_history_trigger ON ventas;
DROP TRIGGER IF EXISTS process_return_trigger ON devoluciones;
DROP TRIGGER IF EXISTS track_sale_edit_trigger ON ventas;

-- Create triggers
CREATE TRIGGER set_credit_sale_properties_trigger
  BEFORE INSERT ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION set_credit_sale_properties();

CREATE TRIGGER update_payment_status_trigger
  AFTER INSERT ON pagos_parciales
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_status();

CREATE TRIGGER create_sales_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION create_sales_history();

CREATE TRIGGER process_return_trigger
  AFTER UPDATE ON devoluciones
  FOR EACH ROW
  EXECUTE FUNCTION process_return();

CREATE TRIGGER track_sale_edit_trigger
  BEFORE UPDATE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION track_sale_edit();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ventas_puede_editarse ON ventas(puede_editarse);
CREATE INDEX IF NOT EXISTS idx_ventas_metodo_pago ON ventas(metodo_pago);
CREATE INDEX IF NOT EXISTS idx_ventas_estado_pago ON ventas(estado_pago);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha_vencimiento ON ventas(fecha_vencimiento_credito);
CREATE INDEX IF NOT EXISTS idx_pagos_parciales_venta ON pagos_parciales(venta_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_venta ON devoluciones(venta_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_estado ON devoluciones(estado);
CREATE INDEX IF NOT EXISTS idx_historial_ventas_venta ON historial_ventas(venta_id);
CREATE INDEX IF NOT EXISTS idx_historial_ventas_accion ON historial_ventas(accion);

-- Update existing RLS policies for ventas to allow admin edits
CREATE POLICY "Admins can edit credit sales"
  ON ventas FOR UPDATE
  USING (
    puede_editarse = true AND
    negocio_id IN (
      SELECT negocio_id FROM usuarios 
      WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
    )
  );

CREATE POLICY "Admins can delete sales"
  ON ventas FOR DELETE
  USING (
    negocio_id IN (
      SELECT negocio_id FROM usuarios 
      WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
    )
  );