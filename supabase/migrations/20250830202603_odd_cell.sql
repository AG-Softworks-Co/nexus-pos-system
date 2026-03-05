/*
  # Fix historial_ventas constraint error
  
  1. Changes
    - Fix the constraint that's causing the error with 'new row for relation historial_ventas'
    - Update the constraint to allow all necessary actions
    - Ensure the trigger can insert history records properly
*/

-- Drop the problematic constraint
ALTER TABLE historial_ventas DROP CONSTRAINT IF EXISTS historial_ventas_accion_check;

-- Recreate the constraint with all necessary actions
ALTER TABLE historial_ventas 
ADD CONSTRAINT historial_ventas_accion_check 
CHECK (accion IN ('creada', 'editada', 'cancelada', 'devolucion', 'pago', 'descuento'));

-- Ensure the create_sales_history function works properly
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
    COALESCE(NEW.editada_por, NEW.usuario_id, OLD.usuario_id, auth.uid()),
    v_accion,
    v_datos_anteriores,
    v_datos_nuevos,
    COALESCE(NEW.razon_edicion, NULL)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS create_sales_history_trigger ON ventas;
CREATE TRIGGER create_sales_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION create_sales_history();

-- Fix any existing sales that might have issues
UPDATE ventas 
SET total = (
  SELECT COALESCE(SUM(cantidad * precio_unitario), 0) + COALESCE(costo_domicilio, 0)
  FROM detalle_ventas 
  WHERE venta_id = ventas.id
)
WHERE total = 0 AND EXISTS (
  SELECT 1 FROM detalle_ventas WHERE venta_id = ventas.id
);