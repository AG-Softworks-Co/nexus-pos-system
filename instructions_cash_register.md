# SQL de Cierre de Caja (Cash Register Flow)

Como el CLI de Supabase requiere autenticación manual en este entorno para empujar migraciones (`db push`), por favor ejecuta este código SQL manualmente en el **SQL Editor** de tu panel de Supabase para habilitar las nuevas funciones de caja:

```sql
/*
  ==============================================================
  Actualización: Gestión Profesional de Apertura y Cierre de Caja
  ==============================================================
*/

-- 1. Actualizar tabla cierres_caja
ALTER TABLE cierres_caja ALTER COLUMN fecha_fin DROP NOT NULL;
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS monto_apertura NUMERIC(10,2) DEFAULT 0;
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS total_ingresos NUMERIC(10,2) DEFAULT 0;
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS total_egresos NUMERIC(10,2) DEFAULT 0;

-- 2. Crear tabla movimientos_caja
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

-- Habilitar RLS
ALTER TABLE movimientos_caja ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para movimientos_caja
CREATE POLICY "Usuarios pueden ver movimientos de caja de su negocio"
  ON movimientos_caja FOR SELECT
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

CREATE POLICY "Usuarios pueden crear movimientos de caja para su negocio"
  ON movimientos_caja FOR INSERT
  WITH CHECK (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));
  
-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_cierre ON movimientos_caja(cierre_caja_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_negocio ON movimientos_caja(negocio_id);

## 🏁 ÚLTIMO PASO: Solución Definitiva (Solo ejecuta esto)

Copia y pega este bloque único. He añadido comandos para borrar las políticas si ya existen, así no te dará el error de "already exists":

```sql
-- 1. Permiso de Actualización para Cerrar Caja (EL MÁS IMPORTANTE)
DROP POLICY IF EXISTS "Usuarios pueden actualizar cierres de su negocio" ON cierres_caja;
CREATE POLICY "Usuarios pueden actualizar cierres de su negocio"
  ON cierres_caja FOR UPDATE
  USING (negocio_id IN (
    SELECT negocio_id FROM usuarios WHERE id = auth.uid()
  ));

-- 2. Liberar la columna diferencia (Para evitar error 400)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'cierres_caja' AND a.attname = 'diferencia' AND a.attgenerated <> ''
  ) THEN
    ALTER TABLE cierres_caja ALTER COLUMN diferencia DROP EXPRESSION;
  END IF;
END $$;

-- 3. Limpiar la caja que se quedó "pegada" como abierta
-- Esto la cerrará automáticamente y la pasará al historial
UPDATE cierres_caja 
SET estado = 'completado', 
    fecha_fin = now(),
    total_ventas = total_ventas -- Mantiene los valores que ya tenía
WHERE estado = 'pendiente';
```
