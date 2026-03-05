/*
  # Desactivar trigger problemático que causa totales en $0
  
  1. Cambios
    - Desactivar trigger calculate_sale_totals_with_discounts_trigger
    - Permitir que el frontend calcule los totales correctamente
    - Mantener funcionalidad de descuentos sin interferir con totales normales
    - Arreglar ventas existentes con total $0
*/

-- Desactivar el trigger problemático que está causando totales en $0
DROP TRIGGER IF EXISTS calculate_sale_totals_with_discounts_trigger ON ventas;

-- Mantener solo el trigger de registro de descuentos (AFTER INSERT)
-- Este no interfiere con el cálculo de totales

-- Arreglar todas las ventas existentes que tienen total en $0
UPDATE ventas 
SET total = (
  SELECT COALESCE(SUM(dv.cantidad * dv.precio_unitario), 0) + COALESCE(ventas.costo_domicilio, 0)
  FROM detalle_ventas dv
  WHERE dv.venta_id = ventas.id
)
WHERE total = 0 
AND EXISTS (
  SELECT 1 FROM detalle_ventas WHERE venta_id = ventas.id
);

-- Función simplificada para manejar solo ventas a crédito (sin interferir con totales)
CREATE OR REPLACE FUNCTION handle_credit_sales_only()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo configurar campos de crédito, NO tocar el total
  IF NEW.metodo_pago = 'credito' THEN
    NEW.puede_editarse = true;
    NEW.saldo_pendiente = NEW.total; -- Usar el total que viene del frontend
    NEW.estado_pago = 'pendiente';
    
    -- Establecer fecha de vencimiento si no se proporcionó
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger que NO interfiere con el total
CREATE TRIGGER handle_credit_sales_only_trigger
  BEFORE INSERT ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION handle_credit_sales_only();