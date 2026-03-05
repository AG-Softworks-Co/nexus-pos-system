/*
  # Set up authentication trigger

  1. New Functions
    - `handle_new_user()`: Creates a user profile when a new auth user is registered
    
  2. Triggers
    - `on_auth_user_created`: Automatically creates user profile after auth signup
*/

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public
AS $$
DECLARE
  new_negocio_id uuid;
BEGIN
  -- If this is the first user, create a business for them
  IF NOT EXISTS (SELECT 1 FROM public.usuarios) THEN
    -- Create a new business
    INSERT INTO public.negocios (nombre)
    VALUES ('Mi Negocio')
    RETURNING id INTO new_negocio_id;

    -- Create the user as owner
    INSERT INTO public.usuarios (id, nombre_completo, correo, rol, negocio_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email),
      NEW.email,
      'propietario',
      new_negocio_id
    );
  ELSE
    -- For subsequent users, they need to be invited by an owner
    INSERT INTO public.usuarios (id, nombre_completo, correo, rol, negocio_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email),
      NEW.email,
      'cajero',
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;