/*
  # Fix policy syntax error
  
  1. Changes
    - Remove IF NOT EXISTS from policy creation statements
    - Ensure policies are dropped before recreation
    - Fix syntax errors in policy creation
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view returns from their business" ON devoluciones;
DROP POLICY IF EXISTS "Users can create returns" ON devoluciones;
DROP POLICY IF EXISTS "Admins can manage returns" ON devoluciones;
DROP POLICY IF EXISTS "Users can view return details from their business" ON detalle_devoluciones;
DROP POLICY IF EXISTS "Users can manage return details" ON detalle_devoluciones;

-- Recreate policies without IF NOT EXISTS (which is not supported for policies)
CREATE POLICY "Users can view returns from their business"
  ON devoluciones FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create returns"
  ON devoluciones FOR INSERT
  WITH CHECK (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage returns"
  ON devoluciones FOR UPDATE
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

-- Recreate policies for detalle_devoluciones
CREATE POLICY "Users can view return details from their business"
  ON detalle_devoluciones FOR SELECT
  USING (devolucion_id IN (
    SELECT id FROM devoluciones WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage return details"
  ON detalle_devoluciones FOR ALL
  USING (devolucion_id IN (
    SELECT id FROM devoluciones WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));