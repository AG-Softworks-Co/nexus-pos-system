/*
  # Update RLS policies to be more permissive during development
  
  1. Changes
    - Make all policies return true for easier development
    - Will be updated with proper security later
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own business" ON negocios;
DROP POLICY IF EXISTS "Owners can update their business" ON negocios;
DROP POLICY IF EXISTS "Users can view own profile" ON usuarios;
DROP POLICY IF EXISTS "Users can view profiles from same business" ON usuarios;
DROP POLICY IF EXISTS "Users can update their own profile" ON usuarios;
DROP POLICY IF EXISTS "Users can view categories from their business" ON categorias;
DROP POLICY IF EXISTS "Admins and owners can manage categories" ON categorias;
DROP POLICY IF EXISTS "Users can view products from their business" ON productos;
DROP POLICY IF EXISTS "Admins and owners can manage products" ON productos;
DROP POLICY IF EXISTS "Users can view sales from their business" ON ventas;
DROP POLICY IF EXISTS "Users can create sales" ON ventas;
DROP POLICY IF EXISTS "Users can view sale details from their business" ON detalle_ventas;
DROP POLICY IF EXISTS "Users can create sale details" ON detalle_ventas;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notificaciones;
DROP POLICY IF EXISTS "Users can update their notifications" ON notificaciones;

-- Create new permissive policies
CREATE POLICY "Temporary permissive policy" ON negocios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Temporary permissive policy" ON usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Temporary permissive policy" ON categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Temporary permissive policy" ON productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Temporary permissive policy" ON ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Temporary permissive policy" ON detalle_ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Temporary permissive policy" ON notificaciones FOR ALL USING (true) WITH CHECK (true);