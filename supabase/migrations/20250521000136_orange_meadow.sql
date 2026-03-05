/*
  # Add Supplies and Ingredients Management
  
  1. New Tables
    - `tipos_insumos` - Types of supplies (direct ingredients, indirect supplies, operational expenses)
    - `insumos` - Supplies/ingredients master table
    - `compras_insumos` - Purchase records for supplies
    - `detalle_compras_insumos` - Purchase details
    - `formulaciones` - Product formulations (recipes)
    - `detalle_formulaciones` - Formulation details (ingredients per product)

  2. Changes
    - Add `es_complementario` field to productos table
    - Add supply type categorization
    - Add stock management for supplies
*/

-- Create supply types enum
CREATE TYPE tipo_insumo AS ENUM (
  'ingrediente_directo',    -- Direct ingredients (measured precisely)
  'insumo_complementario',  -- Complementary supplies (approximate usage)
  'gasto_operativo'        -- Operational expenses
);

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
  creado_en TIMESTAMPTZ DEFAULT now()
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

-- Add complementary flag to products
ALTER TABLE productos
ADD COLUMN es_complementario BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_compras_insumos ENABLE ROW LEVEL SECURITY;
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

-- Create function to update supply stock on purchase
CREATE OR REPLACE FUNCTION update_supply_stock_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE insumos
  SET 
    stock_actual = stock_actual + NEW.cantidad,
    precio_ultima_compra = NEW.precio_unitario
  WHERE id = NEW.insumo_id
  AND requiere_stock = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic stock updates on purchases
CREATE TRIGGER update_supply_stock_on_purchase_trigger
  AFTER INSERT ON detalle_compras_insumos
  FOR EACH ROW
  EXECUTE FUNCTION update_supply_stock_on_purchase();

-- Create function to check supply stock levels
CREATE OR REPLACE FUNCTION check_supply_stock_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requiere_stock AND NEW.stock_actual <= NEW.stock_minimo THEN
    INSERT INTO stock_alertas (
      producto_id,
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

-- Create trigger for supply stock alerts
CREATE TRIGGER check_supply_stock_level_trigger
  AFTER INSERT OR UPDATE OF stock_actual ON insumos
  FOR EACH ROW
  EXECUTE FUNCTION check_supply_stock_level();