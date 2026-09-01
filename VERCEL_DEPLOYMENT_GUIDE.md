# Vercel Frontend Deployment Guide

This guide walks you through deploying the Executive Hostel web frontend to Vercel.

## Prerequisites

Before starting, you'll need:

1. **GitHub Account** - Your code must be on GitHub
2. **Vercel Account** - Free tier available at [vercel.com](https://vercel.com)
3. **Deployed Backend API** - You must have the API running on Render first (see RENDER_DEPLOYMENT_GUIDE.md)
4. **Backend API URL** - The URL where your Render API is deployed (e.g., `https://executive-hostel-api.onrender.com`)

---

## Step 1: Prepare Your Repository

Make sure your code is on GitHub:

1. **Check if you have a GitHub repository**
   ```bash
   git remote -v
   ```
   You should see `origin https://github.com/your-username/Executivehostel.git`

2. **If not, create one:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/Executivehostel.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Create Vercel Project

1. **Go to [vercel.com](https://vercel.com)** and sign in (or create account)

2. **Click "Add New..."** → **Project**

3. **Import GitHub Repository**
   - Click "Select a Git Repository"
   - Find your `Executivehostel` repository
   - Click "Import"

4. **Configure Project**
   - **Project Name**: `executive-hostel` (or similar)
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: `./executive-hostel-web/` (or where your package.json is)
   - Keep other settings as default

5. **Click "Deploy"**

Wait for the initial deployment to complete (should take 1-2 minutes).

---

## Step 3: Add Environment Variable

Once the first deployment completes:

1. **Go to Project Settings** (on the project page, click "Settings" tab)

2. **Click "Environment Variables"** on the left

3. **Add a new environment variable:**
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://your-render-api-url.onrender.com` (replace with your actual Render API URL)
   - **Environments**: Select all (Production, Preview, Development)
   - Click "Add"

---

## Step 4: Trigger New Deployment

Now that the environment variable is set, redeploy:

1. **Go to "Deployments" tab**

2. **Click the three dots (•••)** on the most recent deployment

3. **Click "Redeploy"**

4. **Confirm by clicking "Redeploy"** again

Wait for the deployment to complete. You should see:
```
✓ Built and deployed successfully
```

---

## Step 5: Test the Frontend

1. **Click the URL** at the top of the deployment (looks like `https://executive-hostel-xxxxx.vercel.app`)

2. **You should see the home page** with buttons:
   - View Available Rooms ✅
   - Apply for Accommodation ✅
   - Student Login ✅

3. **Test each section:**
   - **View Available Rooms**: Click to see if rooms load
   - **Apply for Accommodation**: Submit an application (should work)
   - **Student Login**: Try logging in (should work)

If you see "Something went wrong" errors, see the troubleshooting section below.

---

## Configuration Files

Your frontend is already configured correctly. Here's what's set up:

### vercel.json (already updated)
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "buildCommand": "VITE_API_BASE_URL=$VITE_API_BASE_URL npm run build"
}
```

This tells Vercel to:
- Pass `VITE_API_BASE_URL` to the build process
- Redirect all routes to `index.html` (for React Router)

### vite.config.ts (development proxy)
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",  // Local dev only
    },
  },
});
```

This only affects local development. Production uses `VITE_API_BASE_URL`.

---

## Troubleshooting

### Issue: "Something went wrong" on Login or Forms

**Solution:**
1. Check browser DevTools (F12) → Network tab
2. Look for API calls to `/api/...` 
3. They should go to `https://your-render-api.onrender.com/api/...`
4. If they go to just `/api/...`, then `VITE_API_BASE_URL` is not set
5. Verify in Vercel → Settings → Environment Variables

### Issue: CORS Error in Browser Console

**Example error:**
```
Access to XMLHttpRequest at 'https://your-api.onrender.com/api/v1/auth/login' 
from origin 'https://your-vercel-app.vercel.app' has been blocked by CORS policy
```

**Solution:**
1. This means the backend's `CORS_ORIGINS` doesn't include your Vercel URL
2. Go to Render (backend) → Settings → Environment Variables
3. Update `CORS_ORIGINS` to include your Vercel URL:
   ```
   https://your-vercel-app.vercel.app
   ```
4. Redeploy Render
5. Try again in frontend

### Issue: API Returns 404 or 500 Errors

**Solution:**
1. Test the backend directly: 
   ```bash
   curl https://your-render-api.onrender.com/health
   ```
2. Should return: `{"status":"ok"}`
3. If it doesn't, the backend has issues (see RENDER_DEPLOYMENT_GUIDE.md)

### Issue: Pages Load But No Data Displays

**Solution:**
1. Check browser Network tab for API calls
2. Look for errors in Render backend logs
3. Common issues:
   - Database connection error
   - Missing S3 credentials (for image uploads)
   - Authentication token issue

### Issue: Blank Screen After Login

**Solution:**
1. Check browser Network tab
2. Look for failed API calls to `/api/v1/me` or `/api/v1/rooms`
3. Check Render logs for specific error
4. Verify database has data (run seed if needed)

---

## Environment Variables Reference

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `VITE_API_BASE_URL` | ✅ Yes | Backend API URL | `https://api.onrender.com` |

That's it! The frontend is simple. All other config is in the backend.

---

## How Frontend Communicates with Backend

1. **Development (npm run dev)**
   - Frontend runs on `http://localhost:5173`
   - Vite proxy forwards `/api` calls to `http://localhost:4000`
   - `VITE_API_BASE_URL` is empty (uses proxy)

2. **Production (Vercel)**
   - Frontend deployed to `https://your-vercel-app.vercel.app`
   - Uses `VITE_API_BASE_URL` from environment (e.g., `https://your-render-api.onrender.com`)
   - Calls go directly to the backend

Example API call code (in `src/lib/api.ts`):
```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
// In production: https://api.onrender.com
// In dev: "" (uses Vite proxy)

fetch(`${API_BASE}/api/v1/auth/login`, {...})
// In production: https://api.onrender.com/api/v1/auth/login
// In dev: /api/v1/auth/login (proxied to localhost:4000)
```

---

## Deployments & Redeployments

### Automatic Deployments (from GitHub)

Any push to your main branch will:
1. Trigger a new Vercel deployment
2. Run: `VITE_API_BASE_URL=$VITE_API_BASE_URL npm run build`
3. Deploy the build automatically

### Manual Redeployment

If something's wrong and you need to redeploy:
1. Go to Vercel → Deployments
2. Click the three dots (•••) next to any deployment
3. Click "Redeploy"
4. Wait for it to complete

### Redeploy After Backend Changes

If you update the backend API:
1. Redeploy on Render first
2. Make sure the new API is working
3. Then redeploy on Vercel
4. This ensures frontend gets new API features

---

## Viewing Logs

To debug issues, check Vercel logs:

1. **Build Logs**
   - Go to Deployments
   - Click on a deployment
   - Scroll to "Build Logs"
   - Shows build output and errors

2. **Runtime Logs** (requires Pro)
   - Free tier doesn't have persistent runtime logs
   - Use browser DevTools instead for frontend debugging

---

## DNS & Custom Domain (Optional)

To use a custom domain (e.g., `executive-hostel.example.com`):

1. Go to Project Settings → Domains
2. Enter your domain
3. Add DNS records as shown (usually an ALIAS or CNAME)
4. Wait for DNS to propagate (5-30 minutes)

---

## Performance Tips

1. **Build size**: Current build should be ~500KB (gzipped)
2. **Load time**: Should load in <2 seconds on 4G
3. **Deployments**: Vercel caches builds, redeployments are instant
4. **CDN**: Automatically enabled and distributed globally

---

## Next Steps

After frontend is deployed:

1. ✅ Test home page loads
2. ✅ Test viewing available rooms
3. ✅ Test student login
4. ✅ Test submitting an application
5. ✅ Test admin login
6. ✅ Test viewing admin dashboard

If any of these fail, check:
- Browser DevTools Network tab for API errors
- Vercel build logs
- Render backend logs
- Environment variable is set correctly

---

## Support

See `DEPLOYMENT_ISSUES_AND_FIXES.md` for comprehensive troubleshooting.
