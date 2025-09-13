# Prayer Warrior API Server

A REST API server for the Prayer Warriors mobile application, supporting anonymous prayer requests and community prayer participation.

## Features

- **Anonymous Prayer System**: Uses device identifiers instead of personal information
- **Prayer Categories**: Hierarchical prayer topics with main categories and subcategories
- **Community Prayer**: Users can join prayers, track participation, and complete prayers
- **Real-time Statistics**: Track total prayers, active prayers, and completed prayers
- **Privacy-First**: No personal data collection, only anonymous device identifiers

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and timestamp.

### Database Initialization
```
POST /api/init-database
```
Initializes database tables and inserts default prayer topics.

### Prayer Topics
```
GET /api/prayer-topics
```
Returns all prayer topics organized by main categories with subcategories.

### Prayer Requests

#### Get Active Prayer Requests
```
GET /api/prayer-requests
```
Returns all active (non-expired) prayer requests.

#### Create Prayer Request
```
POST /api/prayer-requests
Body: {
  "topic_id": number,
  "device_id": string,
  "description": string (optional)
}
```
Creates a new prayer request that expires in 24 hours.

#### Join Prayer
```
POST /api/prayer-requests/:id/join
Body: {
  "device_id": string
}
```
Allows a device to join an existing prayer request.

#### Complete Prayer
```
POST /api/prayer-requests/:id/complete
Body: {
  "device_id": string
}
```
Marks a prayer as completed for a specific device.

### Statistics
```
GET /api/stats
```
Returns overall prayer statistics including total prayers, active prayers, and completed prayers.

### Device-Specific Prayers
```
GET /api/device/:deviceId/prayers
```
Returns all prayers associated with a specific device ID.

### Maintenance
```
DELETE /api/cleanup-expired
```
Removes expired prayer requests from the database.

## Database Schema

### Tables

#### prayer_topics
- Main categories and subcategories for prayer requests
- Hierarchical structure with parent-child relationships

#### prayer_requests
- Individual prayer requests submitted by users
- Includes device_id for anonymous tracking
- Auto-expires after 24 hours

#### device_prayers
- Junction table tracking which devices are praying for which requests
- Supports join/leave functionality
- Tracks completion status

## Privacy & Anonymity

The API is designed with privacy as a core principle:

- **No Personal Data**: Only anonymous device identifiers are stored
- **Device-Based Tracking**: All prayer participation is tracked by device ID
- **Automatic Cleanup**: Prayer requests automatically expire
- **Anonymous Statistics**: Aggregate data without personal identification

## Environment Variables

```
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production|development
PORT=3000
```

## Installation & Deployment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env` file

3. Initialize database:
   ```bash
   curl -X POST https://your-server.com/api/init-database
   ```

4. Start server:
   ```bash
   npm start
   ```

## Database Migration

If upgrading from a previous version, run the database initialization endpoint to add new tables and indexes:

```bash
curl -X POST https://your-server.com/api/init-database
```

This will create new tables and indexes without affecting existing data.

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Cross-origin request handling
- **Helmet Security**: HTTP security headers
- **Input Validation**: Request parameter validation
- **SQL Injection Protection**: Parameterized queries

## Compatibility

This server is compatible with:
- React Native Prayer Warrior app v2.0+
- Anonymous device identifier system
- Google Mobile Ads integration
- iOS and Android platforms
