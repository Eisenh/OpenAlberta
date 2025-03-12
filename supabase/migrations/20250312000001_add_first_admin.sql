-- This is a template for adding the first admin user
-- Replace '[YOUR_USER_ID]' with the actual auth.users id of the admin user
-- You can find your user ID in the Supabase dashboard under Authentication > Users

/*
INSERT INTO public.admin_users (user_id, role, permissions, created_by)
VALUES (
  '[YOUR_USER_ID]', -- Replace with your auth.users id
  'super_admin',
  '{
    "users": {"read": true, "create": true, "update": true, "delete": true},
    "content": {"read": true, "create": true, "update": true, "delete": true},
    "settings": {"read": true, "update": true}
  }',
  '[YOUR_USER_ID]' -- Same as above
);
*/

-- Uncomment the above SQL statement and replace the placeholders to add your first admin user
-- Then run this migration using the Supabase CLI or dashboard
