-- MASTER SCHEMA RESET FOR SALESFLOW CRM
-- WARNING: This will DELETE all existing data!

-------------------------------------------------------------------------------
-- 1. CLEANUP PHASE: Drop existing tables and logic
-------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

DROP TABLE IF EXISTS public.employee_locations CASCADE;
DROP TABLE IF EXISTS public.interactions CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-------------------------------------------------------------------------------
-- 2. CORE TABLES PHASE
-------------------------------------------------------------------------------

-- PROFILES (RBAC & User Management)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username TEXT,
  role TEXT DEFAULT 'Pending' CHECK (role IN ('Admin', 'User', 'Field', 'Pending')),
  is_enabled BOOLEAN DEFAULT TRUE,
  approval_status TEXT DEFAULT 'Pending' CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- CLIENTS (Leads & CRM)
CREATE TABLE public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  project_name TEXT,
  source TEXT DEFAULT 'Manual',
  status TEXT DEFAULT 'Follow-up' CHECK (status IN ('Follow-up', 'Converted', 'Lost')),
  lead_type TEXT DEFAULT 'Cold' CHECK (lead_type IN ('Hot', 'Warm', 'Cold')),
  address TEXT,
  description TEXT,
  reason_for_contact TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  reminder_date TIMESTAMP WITH TIME ZONE,
  reminder_recurrence TEXT,
  deal_value NUMERIC DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- TASKS (Productivity & Board)
CREATE TABLE public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  description TEXT,
  voice_note_url TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- INTERACTIONS (Activity Logs & Recordings)
CREATE TABLE public.interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'NOTE_ADDED', 'CALL_MADE', 'CALL_RECORDING', 'VOICE_INSTRUCTION', 'ATTACHMENT_ADDED'
  content TEXT,
  media_url TEXT,
  amount NUMERIC,
  author TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- EMPLOYEE LOCATIONS (Live Tracking)
CREATE TABLE public.employee_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-------------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS & TRIGGERS
-------------------------------------------------------------------------------

-- Admin check helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'Admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auth signup trigger handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, is_enabled, approval_status)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'username', 
    COALESCE(NEW.raw_user_meta_data->>'role', 'Pending'), 
    TRUE,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'Admin' THEN 'Approved'
      ELSE 'Pending'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-------------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_locations ENABLE ROW LEVEL SECURITY;

----------------- PROFILES POLICIES -----------------
CREATE POLICY "Profiles: Users see self" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles: Admins see all" ON public.profiles FOR SELECT USING (is_admin());
CREATE POLICY "Profiles: Admins manage" ON public.profiles FOR ALL USING (is_admin());

----------------- CLIENTS POLICIES -----------------
-- Users see their own clients
CREATE POLICY "Clients: Owner access" ON public.clients 
  FOR ALL USING (auth.uid() = user_id);

-- Admins see all clients
CREATE POLICY "Clients: Admin access" ON public.clients 
  FOR ALL USING (is_admin());

----------------- TASKS POLICIES -----------------
CREATE POLICY "Tasks: Owner access" ON public.tasks 
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Tasks: Admin access" ON public.tasks 
  FOR ALL USING (is_admin());

----------------- INTERACTIONS POLICIES -----------------
CREATE POLICY "Interactions: Owner access" ON public.interactions 
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Interactions: Admin access" ON public.interactions 
  FOR ALL USING (is_admin());

----------------- LOCATIONS POLICIES -----------------
CREATE POLICY "Locations: Field insert self" ON public.employee_locations 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Locations: User see self" ON public.employee_locations 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Locations: Admin see all" ON public.employee_locations 
  FOR SELECT USING (is_admin());

-------------------------------------------------------------------------------
-- 5. INITIAL ADMIN SETUP (TEMPLATE)
-------------------------------------------------------------------------------
-- IMPORTANT: After running this script and signing up, run the command below 
-- in the SQL Editor to promote your user to Admin.
--
-- UPDATE public.profiles SET role = 'Admin', approval_status = 'Approved' 
-- WHERE id IN (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@GMAIL.COM');

-- Super Admin Feature Flags
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb;
