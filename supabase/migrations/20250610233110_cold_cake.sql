/*
  # Add Credit, Discounts and Partial Payments System
  
  1. New Tables
    - `pagos_parciales` - Partial payments tracking
    - `descuentos_venta` - Sale discounts tracking
    - `cuentas_credito` - Credit accounts for customers
    - `movimientos_credito` - Credit movements (charges/payments)

  2. Changes
    - Add discount fields to ventas table
    - Add credit payment method support
    - Add partial payment status tracking
    - Add admin discount permissions
*/

-- Add new payment status enum
DO $$ BEGIN
  CREATE TYPE estado_pago AS ENUM ('pendiente', 'parcial', 'pagado', 'vencido');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add discount and credit fields to ventas table
ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS descuento_porcentaje NUMERIC(5,2) DEFAULT 0 CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
ADD COLUMN IF NOT EXISTS descuento_monto NUMERIC(10,2) DEFAULT 0 CHECK (descuento_monto >= 0),
ADD COLUMN IF NOT EXISTS subtotal_antes_descuento NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS usuario_descuento_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS razon_descuento TEXT,
ADD COLUMN IF NOT EXISTS estado_pago estado_pago DEFAULT 'pagado',
ADD COLUMN IF NOT EXISTS fecha_vencimiento_credito TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(10,2) DEFAULT 0;

-- Create partial payments table
CREATE TABLE IF NOT EXISTS pagos_parciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  metodo_pago TEXT NOT NULL,
  fecha_pago TIMESTAMPTZ DEFAULT now(),
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create sale discounts detail table
CREATE TABLE IF NOT EXISTS descuentos_venta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  detalle_venta_id UUID REFERENCES detalle_ventas(id) ON DELETE CASCADE,
  tipo_descuento TEXT NOT NULL CHECK (tipo_descuento IN ('porcentaje', 'monto_fijo')),
  valor_descuento NUMERIC(10,2) NOT NULL CHECK (valor_descuento >= 0),
  monto_descontado NUMERIC(10,2) NOT NULL CHECK (monto_descontado >= 0),
  usuario_aplicador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  razon TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create credit accounts table
CREATE TABLE IF NOT EXISTS cuentas_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  limite_credito NUMERIC(10,2) DEFAULT 0 CHECK (limite_credito >= 0),
  saldo_actual NUMERIC(10,2) DEFAULT 0,
  dias_credito INTEGER DEFAULT 30 CHECK (dias_credito > 0),
  activa BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, negocio_id)
);

-- Create credit movements table
CREATE TABLE IF NOT EXISTS movimientos_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_credito_id UUID REFERENCES cuentas_credito(id) ON DELETE CASCADE,
  venta_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
  pago_parcial_id UUID REFERENCES pagos_parciales(id) ON DELETE SET NULL,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('cargo', 'pago', 'ajuste')),
  monto NUMERIC(10,2) NOT NULL,
  saldo_anterior NUMERIC(10,2) NOT NULL,
  saldo_nuevo NUMERIC(10,2) NOT NULL,
  descripcion TEXT,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE pagos_parciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE descuentos_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_credito ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pagos_parciales
CREATE POLICY "Users can view partial payments from their business"
  ON pagos_parciales FOR SELECT
  USING (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can create partial payments"
  ON pagos_parciales FOR INSERT
  WITH CHECK (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

-- RLS Policies for descuentos_venta
CREATE POLICY "Users can view discounts from their business"
  ON descuentos_venta FOR SELECT
  USING (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Admins can manage discounts"
  ON descuentos_venta FOR ALL
  USING (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios 
      WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
    )
  ));

-- RLS Policies for cuentas_credito
CREATE POLICY "Users can view credit accounts from their business"
  ON cuentas_credito FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage credit accounts"
  ON cuentas_credito FOR ALL
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
  ));

