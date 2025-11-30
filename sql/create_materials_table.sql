-- Create materials table
CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    quality VARCHAR(50),
    supplier VARCHAR(255),
    cost_per_unit DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_materials_cluster_id ON materials(cluster_id);

-- Add RLS policies
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view materials
CREATE POLICY "Allow authenticated users to view materials" ON materials
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow cluster users to insert their own materials
CREATE POLICY "Allow cluster users to insert materials" ON materials
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Allow cluster users to update their own materials
CREATE POLICY "Allow cluster users to update materials" ON materials
    FOR UPDATE
    TO authenticated
    USING (true);

-- Policy: Allow cluster users to delete their own materials
CREATE POLICY "Allow cluster users to delete materials" ON materials
    FOR DELETE
    TO authenticated
    USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
