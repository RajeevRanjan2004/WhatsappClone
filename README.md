# MERN WhatsApp Clone

WhatsApp-style chat app with:

- Vite web client
- Express + MongoDB Atlas backend
- React Native Expo mobile client

## What is included

- JWT authentication with register/login
- Forgot password with email OTP
- MongoDB Atlas-ready Express API
- Real-time chat using Socket.IO
- Conversation sidebar, contact search, and online indicators
- Mobile-first React UI designed for Android screens
- Vite frontend and clean workspace scripts

## Project structure

```text
.
|-- client
|-- mobile
|-- server
|-- package.json
```

## 1. Configure MongoDB Atlas

Create a MongoDB Atlas cluster and copy your connection string.

Example:

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/whatsapp-clone?retryWrites=true&w=majority&appName=Cluster0
```

## 2. Add environment files

Copy the examples and update them:

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Set your values:

- `server/.env`
  - `MONGO_URI`
  - `JWT_SECRET`
  - `CLIENT_URL`
  - `MAIL_FROM`
  - `SMTP_HOST` or `SMTP_SERVICE`
  - `SMTP_PORT`
  - `SMTP_SECURE`
  - `SMTP_USER`
  - `SMTP_PASS`
- `client/.env`
  - `VITE_API_URL`
  - `VITE_SOCKET_URL`

## 3. Install dependencies

```powershell
npm install
```

## 4. Run the app

```powershell
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## 5. React Native mobile app

The repo now includes a React Native app in `mobile/` that reuses the same backend, auth, chats, settings, status feed, and realtime socket sync.

### Install mobile dependencies

```powershell
cd mobile
npm install
```

### Add mobile env

```powershell
Copy-Item .env.example .env
```

Set:

```env
EXPO_PUBLIC_API_URL=http://<YOUR_BACKEND_HOST>:5000/api
EXPO_PUBLIC_SOCKET_URL=http://<YOUR_BACKEND_HOST>:5000
```

### Start Expo

```powershell
cd ..
npm run mobile
```

Or directly:

```powershell
cd mobile
npm start
```

### Run on Android

1. For chat-only testing, install Expo Go on Android.
2. For real audio/video calling, install a built APK or use an Expo development build.
3. Start Expo with `npm run mobile` only when using Expo Go or a dev client.
4. Make sure the backend URL in `mobile/.env` is reachable from the phone.

### Android URL notes

- Same Wi-Fi device testing:
  - `EXPO_PUBLIC_API_URL=http://<YOUR_LAPTOP_IP>:5000/api`
  - `EXPO_PUBLIC_SOCKET_URL=http://<YOUR_LAPTOP_IP>:5000`
- Android emulator:
  - `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api`
  - `EXPO_PUBLIC_SOCKET_URL=http://10.0.2.2:5000`
- Different networks / mobile data:
  - use public HTTPS backend URL or tunnel URL
  - for reliable calling, also set TURN values in `mobile/.env`:
    - `EXPO_PUBLIC_STUN_URLS=stun:stun.l.google.com:19302`
    - `EXPO_PUBLIC_TURN_URLS=turn:your-turn-host:3478`
    - `EXPO_PUBLIC_TURN_USERNAME=your-turn-username`
    - `EXPO_PUBLIC_TURN_CREDENTIAL=your-turn-password`

### Current React Native feature set

- Login / sign up
- Forgot password with email OTP
- Realtime chat list and direct messaging
- Long-press message actions: copy, share, delete for me, delete for everyone
- Status list from backend stories
- Settings: profile edit, theme toggle, password change, blocked users
- Direct audio/video call flow with WebRTC signaling
- Incoming call receive / decline
- Active call controls: mute, video on/off, end call

### Current React Native call notes

- Real calling is available in APK/development builds that include native WebRTC.
- Expo Go does not include `react-native-webrtc`, so call buttons need a built app, not plain Expo Go.
- Cross-network call reliability is much better with a TURN server configured in `mobile/.env`.

## 6. Make it work without your laptop

For true WhatsApp-like usage, the app must not depend on your local machine. That means:

- backend deployed on a cloud host
- media stored in cloud storage instead of local disk
- Android app installed as a built APK or AAB

This repo is now prepared for that flow.

### Backend deployment

Use the root `render.yaml` file to deploy the Node backend on Render.

Required production env vars:

- `MONGO_URI`
- `MONGO_DIRECT_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `MAIL_FROM`
- `SMTP_HOST` or `SMTP_SERVICE`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER`

### Why Cloudinary is needed

Local `/uploads` works only while your own machine or server disk is available. In production, media should live in cloud storage.

This backend now supports:

- local uploads in development
- Cloudinary uploads in production

