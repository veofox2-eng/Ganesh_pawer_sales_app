-- Add toggle fields to the existing tenant_config table
ALTER TABLE public.tenant_config 
ADD COLUMN IF NOT EXISTS admin_app_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS employee_app_active BOOLEAN DEFAULT false;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
