-- FIELD EMPLOYEE & LOCATION TRACKING SCHEMA UPDATE

-- 1. Updates to Profiles Table (Roles & Approvals)
-- Drop the existing role constraint to allow new roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- Add constraint back with 'Field' and 'Pending' included
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('Admin', 'User', 'Field', 'Pending'));

-- Add Approval Status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'Pending' CHECK (approval_status IN ('Pending', 'Approved', 'Rejected'));

-- Fix the auth trigger to set approval_status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, is_enabled, approval_status)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'username', 
    COALESCE(NEW.raw_user_meta_data->>'role', 'Pending'), -- Default new signups to Pending role or User
    TRUE,
    'Pending' -- Newly registered users MUST be approved by Admin
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Updates to Clients Table (Hot/Warm/Cold, Addresses, Map Pins)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lead_type TEXT DEFAULT 'Cold' CHECK (lead_type IN ('Hot', 'Warm', 'Cold'));
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
-- For Warm recurring reminders (e.g., 'daily', 'weekly', '3_days')
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS reminder_recurrence TEXT;


-- 3. Create Employee Locations Table for Real-Time Background Tracking
CREATE TABLE IF NOT EXISTS public.employee_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_employee_locations_user_id ON public.employee_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_locations_updated_at ON public.employee_locations(updated_at);

-- Enable RLS for locations
ALTER TABLE public.employee_locations ENABLE ROW LEVEL SECURITY;

-- Field Employees can insert/update their own locations
CREATE POLICY "Users can insert their own locations" ON public.employee_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own locations" ON public.employee_locations
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all employee locations
CREATE POLICY "Admins can view all locations" ON public.employee_locations
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin'
  );

-- Function to clean up old locations (optional, e.g., run via cron to delete data older than 30 days)
-- Kept out of schema for now, but the table structure supports it.
