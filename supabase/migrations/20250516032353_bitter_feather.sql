/*
  # Add Cash Register Closing functionality
  
  1. New Tables
    - `cierres_caja` - Store cash register closing records
    - `detalle_cierre_caja` - Store payment method breakdowns
    
  2. Changes
    - Add tables for tracking cash register closings
    - Add payment method totals
    - Add support for tips and discounts
*/

-- Create cash register closing table
CREATE TABLE IF NOT EXISTS cierres_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  total_ventas NUMERIC(10,2) NOT NULL,
  total_efectivo NUMERIC(10,2) NOT NULL,
  total_otros_medios NUMERIC(10,2) NOT NULL,
  total_propinas NUMERIC(10,2) DEFAULT 0,
  total_descuentos NUMERIC(10,2) DEFAULT 0,
  numero_ordenes INTEGER NOT NULL,
  notas TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create payment method breakdown table
CREATE TABLE IF NOT EXISTS detalle_cierre_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cierre_id UUID REFERENCES cierres_caja(id) ON DELETE CASCADE,
  metodo_pago TEXT NOT NULL,
  monto NUMERIC(10,2) NOT NULL
);

-- Enable RLS
ALTER TABLE cierres_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_cierre_caja ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view closings from their business"
  ON cierres_caja FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create closings for their business"
  ON cierres_caja FOR INSERT
  WITH CHECK (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view closing details"
  ON detalle_cierre_caja FOR SELECT
  USING (cierre_id IN (
    SELECT id FROM cierres_caja WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can create closing details"
  ON detalle_cierre_caja FOR INSERT
  WITH CHECK (cierre_id IN (
    SELECT id FROM cierres_caja WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));