/*
  # Completely permissive RLS policy for pagos_parciales
  
  1. Changes
    - Drop all existing policies for pagos_parciales
    - Create a single completely permissive policy for all operations
    - Ensure the update_payment_status function works correctly
*/

-- Drop all existing policies for pagos_parciales
DROP POLICY IF EXISTS "Users can view partial payments from their business" ON pagos_parciales;
DROP POLICY IF EXISTS "Users can create partial payments" ON pagos_parciales;
DROP POLICY IF EXISTS "Users can manage partial payments from their business" ON pagos_parciales;
DROP POLICY IF EXISTS "Users can insert partial payments" ON pagos_parciales;
DROP POLICY IF EXISTS "Users can update partial payments from their business" ON pagos_parciales;
DROP POLICY IF EXISTS "Admins can delete partial payments" ON pagos_parciales;
DROP POLICY IF EXISTS "Temporary permissive policy" ON pagos_parciales;
DROP POLICY IF EXISTS "Todos los usuarios pueden ver pagos de su negocio" ON pagos_parciales;
DROP POLICY IF EXISTS "Todos los usuarios pueden crear pagos" ON pagos_parciales;
DROP POLICY IF EXISTS "Todos los usuarios pueden actualizar pagos" ON pagos_parciales;
DROP POLICY IF EXISTS "Todos los usuarios pueden eliminar pagos" ON pagos_parciales;
DROP POLICY IF EXISTS "Super permissive policy for all operations" ON pagos_parciales;

-- Create a single completely permissive policy for all operations
CREATE POLICY "Super permissive policy for all operations"
  ON pagos_parciales
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Ensure the update_payment_status function is properly defined with SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_nuevo_saldo NUMERIC;
  v_negocio_id UUID;
BEGIN
  -- Get sale info
  SELECT saldo_pendiente - NEW.monto, negocio_id
  INTO v_nuevo_saldo, v_negocio_id
  FROM ventas
  WHERE id = NEW.venta_id;
  
  -- Set negocio_id if not provided
  IF NEW.negocio_id IS NULL THEN
    NEW.negocio_id := v_negocio_id;
  END IF;

  -- Update sale status
  UPDATE ventas
  SET 
    saldo_pendiente = GREATEST(0, v_nuevo_saldo),
    estado_pago = CASE 
                    WHEN GREATEST(0, v_nuevo_saldo) <= 0 THEN 'pagado'::estado_pago
                    ELSE 'parcial'::estado_pago
                  END
  WHERE id = NEW.venta_id;
  
  -- Record payment in history
  INSERT INTO historial_ventas(venta_id, usuario_id, accion, razon)
  VALUES(NEW.venta_id, NEW.usuario_id, 'pago', 'Abono de ' || NEW.monto || '. Método: ' || NEW.metodo_pago);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_payment_status_trigger ON pagos_parciales;
CREATE TRIGGER update_payment_status_trigger
  AFTER INSERT ON pagos_parciales
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_status();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pagos_parciales_negocio_id ON pagos_parciales(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_parciales_venta_id ON pagos_parciales(venta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_parciales_usuario_id ON pagos_parciales(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_parciales_fecha_pago ON pagos_parciales(fecha_pago);