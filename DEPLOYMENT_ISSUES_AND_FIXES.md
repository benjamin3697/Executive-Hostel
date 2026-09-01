# Executive Hostel Deployment Troubleshooting Guide

## Problems Identified

Based on the screenshots and configuration analysis, here are the issues causing your "Something went wrong" errors:

### 1. **Frontend Cannot Connect to Backend API** ❌
   - **Problem**: The frontend (Vercel) doesn't know where the backend API is located
   - **Evidence**: Login and application forms show "Something went wrong"
   - **Root Cause**: `VITE_API_BASE_URL` environment variable is not set on Vercel
   - **Impact**: All API calls fail silently with CORS or connection errors

### 2. **Backend CORS Configuration Incorrect** ❌
   - **Problem**: Even if the frontend knew the API URL, it would be blocked by CORS
   - **Root Cause**: `CORS_ORIGINS` environment variable on Render doesn't include the Vercel frontend URL
   - **Config**: Currently set to localhost only: `http://localhost:5173`
   - **Should Be**: `https://executive-hostel-4twfcre60-benja-b083.vercel.app` (or your actual Vercel URL)

### 3. **Missing Required Environment Variables on Render** ❌
   - **S3 Storage**: Not configured (required for payment evidence uploads)
   - **JWT Secrets**: May not be set
   - **Database**: May not have proper connection
   - **Email/SMS**: Not configured (optional but needed for password resets)

### 4. **Frontend Build Not Using API URL** ❌
   - **Problem**: `vercel.json` has no environment variable configuration
   - **Impact**: Vercel doesn't inject `VITE_API_BASE_URL` during the build

### 5. **Database Migrations Not Automatic** ⚠️
   - **Current Setup**: Docker CMD tries to run migrations, but Render's deployment may not execute them
   - **Risk**: Schema mismatch if migrations haven't run

---

## Solution: Step-by-Step Fix

### **Step 1: Set Up the Backend API on Render** 🚀

#### A. Verify/Create the Render Web Service