If Cloudinary env vars are set, avatars, story media, and chat attachments are uploaded to Cloudinary automatically.

### Android build

Use `mobile/eas.json` for permanent Android builds.

Basic flow:

```powershell
npm install --global eas-cli
cd mobile
eas login
eas build --platform android --profile preview
```

For Play Store release:

```powershell
eas build --platform android --profile production
```

### Mobile production env

For the built Android app, set public backend values in `mobile/.env` or EAS secrets:

```env
EXPO_PUBLIC_API_URL=https://your-api-domain.com/api
EXPO_PUBLIC_SOCKET_URL=https://your-api-domain.com
```

Once the backend is deployed and the APK is built, the app can run from the phone directly even when the laptop is off.

### GitHub automation for production

This repo now includes GitHub Actions for the two repeatable tasks you will need most:

- `.github/workflows/render-deploy.yml`
  - triggers Render backend deploys after pushes to `main`
- `.github/workflows/eas-android-preview.yml`
  - starts a cloud Android preview build from GitHub

Set these GitHub repository values once:

- Repository secret: `RENDER_DEPLOY_HOOK_URL`
- Repository secret: `EXPO_TOKEN`
- Repository variable: `EXPO_PUBLIC_API_URL`
- Repository variable: `EXPO_PUBLIC_SOCKET_URL`

Recommended production flow:

1. Create the Render service from `render.yaml`
2. Copy the Render deploy hook URL into the `RENDER_DEPLOY_HOOK_URL` GitHub secret
3. Put the public backend URL into:
   - `EXPO_PUBLIC_API_URL`
   - `EXPO_PUBLIC_SOCKET_URL`
4. Run the `Build Android Preview` workflow from the GitHub Actions tab

After that, future backend changes can deploy from GitHub and future APK builds can be triggered without keeping the laptop on.

## 7. Use the web app on Android mobile

Keep your laptop and Android phone on the same Wi-Fi network.

1. Find your laptop IPv4 address.
2. In `server/.env`, set `CLIENT_URL` to your laptop IP with port `5173`.
3. In `client/.env`, set:
   - `VITE_API_URL=http://<YOUR_LAPTOP_IP>:5000/api`
   - `VITE_SOCKET_URL=http://<YOUR_LAPTOP_IP>:5000`
4. Run `npm run dev`.
5. Open `http://<YOUR_LAPTOP_IP>:5173` in your Android browser.

Example:

```env
CLIENT_URL=http://192.168.1.25:5173
VITE_API_URL=http://192.168.1.25:5000/api
VITE_SOCKET_URL=http://192.168.1.25:5000
```

For an installable APK later, this project can also be wrapped with Capacitor.

## 8. Use it without the same Wi-Fi

`localhost` or your laptop IP only works inside the same network. To use the app from anywhere, you need public URLs for both frontend and backend.

### Quick testing from anywhere

Expose both apps through public HTTPS tunnels.

1. Start backend and frontend locally.
2. Create one public URL for `http://localhost:5000`.
3. Create one public URL for `http://localhost:5173`.
4. Set:
   - `server/.env`
     - `CLIENT_URL=https://your-frontend-public-url`
   - `client/.env`
     - `VITE_API_URL=https://your-backend-public-url/api`
     - `VITE_SOCKET_URL=https://your-backend-public-url`
5. Restart both apps.
6. Open the frontend public URL on Android using mobile data or any other network.

### Permanent use from anywhere

Deploy:

- frontend to any static hosting
- backend to any Node.js hosting
- MongoDB Atlas stays as the database

Then set:

```env
CLIENT_URL=https://app.yourdomain.com
VITE_API_URL=https://api.yourdomain.com/api
VITE_SOCKET_URL=https://api.yourdomain.com
```

### Important for audio/video calls

If users are on different networks, STUN alone is often not enough. Add a TURN server in `client/.env`:

```env
VITE_STUN_URLS=stun:stun.l.google.com:19302
VITE_TURN_URLS=turn:your-turn-host:3478
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-password
```

Or provide full ICE config:

```env
VITE_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":["turn:your-turn-host:3478"],"username":"your-turn-username","credential":"your-turn-password"}]
```

For camera, microphone, login, Socket.IO, and calling on Android outside the same Wi-Fi, use `https://` URLs instead of plain `http://`.

## 9. Build the client

```powershell
npm run build
```

## API overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `GET /api/users`
- `GET /api/chats`
- `POST /api/chats/direct/:userId`
- `GET /api/chats/:conversationId/messages`
- `POST /api/chats/:conversationId/messages`

## Notes

- This version supports direct one-to-one chat.
- Presence and incoming messages update in real time through Socket.IO.
- For Android packaging later, this frontend is already mobile-first and can be wrapped with Capacitor if you want a Play Store-style APK flow.
