/*
  # Create Auth Trigger
  
  1. Changes
    - Create trigger to handle new user registration
    - Automatically create business for first user
    - Set up proper role assignment
*/

-- Create trigger for handling new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();