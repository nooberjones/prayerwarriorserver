-- Migration script to update existing database for device ID support
-- Run this against the PostgreSQL database to add new columns and tables

-- Add device_id and description columns to existing prayer_requests table
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS description TEXT;

-- Create device_prayers table if it doesn't exist
CREATE TABLE IF NOT EXISTS device_prayers (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    prayer_request_id INTEGER NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(device_id, prayer_request_id)
);

-- Create new indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prayer_requests_device_id ON prayer_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_device_prayers_device_id ON device_prayers(device_id);
CREATE INDEX IF NOT EXISTS idx_device_prayers_request_id ON device_prayers(prayer_request_id);

-- Display success message
SELECT 'Database migration completed successfully' as result;
