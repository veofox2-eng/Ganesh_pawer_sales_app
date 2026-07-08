-- ROLE-BASED ACCESS CONTROL (RBAC) SETUP
-- Run this in your Supabase SQL Editor

-- 1. Create Profile Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username TEXT,
  role TEXT DEFAULT 'User' CHECK (role IN ('Admin', 'User')),
  is_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles Policies
-- Helper function to check if a user is an admin without triggering recursion
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

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (is_admin());

-- Admins can update all profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (is_admin());

-- Admin can delete profiles (optional)
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (is_admin());

-- 4. Clients Table Policies Update (Allow Admins to see all clients)
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
CREATE POLICY "Admins can manage all clients" ON public.clients
  FOR ALL USING (is_admin());

-- 5. Interactions Table Policies Update (Allow Admins to see all interactions)
DROP POLICY IF EXISTS "Admins can view all interactions" ON public.interactions;
CREATE POLICY "Admins can view all interactions" ON public.interactions
  FOR SELECT USING (is_admin());

-- 6. Trigger for Profile Creation on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, is_enabled)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'username', 
    COALESCE(NEW.raw_user_meta_data->>'role', 'User'), 
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. INITIAL ADMIN SETUP
-- Replace 'your-email@example.com' with your actual email to make yourself an Admin
-- UPDATE public.profiles SET role = 'Admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
