-- Update attendance table status constraint to allow 'Leave' instead of 'Half Day'
-- Run this in your Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- Add new constraint with 'Leave' instead of 'Half Day'
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check 
  CHECK (status IN ('Present', 'Absent', 'Leave'));

-- Optional: Update any existing 'Half Day' records to 'Leave'
UPDATE attendance SET status = 'Leave' WHERE status = 'Half Day';
