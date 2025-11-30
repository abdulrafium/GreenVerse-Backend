-- Fix RLS policies for custom JWT authentication
-- Run this in your Supabase SQL Editor

-- Option 1: Disable RLS on client_profiles (simpler approach)
-- Since we're using backend JWT auth, we handle security at the API layer
ALTER TABLE client_profiles DISABLE ROW LEVEL SECURITY;

-- Option 2 (Alternative): Keep RLS enabled but allow service role access
-- If you want to keep RLS, you need to use the service role key in your backend
-- This is already handled if you use the service role key in supabase.js

-- For order_items, we can disable RLS since backend controls access
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Drop existing policies (if keeping RLS, you'll need different policies)
DROP POLICY IF EXISTS "Users can view own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON client_profiles;
DROP POLICY IF EXISTS "Users can view order items" ON order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;

-- Note: With RLS disabled, your backend API's authenticateToken middleware
-- handles all security checks, which is the correct approach for custom auth
