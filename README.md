# Alibhai Points

A React Native mobile application built with Expo.

## Project Structure

```
alibhai-points/
├── apps/
│   ├── mobile/          # React Native frontend app
│   └── api/             # TypeScript + Express API
└── package.json
```

## Getting Started

### Prerequisites
- Node.js
- npm or yarn

### Installation

```bash
# Install dependencies
cd apps/mobile
npm install
```

### Running the App

```bash
# Start the development server
npm start

# Or from the root
npm run mobile:start

# Run on Android
npm run mobile:android

# Run on iOS
npm run mobile:ios

# Run on Web
npm run mobile:web
```

## Tech Stack

- React Native
- Expo
- Expo Router (file-based routing)
- TypeScript
- TanStack Query
- React Hook Form

## Backend API

The Express API is in `apps/api`. Run it locally with `npm run api:dev`, build
with `npm run api:build`, and run its tests with `npm run api:test`.

For Vercel project settings, required environment variables, and production
smoke-test commands, see [apps/api/DEPLOYMENT_CHECKLIST.md](./apps/api/DEPLOYMENT_CHECKLIST.md).
The daily expiry job is scheduled by Supabase `pg_cron`; see
[apps/api/PG_CRON_CONFIGURATION.md](./apps/api/PG_CRON_CONFIGURATION.md).

## License

MIT
