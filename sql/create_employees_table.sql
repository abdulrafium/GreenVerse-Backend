-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  role VARCHAR(100) NOT NULL,
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add employees_count column to clusters if not exists
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS employees_count INTEGER DEFAULT 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_employees_cluster_id ON employees(cluster_id);

-- Update existing clusters to set employees_count to 0 if NULL
UPDATE clusters SET employees_count = 0 WHERE employees_count IS NULL;

-- Verify the table and column were created
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name IN ('employees', 'clusters') 
ORDER BY table_name, ordinal_position;
