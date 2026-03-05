/*
  # Fix Credit Sales Constraint
  
  1. Changes
    - Update existing credit sales to have a valid payment method if they don't have a client
    - Add constraint to ensure credit sales always have a client
*/

-- Fix existing credit sales without a client by changing their payment method to 'efectivo'
UPDATE ventas 
SET metodo_pago = 'efectivo'
WHERE metodo_pago = 'credito' AND cliente_id IS NULL;

-- Add constraint to ensure credit sales always have a client
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS chk_cliente_en_credito;
ALTER TABLE ventas ADD CONSTRAINT chk_cliente_en_credito
CHECK ( (metodo_pago <> 'credito') OR (metodo_pago = 'credito' AND cliente_id IS NOT NULL) );

-- Add negocio_id to pagos_parciales if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pagos_parciales' AND column_name = 'negocio_id'
  ) THEN
    ALTER TABLE pagos_parciales ADD COLUMN negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE;
    
    -- Update existing records to set negocio_id from related ventas
    UPDATE pagos_parciales pp
    SET negocio_id = v.negocio_id
    FROM ventas v
    WHERE pp.venta_id = v.id;
    
    -- Make negocio_id NOT NULL
    ALTER TABLE pagos_parciales ALTER COLUMN negocio_id SET NOT NULL;
  END IF;
END $$;

-- Update RLS policies for pagos_parciales
DROP POLICY IF EXISTS "Users can view partial payments from their business" ON pagos_parciales;
DROP POLICY IF EXISTS "Users can create partial payments" ON pagos_parciales;
DROP POLICY IF EXISTS "Users can manage partial payments from their business" ON pagos_parciales;

CREATE POLICY "Users can view partial payments from their business"
  ON pagos_parciales FOR SELECT
  USING (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "Users can create partial payments"
  ON pagos_parciales FOR INSERT
  WITH CHECK (negocio_id IN (SELECT negocio_id FROM usuarios WHERE id = auth.uid()));

-- Fix update_payment_status function to include payment action in history
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

-- Recreate trigger
DROP TRIGGER IF EXISTS update_payment_status_trigger ON pagos_parciales;
CREATE TRIGGER update_payment_status_trigger
  AFTER INSERT ON pagos_parciales
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_status();