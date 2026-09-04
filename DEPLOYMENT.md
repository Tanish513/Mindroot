# 🚀 Mindroot Production Deployment Guide & Checklist

This document details all required environment variables and post-deployment setup steps for deploying Mindroot to production environments (Vercel, Render, Railway, Docker, AWS, etc.).

---

## 🔑 Environment Variables Checklist

### 1. Frontend (Build-Time Variables)
*These must be provided to the frontend build command (e.g. Vite build args or hosting environment variables).*

* **`VITE_BACKEND_URL`** *(Required)*: The full public URL of your deployed backend API server (e.g. `https://api.mindroot.app` or `http://localhost:3000`).
* **`VITE_GOOGLE_CLIENT_ID`** *(Optional)*: Your Google OAuth 2.0 Client ID for client-side Google Sign-In. Required if enabling Google SSO.
* **`VITE_RAZORPAY_KEY_ID`** *(Required for Razorpay)*: Your Razorpay Key ID (`rzp_test_...` for testing or `rzp_live_...` for production).

---

## 2. Backend (Runtime Variables)
*These environment variables must be configured on your backend node runtime environment.*

* **`DATABASE_URL`** *(Required)*: PostgreSQL connection string formatted as `postgresql://user:password@host:5432/dbname?schema=public`.
* **`JWT_SECRET`** *(Required)*: Cryptographically secure secret string used for signing session authentication tokens.
* **`FRONTEND_URL`** *(Required)*: The exact deployed frontend web domain (e.g. `https://mindroot.app`). Restricts Express CORS and Socket.io signaling origins.
* **`RAZORPAY_KEY_ID`** *(Required for Razorpay)*: Razorpay Key ID matching `VITE_RAZORPAY_KEY_ID` (`rzp_live_...` in production).
* **`RAZORPAY_KEY_SECRET`** *(Required for Razorpay)*: Razorpay Secret Key generated from Razorpay Dashboard under API Keys (`rzp_live_...` secret).
* **`RESEND_API_KEY`** *(Required for email sending)*: API Key from [Resend Dashboard](https://resend.com) for sending verification emails, password resets, payment receipts, and session notifications.
* **`EMAIL_FROM`** *(Optional)*: Sender address (defaults to `Mindroot Learning <onboarding@resend.dev>` or your verified domain e.g. `Mindroot <noreply@yourdomain.com>`).
* **`GOOGLE_CLIENT_ID`** *(Optional)*: OAuth Client ID matching `VITE_GOOGLE_CLIENT_ID` for backend Google ID token verification.
* **`GEMINI_API_KEY`** *(Optional)*: Gemini API key for the interactive AI contextual chat assistant.

---

## 3. Docker / Docker Compose Variables
*Used when running via `docker-compose.yml` or containerized environments.*

* **`POSTGRES_USER`** *(Required)*: Database administrator username for the PostgreSQL container.
* **`POSTGRES_PASSWORD`** *(Required)*: Database administrator password for the PostgreSQL container.
* **`POSTGRES_DB`** *(Required)*: Default database name created on PostgreSQL startup.

---

## 📋 First Deploy Checklist

1. **Apply Database Schema Migrations**:
   Run `npx prisma migrate deploy` from the `server/` directory against your production database instance.
   ```bash
   cd server
   npx prisma migrate deploy
   ```

2. **Verify Domain in Resend Dashboard**:
   Before relying on email delivery in production, verify your custom domain DNS records (DKIM, SPF) in the Resend dashboard to prevent emails from landing in spam or hitting free-tier sending restrictions.

3. **Configure Google Cloud Console Authorized Origins**:
   If using Google OAuth, add your production frontend domain (e.g., `https://mindroot.app`) to **Authorized JavaScript origins** in [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).

4. **Verify CORS & Socket.io Allowed Origin**:
   Ensure `FRONTEND_URL` matches your actual deployed web application URL exactly, including the protocol (e.g. `https://` vs `http://`).

5. **Verify JWT Secret**:
   Confirm `JWT_SECRET` is set to a strong random production key and is not using the default dev fallback string.
