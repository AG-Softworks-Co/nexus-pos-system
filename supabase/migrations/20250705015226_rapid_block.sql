/*
  # Add Returns System
  
  1. New Tables
    - `devoluciones` - Returns/refunds tracking
    - `detalle_devoluciones` - Return details
    
  2. Changes
    - Add return/refund functionality
    - Add stock restoration on return approval
    - Add sale adjustment on return approval
    - Add audit trail for returns
*/

-- Create returns/refunds table if it doesn't exist
CREATE TABLE IF NOT EXISTS devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo_devolucion TEXT NOT NULL CHECK (tipo_devolucion IN ('total', 'parcial')),
  monto_devolucion NUMERIC(10,2) NOT NULL CHECK (monto_devolucion > 0),
  razon TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  aprobada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_aprobacion TIMESTAMPTZ,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create return details table if it doesn't exist
CREATE TABLE IF NOT EXISTS detalle_devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id UUID REFERENCES devoluciones(id) ON DELETE CASCADE,
  detalle_venta_id UUID REFERENCES detalle_ventas(id) ON DELETE CASCADE,
  cantidad_devuelta INTEGER NOT NULL CHECK (cantidad_devuelta > 0),
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal_devolucion NUMERIC(10,2) GENERATED ALWAYS AS (cantidad_devuelta * precio_unitario) STORED
);

-- Enable RLS on new tables
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_devoluciones ENABLE ROW LEVEL SECURITY;

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

-- Function to handle returns and restore stock
CREATE OR REPLACE FUNCTION process_return()
RETURNS TRIGGER AS $$
DECLARE
  v_detalle RECORD;
  v_venta_id UUID;
  v_tipo_devolucion TEXT;
  v_monto_devolucion NUMERIC;
  v_negocio_id UUID;
BEGIN
  -- Only process approved returns
  IF NEW.estado = 'aprobada' AND (OLD.estado IS NULL OR OLD.estado != 'aprobada') THEN
    v_venta_id := NEW.venta_id;
    v_tipo_devolucion := NEW.tipo_devolucion;
    v_monto_devolucion := NEW.monto_devolucion;
    
    -- Get negocio_id for history record
    SELECT negocio_id INTO v_negocio_id FROM ventas WHERE id = v_venta_id;
    
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
    IF v_tipo_devolucion = 'parcial' THEN
      UPDATE ventas
      SET 
        total = total - v_monto_devolucion,
        saldo_pendiente = GREATEST(0, saldo_pendiente - v_monto_devolucion)
      WHERE id = v_venta_id;
    ELSE
      -- Full return - cancel the sale
      UPDATE ventas
      SET 
        estado = 'cancelada',
        estado_pago = 'pagado',
        saldo_pendiente = 0
      WHERE id = v_venta_id;
    END IF;

    -- Create history record for return
    INSERT INTO historial_ventas (
      venta_id,
      usuario_id,
      accion,
      razon
    ) VALUES (
      v_venta_id,
      NEW.aprobada_por,
      'devolucion',
      'Devolución ' || v_tipo_devolucion || ' por: ' || NEW.razon
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for return processing
DROP TRIGGER IF EXISTS process_return_trigger ON devoluciones;
CREATE TRIGGER process_return_trigger
  AFTER UPDATE OF estado ON devoluciones
  FOR EACH ROW
  EXECUTE FUNCTION process_return();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_devoluciones_venta_id ON devoluciones(venta_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_negocio_id ON devoluciones(negocio_id);
CREATE INDEX IF NOT EXISTS idx_devoluciones_estado ON devoluciones(estado);
CREATE INDEX IF NOT EXISTS idx_detalle_devoluciones_devolucion_id ON detalle_devoluciones(devolucion_id);