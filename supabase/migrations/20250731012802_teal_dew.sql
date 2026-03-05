/*
  # Add address field to clients table
  
  1. Changes
    - Add direccion field to clientes table for storing client addresses
    - This allows storing client address information for all sales types
*/

-- Add address field to clients table
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS direccion TEXT;

-- Create index for better performance on address searches
CREATE INDEX IF NOT EXISTS idx_clientes_direccion ON clientes(direccion);