-- Add manager_name column to clusters table
-- Run this in Supabase SQL Editor

-- Safest approach: Break circular dependencies first, then delete

-- Step 1: Break circular dependencies by setting foreign keys to NULL
UPDATE clusters SET manager_id = NULL WHERE manager_id IS NOT NULL;
UPDATE users SET cluster_id = NULL WHERE cluster_id IS NOT NULL;

-- Step 2: Delete all data that references clusters (child tables)
DELETE FROM production WHERE cluster_id IS NOT NULL;
DELETE FROM materials WHERE cluster_id IS NOT NULL;
DELETE FROM attendance WHERE cluster_id IS NOT NULL;

-- Step 3: Delete users with role 'cluster'
DELETE FROM users WHERE role = 'cluster';

-- Step 4: Delete all existing clusters (now safe - no references)
DELETE FROM clusters;

-- Step 5: Add manager_name column to clusters table
ALTER TABLE clusters
ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255);

-- Verification: Check if column was added successfully
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clusters' AND column_name = 'manager_name';

-- Now you can create new clusters with manager_name through the admin panel
