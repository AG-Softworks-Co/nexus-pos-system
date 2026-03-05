/*
  # Add delivery functionality

  1. New Tables
    - `clientes` - Store customer contact information
    - `direcciones_entrega` - Store delivery addresses
    - Add delivery fields to `ventas` table

  2. Changes
    - Add delivery-related columns to ventas table
    - Create tables for customer management
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  telefono TEXT,
  correo TEXT,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Create delivery addresses table
CREATE TABLE IF NOT EXISTS direcciones_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  direccion TEXT NOT NULL,
  referencias TEXT,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Add delivery fields to ventas table
ALTER TABLE ventas
ADD COLUMN es_domicilio BOOLEAN DEFAULT false,
ADD COLUMN cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
ADD COLUMN direccion_entrega_id UUID REFERENCES direcciones_entrega(id) ON DELETE SET NULL,
ADD COLUMN costo_domicilio NUMERIC(10,2) DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE direcciones_entrega ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for clientes
CREATE POLICY "Users can view customers from their business"
  ON clientes FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert customers"
  ON clientes FOR INSERT
  WITH CHECK (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update customers from their business"
  ON clientes FOR UPDATE
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

-- Add RLS policies for direcciones_entrega
CREATE POLICY "Users can view delivery addresses"
  ON direcciones_entrega FOR SELECT
  USING (cliente_id IN (
    SELECT id FROM clientes WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can manage delivery addresses"
  ON direcciones_entrega FOR ALL
  USING (cliente_id IN (
    SELECT id FROM clientes WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));