/*
  # Initial Schema Setup for Majos POS

  1. New Tables
    - `negocios` - Stores business information
    - `usuarios` - User profiles linked to Supabase Auth
    - `categorias` - Product categories
    - `productos` - Products inventory
    - `ventas` - Sales records
    - `detalle_ventas` - Sales details/line items
    - `notificaciones` - System notifications

  2. Security
    - Enable RLS on all tables
    - Add policies for business-specific access
    - Set up role-based access control
*/

-- Create custom types
CREATE TYPE rol_usuario AS ENUM ('propietario', 'administrador', 'cajero');
CREATE TYPE estado_venta AS ENUM ('pagada', 'pendiente', 'cancelada');

-- Businesses table
CREATE TABLE IF NOT EXISTS negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  logo_url TEXT,
  moneda TEXT DEFAULT 'COP',
  zona_horaria TEXT DEFAULT 'America/Bogota',
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Users table (linked to auth.users)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  correo TEXT NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'cajero',
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_costo NUMERIC(10,2) NOT NULL,
  precio_venta NUMERIC(10,2) NOT NULL,
  url_imagen TEXT,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Sales table
CREATE TABLE IF NOT EXISTS ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  total NUMERIC(10,2) NOT NULL,
  metodo_pago TEXT DEFAULT 'efectivo',
  estado estado_venta DEFAULT 'pagada',
  notas TEXT,
  creada_en TIMESTAMPTZ DEFAULT now()
);

-- Sales details table
CREATE TABLE IF NOT EXISTS detalle_ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Negocios policies
CREATE POLICY "Users can view their own business"
  ON negocios FOR SELECT
  USING (id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Owners can update their business"
  ON negocios FOR UPDATE
  USING (id IN (
    SELECT negocio_id FROM usuarios 
    WHERE id = auth.uid() AND rol = 'propietario'
  ));

-- Usuarios policies
CREATE POLICY "Users can view profiles from their business"
  ON usuarios FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their own profile"
  ON usuarios FOR UPDATE
  USING (id = auth.uid());

-- Categorias policies
CREATE POLICY "Users can view categories from their business"
  ON categorias FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins and owners can manage categories"
  ON categorias FOR ALL
  USING (
    negocio_id IN (
      SELECT negocio_id FROM usuarios 
      WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
    )
  );

-- Productos policies
CREATE POLICY "Users can view products from their business"
  ON productos FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Admins and owners can manage products"
  ON productos FOR ALL
  USING (
    negocio_id IN (
      SELECT negocio_id FROM usuarios 
      WHERE id = auth.uid() AND rol IN ('propietario', 'administrador')
    )
  );

-- Ventas policies
CREATE POLICY "Users can view sales from their business"
  ON ventas FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create sales"
  ON ventas FOR INSERT
  WITH CHECK (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

-- Detalle_ventas policies
CREATE POLICY "Users can view sale details from their business"
  ON detalle_ventas FOR SELECT
  USING (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can create sale details"
  ON detalle_ventas FOR INSERT
  WITH CHECK (venta_id IN (
    SELECT id FROM ventas WHERE negocio_id IN (
      SELECT negocio_id FROM usuarios WHERE id = auth.uid()
    )
  ));

-- Notificaciones policies
CREATE POLICY "Users can view their own notifications"
  ON notificaciones FOR SELECT
  USING (usuario_id = auth.uid());

CREATE POLICY "Users can update their notifications"
  ON notificaciones FOR UPDATE
  USING (usuario_id = auth.uid());