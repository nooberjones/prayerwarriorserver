const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
let firebaseAdmin = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin SDK initialized');
  } catch (error) {
    console.warn('⚠️ Firebase Admin SDK initialization failed:', error.message);
    console.log('📱 Push notifications will be disabled');
  }
} else {
  console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not found in environment variables');
  console.log('📱 Push notifications will be disabled');
}

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Trust proxy for rate limiting (required for Render deployment)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0-device-id-support'
  });
});

// Initialize database (create tables and insert data)
app.post('/api/init-database', async (req, res) => {
  try {
    // Create prayer_topics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prayer_topics (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        parent_id INTEGER REFERENCES prayer_topics(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create prayer_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prayer_requests (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER NOT NULL REFERENCES prayer_topics(id),
        device_id VARCHAR(255),
        description TEXT,
        prayer_count INTEGER DEFAULT 0,
        active_prayers INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    // Create device_prayers table to track which devices are praying for which requests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_prayers (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        prayer_request_id INTEGER NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        UNIQUE(device_id, prayer_request_id)
      )
    `);

    // Create devices table to store push tokens for notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        push_token TEXT,
        platform VARCHAR(20) NOT NULL,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert prayer topics data
    await pool.query(`
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
      ON CONFLICT (id) DO NOTHING
    `);

    // Update sequence to avoid conflicts
    await pool.query(`
      SELECT setval('prayer_topics_id_seq', (SELECT MAX(id) FROM prayer_topics))
    `);

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_requests_expires_at ON prayer_requests(expires_at)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_requests_topic_id ON prayer_requests(topic_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_requests_device_id ON prayer_requests(device_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_topics_parent_id ON prayer_topics(parent_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_device_prayers_device_id ON device_prayers(device_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_device_prayers_request_id ON device_prayers(prayer_request_id)
    `);

    res.status(200).json({ 
      success: true, 
      message: 'Database initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error initializing database:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initialize database',
      details: err.message 
    });
  }
});

// Migrate existing database to support device IDs
app.post('/api/migrate-database', async (req, res) => {
  try {
    // Add device_id and description columns to existing prayer_requests table
    await pool.query(`
      ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS device_id VARCHAR(255)
    `);
    
    await pool.query(`
      ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS description TEXT
    `);

    // Create device_prayers table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_prayers (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        prayer_request_id INTEGER NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        UNIQUE(device_id, prayer_request_id)
      )
    `);

    // Create devices table for push notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        push_token TEXT,
        platform VARCHAR(20) NOT NULL,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create new indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_prayer_requests_device_id ON prayer_requests(device_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_device_prayers_device_id ON device_prayers(device_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_device_prayers_request_id ON device_prayers(prayer_request_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_last_active ON devices(last_active)
    `);

    res.status(200).json({ 
      success: true, 
      message: 'Database migration completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error migrating database:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to migrate database',
      details: err.message 
    });
  }
});

