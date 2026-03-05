/*
  # Corregir políticas RLS para pagos_parciales
  
  1. Cambios
    - Eliminar políticas existentes para pagos_parciales
    - Crear nuevas políticas más robustas para pagos_parciales
    - Asegurar que todas las operaciones CRUD estén correctamente protegidas
*/

-- Eliminar políticas existentes para pagos_parciales
DROP POLICY IF EXISTS "Users can view partial payments from their business" ON pagos_parciales;
DROP POLICY IF EXISTS "Users can create partial payments" ON pagos_parciales;
DROP POLICY IF EXISTS "Users can manage partial payments from their business" ON pagos_parciales;
DROP POLICY IF EXISTS "Temporary permissive policy" ON pagos_parciales;

-- Crear nuevas políticas más robustas
CREATE POLICY "Users can view partial payments from their business"
  ON pagos_parciales FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert partial payments"
  ON pagos_parciales FOR INSERT
  WITH CHECK (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update partial payments from their business"
  ON pagos_parciales FOR UPDATE
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can delete partial payments"
  ON pagos_parciales FOR DELETE
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

-- Asegurar que el campo negocio_id existe y está correctamente configurado
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pagos_parciales' AND column_name = 'negocio_id'
  ) THEN
    ALTER TABLE pagos_parciales ADD COLUMN negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE;
    
    -- Actualizar registros existentes para establecer negocio_id desde ventas relacionadas
    UPDATE pagos_parciales pp
    SET negocio_id = v.negocio_id
    FROM ventas v
    WHERE pp.venta_id = v.id;
    
    -- Hacer negocio_id NOT NULL
    ALTER TABLE pagos_parciales ALTER COLUMN negocio_id SET NOT NULL;
  END IF;
END $$;

-- Asegurar que el trigger de actualización de estado de pago funciona correctamente
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_nuevo_saldo NUMERIC;
  v_negocio_id UUID;
BEGIN
  -- Obtener información de la venta
  SELECT saldo_pendiente - NEW.monto, negocio_id
  INTO v_nuevo_saldo, v_negocio_id
  FROM ventas
  WHERE id = NEW.venta_id;
  
  -- Establecer negocio_id si no se proporcionó
  IF NEW.negocio_id IS NULL THEN
    NEW.negocio_id := v_negocio_id;
  END IF;

  -- Actualizar estado de la venta
  UPDATE ventas
  SET 
    saldo_pendiente = GREATEST(0, v_nuevo_saldo),
    estado_pago = CASE 
                    WHEN GREATEST(0, v_nuevo_saldo) <= 0 THEN 'pagado'::estado_pago
                    ELSE 'parcial'::estado_pago
                  END
  WHERE id = NEW.venta_id;
  
  -- Registrar pago en el historial
  INSERT INTO historial_ventas(venta_id, usuario_id, accion, razon)
  VALUES(NEW.venta_id, NEW.usuario_id, 'pago', 'Abono de ' || NEW.monto || '. Método: ' || NEW.metodo_pago);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
DROP TRIGGER IF EXISTS update_payment_status_trigger ON pagos_parciales;
CREATE TRIGGER update_payment_status_trigger
  AFTER INSERT ON pagos_parciales
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_status();

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_pagos_parciales_negocio_id ON pagos_parciales(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_parciales_usuario_id ON pagos_parciales(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_parciales_fecha_pago ON pagos_parciales(fecha_pago);