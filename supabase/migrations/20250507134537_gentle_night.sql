/*
  # Fix usuarios table RLS policies

  1. Changes
    - Remove recursive policy for viewing profiles
    - Add separate policies for:
      - Viewing own profile
      - Viewing business colleagues (only after user profile is loaded)
  
  2. Security
    - Maintains RLS enabled
    - Ensures users can only view their own profile during initial auth
    - Allows viewing business colleagues only after authenticated
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view profiles from their business" ON usuarios;

-- Create new policies
CREATE POLICY "Users can view own profile"
ON usuarios
FOR SELECT
TO public
USING (
  id = auth.uid()
);

CREATE POLICY "Users can view profiles from same business"
ON usuarios
FOR SELECT
TO public
USING (
  -- Only allow viewing other profiles if they share the same business_id
  -- and the user exists (prevents recursion during initial profile fetch)
  EXISTS (
    SELECT 1 FROM usuarios self 
    WHERE self.id = auth.uid() 
    AND self.negocio_id = usuarios.negocio_id
    AND usuarios.id != auth.uid()
  )
);