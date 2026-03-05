/*
  # Add business contact information fields
  
  1. Changes
    - Add NIT field to negocios table
    - Add address fields
    - Add phone numbers
    - Add business email
*/

ALTER TABLE negocios
ADD COLUMN nit TEXT,
ADD COLUMN direccion TEXT,
ADD COLUMN telefono_principal TEXT,
ADD COLUMN telefono_secundario TEXT,
ADD COLUMN correo_empresarial TEXT;