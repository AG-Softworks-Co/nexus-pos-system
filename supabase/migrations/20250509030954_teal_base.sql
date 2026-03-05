/*
  # Add storage bucket for product images
  
  1. Changes
    - Create products storage bucket
    - Add storage policies for business-specific access
*/

-- Create bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('productos', 'productos', true);

-- Allow authenticated users to upload files to their business folder
CREATE POLICY "Users can upload product images to their business folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'productos' AND 
  (storage.foldername(name))[1] = (
    SELECT negocio_id::text 
    FROM usuarios 
    WHERE id = auth.uid()
  )
);

-- Allow users to read product images from their business
CREATE POLICY "Users can view product images from their business"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'productos' AND
  (storage.foldername(name))[1] IN (
    SELECT negocio_id::text 
    FROM usuarios 
    WHERE id = auth.uid()
  )
);

-- Allow users to delete product images from their business
CREATE POLICY "Users can delete product images from their business"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'productos' AND
  (storage.foldername(name))[1] IN (
    SELECT negocio_id::text 
    FROM usuarios 
    WHERE id = auth.uid()
  )
);