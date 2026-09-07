# Supabase Integration Setup Guide

## ✅ Completed Tasks
- ✅ Supabase TypeScript client created: `executive-hostel-web/src/lib/supabase.ts`
- ✅ Frontend build passes (npm run build)
- ✅ Backend build passes (npm run build)
- ✅ `@supabase/supabase-js` package installed
- ✅ `browser-image-compression` package installed
- ✅ Payment route updated to use Supabase URLs instead of S3 keys
- ✅ Maintenance route updated to use Supabase uploads
- ✅ SubmitPayment component updated for Supabase
- ✅ Login component updated with session persistence checkbox

## 🔧 Next Steps: Environment Configuration

### Step 1: Get Your Supabase Credentials
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **Project Settings** → **API**
4. Copy:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon public** key (the "public" key, safe to expose in frontend)

### Step 2: Configure Frontend Environment

**For Development (Local):**
Create `.env.local` in `executive-hostel-web/`:
```
VITE_API_BASE_URL=
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anonymous-key
```

**For Production (Vercel):**
1. Go to Vercel project settings
2. Navigate to **Environment Variables**
3. Add:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key

### Step 3: Verify Supabase Storage Setup

Check that your Supabase project has:
- ✅ Bucket named `payment-evidence` (public access)
- ✅ Storage permissions allow anonymous uploads

**To verify storage access:**
```sql
-- Run in Supabase SQL Editor to check policies
SELECT * FROM storage.buckets;
```

Your `payment-evidence` bucket should exist and be marked as `public`.

## 🧪 Testing the Integration

### Local Testing
1. Start the frontend:
   ```bash
   cd executive-hostel-web
   npm run dev
   ```

2. Test file upload:
   - Navigate to **Submit Payment** page
   - Try uploading an image
   - Check browser console for: `✅ File uploaded successfully to Supabase: https://...`
   - Verify file appears in Supabase Storage dashboard

3. Verify database:
   - Check your Supabase database `payments` table
   - Evidence URLs should start with `https://your-project.supabase.co/storage/v1/object/public/payment-evidence/`

### Upload Flow Checklist
- [ ] File selected and displayed in preview
- [ ] "Keep me signed in" checkbox works for session persistence
- [ ] File uploads without CORS errors
- [ ] Payment evidence saved with correct Supabase URL
- [ ] Image compression reduces file size (check browser DevTools)

## 🚀 Production Deployment

### Backend (Render)
1. Update environment variables (if needed):
   - No changes required - backend doesn't directly upload to Supabase
   - Frontend handles all file uploads

2. Redeploy to Render:
   ```bash
   git push origin main
   ```

### Frontend (Vercel)
1. Add environment variables (see Step 2 above)
2. Deploy:
   ```bash
   vercel deploy --prod
   ```

## 📊 Architecture Summary

**File Upload Flow (New):**
```
Browser
  ↓
Upload file with compression (browser-image-compression)
  ↓
uploadFileToSupabase() in supabase.ts
  ↓
Supabase Storage (payment-evidence bucket)
  ↓
Returns public URL: https://project.supabase.co/storage/v1/object/public/payment-evidence/{file}
  ↓
Frontend sends URL to backend via API
  ↓
Backend stores URL in database
  ↓
Admin can view evidence by clicking download link
```

## 🐛 Troubleshooting

### Error: "Missing Supabase environment variables"
- **Fix:** Ensure `.env.local` (dev) or Vercel env vars (prod) are set with correct keys
- Restart dev server after adding env vars

### Error: "CORS error" or "Upload blocked"
- **Fix:** Your Supabase `payment-evidence` bucket must be public
- Go to Supabase Storage → payment-evidence → Settings → Public bucket toggle

### Error: "Could not generate public URL"
- **Fix:** Verify bucket permissions allow public file access
- Check Supabase RLS policies for storage.objects

### Large file uploads failing
- Browser compression is enabled (maxSizeMB: 1, maxWidthOrHeight: 1920)
- Check file size in console before upload
- Verify network timeout settings in frontend config

## 🧹 Optional Cleanup

Old Backblaze B2 functions (no longer needed):
- File: `executive-hostel-api/src/lib/storage.ts`
- Functions to remove:
  - `createEvidenceUploadPost()` - presigned URL creation
  - Import removed from `payments.routes.ts`

Can be cleaned up after confirming Supabase integration works.

## ✅ Verification Checklist

- [ ] `.env.local` (or Vercel env vars) configured with Supabase credentials
- [ ] Frontend builds without errors: `npm run build`
- [ ] Backend builds without errors: `npm run build`
- [ ] Local dev server runs: `npm run dev`
- [ ] File upload to Submit Payment works
- [ ] Image compression reduces file size
- [ ] Supabase Storage shows uploaded files
- [ ] Database evidence URLs are correct
- [ ] Login session persistence checkbox works
- [ ] Vercel and Render deployments successful
