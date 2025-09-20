<<<<<<< HEAD
This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
=======
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
>>>>>>> f17795eaa4a2461ddf2370617b562422a87dec29
