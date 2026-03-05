/*
  # Add logo_nombre column to negocios table

  1. Changes
    - Add logo_nombre column to store the original filename of the uploaded logo
*/

ALTER TABLE negocios
ADD COLUMN IF NOT EXISTS logo_nombre text;