-- RLS Policies for movimientos_credito
CREATE POLICY "Users can view credit movements from their business"
  ON movimientos_credito FOR SELECT
  USING (cuenta_credito_id IN (
    SELECT id FROM cuentas_credito WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can create credit movements"
  ON movimientos_credito FOR INSERT
  WITH CHECK (cuenta_credito_id IN (
    SELECT id FROM cuentas_credito WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

-- Function to calculate sale totals with discounts
CREATE OR REPLACE FUNCTION calculate_sale_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal NUMERIC(10,2);
  v_descuento_monto NUMERIC(10,2);
  v_total_final NUMERIC(10,2);
BEGIN
  -- Calculate subtotal from sale details
  SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
  INTO v_subtotal
  FROM detalle_ventas
  WHERE venta_id = NEW.id;

  -- Store subtotal before discount
  NEW.subtotal_antes_descuento = v_subtotal;

  -- Calculate discount amount
  IF NEW.descuento_porcentaje > 0 THEN
    v_descuento_monto = v_subtotal * (NEW.descuento_porcentaje / 100);
  ELSE
    v_descuento_monto = COALESCE(NEW.descuento_monto, 0);
  END IF;

  -- Ensure discount doesn't exceed subtotal
  v_descuento_monto = LEAST(v_descuento_monto, v_subtotal);
  NEW.descuento_monto = v_descuento_monto;

  -- Calculate final total (including delivery cost)
  v_total_final = v_subtotal - v_descuento_monto + COALESCE(NEW.costo_domicilio, 0);
  NEW.total = v_total_final;

  -- Set pending balance for credit sales
  IF NEW.metodo_pago = 'credito' THEN
    NEW.saldo_pendiente = v_total_final;
    NEW.estado_pago = 'pendiente';
    
    -- Set credit due date if not provided
    IF NEW.fecha_vencimiento_credito IS NULL THEN
      NEW.fecha_vencimiento_credito = NEW.creada_en + INTERVAL '30 days';
    END IF;
  ELSE
    NEW.saldo_pendiente = 0;
    NEW.estado_pago = 'pagado';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update payment status based on partial payments
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_pagado NUMERIC(10,2);
  v_total_venta NUMERIC(10,2);
  v_nuevo_estado estado_pago;
  v_nuevo_saldo NUMERIC(10,2);
BEGIN
  -- Get sale total
  SELECT total INTO v_total_venta
  FROM ventas
  WHERE id = NEW.venta_id;

  -- Calculate total paid
  SELECT COALESCE(SUM(monto), 0)
  INTO v_total_pagado
  FROM pagos_parciales
  WHERE venta_id = NEW.venta_id;

  -- Determine new status and balance
  v_nuevo_saldo = v_total_venta - v_total_pagado;
  
  IF v_nuevo_saldo <= 0 THEN
    v_nuevo_estado = 'pagado';
    v_nuevo_saldo = 0;
  ELSIF v_total_pagado > 0 THEN
    v_nuevo_estado = 'parcial';
  ELSE
    v_nuevo_estado = 'pendiente';
  END IF;

  -- Update sale
  UPDATE ventas
  SET 
    estado_pago = v_nuevo_estado,
    saldo_pendiente = v_nuevo_saldo
  WHERE id = NEW.venta_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle credit account movements
CREATE OR REPLACE FUNCTION handle_credit_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_cuenta_credito_id UUID;
  v_saldo_anterior NUMERIC(10,2);
  v_saldo_nuevo NUMERIC(10,2);
  v_monto_movimiento NUMERIC(10,2);
BEGIN
  -- Handle credit sales
  IF TG_TABLE_NAME = 'ventas' AND NEW.metodo_pago = 'credito' AND NEW.cliente_id IS NOT NULL THEN
    -- Get or create credit account
    SELECT id, saldo_actual
    INTO v_cuenta_credito_id, v_saldo_anterior
    FROM cuentas_credito
    WHERE cliente_id = NEW.cliente_id
    AND negocio_id = NEW.negocio_id;

    -- Create credit account if doesn't exist
    IF v_cuenta_credito_id IS NULL THEN
      INSERT INTO cuentas_credito (cliente_id, negocio_id, limite_credito, saldo_actual)
      VALUES (NEW.cliente_id, NEW.negocio_id, 10000, 0) -- Default 1M limit
      RETURNING id, saldo_actual INTO v_cuenta_credito_id, v_saldo_anterior;
    END IF;

    -- Calculate new balance
    v_monto_movimiento = NEW.total;
    v_saldo_nuevo = v_saldo_anterior + v_monto_movimiento;

    -- Update credit account
    UPDATE cuentas_credito
    SET saldo_actual = v_saldo_nuevo
    WHERE id = v_cuenta_credito_id;

    -- Record movement
    INSERT INTO movimientos_credito (
      cuenta_credito_id,
      venta_id,
      tipo_movimiento,
      monto,
      saldo_anterior,
      saldo_nuevo,
      descripcion,
      usuario_id
    ) VALUES (
      v_cuenta_credito_id,
      NEW.id,
      'cargo',
      v_monto_movimiento,
      v_saldo_anterior,
      v_saldo_nuevo,
      'Venta a crédito #' || NEW.id,
      NEW.usuario_id
    );
  END IF;

  -- Handle credit payments
  IF TG_TABLE_NAME = 'pagos_parciales' THEN
    -- Get credit account from sale
    SELECT cc.id, cc.saldo_actual
    INTO v_cuenta_credito_id, v_saldo_anterior
    FROM cuentas_credito cc
    JOIN ventas v ON v.cliente_id = cc.cliente_id AND v.negocio_id = cc.negocio_id
    WHERE v.id = NEW.venta_id
    AND v.metodo_pago = 'credito';

    -- If this is a payment to a credit sale
    IF v_cuenta_credito_id IS NOT NULL THEN
      v_monto_movimiento = -NEW.monto; -- Negative for payment
      v_saldo_nuevo = v_saldo_anterior + v_monto_movimiento;

      -- Update credit account
      UPDATE cuentas_credito
      SET saldo_actual = v_saldo_nuevo
      WHERE id = v_cuenta_credito_id;

      -- Record movement
      INSERT INTO movimientos_credito (
        cuenta_credito_id,
        venta_id,
        pago_parcial_id,
        tipo_movimiento,
        monto,
        saldo_anterior,
        saldo_nuevo,
        descripcion,
        usuario_id
      ) VALUES (
        v_cuenta_credito_id,
        NEW.venta_id,
        NEW.id,
        'pago',
        v_monto_movimiento,
        v_saldo_anterior,
        v_saldo_nuevo,
        'Pago parcial #' || NEW.id,
        NEW.usuario_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to apply item-level discounts
CREATE OR REPLACE FUNCTION apply_item_discount()
RETURNS TRIGGER AS $$
DECLARE
  v_precio_original NUMERIC(10,2);
  v_monto_descontado NUMERIC(10,2);
BEGIN
  -- Get original price
  v_precio_original = NEW.cantidad * NEW.precio_unitario;

  -- Calculate discount amount
  IF NEW.tipo_descuento = 'porcentaje' THEN
    v_monto_descontado = v_precio_original * (NEW.valor_descuento / 100);
  ELSE
    v_monto_descontado = NEW.valor_descuento;
  END IF;

  -- Ensure discount doesn't exceed item total
  v_monto_descontado = LEAST(v_monto_descontado, v_precio_original);
  NEW.monto_descontado = v_monto_descontado;

  -- Update the sale detail with discounted price
  UPDATE detalle_ventas
  SET precio_unitario = precio_unitario - (v_monto_descontado / cantidad)
  WHERE id = NEW.detalle_venta_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check overdue credit sales
CREATE OR REPLACE FUNCTION check_overdue_credits()
RETURNS void AS $$
BEGIN
  UPDATE ventas
  SET estado_pago = 'vencido'
  WHERE metodo_pago = 'credito'
  AND estado_pago IN ('pendiente', 'parcial')
  AND fecha_vencimiento_credito < now()
  AND saldo_pendiente > 0;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS calculate_sale_totals_trigger ON ventas;
DROP TRIGGER IF EXISTS update_payment_status_trigger ON pagos_parciales;
DROP TRIGGER IF EXISTS handle_credit_sale_trigger ON ventas;
DROP TRIGGER IF EXISTS handle_credit_payment_trigger ON pagos_parciales;
DROP TRIGGER IF EXISTS apply_item_discount_trigger ON descuentos_venta;

-- Create triggers
CREATE TRIGGER calculate_sale_totals_trigger
  BEFORE INSERT OR UPDATE ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sale_totals();

CREATE TRIGGER update_payment_status_trigger
  AFTER INSERT ON pagos_parciales
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_status();

CREATE TRIGGER handle_credit_sale_trigger
  AFTER INSERT ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION handle_credit_movement();

CREATE TRIGGER handle_credit_payment_trigger
  AFTER INSERT ON pagos_parciales
  FOR EACH ROW
  EXECUTE FUNCTION handle_credit_movement();

CREATE TRIGGER apply_item_discount_trigger
  BEFORE INSERT ON descuentos_venta
  FOR EACH ROW
  EXECUTE FUNCTION apply_item_discount();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ventas_estado_pago ON ventas(estado_pago);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha_vencimiento ON ventas(fecha_vencimiento_credito);
CREATE INDEX IF NOT EXISTS idx_pagos_parciales_venta ON pagos_parciales(venta_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_credito_cliente ON cuentas_credito(cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_credito_cuenta ON movimientos_credito(cuenta_credito_id);

-- Insert some common unit conversions for supplies
INSERT INTO unidades_conversion (unidad_origen, unidad_destino, factor_conversion) VALUES
('kg', 'g', 1000),
('g', 'kg', 0.001),
('l', 'ml', 1000),
('ml', 'l', 0.001),
('unidad', 'docena', 0.0833),
('docena', 'unidad', 12)
ON CONFLICT (unidad_origen, unidad_destino) DO NOTHING;