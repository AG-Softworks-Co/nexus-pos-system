/*
  # Comprehensive Cash Register Management
  
  1. Updates to `cierres_caja`
    - Make `fecha_fin` nullable (to support open registers)
    - Add `monto_apertura` column (base amount when opening)
    - Add `total_ingresos` (sum of manual income movements)
    - Add `total_egresos` (sum of manual expense movements)
    
  2. New Table `movimientos_caja`
    - Tracks manual income/expenses during an open register session
    - Fields: id, cierre_caja_id, tipo, monto, descripcion, usuario_id, negocio_id
    
  3. Security
    - Enable RLS for `movimientos_caja`
    - Add policies for users to read/insert based on their `negocio_id`
*/

-- 1. Update cierres_caja table
ALTER TABLE cierres_caja ALTER COLUMN fecha_fin DROP NOT NULL;
ALTER TABLE cierres_caja ADD COLUMN monto_apertura NUMERIC(10,2) DEFAULT 0;
ALTER TABLE cierres_caja ADD COLUMN total_ingresos NUMERIC(10,2) DEFAULT 0;
ALTER TABLE cierres_caja ADD COLUMN total_egresos NUMERIC(10,2) DEFAULT 0;

-- 2. Create movimientos_caja table
CREATE TABLE IF NOT EXISTS movimientos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cierre_caja_id UUID REFERENCES cierres_caja(id) ON DELETE CASCADE,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  descripcion TEXT NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for movimientos_caja
CREATE POLICY "Users can view box movements from their business"
  ON movimientos_caja FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create box movements for their business"
  ON movimientos_caja FOR INSERT
  WITH CHECK (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));
  
-- Add INDEX for performance
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_cierre ON movimientos_caja(cierre_caja_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_negocio ON movimientos_caja(negocio_id);
