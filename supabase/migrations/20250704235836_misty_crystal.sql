/*
  # Fix Payment Status for Non-Credit Sales
  
  1. Changes
    - Ensure all non-credit sales are marked as 'pagada' (paid)
    - Only credit sales should be 'pendiente' (pending)
    - Update set_credit_sale_properties function to fix this behavior
*/

-- Update the function that sets properties for new sales
CREATE OR REPLACE FUNCTION set_credit_sale_properties()
RETURNS TRIGGER AS $$
BEGIN
  -- Only credit sales should be pending and have saldo_pendiente
  IF NEW.metodo_pago = 'credito' THEN
    NEW.puede_editarse = true;
    NEW.saldo_pendiente = NEW.total;
    NEW.estado_pago = 'pendiente';
    NEW.estado = 'pendiente';
    
    -- Set credit due date if not provided (30 days from creation)
    IF NEW.fecha_vencimiento_credito IS NULL THEN
      NEW.fecha_vencimiento_credito = NEW.creada_en + INTERVAL '30 days';
    END IF;
  ELSE
    -- All other payment methods should be marked as paid
    NEW.puede_editarse = false;
    NEW.saldo_pendiente = 0;
    NEW.estado_pago = 'pagado';
    NEW.estado = 'pagada';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix existing sales to ensure correct payment status
UPDATE ventas
SET 
  estado = 'pagada',
  estado_pago = 'pagado',
  saldo_pendiente = 0
WHERE 
  metodo_pago != 'credito' AND 
  (estado != 'pagada' OR estado_pago != 'pagado' OR saldo_pendiente > 0);