// Get all prayer topics with categories
app.get('/api/prayer-topics', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pt.id,
        pt.title,
        pt.category,
        pt.parent_id,
        CASE WHEN pt.parent_id IS NULL THEN pt.title ELSE p.title END as main_category
      FROM prayer_topics pt
      LEFT JOIN prayer_topics p ON pt.parent_id = p.id
      ORDER BY 
        CASE WHEN pt.parent_id IS NULL THEN pt.id ELSE pt.parent_id END,
        pt.parent_id IS NULL DESC,
        pt.id
    `);
    
    // Group by main categories
    const categorized = {};
    result.rows.forEach(topic => {
      const mainCat = topic.main_category;
      if (!categorized[mainCat]) {
        categorized[mainCat] = {
          id: topic.parent_id || topic.id,
          title: mainCat,
          subcategories: []
        };
      }
      
      if (topic.parent_id) {
        categorized[mainCat].subcategories.push({
          id: topic.id,
          title: topic.title
        });
      }
    });
    
    res.json(Object.values(categorized));
  } catch (err) {
    console.error('Error fetching prayer topics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit a prayer request
app.post('/api/prayer-requests', async (req, res) => {
  const { topic_id, topicId, description, device_id } = req.body;
  
  // Support both naming conventions
  const finalTopicId = topic_id || topicId;
  
  if (!finalTopicId) {
    return res.status(400).json({ error: 'Topic ID is required' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO prayer_requests (topic_id, device_id, description, created_at, expires_at) VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL \'24 hours\') RETURNING *',
      [finalTopicId, device_id, description]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating prayer request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active prayer requests
app.get('/api/prayer-requests', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pr.id,
        pr.topic_id,
        pr.device_id,
        pr.description,
        pr.prayer_count,
        pr.active_prayers,
        pr.created_at,
        pr.expires_at,
        pt.title as topic_title,
        pt.category,
        CASE WHEN pt.parent_id IS NULL THEN pt.title ELSE p.title END as main_category
      FROM prayer_requests pr
      JOIN prayer_topics pt ON pr.topic_id = pt.id
      LEFT JOIN prayer_topics p ON pt.parent_id = p.id
      WHERE pr.expires_at > NOW()
      ORDER BY pr.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching prayer requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start praying for a request (join prayer)
app.post('/api/prayer-requests/:id/join', async (req, res) => {
  const { id } = req.params;
  const { device_id } = req.body;
  
  if (!device_id) {
    return res.status(400).json({ error: 'Device ID is required' });
  }
  
  try {
    // Check if prayer request exists and is not expired
    const prayerResult = await pool.query(
      'SELECT * FROM prayer_requests WHERE id = $1 AND expires_at > NOW()',
      [id]
    );
    
    if (prayerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prayer request not found or expired' });
    }
    
    // Check if device has already joined this prayer
    const existingJoin = await pool.query(
      'SELECT * FROM device_prayers WHERE device_id = $1 AND prayer_request_id = $2',
      [device_id, id]
    );
    
    // Only increment prayer_count if this is a new join (device hasn't joined before)
    if (existingJoin.rows.length === 0) {
      // Add device to prayer tracking
      await pool.query(
        'INSERT INTO device_prayers (device_id, prayer_request_id) VALUES ($1, $2)',
        [device_id, id]
      );
      
      // Increment prayer_count only for new joins
      const result = await pool.query(
        'UPDATE prayer_requests SET prayer_count = prayer_count + 1 WHERE id = $1 RETURNING *',
        [id]
      );
      
      res.json(result.rows[0]);
    } else {
      // Device already joined - just return current state without incrementing
      const result = await pool.query(
        'SELECT * FROM prayer_requests WHERE id = $1',
        [id]
      );
      
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error joining prayer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start actively praying (increment active_prayers when holding button)
app.post('/api/prayer-requests/:id/start-praying', async (req, res) => {
  const { id } = req.params;
  const { device_id } = req.body;
  
  if (!device_id) {
    return res.status(400).json({ error: 'Device ID is required' });
  }
  
  try {
    // Just increment active_prayers when user starts holding the button
    // Don't auto-join here - let the frontend handle joining explicitly
    const result = await pool.query(
      'UPDATE prayer_requests SET active_prayers = active_prayers + 1 WHERE id = $1 AND expires_at > NOW() RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prayer request not found or expired' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error starting active prayer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy endpoint for backward compatibility
app.post('/api/prayer-requests/:id/pray', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'UPDATE prayer_requests SET prayer_count = prayer_count + 1, active_prayers = active_prayers + 1 WHERE id = $1 AND expires_at > NOW() RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prayer request not found or expired' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating prayer count:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stop praying for a request
app.post('/api/prayer-requests/:id/stop-praying', async (req, res) => {
  const { id } = req.params;
  const { device_id } = req.body;
  
  if (!device_id) {
    return res.status(400).json({ error: 'Device ID is required' });
  }
  
  try {
    // Just decrement active_prayers when user releases the button
    // Don't auto-join here - let the frontend handle joining explicitly
    const result = await pool.query(
      'UPDATE prayer_requests SET active_prayers = GREATEST(active_prayers - 1, 0) WHERE id = $1 AND expires_at > NOW() RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prayer request not found or expired' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error stopping active prayer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete prayer (remove from user's list)
app.post('/api/prayer-requests/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { device_id } = req.body;
  
  if (!device_id) {
    return res.status(400).json({ error: 'Device ID is required' });
  }
  
  try {
    // Mark prayer as completed for this device
    const devicePrayerResult = await pool.query(
      'UPDATE device_prayers SET completed_at = NOW() WHERE device_id = $1 AND prayer_request_id = $2 AND completed_at IS NULL RETURNING *',
      [device_id, id]
    );
    
    if (devicePrayerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prayer not found for this device or already completed' });
    }
    
    // Decrease active prayers count
    await pool.query(
      'UPDATE prayer_requests SET active_prayers = GREATEST(active_prayers - 1, 0) WHERE id = $1',
      [id]
    );
    
    res.json({ message: 'Prayer completed successfully' });
  } catch (err) {
    console.error('Error completing prayer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy endpoint - Delete method for backward compatibility
app.delete('/api/prayer-requests/:id/complete', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'UPDATE prayer_requests SET active_prayers = GREATEST(active_prayers - 1, 0) WHERE id = $1 AND expires_at > NOW() RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prayer request not found or expired' });
    }
    
    res.json({ message: 'Prayer completed successfully' });
  } catch (err) {
    console.error('Error completing prayer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get prayer statistics
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(prayer_count), 0) as total_prayers,
        COALESCE(SUM(active_prayers), 0) as active_prayers,
        COALESCE(COUNT(CASE WHEN dp.completed_at IS NOT NULL THEN 1 END), 0) as completed_prayers
      FROM prayer_requests pr
      LEFT JOIN device_prayers dp ON pr.id = dp.prayer_request_id
      WHERE pr.expires_at > NOW()
    `);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching prayer stats:', err);
    res.status(500).json({ 
      total_prayers: 0,
      active_prayers: 0,
      completed_prayers: 0 
    });
  }
});

