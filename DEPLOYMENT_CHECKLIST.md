# 🚀 Complete Deployment Checklist

Use this checklist to deploy the Executive Hostel system from scratch.

---

## Phase 1: Prepare Services

### Database Setup
- [ ] Create Neon account at [neon.tech](https://neon.tech)
- [ ] Create a new project
- [ ] Copy `DATABASE_URL` connection string
- [ ] Save it somewhere safe (you'll need it multiple times)

### Generate Secrets
```bash
# In terminal, run these commands and save the output
openssl rand -hex 32  # Copy this for JWT_ACCESS_SECRET
openssl rand -hex 32  # Copy this for JWT_REFRESH_SECRET
```
- [ ] JWT_ACCESS_SECRET generated and saved
- [ ] JWT_REFRESH_SECRET generated and saved

### S3 Storage Setup
- [ ] Create Backblaze B2 account at [backblaze.com/b2](https://backblaze.com/b2)
- [ ] Create a **PRIVATE** bucket named `executive-hostel-storage`
- [ ] Create Application Key scoped to that bucket
- [ ] Save:
  - [ ] S3 endpoint (e.g., `https://s3.us-west-004.backblazeb2.com`)
  - [ ] S3 region (e.g., `us-west-004`)
  - [ ] S3 bucket name
  - [ ] S3 access key ID
  - [ ] S3 secret access key

### Email Service (Optional but Recommended)
- [ ] Create Resend account at [resend.com](https://resend.com)
- [ ] Verify a domain (or use sandbox)
- [ ] Create API key
- [ ] Save `RESEND_API_KEY`

---

## Phase 2: Deploy Backend API on Render

Follow: [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md)

### Render Setup
- [ ] Create Render account at [render.com](https://render.com)
- [ ] Create new Web Service
- [ ] Connect to GitHub repository
- [ ] Configure build/start commands:
  ```
  Build: npm install && npm run build && npx prisma migrate deploy
  Start: npm start
  ```

### Add All Environment Variables to Render
- [ ] `DATABASE_URL` (from Neon)
- [ ] `JWT_ACCESS_SECRET` (generated secret)
- [ ] `JWT_REFRESH_SECRET` (generated secret)
- [ ] `S3_ENDPOINT` (from Backblaze)
- [ ] `S3_REGION` (from Backblaze)
- [ ] `S3_BUCKET` (from Backblaze)
- [ ] `S3_ACCESS_KEY_ID` (from Backblaze)
- [ ] `S3_SECRET_ACCESS_KEY` (from Backblaze)
- [ ] `S3_MAX_UPLOAD_BYTES=8388608`
- [ ] `PORT=4000`
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGINS=<placeholder>` (will update after frontend deployed)
- [ ] `RESEND_API_KEY` (from Resend, if setting up email)
- [ ] `EMAIL_FROM` (your email)
- [ ] `APP_URL=<placeholder>` (will update after frontend deployed)

### Test Backend
- [ ] Click "Deploy" on Render
- [ ] Wait for deployment to complete (status: "Live")
- [ ] Test health endpoint:
  ```bash
  curl https://your-render-service.onrender.com/health
  # Should return: {"status":"ok"}
  ```
- [ ] Copy your Render API URL (you'll need it next)

**Your Render API URL:** `https://executive-hostel-api.onrender.com` (replace with your actual URL)

---

## Phase 3: Deploy Frontend on Vercel

Follow: [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md)

### Vercel Setup
- [ ] Go to [vercel.com](https://vercel.com)
- [ ] Sign in (or create account)
- [ ] Click "Add New" → "Project"
- [ ] Import GitHub repository (Executivehostel)
- [ ] Root directory: `./executive-hostel-web/`
- [ ] Click "Deploy"
- [ ] Wait for deployment to complete

### Add Environment Variable to Vercel
- [ ] Go to Project Settings → Environment Variables
- [ ] Add variable:
  - **Name:** `VITE_API_BASE_URL`
  - **Value:** `https://your-render-api.onrender.com`
  - **Environments:** All (Production, Preview, Development)
- [ ] Save

### Redeploy with Environment Variable
- [ ] Go to Deployments tab
- [ ] Click the three dots (•••) on latest deployment
- [ ] Click "Redeploy"
- [ ] Wait for new deployment to complete

**Your Vercel Frontend URL:** `https://executive-hostel-xxxxx.vercel.app`

---

## Phase 4: Complete Backend Configuration

Go back to Render and update these variables with actual URLs:

### Update CORS_ORIGINS on Render
- [ ] Go to Render → Settings → Environment Variables
- [ ] Update `CORS_ORIGINS` to:
  ```
  https://executive-hostel-xxxxx.vercel.app
  ```
  *(Replace with your actual Vercel URL)*
- [ ] Save (Render will auto-redeploy)
- [ ] Wait for redeploy to complete

### Update APP_URL on Render (for email links)
- [ ] Go to Render → Settings → Environment Variables
- [ ] Update `APP_URL` to:
  ```
  https://executive-hostel-xxxxx.vercel.app
  ```
- [ ] Save (Render will auto-redeploy)

---

## Phase 5: End-to-End Testing

### Test Backend is Accessible
```bash
# From your terminal
curl https://your-render-api.onrender.com/health
# Should return: {"status":"ok"}
```
- [ ] Backend health check passes

### Test Frontend Loads
- [ ] Open `https://your-vercel-app.vercel.app` in browser
- [ ] Home page loads without errors
- [ ] You see the header with logo and buttons
- [ ] Dark background image visible

### Test View Available Rooms
- [ ] Click "View Available Rooms" button
- [ ] Wait for page to load
- [ ] Rooms should display (or empty if seed hasn't run)
- [ ] Check browser console (F12) for any errors
- [ ] Should NOT see "Something went wrong"

### Test Application Submission
- [ ] Click "Apply for Accommodation" button
- [ ] Fill in the form with test data
- [ ] Click "Submit Application"
- [ ] Should see success message (or error if database issue)

### Test Student Login
- [ ] Click "Student Login" button
- [ ] Try logging in with test credentials
- [ ] Should redirect to dashboard or show error
- [ ] Check Network tab for API calls to backend

### Test Admin Login
- [ ] Navigate to login page
- [ ] Check if admin portal is accessible
- [ ] Test basic admin features

---

## Phase 6: Seed Sample Data (Optional)

If you want sample data to test with:

1. **Run seed in database** (one-time, after migrations run)
   ```bash
   # Option A: Run seed through Render shell (requires paid plan)
   # Option B: Run locally and sync to database
   # Option C: Use Prisma Studio to manually add data
   ```

2. **What seed adds:**
   - 2 sections (Blocks A & B)
   - 72 sample rooms
   - 2 room types (single & double)
   - Default fees

- [ ] Sample data added to database

---

## Common Issues & Quick Fixes

### "Something went wrong" on Frontend

1. Check `VITE_API_BASE_URL` is set on Vercel
2. Verify Render health endpoint works
3. Check browser Network tab for API call URLs
4. Verify `CORS_ORIGINS` on Render includes Vercel URL

**See:** DEPLOYMENT_ISSUES_AND_FIXES.md

### CORS Error in Browser

```
Access to XMLHttpRequest at 'https://api.onrender.com/...' 
from origin 'https://vercel.app' has been blocked by CORS policy
```

**Fix:**
1. Go to Render → Settings → Environment Variables
2. Update `CORS_ORIGINS` to include your Vercel URL
3. Redeploy Render

### Database Connection Error

1. Verify `DATABASE_URL` is correct
2. Check database is running (Neon)
3. Test locally: `psql <your-database-url>`

### File Upload Fails

1. Verify all S3 environment variables are set
2. Check bucket is PRIVATE (not public)
3. Verify credentials have access to bucket

---

## After Deployment

### Monitoring & Logs

**Render Backend Logs:**
- Go to [render.com](https://render.com)
- Select your service
- Click "Logs" to see real-time logs
- Use for debugging errors

**Vercel Frontend Logs:**
- Go to [vercel.com](https://vercel.com)
- Select your project
- Click "Deployments"
- Click a deployment to see build logs

### Making Changes

1. **Code changes → Auto deployment**
   - Push to GitHub
   - Vercel/Render automatically redeploy

2. **Environment variable changes → Manual redeploy**
   - Update variable in Vercel/Render settings
   - Click "Redeploy" to apply

3. **Database schema changes**
   - Create Prisma migration: `npx prisma migrate dev --name <name>`
   - Push to GitHub
   - Render automatically runs migrations on redeploy

### Backup & Security

- [ ] Database backups enabled (Neon/Supabase handles this)
- [ ] S3 bucket is PRIVATE (critical - never public)
- [ ] Secrets are in environment variables (never in code)
- [ ] JWT secrets are strong (run `openssl rand -hex 32`)

---

## Rollback / Revert

If something breaks:

**Render:**
- Go to Deployments
- Click "Resume" on a previous deployment

**Vercel:**
- Go to Deployments
- Click three dots on previous deployment
- Click "Redeploy"

---

## Performance & Optimization

- **Frontend build size:** ~500KB gzipped
- **API response time:** <200ms on Render free tier
- **Database:** Neon free tier supports ~100K queries/month
- **S3 storage:** Backblaze B2 free: 10GB storage, 1GB/day download

Monitor on Render/Vercel dashboards if getting close to limits.

---

## Next Steps

After successful deployment:

1. Create admin account (use Prisma Studio)
2. Add system configuration (fees, semesters, etc.)
3. Create landlady/staff accounts
4. Set up payment verification method
5. Configure SMS service (Africa's Talking)
6. Set up automated backups

---

## Support Resources

- **Deployment Issues:** See DEPLOYMENT_ISSUES_AND_FIXES.md
- **Render:** See RENDER_DEPLOYMENT_GUIDE.md
- **Vercel:** See VERCEL_DEPLOYMENT_GUIDE.md
- **API Docs:** See executive-hostel-design-docs.md
- **Local Development:** See executive-hostel-api/README.md

---

**Last Updated:** September 2026  
**Framework Versions:**
- Node.js 20+
- React 18
- Express 4
- Prisma 5
- PostgreSQL 13+

---

## Emergency Contacts

If everything fails:

1. **Check all environment variables are set** (no typos)
2. **Verify database connection** (`curl` from Render shell)
3. **Check Render logs** for specific errors
4. **Check Vercel build logs** for build failures
5. **Review CORS configuration** (most common issue)

**Most common issue:** Missing `CORS_ORIGINS` or `VITE_API_BASE_URL`

✅ **Good luck! You've got this!** 🎉
