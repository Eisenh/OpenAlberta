-- Enable RLS on the docs table if not already enabled
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows admins to select from the docs table
DROP POLICY IF EXISTS "Admins can view docs" ON public.docs;
CREATE POLICY "Admins can view docs"
  ON public.docs
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users WHERE active = true
    )
  );

-- Create a policy that allows admins to insert into the docs table
DROP POLICY IF EXISTS "Admins can insert docs" ON public.docs;
CREATE POLICY "Admins can insert docs"
  ON public.docs
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users WHERE active = true
    )
  );

-- Create a policy that allows admins to update the docs table
DROP POLICY IF EXISTS "Admins can update docs" ON public.docs;
CREATE POLICY "Admins can update docs"
  ON public.docs
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users WHERE active = true
    )
  );

-- Create a policy that allows admins to delete from the docs table
DROP POLICY IF EXISTS "Admins can delete docs" ON public.docs;
CREATE POLICY "Admins can delete docs"
  ON public.docs
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users WHERE active = true
    )
  );

-- Add a policy to allow the service role to bypass RLS for the populate script
DROP POLICY IF EXISTS "Service role bypass for docs" ON public.docs;
CREATE POLICY "Service role bypass for docs"
  ON public.docs
  USING (auth.jwt() ->> 'role' = 'service_role');
