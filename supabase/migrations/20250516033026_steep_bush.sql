/*
  # Fix subtotal calculation and add stock alerts
  
  1. Changes
    - Remove GENERATED ALWAYS AS for subtotal
    - Add trigger to calculate subtotal on insert
*/

-- Remove GENERATED ALWAYS AS constraint from subtotal
ALTER TABLE detalle_ventas 
ALTER COLUMN subtotal DROP GENERATED,
ALTER COLUMN subtotal SET DEFAULT 0;

-- Create trigger function for subtotal calculation
CREATE OR REPLACE FUNCTION calculate_subtotal()
RETURNS TRIGGER AS $$
BEGIN
  NEW.subtotal = NEW.cantidad * NEW.precio_unitario;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER calculate_subtotal_trigger
  BEFORE INSERT ON detalle_ventas
  FOR EACH ROW
  EXECUTE FUNCTION calculate_subtotal();