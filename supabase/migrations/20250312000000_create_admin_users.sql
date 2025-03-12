-- Create the helper function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  active BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(user_id)
);

-- Add comment to table
COMMENT ON TABLE public.admin_users IS 'Stores admin users and their permissions';

-- Create indexes
CREATE INDEX IF NOT EXISTS admin_users_user_id_idx ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS admin_users_role_idx ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS admin_users_active_idx ON public.admin_users(active);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.admin_users;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS on the table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create a policy that only allows admins to view the admin_users table
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
CREATE POLICY "Admins can view admin_users"
  ON public.admin_users
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users WHERE active = true
    )
  );

-- Create a policy that only allows super_admins to insert new admins
DROP POLICY IF EXISTS "Super admins can insert admin_users" ON public.admin_users;
CREATE POLICY "Super admins can insert admin_users"
  ON public.admin_users
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users 
      WHERE role = 'super_admin' AND active = true
    )
  );

-- Create a policy that only allows super_admins to update admin records
DROP POLICY IF EXISTS "Super admins can update admin_users" ON public.admin_users;
CREATE POLICY "Super admins can update admin_users"
  ON public.admin_users
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users 
      WHERE role = 'super_admin' AND active = true
    )
  );

-- Create a policy that only allows super_admins to delete admin records
DROP POLICY IF EXISTS "Super admins can delete admin_users" ON public.admin_users;
CREATE POLICY "Super admins can delete admin_users"
  ON public.admin_users
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users 
      WHERE role = 'super_admin' AND active = true
    )
  );
