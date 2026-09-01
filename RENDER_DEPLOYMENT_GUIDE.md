# Render Backend Deployment Guide

This guide walks you through deploying the Executive Hostel API to Render.

## Prerequisites

Before starting, you'll need:

1. **GitHub Account** - Already connected to your project
2. **Render Account** - Free tier available at [render.com](https://render.com)
3. **Database** - Neon ([neon.tech](https://neon.tech)) or Supabase ([supabase.com](https://supabase.com))
4. **S3 Storage** - Backblaze B2 ([backblaze.com/b2](https://backblaze.com/b2))
5. **Email Service** (optional) - Resend ([resend.com](https://resend.com))
6. **SMS Service** (optional) - Africa's Talking ([africastalking.com](https://africastalking.com))

---

## Step 1: Prepare Your Database

### Option A: Neon (Recommended - Easiest)

1. Go to [neon.tech](https://neon.tech) and sign up (free tier)
2. Create a new project
3. Copy the connection string (looks like: `postgresql://user:password@host:5432/database`)
4. Keep this handy - you'll need it for Render environment variables

### Option B: Supabase

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project
3. Go to **Project Settings** → **Database** → Copy the connection string
4. Keep this handy

---

## Step 2: Generate Secrets

Open your terminal and run these commands:

```bash
# Generate JWT Access Secret
openssl rand -hex 32

# Generate JWT Refresh Secret (run command again)
openssl rand -hex 32
```

Copy both outputs - you'll need them for Render.

**Example outputs:**
```
b05f42e9ad09795378d021f7d13c5b21cda24683023ce1024b0b435f60f41ec5
c8e1204fe778daee6b800a93472dff26966733e73af28e1e057f411d5e3b8e7d
```

---

## Step 3: Set Up S3/Backblaze B2 (File Storage)

Payment evidence and maintenance photos are stored in S3. This is required for the app to function.

1. **Create Backblaze B2 Account**
   - Go to [backblaze.com/b2](https://backblaze.com/b2)
   - Sign up (free tier: 10GB storage + 1GB/day download)
   - No credit card required

2. **Create a Private Bucket**
   - Click "Create a Bucket"
   - Name: `executive-hostel-storage` (or similar)
   - **Type: Private** (this is critical - payment evidence must not be public)
   - Note the S3 endpoint URL (you'll see it on the bucket page, looks like: `https://s3.us-west-004.backblazeb2.com`)
   - Note the region (e.g., `us-west-004`)

3. **Create Application Key**
   - Go to **Account** → **App Keys**
   - Click "Create New Master Key"
   - Restrict it to your bucket only
   - Copy:
     - Key ID (access key)
     - Application Key (secret)

---

## Step 4: Create Render Web Service

1. **Go to [render.com](https://render.com)** and sign in
2. **Click "New"** → **Web Service**
3. **Connect GitHub**
   - Click "Connect account"
   - Select your Executivehostel repository
4. **Configure the service:**

   ```
   Name: executive-hostel-api
   Environment: Node
   Region: Choose closest to your users
   Branch: main (or your main branch)
   Build Command: npm install && npm run build && npx prisma migrate deploy
   Start Command: npm start
   Instance Type: Free (or upgrade if needed)
   ```

5. **Click "Create Web Service"**

---

## Step 5: Add Environment Variables

Once the service is created, you'll be on the deployment page. Now add environment variables:

1. **Click "Environment"** on the left sidebar
2. **Add each of these variables** (one by one):

### Critical Variables (must have)

```
DATABASE_URL=postgresql://user:password@host:5432/database
```
*(Copy from Neon or Supabase)*

```
JWT_ACCESS_SECRET=<paste_first_openssl_output>
JWT_REFRESH_SECRET=<paste_second_openssl_output>
```
*(The long hex strings you generated earlier)*

```
CORS_ORIGINS=https://your-vercel-frontend-url.vercel.app
```
*(You'll get this URL from Vercel later - for now use a placeholder)*

```
PORT=4000
NODE_ENV=production
```

### S3 Variables (required - for file uploads)

```
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_BUCKET=executive-hostel-storage
S3_ACCESS_KEY_ID=<paste_backblaze_key_id>
S3_SECRET_ACCESS_KEY=<paste_backblaze_application_key>
S3_MAX_UPLOAD_BYTES=8388608
```

### Email Variables (optional - for password resets)

```
RESEND_API_KEY=<paste_resend_api_key>
EMAIL_FROM=Executive Hostel <noreply@yourdomain.com>
APP_URL=https://your-vercel-frontend-url.vercel.app
```

### SMS Variables (optional - for phone-only accounts)

```
AT_API_KEY=<paste_africa_talking_key>
AT_USERNAME=sandbox
```

---

## Step 6: Trigger First Deployment

1. Once all environment variables are added, click **"Deploy"**
2. Watch the build logs - it should:
   - Install dependencies
   - Build TypeScript
   - Run Prisma migrations
   - Start the server

3. **Wait for "Live" status** (this can take 2-5 minutes)

---

## Step 7: Test the API

Once deployed, test the health endpoint:

```bash
curl https://your-render-service.onrender.com/health
```

You should see:
```json
{"status":"ok"}
```

**If this works, the API is deployed! 🎉**

---

## Step 8: Update CORS_ORIGINS with Frontend URL

1. Once you have your Vercel URL (after deploying the frontend), come back to Render
2. **Settings** → **Environment Variables**
3. Find `CORS_ORIGINS` and update it to your actual Vercel URL
4. Click "Save" and wait for automatic redeploy

---

## Troubleshooting

### "Build failed" error

1. Check the build logs - they contain error messages
2. Common issues:
   - Typo in `DATABASE_URL`
   - Missing required environment variables
   - Node version mismatch (needs Node 20+)

### "Service is crashing" or "500 errors"

1. Click **Logs** to see what's happening
2. Common issues:
   - `DATABASE_URL` is unreachable
   - Missing S3 credentials
   - JWT secrets not set

### Migrations failed

Check the logs for SQL errors. Options:
- Verify `DATABASE_URL` is correct
- Try running migrations locally first: `npx prisma migrate deploy`
- In Render logs, look for the specific SQL error

### CORS errors in frontend

This means `CORS_ORIGINS` doesn't include your frontend URL:
1. Check your Vercel URL is exactly correct (including `https://`)
2. No trailing slashes
3. Redeploy Render after updating

---

## Environment Variables Reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ Yes | Signing key for access tokens |
| `JWT_REFRESH_SECRET` | ✅ Yes | Signing key for refresh tokens |
| `CORS_ORIGINS` | ✅ Yes | Frontend URL for CORS |
| `S3_ENDPOINT` | ✅ Yes | Backblaze S3 endpoint URL |
| `S3_REGION` | ✅ Yes | Backblaze region |
| `S3_BUCKET` | ✅ Yes | Bucket name |
| `S3_ACCESS_KEY_ID` | ✅ Yes | Backblaze access key |
| `S3_SECRET_ACCESS_KEY` | ✅ Yes | Backblaze secret key |
| `PORT` | ⚠️ Auto | Server port (Render sets this) |
| `NODE_ENV` | ⚠️ Auto | Set to `production` |
| `RESEND_API_KEY` | ❌ Optional | For email password resets |
| `EMAIL_FROM` | ❌ Optional | Sender email address |
| `APP_URL` | ❌ Optional | Frontend URL for email links |
| `AT_API_KEY` | ❌ Optional | For SMS (Africa's Talking) |
| `AT_USERNAME` | ❌ Optional | Africa's Talking username |

---

## Database Backup

Your data is in the Neon/Supabase database, not in Render. To back it up:

1. **Neon**: Settings → Branches → Backup (automatic daily)
2. **Supabase**: Settings → Database → Backups → Download manual backup

---

## Next Steps

After successful deployment:

1. Get your Render API URL (e.g., `https://executive-hostel-api.onrender.com`)
2. Update CORS_ORIGINS with your Vercel frontend URL
3. Deploy frontend on Vercel with `VITE_API_BASE_URL` pointing to this URL
4. Test the full stack

See `DEPLOYMENT_ISSUES_AND_FIXES.md` for complete end-to-end instructions.
