# Veerraaj Foods Mobile App

React Native (Expo Router) auth app with:

- Login screen
- Register screen
- Forgot password screen

## Run the app

```bash
npm install
npx expo start
```

## Backend API base URL

Set API base URL in `.env` using your backend machine LAN IP (manual):

```bash
EXPO_PUBLIC_API_URL=http://192.168.29.57:5000
```

## Auth endpoints used

Login tries:

- `/api/auth/login`
- `/auth/login`
- `/api/login`

Register tries:

- `/api/auth/register`
- `/auth/register`
- `/api/register`

Forgot password tries:

- `/api/auth/forgot-password`
- `/auth/forgot-password`
- `/api/forgot-password`
