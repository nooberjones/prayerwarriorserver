# Push Notifications Setup Guide

## Overview
Your Prayer Warrior app now supports cross-device notifications using:
- **Device IDs**: Anonymous authentication using unique device identifiers
- **Firebase Cloud Messaging (FCM)**: For sending push notifications
- **PostgreSQL Database**: Stores device info and prayer requests
- **Render.com Backend**: Handles notification distribution

## 🏗️ Backend Setup (Your Render Server)

### 1. Install Dependencies
```bash
cd backend
npm install firebase-admin
```

### 2. Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Cloud Messaging** 
4. Go to **Project Settings** > **Service Accounts**
5. Click **Generate New Private Key**
6. Save the JSON file securely

### 3. Environment Variables in Render
Add this environment variable in your Render dashboard:
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}
```
(Paste the entire JSON content as a single line)

### 4. Database Migration
After deploying, call this endpoint once to create the new tables:
```bash
curl -X POST https://your-app.onrender.com/api/migrate-database
```

## 📱 Mobile App Configuration

### 1. Update Server URL
In `src/services/NativeNotificationService.ts`, replace:
```typescript
private serverUrl = 'https://your-render-app-name.onrender.com';
```

### 2. Firebase App Configuration
You'll need to add Firebase config files to your React Native app:

**Android**: `android/app/google-services.json`
**iOS**: `ios/PrayerWarriorApp/GoogleService-Info.plist`

Download these from Firebase Console > Project Settings > Your Apps

## 🚀 How It Works

### Device Registration
- App automatically gets a unique device ID using `react-native-device-info`
- When push token is received, registers device with server
- Server stores: `device_id`, `push_token`, `platform`

### Cross-Device Notifications
1. **Prayer Request**: User creates prayer → server sends to all other devices
2. **Prayer Joined**: User joins prayer → creator gets notified
3. **Daily Reminders**: Server can send to all devices

### Anonymous Authentication
- No user accounts needed
- Each device has a unique ID
- Privacy-friendly approach

## 📡 New API Endpoints

### Device Management
- `POST /api/register-device` - Register device for push notifications
- `GET /api/devices` - List all registered devices (debugging)

### Cross-Device Notifications
- `POST /api/send-prayer-request` - Send prayer request to all devices
- `POST /api/send-prayer-joined` - Notify prayer creator
- `POST /api/send-daily-reminder` - Send daily prayer reminder

## 🔧 Usage Examples

### Send Prayer Request to All Devices
```typescript
// In your React Native app
notificationService.showPrayerRequestNotification(
  "John Doe", 
  "Please pray for healing", 
  true  // sendToAllDevices = true
);
```

### Manual Server Call
```bash
curl -X POST https://your-app.onrender.com/api/send-prayer-request \
  -H "Content-Type: application/json" \
  -d '{
    "requesterName": "John",
    "prayerText": "Please pray for my family"
  }'
```

### Send Daily Reminder to All
```bash
curl -X POST https://your-app.onrender.com/api/send-daily-reminder
```

## 🛠️ Testing

1. **Register Multiple Devices**: Install app on multiple phones/emulators
2. **Test Notifications**: Send prayer request from one device
3. **Check Logs**: Monitor server logs for notification delivery
4. **Database Check**: Query `/api/devices` to see registered devices

## 🔐 Privacy Features

- **No Personal Data**: Only device IDs and prayer content
- **Anonymous**: No usernames or emails required
- **Temporary**: Prayer requests expire after 24 hours
- **Opt-out**: Users can disable notifications anytime

## 📊 Monitoring

- **Device Count**: Check how many devices are registered
- **Notification Success**: Server logs show delivery success rates
- **Active Prayers**: Track real-time prayer engagement

Your prayer app now creates a truly connected community where prayer requests instantly reach all users across all devices! 🙏✨
