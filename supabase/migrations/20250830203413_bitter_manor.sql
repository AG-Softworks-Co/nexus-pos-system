/*
  # Fix missing cantidad_devuelta column and discount display
  
  1. Changes
    - Add cantidad_devuelta column to detalle_ventas if it doesn't exist
    - Fix Sales.tsx to properly fetch discount information
    - Update SalePreviewModal to show discount details correctly
    - Ensure PDF generation includes discount information
*/

-- Add cantidad_devuelta column to detalle_ventas if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'detalle_ventas' AND column_name = 'cantidad_devuelta'
  ) THEN
    ALTER TABLE detalle_ventas ADD COLUMN cantidad_devuelta INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_detalle_ventas_cantidad_devuelta ON detalle_ventas(cantidad_devuelta);

-- Update existing detalle_ventas records to set cantidad_devuelta from approved returns
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT 
      dd.detalle_venta_id,
      dd.cantidad_devuelta
    FROM devoluciones d
    JOIN detalle_devoluciones dd ON d.id = dd.devolucion_id
    WHERE d.estado = 'aprobada'
  ) LOOP
    UPDATE detalle_ventas
    SET cantidad_devuelta = COALESCE(cantidad_devuelta, 0) + r.cantidad_devuelta
    WHERE id = r.detalle_venta_id;
  END LOOP;
END $$;