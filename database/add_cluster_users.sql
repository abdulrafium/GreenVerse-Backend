-- Migration: Add cluster_id column to users table
-- Run this ONCE in Supabase SQL Editor before creating clusters via admin panel

-- Add cluster_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES clusters(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_cluster_id ON users(cluster_id);

-- That's it! Now you can create clusters via the Admin Dashboard.
-- The system will automatically:
-- 1. Create the cluster in the clusters table
-- 2. Create a user account with role='cluster' and the cluster_id
-- 3. Hash the password securely
-- 4. Link the user as the cluster manager
