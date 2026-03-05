/*
  # Enhance Cash Closing System
  
  1. Changes
    - Add cash counting fields to cierres_caja
    - Add balance calculation fields
    - Add status field for closing state
*/

ALTER TABLE cierres_caja
ADD COLUMN efectivo_contado NUMERIC(10,2) DEFAULT 0,
ADD COLUMN diferencia NUMERIC(10,2) GENERATED ALWAYS AS (efectivo_contado - total_efectivo) STORED,
ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado', 'anulado'));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_cierres_caja_fecha ON cierres_caja(fecha_inicio, fecha_fin);