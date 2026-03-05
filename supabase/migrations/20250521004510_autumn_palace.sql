/*
  # Fix stock alerts functionality
  
  1. Changes
    - Update stock_alertas table to use insumo_id instead of producto_id
    - Fix check_supply_stock_level function
    - Add missing RLS policies
*/

-- Modify stock_alertas table to use insumo_id
ALTER TABLE stock_alertas
DROP COLUMN IF EXISTS producto_id CASCADE;

ALTER TABLE stock_alertas
ADD COLUMN IF NOT EXISTS insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE;

-- Update check_supply_stock_level function
CREATE OR REPLACE FUNCTION check_supply_stock_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requiere_stock AND NEW.stock_actual <= NEW.stock_minimo THEN
    INSERT INTO stock_alertas (
      insumo_id,
      negocio_id,
      tipo,
      mensaje,
      leido
    ) VALUES (
      NEW.id,
      NEW.negocio_id,
      CASE 
        WHEN NEW.stock_actual <= 0 THEN 'sin_stock'
        ELSE 'bajo_stock'
      END,
      CASE 
        WHEN NEW.stock_actual <= 0 THEN 'El insumo ' || NEW.nombre || ' se ha quedado sin stock'
        ELSE 'El insumo ' || NEW.nombre || ' tiene stock bajo (' || NEW.stock_actual || ' ' || NEW.unidad_medida || ')'
      END,
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for stock_alertas
CREATE POLICY "Users can view alerts from their business"
  ON stock_alertas FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update alerts"
  ON stock_alertas FOR UPDATE
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));