1. Go to [render.com](https://render.com)
2. Create a new **Web Service** (if not already created)
3. Connect your GitHub repository (Executivehostel)
4. Set the following configuration:

```
Name: executive-hostel-api
Environment: Node
Build Command: npm install && npm run build && npx prisma migrate deploy
Start Command: npm start
Region: Choose closest to your users
```

#### B. Add Required Environment Variables

In Render Dashboard → Your Service → Environment:

```
# Database (required - create free one at Neon or Supabase)
DATABASE_URL=postgresql://user:password@host:5432/database

# JWT Secrets (run: openssl rand -hex 32 twice)
JWT_ACCESS_SECRET=<generate_random_32_char_hex>
JWT_REFRESH_SECRET=<generate_random_32_char_hex>

# CORS - CRITICAL FIX
CORS_ORIGINS=https://executive-hostel-4twfcre60-benja-b083.vercel.app

# Port (Render will set PORT automatically, but override if needed)
PORT=4000
NODE_ENV=production

# Email (optional - for password resets)
RESEND_API_KEY=<your_resend_api_key>
EMAIL_FROM=Executive Hostel <noreply@yourdomain.com>
APP_URL=https://executive-hostel-4twfcre60-benja-b083.vercel.app

# SMS (optional - for phone-only accounts)
AT_API_KEY=<your_africa_talking_key>
AT_USERNAME=sandbox

# S3/Backblaze B2 (required - for payment uploads)
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=<your_access_key>
S3_SECRET_ACCESS_KEY=<your_secret_key>
S3_MAX_UPLOAD_BYTES=8388608
```

**Getting the required values:**

- **Database**: 
  - Go to [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com) → Create free project → Copy CONNECTION_STRING
  
- **JWT Secrets**:
  ```bash
  # Run this twice and copy the output
  openssl rand -hex 32
  ```

- **S3/Backblaze B2**:
  1. Go to [backblaze.com/b2](https://backblaze.com/b2)
  2. Sign up (free tier: 10GB storage)
  3. Create a PRIVATE bucket
  4. Create an Application Key scoped to that bucket
  5. Copy endpoint, region, bucket name, access key, and secret

- **Email (Resend)**:
  1. Go to [resend.com](https://resend.com)
  2. Sign up → Verify domain or use sandbox
  3. Create API key

#### C. Redeploy with New Environment

In Render Dashboard:
1. Click the "Deploy" button to trigger a new deployment
2. Monitor the deployment logs
3. Once "Live" appears, test: `curl https://your-render-api-url.onrender.com/health`
4. You should see: `{"status":"ok"}`

---

### **Step 2: Configure Frontend on Vercel** 🎨

#### A. Update vercel.json

Replace your current `vercel.json` with this:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "env": {
    "VITE_API_BASE_URL": "@vite-api-base-url"
  }
}
```

#### B. Add Environment Variable to Vercel

1. Go to [vercel.com](https://vercel.com) → Your Project
2. Go to **Settings** → **Environment Variables**
3. Add a new variable:
   ```
   VITE_API_BASE_URL = https://your-render-api-url.onrender.com
   ```
4. Make sure it's available for all environments (Production, Preview, Development)

#### C. Redeploy on Vercel

1. Click **Deployments** → **Redeploy** on the latest commit
2. Or push a small change to trigger a new build
3. Wait for the build to complete
4. Test the login page at `https://your-vercel-url.vercel.app/login`

---

### **Step 3: Test Connectivity** ✅

1. **Test Backend Health:**
   ```
   curl https://your-render-api-url.onrender.com/health
   # Should return: {"status":"ok"}
   ```

2. **Test Frontend → Backend Connection:**
   - Go to your Vercel app
   - Open browser DevTools (F12) → **Network** tab
   - Try to login or view rooms
   - You should see API calls to `https://your-render-api-url.onrender.com/api/v1/...`
   - They should return data (not 404, not CORS errors)

3. **Test CORS Headers:**
   ```bash
   curl -H "Origin: https://your-vercel-url.vercel.app" \
        https://your-render-api-url.onrender.com/api/v1/rooms/available
   # Should return data, not CORS error
   ```

---

## Quick Reference: Service URLs

After deployment:

| Service | URL | Notes |
|---------|-----|-------|
| **API Health** | `https://your-render-api-url.onrender.com/health` | Should return `{"status":"ok"}` |
| **API Base** | `https://your-render-api-url.onrender.com/api/v1/...` | All API endpoints here |
| **Frontend** | `https://your-vercel-url.vercel.app` | User-facing application |
| **Database** | Via `DATABASE_URL` | Hidden in Render env vars |

---

## Troubleshooting Individual Issues

### Issue: "Something went wrong" on Login

1. ✅ Check if `VITE_API_BASE_URL` is set on Vercel
2. ✅ Check browser Network tab for failed API calls
3. ✅ Verify `/health` endpoint returns `{"status":"ok"}`
4. ✅ Check Render logs for errors

### Issue: CORS Errors in Browser Console

1. ✅ Verify `CORS_ORIGINS` includes your Vercel URL
2. ✅ Make sure `CORS_ORIGINS` doesn't have extra spaces (e.g., `https://vercel-url.com,https://another-url.com`)
3. ✅ Redeploy Render after changing `CORS_ORIGINS`

### Issue: Database Connection Error

1. ✅ Verify `DATABASE_URL` is correct
2. ✅ Test connection locally: `psql <your-database-url>`
3. ✅ Ensure database exists and is accessible from the internet
4. ✅ Check Render logs for migration errors

### Issue: File Upload Fails

1. ✅ Verify all S3 environment variables are set correctly
2. ✅ Ensure bucket is PRIVATE (not public)
3. ✅ Test S3 credentials locally (optional, advanced)

### Issue: Emails Not Sending

1. ✅ Set `RESEND_API_KEY` on Render
2. ✅ Verify `EMAIL_FROM` domain is verified in Resend
3. ✅ Check Render logs for email send errors
4. ✅ Ensure `APP_URL` is correct (used in email links)

---

## Local Testing (Optional)

Before deploying, test locally:

1. **Create .env file in executive-hostel-api:**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and secrets
   ```

2. **Run locally:**
   ```bash
   cd executive-hostel-api
   npm install
   npm run prisma:migrate
   npm run dev
   # Should start on http://localhost:4000
   ```

3. **Update frontend for local dev:**
   - Keep `vite.config.ts` proxy as-is (forwards /api to localhost:4000)
   - No need to set `VITE_API_BASE_URL` for local dev

---

## Deployment Checklist

- [ ] Database created on Neon/Supabase (copy DATABASE_URL)
- [ ] JWT secrets generated (run `openssl rand -hex 32` twice)
- [ ] S3/Backblaze B2 bucket created and credentials copied
- [ ] All environment variables added to Render
- [ ] Render deployment completed successfully
- [ ] `/health` endpoint returns `{"status":"ok"}`
- [ ] CORS_ORIGINS set to your Vercel URL on Render
- [ ] VITE_API_BASE_URL set to your Render API URL on Vercel
- [ ] Vercel redeployed with new environment variable
- [ ] Login page loads without "Something went wrong"
- [ ] Can see "Available Rooms" without errors
- [ ] Can submit an application successfully

---

## Need Help?

Check these common issues:

1. **Typos in URLs** - Double-check `CORS_ORIGINS` and `VITE_API_BASE_URL`
2. **Trailing slashes** - URLs should NOT have trailing slashes
3. **Environment variables not injected** - Redeploy after adding/changing env vars
4. **Port conflicts** - Render uses PORT env var automatically
5. **Database migrations** - Check Render logs for migration errors

If issues persist, collect:
- Render deployment logs
- Browser Network tab (API call details)
- Browser Console errors
- Vercel build logs
