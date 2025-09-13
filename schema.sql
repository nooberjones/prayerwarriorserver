-- Create prayer_topics table
CREATE TABLE IF NOT EXISTS prayer_topics (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES prayer_topics(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create prayer_requests table
CREATE TABLE IF NOT EXISTS prayer_requests (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES prayer_topics(id),
    device_id VARCHAR(255),
    description TEXT,
    prayer_count INTEGER DEFAULT 0,
    active_prayers INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- Create device_prayers table to track which devices are praying for which requests
CREATE TABLE IF NOT EXISTS device_prayers (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    prayer_request_id INTEGER NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(device_id, prayer_request_id)
);

-- Insert prayer topics data
INSERT INTO prayer_topics (id, title, category, parent_id) VALUES
    (1, 'Job', 'main', NULL),
    (16, 'I just lost my job', 'job', 1),
    (17, 'I need a job', 'job', 1),
    (2, 'Finances', 'main', NULL),
    (18, 'Budget Help', 'Finances', 2),
    (19, 'Work - Raise', 'Finances', 2),
    (3, 'Spouse', 'main', NULL),
    (4, 'Spouse - Infidelity', 'spouse', 3),
    (5, 'Spouse - Divorce', 'spouse', 3),
    (6, 'Spouse - Death', 'spouse', 3),
    (7, 'Children', 'main', NULL),
    (8, 'Children - Defiance', 'children', 7),
    (9, 'Children - School', 'children', 7),
    (10, 'Health', 'main', NULL),
    (11, 'Health - Spouse', 'health', 10),
    (12, 'Health - Friend', 'health', 10),
    (13, 'Health - Parent', 'health', 10),
    (14, 'Health - Child', 'health', 10),
    (20, 'Pregnancy', 'health', 10),
    (15, 'Other - God will know', 'main', NULL)
ON CONFLICT (id) DO NOTHING;

-- Update sequence to avoid conflicts
SELECT setval('prayer_topics_id_seq', (SELECT MAX(id) FROM prayer_topics));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prayer_requests_expires_at ON prayer_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_topic_id ON prayer_requests(topic_id);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_device_id ON prayer_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_prayer_topics_parent_id ON prayer_topics(parent_id);
CREATE INDEX IF NOT EXISTS idx_device_prayers_device_id ON device_prayers(device_id);
CREATE INDEX IF NOT EXISTS idx_device_prayers_request_id ON device_prayers(prayer_request_id);
