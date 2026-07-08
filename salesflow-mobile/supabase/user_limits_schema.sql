-- 1. Create Tenant Config Table for User Limits
CREATE TABLE IF NOT EXISTS public.tenant_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_admin INT DEFAULT 99,
  max_user INT DEFAULT 99,
  max_field INT DEFAULT 99,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Insert default values if the table is empty
INSERT INTO public.tenant_config (id, max_admin, max_user, max_field) 
VALUES (1, 99, 99, 99) 
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.tenant_config ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (needed for pre-signup checks)
DROP POLICY IF EXISTS "Anyone can view tenant config" ON public.tenant_config;
CREATE POLICY "Anyone can view tenant config" ON public.tenant_config FOR SELECT USING (true);

-- Allow admins to update
DROP POLICY IF EXISTS "Admins can update tenant config" ON public.tenant_config;
CREATE POLICY "Admins can update tenant config" ON public.tenant_config FOR UPDATE USING (is_admin());

-- 2. Create Security Definer function to check limits
CREATE OR REPLACE FUNCTION public.check_role_limit(target_role text)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INT;
  max_limit INT;
BEGIN
  -- Count active users of the target role
  SELECT count(*) INTO current_count FROM public.profiles WHERE role = target_role;
  
  -- Determine limit based on role
  IF target_role = 'Admin' THEN
    SELECT max_admin INTO max_limit FROM public.tenant_config WHERE id = 1;
  ELSIF target_role = 'User' THEN
    SELECT max_user INTO max_limit FROM public.tenant_config WHERE id = 1;
  ELSIF target_role = 'Field' THEN
    SELECT max_field INTO max_limit FROM public.tenant_config WHERE id = 1;
  ELSE
    RETURN TRUE; -- SuperAdmin bypass or other unknown roles
  END IF;
  
  IF current_count >= max_limit THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
