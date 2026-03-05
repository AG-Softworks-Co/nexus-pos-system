/*
  # Fix Returns Policy Error
  
  1. Changes
    - Drop existing policies for devoluciones table
    - Recreate policies with IF NOT EXISTS to prevent errors
    - Ensure proper RLS for returns management
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view returns from their business" ON devoluciones;
DROP POLICY IF EXISTS "Users can create returns" ON devoluciones;
DROP POLICY IF EXISTS "Admins can manage returns" ON devoluciones;

-- Recreate policies with IF NOT EXISTS
CREATE POLICY IF NOT EXISTS "Users can view returns from their business"
  ON devoluciones FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "Users can create returns"
  ON devoluciones FOR INSERT
  WITH CHECK (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY IF NOT EXISTS "Admins can manage returns"
  ON devoluciones FOR UPDATE
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

-- Ensure the process_return function is properly defined
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

-- Recreate trigger for return processing
DROP TRIGGER IF EXISTS process_return_trigger ON devoluciones;
CREATE TRIGGER process_return_trigger
  AFTER UPDATE OF estado ON devoluciones
  FOR EACH ROW
  EXECUTE FUNCTION process_return();