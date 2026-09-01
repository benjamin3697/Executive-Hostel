# ⚡ QUICK FIX: Immediate Actions to Resolve "Something went wrong"

Your system is showing "Something went wrong" errors because **the frontend doesn't know where the backend API is located**.

This guide gives you the exact steps to fix it RIGHT NOW.

---

## The Problem in 30 Seconds

```
Frontend (Vercel) → ❌ Doesn't know API URL → Can't call backend
Backend (Render)  → ❌ Doesn't allow Vercel → Blocks requests with CORS error
Result: "Something went wrong" message
```

---

## The Fix in 5 Minutes

### Step 1: Find Your Render API URL (2 minutes)

1. Go to https://render.com
2. Sign in
3. Click your "executive-hostel-api" service
4. Look for the URL near the top of the page
5. Copy it (looks like: `https://executive-hostel-abc123.onrender.com`)

**Your Render API URL:** `_______________________`

---

### Step 2: Update Render CORS (1 minute)

1. **Still on Render**, click **"Settings"** on the left sidebar
2. Scroll down to **"Environment Variables"**
3. Find **`CORS_ORIGINS`**
4. Click the **edit icon** (pencil)
5. Change the value to your **Vercel URL** (you'll get it in next step)
   ```
   https://executive-hostel-xxxxx.vercel.app
   ```
   *(Replace `xxxxx` with your actual Vercel URL)*
6. Click **"Save"**
7. **Render will auto-redeploy** (wait 1-2 minutes for "Live" status)

---

### Step 3: Update Vercel Environment Variable (1 minute)

1. Go to https://vercel.com
2. Sign in
3. Click your "executive-hostel" project
4. Click **"Settings"** tab
5. Click **"Environment Variables"** on the left
6. Look for **`VITE_API_BASE_URL`**

**If it exists:**
- Click the edit icon (pencil)
- Change value to your **Render API URL** from Step 1
- Click "Save"

**If it does NOT exist:**
- Click "Add New"
- **Name:** `VITE_API_BASE_URL`
- **Value:** `https://executive-hostel-abc123.onrender.com` (your Render URL from Step 1)
- **Environments:** Select "Production", "Preview", and "Development"
- Click "Add"

---

### Step 4: Redeploy Vercel (1 minute)

1. **Still on Vercel**, click **"Deployments"** tab
2. Find the most recent deployment in the list
3. Click the **three dots (•••)** on the right side
4. Click **"Redeploy"**
5. **Confirm by clicking "Redeploy"** again
6. **Wait for deployment to complete** (status should change to "Live")

---

### Step 5: Test It Works (30 seconds)

1. Go to your Vercel URL: `https://your-vercel-app.vercel.app`
2. Click **"View Available Rooms"** button
3. **Wait for page to load**

**If it works:**
- ✅ You see a list of rooms (or empty list if no data)
- ✅ No error messages
- ✅ No "Something went wrong"

**If it still fails:**
- Open browser DevTools (F12)
- Click the "Network" tab
- Refresh the page
- Look for red entries in the network list
- Click on them to see the error
- See troubleshooting section below

---

## Quick Verification Checklist

Before testing, verify these are correct:

- [ ] Render status shows "Live" (not "Building")
- [ ] Vercel status shows "Ready" (not "Building")
- [ ] `CORS_ORIGINS` on Render includes your Vercel URL
- [ ] `VITE_API_BASE_URL` on Vercel points to Render URL
- [ ] No typos in URLs (check for spaces, trailing slashes, etc.)

---

## What You're Looking For

After the fix, when you navigate to your frontend:

1. **Home page should load** → background image, buttons visible
2. **Click "View Available Rooms"** → should fetch data from backend
3. **Check browser Network tab** → see API calls to `https://your-render-url/api/v1/...`
4. **No CORS errors** in browser console

---

## If It Still Doesn't Work

### Debug Checklist (in order)

1. **Verify backend is running:**
   ```bash
   curl https://your-render-url/health
   ```
   Should return: `{"status":"ok"}`
   
   If not: Backend is down or URL is wrong

2. **Check Render logs:**
   - Go to Render
   - Click your service
   - Click "Logs" tab
   - Look for any error messages
   - Common errors: Database connection failed, environment variable missing

3. **Check Vercel build logs:**
   - Go to Vercel
   - Click your project
   - Click a deployment
   - Scroll to "Build Logs"
   - Look for errors during build
   - Common errors: Build failed, environment variable not set

4. **Check browser Network tab:**
   - F12 → Network tab
   - Refresh page
   - Look for red (failed) requests
   - Click on them to see full error
   - Look for CORS or 404 errors

5. **Common CORS Error:**
   ```
   Access to XMLHttpRequest at 'https://api.onrender.com/api/...'
   from origin 'https://vercel-app.vercel.app' has been blocked by CORS policy
   ```
   **Fix:** Update `CORS_ORIGINS` on Render to include your Vercel URL

---

## URL Examples (So You Know What to Look For)

Your URLs should look like:

```
Render API:    https://executive-hostel-api-xxxxx.onrender.com
Vercel Site:   https://executive-hostel-xxxxx.vercel.app
```

With API calls going to:
```
https://executive-hostel-api-xxxxx.onrender.com/api/v1/rooms/available
https://executive-hostel-api-xxxxx.onrender.com/api/v1/auth/login
```

---

## If Render/Vercel Status is "Building"

**Don't test yet!** Wait for status to change to:
- Render: "Live" ✅
- Vercel: "Ready" ✅

After both show this, test again.

---

## Emergency: Manual Redeploy

If status is stuck on "Building":

**Render:**
1. Click your service
2. Click "Settings" 
3. Scroll to "Build Command"
4. Click the retry/redeploy button

**Vercel:**
1. Click your project
2. Click "Deployments"
3. Click the three dots on latest deployment
4. Click "Redeploy"

---

## What Should Happen (The Happy Path)

1. ✅ You update `CORS_ORIGINS` on Render
2. ✅ Render redeploys (1-2 minutes)
3. ✅ You update `VITE_API_BASE_URL` on Vercel  
4. ✅ Vercel redeploys (1-2 minutes)
5. ✅ You test: frontend loads, API calls work
6. ✅ No "Something went wrong" errors
7. 🎉 System works!

---

## Still Stuck?

1. **Re-read this guide** - Most issues are in the 5-minute fix
2. **Check the URLs carefully** - Typos are the #1 issue
3. **Read DEPLOYMENT_ISSUES_AND_FIXES.md** - Full troubleshooting guide
4. **Review server logs** - They contain specific error messages
5. **Verify all environment variables are set** - Check Render/Vercel settings carefully

---

## Two Most Common Mistakes

### ❌ Mistake #1: Wrong URL in Environment Variable
```
❌ Bad:  https://executive-hostel-abc123.onrender.com/  (trailing slash)
❌ Bad:  http://... (not https)
❌ Bad:  executive-hostel-abc123.onrender.com (missing https://)
✅ Good: https://executive-hostel-abc123.onrender.com
```

### ❌ Mistake #2: Forgot to Redeploy
```
❌ Wrong: Change environment variable but don't redeploy
✅ Right: Change variable, then redeploy immediately
```

---

## Need More Help?

1. **All deployment issues:** Read DEPLOYMENT_ISSUES_AND_FIXES.md
2. **Backend specific:** Read RENDER_DEPLOYMENT_GUIDE.md
3. **Frontend specific:** Read VERCEL_DEPLOYMENT_GUIDE.md
4. **Full checklist:** Read DEPLOYMENT_CHECKLIST.md
5. **Server logs:** The error messages are in Render/Vercel logs

---

## Success Criteria

After following these 5 steps, you should see:

✅ Home page loads with background image  
✅ "View Available Rooms" shows rooms (or empty if no seed)  
✅ "Apply for Accommodation" form loads  
✅ "Student Login" page shows login form  
✅ Browser console shows NO errors  
✅ Network tab shows API calls to `https://your-render-url/api/v1/...`  

If all of these are true: **🎉 You fixed it!**

---

**Time to fix:** 5-10 minutes  
**Difficulty:** Easy (mostly configuration)  
**Most common issue:** CORS_ORIGINS or VITE_API_BASE_URL typo

**You got this! 💪**