// Get prayers for a specific device
app.get('/api/device/:deviceId/prayers', async (req, res) => {
  const { deviceId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        pr.id,
        pr.topic_id,
        pr.description,
        pr.prayer_count,
        pr.active_prayers,
        pr.created_at,
        pr.expires_at,
        pt.title as topic_title,
        pt.category,
        CASE WHEN pt.parent_id IS NULL THEN pt.title ELSE p.title END as main_category,
        dp.joined_at,
        dp.completed_at
      FROM device_prayers dp
      JOIN prayer_requests pr ON dp.prayer_request_id = pr.id
      JOIN prayer_topics pt ON pr.topic_id = pt.id
      LEFT JOIN prayer_topics p ON pt.parent_id = p.id
      WHERE dp.device_id = $1 AND pr.expires_at > NOW()
      ORDER BY dp.joined_at DESC
    `, [deviceId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching device prayers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cleanup expired requests (run periodically)
app.delete('/api/cleanup-expired', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM prayer_requests WHERE expires_at <= NOW()');
    res.json({ message: `Cleaned up ${result.rowCount} expired requests` });
  } catch (err) {
    console.error('Error cleaning up expired requests:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset all active_prayers counts to zero (for debugging)
app.post('/api/reset-active-prayers', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE prayer_requests SET active_prayers = 0 RETURNING *'
    );
    
    res.json({
      success: true,
      message: 'All active_prayers counts reset to zero',
      updated_count: result.rows.length
    });
  } catch (err) {
    console.error('Error resetting active prayers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== PUSH NOTIFICATION ENDPOINTS ==========

// Register device for push notifications
app.post('/api/register-device', async (req, res) => {
  const { device_id, push_token, platform } = req.body;
  
  if (!device_id || !platform) {
    return res.status(400).json({ error: 'Device ID and platform are required' });
  }
  
  try {
    // Upsert device record
    const result = await pool.query(`
      INSERT INTO devices (device_id, push_token, platform, last_active) 
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (device_id) 
      DO UPDATE SET 
        push_token = $2,
        platform = $3,
        last_active = NOW()
      RETURNING *
    `, [device_id, push_token, platform]);
    
    console.log(`📱 Device registered: ${device_id} (${platform})`);
    res.json({ 
      success: true, 
      message: 'Device registered successfully',
      device: result.rows[0]
    });
  } catch (err) {
    console.error('Error registering device:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send push notification to specific device
async function sendPushNotification(pushToken, platform, title, body, data = {}) {
  if (!firebaseAdmin) {
    console.warn('⚠️ Firebase Admin not initialized, skipping push notification');
    return false;
  }
  
  try {
    const message = {
      token: pushToken,
      notification: {
        title: title,
        body: body,
      },
      data: {
        ...data,
        // Convert all data values to strings (FCM requirement)
        timestamp: new Date().toISOString(),
      },
      // Platform-specific configurations
      android: {
        notification: {
          channelId: 'prayer-warriors-default',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };
    
    const response = await firebaseAdmin.messaging().send(message);
    console.log(`✅ Push notification sent successfully: ${response}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending push notification:', error.message);
    return false;
  }
}

// Send prayer request to all devices
app.post('/api/send-prayer-request', async (req, res) => {
  const { requesterName, prayerText, requesterDeviceId } = req.body;
  
  if (!requesterName || !prayerText) {
    return res.status(400).json({ error: 'Requester name and prayer text are required' });
  }
  
  try {
    // Get all active devices (excluding the requester's device)
    let query = 'SELECT device_id, push_token, platform FROM devices WHERE push_token IS NOT NULL';
    let params = [];
    
    if (requesterDeviceId) {
      query += ' AND device_id != $1';
      params = [requesterDeviceId];
    }
    
    const devicesResult = await pool.query(query, params);
    const devices = devicesResult.rows;
    
    console.log(`📤 Sending prayer request to ${devices.length} devices`);
    
    // Send push notifications to all devices
    const notificationPromises = devices.map(device => {
      const title = '🙏 New Prayer Request';
      const body = `${requesterName} is asking for prayer: ${prayerText.substring(0, 80)}${prayerText.length > 80 ? '...' : ''}`;
      
      return sendPushNotification(
        device.push_token,
        device.platform,
        title,
        body,
        {
          type: 'prayer_request',
          requesterName: requesterName,
          prayerText: prayerText,
        }
      );
    });
    
    // Wait for all notifications to be sent
    const results = await Promise.allSettled(notificationPromises);
    const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    console.log(`✅ Prayer request notifications sent: ${successCount}/${devices.length} successful`);
    
    res.json({
      success: true,
      message: 'Prayer request sent to all devices',
      devices_notified: devices.length,
      successful_notifications: successCount
    });
  } catch (err) {
    console.error('Error sending prayer request:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send prayer joined notification to request creator
app.post('/api/send-prayer-joined', async (req, res) => {
  const { prayer_request_id, joiner_device_id } = req.body;
  
  if (!prayer_request_id) {
    return res.status(400).json({ error: 'Prayer request ID is required' });
  }
  
  try {
    // Get prayer request details and creator's device info
    const requestResult = await pool.query(`
      SELECT pr.*, d.push_token, d.platform 
      FROM prayer_requests pr
      LEFT JOIN devices d ON pr.device_id = d.device_id
      WHERE pr.id = $1 AND pr.device_id IS NOT NULL
    `, [prayer_request_id]);
    
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prayer request not found or no device info' });
    }
    
    const prayerRequest = requestResult.rows[0];
    
    // Don't send notification if no push token
    if (!prayerRequest.push_token) {
      return res.json({ 
        success: true, 
        message: 'No push token available for prayer creator' 
      });
    }
    
    // Don't send notification to the same device that joined
    if (prayerRequest.device_id === joiner_device_id) {
      return res.json({ 
        success: true, 
        message: 'Not sending notification to same device' 
      });
    }
    
    const title = '❤️ Someone Joined Your Prayer';
    const body = `${prayerRequest.prayer_count} ${prayerRequest.prayer_count === 1 ? 'person is' : 'people are'} now praying with you!`;
    
    const success = await sendPushNotification(
      prayerRequest.push_token,
      prayerRequest.platform,
      title,
      body,
      {
        type: 'prayer_joined',
        prayer_request_id: prayer_request_id.toString(),
        prayer_count: prayerRequest.prayer_count.toString(),
      }
    );
    
    if (success) {
      console.log(`✅ Prayer joined notification sent to ${prayerRequest.device_id}`);
    }
    
    res.json({
      success: success,
      message: success ? 'Prayer joined notification sent' : 'Failed to send notification'
    });
  } catch (err) {
    console.error('Error sending prayer joined notification:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send daily prayer reminder to all devices
app.post('/api/send-daily-reminder', async (req, res) => {
  try {
    const devicesResult = await pool.query(
      'SELECT device_id, push_token, platform FROM devices WHERE push_token IS NOT NULL'
    );
    const devices = devicesResult.rows;
    
    console.log(`📤 Sending daily reminder to ${devices.length} devices`);
    
    const title = '🕐 Daily Prayer Time';
    const body = 'Take a moment to connect with God and pray for others in your community.';
    
    const notificationPromises = devices.map(device => 
      sendPushNotification(
        device.push_token,
        device.platform,
        title,
        body,
        {
          type: 'daily_reminder',
        }
      )
    );
    
    const results = await Promise.allSettled(notificationPromises);
    const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    console.log(`✅ Daily reminder notifications sent: ${successCount}/${devices.length} successful`);
    
    res.json({
      success: true,
      message: 'Daily reminder sent to all devices',
      devices_notified: devices.length,
      successful_notifications: successCount
    });
  } catch (err) {
    console.error('Error sending daily reminder:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all registered devices (for debugging)
app.get('/api/devices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT device_id, platform, last_active, created_at,
             CASE WHEN push_token IS NOT NULL THEN 'yes' ELSE 'no' END as has_push_token
      FROM devices 
      ORDER BY last_active DESC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching devices:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get device info for diagnostics
app.get('/api/device/:deviceId/info', async (req, res) => {
  const { deviceId } = req.params;
  
  try {
    // Get device registration info
    const deviceResult = await pool.query(
      'SELECT * FROM devices WHERE device_id = $1',
      [deviceId]
    );
    
    // Get prayer stats for this device
    const prayerStats = await pool.query(`
      SELECT 
        COUNT(*) as joined_prayers,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_prayers,
        COUNT(CASE WHEN completed_at IS NULL THEN 1 END) as active_prayers
      FROM device_prayers 
      WHERE device_id = $1
    `, [deviceId]);
    
    // Get recent prayer activity
    const recentActivity = await pool.query(`
      SELECT 
        pr.id as prayer_id,
        pr.description,
        pt.title as topic_title,
        dp.joined_at,
        dp.completed_at
      FROM device_prayers dp
      JOIN prayer_requests pr ON dp.prayer_request_id = pr.id
      JOIN prayer_topics pt ON pr.topic_id = pt.id
      WHERE dp.device_id = $1
      ORDER BY dp.joined_at DESC
      LIMIT 5
    `, [deviceId]);
    
    const device = deviceResult.rows[0];
    const stats = prayerStats.rows[0];
    
    const deviceInfo = {
      device_id: deviceId,
      registered: device ? true : false,
      registration_info: device || null,
      prayer_stats: {
        total_joined_prayers: parseInt(stats.joined_prayers) || 0,
        completed_prayers: parseInt(stats.completed_prayers) || 0,
        currently_active_prayers: parseInt(stats.active_prayers) || 0,
      },
      recent_activity: recentActivity.rows,
      push_notification_ready: device && device.push_token ? true : false,
      firebase_admin_available: firebaseAdmin ? true : false,
    };
    
    console.log(`📋 Device info requested for: ${deviceId}`);
    res.json(deviceInfo);
  } catch (err) {
    console.error('Error fetching device info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send test notification to specific device
app.post('/api/send-test-notification', async (req, res) => {
  const { device_id, title, body, data } = req.body;
  
  if (!device_id) {
    return res.status(400).json({ error: 'Device ID is required' });
  }
  
  try {
    // Get device info
    const deviceResult = await pool.query(
      'SELECT push_token, platform FROM devices WHERE device_id = $1',
      [device_id]
    );
    
    if (deviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const device = deviceResult.rows[0];
    
    if (!device.push_token) {
      return res.status(400).json({ error: 'Device has no push token registered' });
    }
    
    if (!firebaseAdmin) {
      return res.status(503).json({ error: 'Firebase Admin SDK not available' });
    }
    
    const testTitle = title || '🧪 Test Notification';
    const testBody = body || 'This is a test notification from Prayer Warriors app!';
    const testData = data || { type: 'test', test_timestamp: new Date().toISOString() };
    
    const success = await sendPushNotification(
      device.push_token,
      device.platform,
      testTitle,
      testBody,
      testData
    );
    
    console.log(`🧪 Test notification sent to ${device_id}: ${success ? 'success' : 'failed'}`);
    
    res.json({
      success: success,
      message: success ? 'Test notification sent successfully' : 'Failed to send test notification',
      device_id: device_id,
      platform: device.platform,
      notification: {
        title: testTitle,
        body: testBody,
        data: testData
      }
    });
  } catch (err) {
    console.error('Error sending test notification:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Prayer Warrior API server running on port ${PORT}`);
});

module.exports = app;
