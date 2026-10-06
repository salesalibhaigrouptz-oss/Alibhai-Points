# Alibhai Points

A React Native mobile application for loyalty points management.

## Project Structure

```
alibhai-points/
├── apps/
│   ├── mobile/          # React Native frontend app (Expo)
│   └── api/             # Backend API (placeholder - not implemented)
├── README.md
└── package.json
```

## Mobile App Structure

The mobile app follows a standard React Native structure:

```
apps/mobile/
├── app/                 # Expo Router screens and layouts
├── src/
│   ├── components/      # Reusable UI components
│   ├── hooks/          # Custom React hooks
│   ├── navigation/     # Navigation configuration
│   ├── screens/        # Screen components
│   ├── services/       # API services and business logic
│   ├── store/          # State management
│   ├── theme/          # Theme and styling
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── assets/             # Images, fonts, and static assets
├── App.tsx
├── app.json
├── package.json
└── tsconfig.json
```

## Development

### Running the Mobile App

```bash
cd apps/mobile
npm install
npm start
```

### Available Scripts

From root:
- `npm run mobile:start` - Start development server
- `npm run mobile:android` - Run on Android
- `npm run mobile:ios` - Run on iOS
- `npm run mobile:web` - Run on Web

From apps/mobile:
- `npm start` - Start development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on Web
- `npm run typecheck` - Run TypeScript type checking

## Tech Stack

- React Native
- Expo
- Expo Router (file-based routing)
- TypeScript
- TanStack Query
- React Hook Form
