# Mindroot — Peer Skill Exchange Platform

Mindroot is a real-time peer-to-peer skill exchange platform built with React, TypeScript, Vite, Express, Socket.io, and WebRTC. Users can list skills they teach and skills they want to learn, match with peers based on mutual compatibility, book 1-on-1 learning sessions using a Skill Token economy, conduct live virtual classroom sessions with WebRTC video/audio/whiteboard/code editor, and export sessions directly to `.ics` calendars.

---

## 📚 Documentation

Detailed technical documentation for database schema and API endpoints:

- 🗄️ **[Database Schema Documentation](docs/DATABASE_SCHEMA.md)**: Explains every model in `server/prisma/schema.prisma` in plain English, detailing entity roles and relationships.
- 🔌 **[API Reference Documentation](docs/API.md)**: A complete reference table of every HTTP route in `server/src/index.ts` grouped by Auth, Users, Sessions, Messages, Reviews, and Stats (including the `.ics` calendar export endpoint).

---

## 🔑 Google Sign-In Setup (Optional)

Mindroot supports single sign-on with Google accounts using official Google OAuth 2.0 ID tokens. Setting up a Google OAuth Client ID is **100% free** and requires no billing.

### Setup Instructions
1. Go to the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Create a new project (or select an existing one) and create an **OAuth 2.0 Client ID** (Web application).
3. Add `http://localhost:5173` to **Authorized JavaScript origins**.
4. Copy your generated Client ID and add it to your `.env` file:
   ```env
   VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
   ```
> **Note**: Google Sign-In is optional. If these environment variables are left unset, the platform will hide the Google button and seamlessly function with standard email and password authentication.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion, Socket.io Client, WebRTC P2P, `@react-oauth/google`
- **Backend**: Express.js, TypeScript, Socket.io (Signaling & Network Sync), Prisma ORM, `google-auth-library`
- **Real-time Sync**: Multi-device & multi-laptop synchronization powered by Socket.io and BroadcastChannel APIs.

---

## 🚀 Running Mindroot Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

---

### Option A: Quick One-Click Launch (Windows)

Double-click the **`run.bat`** file in the root directory:
```cmd
run.bat
```
This script automatically:
1. Starts the Express backend API on port `3000`.
2. Starts the Vite frontend dev server on port `5173`.
3. Displays local and Wi-Fi LAN access URLs (e.g., `http://localhost:5173` and `http://192.168.x.x:5173`).

---

### Option B: Cross-Platform Manual Launch (macOS, Linux, and Windows)

For macOS, Linux, or Windows users who do not run `.bat` scripts:

1. **Install Root & Frontend Dependencies**:
   ```bash
   npm install
   ```

2. **Install Backend Server Dependencies**:
   ```bash
   cd server && npm install && cd ..
   ```

3. **Apply Database Migrations**:
   ```bash
   cd server && npx prisma migrate deploy
   ```
   > **Note**: `npx prisma migrate deploy` must be run once against the production database after your first deploy to apply all schema migrations. Running `npx prisma db seed` is optional if you want to populate demo data.

4. **Start Backend Express Server** (Terminal 1):
   ```bash
   cd server && npm run dev
   ```
   *(Backend starts on `http://localhost:3000`)*

5. **Start Frontend Dev Server** (Terminal 2):
   ```bash
   npm run dev
   ```
   *(Frontend starts on `http://localhost:5173`)*

---

## 📱 Mobile & LAN Wi-Fi Access

To access Mindroot on a mobile phone or secondary laptop:

1. Ensure both your computer and mobile device are connected to the **same Wi-Fi network**.
2. Find your laptop's local IP address using `ipconfig` (Windows) or `ifconfig` / `ip a` (macOS/Linux).
3. Open your mobile browser and enter:
   ```text
   http://<YOUR-LAPTOP-IP>:5173
   ```
   *(Example: `http://192.168.1.15:5173`)*

---

## ⚡ Features Summary

- **Smart Match Finder**: Calculates match percentage scores (50–99%) based on mutual skill overlap (skills offered vs. skills desired).
- **Skill Token Economy**: Earn 1 token per hour taught, spend 1 token per hour learned.
- **Virtual Classroom**: WebRTC P2P video/audio calls, shared canvas whiteboard, markdown notes, live code sandbox, and screen sharing.
- **Calendar Export**: Export confirmed sessions to `.ics` files compatible with Apple Calendar, Google Calendar, and Outlook (`GET /api/sessions/:id/calendar.ics`).
