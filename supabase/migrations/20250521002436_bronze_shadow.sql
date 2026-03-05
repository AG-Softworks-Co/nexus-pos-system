/*
  # Refine Supplies Management System

  1. Changes
    - Add weighted average cost tracking
    - Add unit conversion support
    - Improve stock management
    - Add supply consumption tracking
*/

-- Add weighted average cost to insumos
ALTER TABLE insumos
ADD COLUMN costo_promedio_ponderado NUMERIC(10,2);

-- Create units conversion table
CREATE TABLE IF NOT EXISTS unidades_conversion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_origen TEXT NOT NULL,
  unidad_destino TEXT NOT NULL,
  factor_conversion NUMERIC(10,4) NOT NULL,
  UNIQUE(unidad_origen, unidad_destino)
);

-- Create supply consumption log
CREATE TABLE IF NOT EXISTS consumo_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id UUID REFERENCES insumos(id) ON DELETE SET NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  unidad_medida TEXT NOT NULL,
  tipo_consumo TEXT NOT NULL CHECK (tipo_consumo IN ('venta', 'merma', 'ajuste')),
  venta_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE unidades_conversion ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumo_insumos ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view unit conversions"
  ON unidades_conversion FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage unit conversions"
  ON unidades_conversion FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('propietario', 'administrador')
    )
  );

CREATE POLICY "Users can view consumption logs from their business"
  ON consumo_insumos FOR SELECT
  USING (insumo_id IN (
    SELECT id FROM insumos WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can create consumption logs"
  ON consumo_insumos FOR INSERT
  WITH CHECK (insumo_id IN (
    SELECT id FROM insumos WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

-- Update stock update function to include weighted average cost
CREATE OR REPLACE FUNCTION update_supply_stock_on_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_old_stock NUMERIC;
  v_old_cost NUMERIC;
BEGIN
  -- Get current stock and cost
  SELECT stock_actual, COALESCE(costo_promedio_ponderado, NEW.precio_unitario)
  INTO v_old_stock, v_old_cost
  FROM insumos
  WHERE id = NEW.insumo_id;

  -- Update stock and costs
  UPDATE insumos
  SET 
    stock_actual = CASE 
      WHEN requiere_stock THEN v_old_stock + NEW.cantidad
      ELSE v_old_stock
    END,
    precio_ultima_compra = NEW.precio_unitario,
    costo_promedio_ponderado = CASE
      WHEN (v_old_stock + NEW.cantidad) = 0 THEN NEW.precio_unitario
      ELSE ((v_old_stock * v_old_cost) + (NEW.cantidad * NEW.precio_unitario)) / (v_old_stock + NEW.cantidad)
    END
  WHERE id = NEW.insumo_id
  AND requiere_stock = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update stock on consumption
CREATE OR REPLACE FUNCTION update_supply_stock_on_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stock for supplies that require tracking
  UPDATE insumos
  SET stock_actual = stock_actual - NEW.cantidad
  WHERE id = NEW.insumo_id
  AND requiere_stock = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for consumption updates
CREATE TRIGGER update_supply_stock_on_consumption_trigger
  AFTER INSERT ON consumo_insumos
  FOR EACH ROW
  EXECUTE FUNCTION update_supply_stock_on_consumption();

-- Create function to handle product sale and ingredient consumption
CREATE OR REPLACE FUNCTION process_sale_ingredients()
RETURNS TRIGGER AS $$
DECLARE
  v_formulacion_id UUID;
  v_ingredient RECORD;
BEGIN
  -- Get active formulation for the product
  SELECT id INTO v_formulacion_id
  FROM formulaciones
  WHERE producto_id = NEW.producto_id
  AND activa = true
  LIMIT 1;

  -- If product has an active formulation, process ingredients
  IF v_formulacion_id IS NOT NULL THEN
    FOR v_ingredient IN (
      SELECT 
        df.insumo_id,
        df.cantidad * NEW.cantidad as total_cantidad,
        df.unidad_medida
      FROM detalle_formulaciones df
      WHERE df.formulacion_id = v_formulacion_id
      AND df.es_opcional = false
    ) LOOP
      -- Insert consumption record
      INSERT INTO consumo_insumos (
        insumo_id,
        cantidad,
        unidad_medida,
        tipo_consumo,
        venta_id,
        usuario_id
      ) VALUES (
        v_ingredient.insumo_id,
        v_ingredient.total_cantidad,
        v_ingredient.unidad_medida,
        'venta',
        NEW.venta_id,
        (SELECT usuario_id FROM ventas WHERE id = NEW.venta_id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic ingredient consumption on sales
CREATE TRIGGER process_sale_ingredients_trigger
  AFTER INSERT ON detalle_ventas
  FOR EACH ROW
  EXECUTE FUNCTION process_sale_ingredients();