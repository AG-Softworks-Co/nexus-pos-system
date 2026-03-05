/*
  # Fix historial_ventas venta_id null constraint
  
  1. Changes
    - Allow venta_id to be NULL in historial_ventas table
    - This fixes the conflict between ON DELETE SET NULL and NOT NULL constraint
    - Update RLS policies to handle NULL venta_id cases
*/

-- Allow venta_id to be NULL in historial_ventas
ALTER TABLE historial_ventas 
ALTER COLUMN venta_id DROP NOT NULL;

-- Update the RLS policy for historial_ventas to handle NULL venta_id
DROP POLICY IF EXISTS "Users can view sales history from their business" ON historial_ventas;
CREATE POLICY "Users can view sales history from their business"
  ON historial_ventas FOR SELECT
  USING (
    venta_id IS NULL OR 
    venta_id IN (
      SELECT id FROM ventas WHERE negocio_id IN (
        SELECT negocio_id FROM usuarios WHERE id = auth.uid()
      )
    )
  );

-- Update the insert policy for historial_ventas
DROP POLICY IF EXISTS "System can create sales history" ON historial_ventas;
CREATE POLICY "System can create sales history"
  ON historial_ventas FOR INSERT
  WITH CHECK (
    venta_id IS NULL OR 
    venta_id IN (
      SELECT id FROM ventas WHERE negocio_id IN (
        SELECT negocio_id FROM usuarios WHERE id = auth.uid()
      )
    )
  );

-- Create a function to handle sale deletion and create history record before deletion
CREATE OR REPLACE FUNCTION record_sale_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Record the deletion in history before the sale is actually deleted
  INSERT INTO historial_ventas(
    venta_id, 
    usuario_id, 
    accion, 
    datos_anteriores,
    razon
  ) VALUES (
    OLD.id,
    auth.uid(),
    'cancelada',
    to_jsonb(OLD),
    'Venta eliminada por administrador'
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to record deletion before it happens
DROP TRIGGER IF EXISTS record_sale_deletion_trigger ON ventas;
CREATE TRIGGER record_sale_deletion_trigger
  BEFORE DELETE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION record_sale_deletion();