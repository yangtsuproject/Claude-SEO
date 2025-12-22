# Quick Start - Vercel Deployment

## Option 1: Frontend on Vercel + Backend on Railway (Recommended)

### Step 1: Deploy Frontend to Vercel

1. **Push your code to GitHub** (already done ✓)

2. **Go to Vercel**: https://vercel.com/new

3. **Import Repository**:
   - Click "Import Git Repository"
   - Select your `Claude-SEO` repo
   - Click "Import"

4. **Configure Build Settings**:
   ```
   Framework Preset: Vite
   Root Directory: frontend
   Build Command: npm run build (auto-detected)
   Output Directory: dist (auto-detected)
   Install Command: npm install (auto-detected)
   ```

5. **Add Environment Variables**:
   Click "Environment Variables" and add:
   ```
   VITE_CLERK_PUBLISHABLE_KEY = pk_test_... (get from clerk.com)
   VITE_API_URL = https://temp.railway.app (we'll update this after backend deployment)
   ```

6. **Deploy**: Click "Deploy"

### Step 2: Deploy Backend to Railway

1. **Go to Railway**: https://railway.app/new

2. **Create Project**:
   - Click "Deploy from GitHub repo"
   - Authorize Railway to access your GitHub
   - Select `Claude-SEO` repository
   - Railway will auto-detect the project

3. **Configure Service**:
   - Click "Add variables"
   - Set root directory: `backend`
   - Add start command: `npm run prisma:migrate:deploy && npm start`

4. **Add PostgreSQL Database**:
   - Click "+ New"
   - Select "Database" → "Add PostgreSQL"
   - Railway will auto-create `DATABASE_URL`

5. **Add Redis**:
   - Click "+ New"
   - Select "Database" → "Add Redis"
   - Railway will auto-create `REDIS_URL`

6. **Add Environment Variables**:
   Click your backend service → "Variables" → "Raw Editor":
   ```
   CLERK_SECRET_KEY=sk_test_... (get from clerk.com)
   CLERK_WEBHOOK_SECRET=whsec_... (get from clerk.com webhooks)
   DATAFORSEO_LOGIN=your-email@example.com
   DATAFORSEO_PASSWORD=your-password
   ANTHROPIC_API_KEY=sk-ant-... (get from console.anthropic.com)
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=${{RAILWAY_PUBLIC_DOMAIN}} or your-vercel-url.vercel.app
   ```

7. **Enable Public Domain**:
   - Click "Settings" → "Networking"
   - Click "Generate Domain"
   - Copy the URL (e.g., `backend-production-xxxx.railway.app`)

8. **Deploy**: Railway will automatically deploy

### Step 3: Connect Frontend to Backend

1. **Update Vercel Environment Variable**:
   - Go to Vercel Dashboard → Your Project
   - Settings → Environment Variables
   - Edit `VITE_API_URL`:
     ```
     VITE_API_URL = https://your-backend.railway.app
     ```
   - Redeploy: Deployments → Click ⋯ → Redeploy

### Step 4: Configure Clerk Webhooks

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com
2. Click your application → "Webhooks"
3. Click "+ Add Endpoint"
4. **Endpoint URL**:
   ```
   https://your-backend.railway.app/api/auth/webhook
   ```
5. **Subscribe to events**:
   - [x] user.created
   - [x] user.updated
   - [x] user.deleted
6. Copy the "Signing Secret" (starts with `whsec_`)
7. Add to Railway environment variables as `CLERK_WEBHOOK_SECRET`

### Step 5: Get Your API Keys

#### Clerk (Free)
1. Go to https://clerk.com → Sign up
2. Create new application
3. Copy `Publishable Key` → Add to Vercel as `VITE_CLERK_PUBLISHABLE_KEY`
4. Copy `Secret Key` → Add to Railway as `CLERK_SECRET_KEY`

#### DataForSEO ($1 Free Credit)
1. Go to https://app.dataforseo.com/register
2. Sign up (you get $1 free credit)
3. Go to "API Access"
4. Use your email as `DATAFORSEO_LOGIN`
5. Use your password as `DATAFORSEO_PASSWORD`

#### Anthropic Claude (Pay-as-you-go)
1. Go to https://console.anthropic.com
2. Sign up and add payment method
3. Go to "API Keys" → Create key
4. Copy key → Add to Railway as `ANTHROPIC_API_KEY`

## Option 2: Everything on Railway

If you prefer to host everything on Railway:

1. **Deploy Backend** (same as above)
2. **Deploy Frontend**:
   - Click "+ New" → "Deploy from GitHub"
   - Select same repository
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Start command: `npm run preview`
   - Add environment variables:
     ```
     VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
     VITE_API_URL=https://your-backend.railway.app
     ```

## Testing Your Deployment

1. **Visit your Vercel URL**: `https://your-app.vercel.app`
2. **Sign in** with Clerk
3. **Create a test project**
4. **Start keyword research** with a few keywords:
   ```
   best coffee shops singapore
   coffee shop near me
   specialty coffee singapore
   ```
5. **Watch it process** and view results!

## Monitoring

### Check Logs
- **Vercel**: Dashboard → Deployments → View Function Logs
- **Railway**: Dashboard → Service → Logs tab

### Check Database
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link
railway login
railway link

# View database
railway run npx prisma studio
```

## Common Issues

### "Network Error" or "Failed to fetch"
✅ **Fix**: Check `VITE_API_URL` matches your Railway backend URL exactly

### "Unauthorized" errors
✅ **Fix**: Verify Clerk keys are correct in both Vercel and Railway

### "Database connection failed"
✅ **Fix**: Ensure PostgreSQL service is running in Railway

### Keywords not processing
✅ **Fix**: Check Railway logs for errors, verify API keys

## You're All Set! 🎉

Your SEO Keyword Research Tool is now live on:
- **Frontend**: Vercel (https://your-app.vercel.app)
- **Backend**: Railway (https://your-backend.railway.app)
- **Database**: Railway PostgreSQL
- **Queue**: Railway Redis

Start researching keywords with AI-powered clustering!
