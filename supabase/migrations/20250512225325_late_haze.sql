/*
  # Add Stock Management Features
  
  1. Changes
    - Add SKU, stock quantity, and stock tracking fields to productos table
    - Create stock_alertas table for low inventory notifications
    - Add triggers for automatic stock alerts
*/

-- Add stock management columns to productos table
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stock_actual INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_minimo INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS requiere_stock BOOLEAN DEFAULT true;

-- Create stock alerts table
CREATE TABLE IF NOT EXISTS stock_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('bajo_stock', 'sin_stock')),
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT false,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on stock_alertas
ALTER TABLE stock_alertas ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for stock_alertas
CREATE POLICY "Users can view alerts from their business"
  ON stock_alertas FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

-- Function to create stock alerts
CREATE OR REPLACE FUNCTION check_stock_level()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check products that require stock tracking
  IF NEW.requiere_stock THEN
    -- Check if stock is below minimum
    IF NEW.stock_actual <= NEW.stock_minimo AND NEW.stock_actual > 0 THEN
      INSERT INTO stock_alertas (producto_id, negocio_id, tipo, mensaje)
      VALUES (
        NEW.id,
        NEW.negocio_id,
        'bajo_stock',
        'El producto ' || NEW.nombre || ' tiene stock bajo (' || NEW.stock_actual || ' unidades)'
      );
    -- Check if out of stock
    ELSIF NEW.stock_actual <= 0 THEN
      INSERT INTO stock_alertas (producto_id, negocio_id, tipo, mensaje)
      VALUES (
        NEW.id,
        NEW.negocio_id,
        'sin_stock',
        'El producto ' || NEW.nombre || ' se ha quedado sin stock'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock alerts
CREATE TRIGGER check_stock_level_trigger
  AFTER INSERT OR UPDATE OF stock_actual ON productos
  FOR EACH ROW
  EXECUTE FUNCTION check_stock_level();

-- Function to update stock on sale
CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stock for products that require tracking
  UPDATE productos
  SET stock_actual = stock_actual - NEW.cantidad
  WHERE id = NEW.producto_id
  AND requiere_stock = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic stock updates on sales
CREATE TRIGGER update_stock_on_sale_trigger
  AFTER INSERT ON detalle_ventas
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_sale();