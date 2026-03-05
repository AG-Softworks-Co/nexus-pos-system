/*
  # Add Supply Management System
  
  1. New Tables
    - `insumos` - Supplies/ingredients master table
    - `compras_insumos` - Purchase records
    - `detalle_compras_insumos` - Purchase details
    - `consumo_insumos` - Consumption tracking
    - `formulaciones` - Product recipes
    - `detalle_formulaciones` - Recipe details
    - `unidades_conversion` - Unit conversion factors

  2. Changes
    - Add supply type categorization
    - Add stock management
    - Add consumption tracking
    - Add recipe system
    - Fix stock alerts to work with supplies
*/

-- Create supply types enum if not exists
DO $$ BEGIN
  CREATE TYPE tipo_insumo AS ENUM (
    'ingrediente_directo',    -- Direct ingredients (measured precisely)
    'insumo_complementario',  -- Complementary supplies (approximate usage)
    'gasto_operativo'        -- Operational expenses
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create supplies/ingredients table
CREATE TABLE IF NOT EXISTS insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo tipo_insumo NOT NULL,
  unidad_medida TEXT NOT NULL, -- e.g., kg, l, units
  stock_actual NUMERIC(10,2) DEFAULT 0,
  stock_minimo NUMERIC(10,2) DEFAULT 0,
  requiere_stock BOOLEAN DEFAULT true,
  precio_ultima_compra NUMERIC(10,2),
  costo_promedio_ponderado NUMERIC(10,2),
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create unit conversion table
CREATE TABLE IF NOT EXISTS unidades_conversion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_origen TEXT NOT NULL,
  unidad_destino TEXT NOT NULL,
  factor_conversion NUMERIC(10,4) NOT NULL,
  UNIQUE(unidad_origen, unidad_destino)
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS compras_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  proveedor TEXT,
  numero_factura TEXT,
  fecha_compra TIMESTAMPTZ NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create purchase details table
CREATE TABLE IF NOT EXISTS detalle_compras_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID REFERENCES compras_insumos(id) ON DELETE CASCADE,
  insumo_id UUID REFERENCES insumos(id) ON DELETE SET NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
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

-- Create product formulations table (recipes)
CREATE TABLE IF NOT EXISTS formulaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activa BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create formulation details table
CREATE TABLE IF NOT EXISTS detalle_formulaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formulacion_id UUID REFERENCES formulaciones(id) ON DELETE CASCADE,
  insumo_id UUID REFERENCES insumos(id) ON DELETE SET NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  unidad_medida TEXT NOT NULL,
  es_opcional BOOLEAN DEFAULT false
);

-- Add complementary flag to products if not exists
DO $$ BEGIN
  ALTER TABLE productos ADD COLUMN es_complementario BOOLEAN DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Modify stock_alertas table to use insumo_id
ALTER TABLE stock_alertas
DROP COLUMN IF EXISTS producto_id CASCADE;

ALTER TABLE stock_alertas
ADD COLUMN IF NOT EXISTS insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE;

-- Enable RLS on all tables
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades_conversion ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_compras_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumo_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_formulaciones ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view supplies from their business"
  ON insumos FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage supplies"
  ON insumos FOR ALL
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

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

CREATE POLICY "Users can view purchases from their business"
  ON compras_insumos FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage purchases"
  ON compras_insumos FOR ALL
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

CREATE POLICY "Users can view purchase details"
  ON detalle_compras_insumos FOR SELECT
  USING (compra_id IN (
    SELECT id FROM compras_insumos WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Admins can manage purchase details"
  ON detalle_compras_insumos FOR ALL
  USING (compra_id IN (
    SELECT id FROM compras_insumos WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios 
      WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
    )
  ));

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

CREATE POLICY "Users can view formulations"
  ON formulaciones FOR SELECT
  USING (producto_id IN (
    SELECT id FROM productos WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Admins can manage formulations"
  ON formulaciones FOR ALL
  USING (producto_id IN (
    SELECT id FROM productos WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios 
      WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
    )
  ));

CREATE POLICY "Users can view formulation details"
  ON detalle_formulaciones FOR SELECT
  USING (formulacion_id IN (
    SELECT id FROM formulaciones WHERE producto_id IN (
      SELECT id FROM productos WHERE negocio_id IN (
        SELECT negocio_id FROM usuarios WHERE id = auth.uid()
      )
    )
  ));

CREATE POLICY "Admins can manage formulation details"
  ON detalle_formulaciones FOR ALL
  USING (formulacion_id IN (
    SELECT id FROM formulaciones WHERE producto_id IN (
      SELECT id FROM productos WHERE negocio_id IN (
        SELECT negocio_id FROM usuarios 
        WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
      )
    )
  ));

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

-- Create function to update supply stock and costs on purchase
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

-- Create function to check supply stock levels
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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_supply_stock_on_purchase_trigger ON detalle_compras_insumos;
DROP TRIGGER IF EXISTS update_supply_stock_on_consumption_trigger ON consumo_insumos;
DROP TRIGGER IF EXISTS check_supply_stock_level_trigger ON insumos;
DROP TRIGGER IF EXISTS process_sale_ingredients_trigger ON detalle_ventas;

-- Create triggers
CREATE TRIGGER update_supply_stock_on_purchase_trigger
  AFTER INSERT ON detalle_compras_insumos
  FOR EACH ROW
  EXECUTE FUNCTION update_supply_stock_on_purchase();

CREATE TRIGGER update_supply_stock_on_consumption_trigger
  AFTER INSERT ON consumo_insumos
  FOR EACH ROW
  EXECUTE FUNCTION update_supply_stock_on_consumption();

CREATE TRIGGER check_supply_stock_level_trigger
  AFTER INSERT OR UPDATE OF stock_actual ON insumos
  FOR EACH ROW
  EXECUTE FUNCTION check_supply_stock_level();

CREATE TRIGGER process_sale_ingredients_trigger
  AFTER INSERT ON detalle_ventas
  FOR EACH ROW
  EXECUTE FUNCTION process_sale_ingredients();