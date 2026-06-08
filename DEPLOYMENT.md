# Quick Deployment Guide - HUMBEE Partner Profiler

## 🚀 Deploy to Render (Recommended - Free Tier Available)

### Why Render?
- ✅ Free tier with 750 hours/month
- ✅ Persistent disk storage (perfect for SQLite)
- ✅ Automatic SSL certificates
- ✅ Easy GitHub integration
- ✅ Zero configuration needed

### Step-by-Step Instructions

#### 1. Prepare Your Repository

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Ready for deployment"

# Create GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/humbee-profiler.git
git push -u origin main
```

#### 2. Deploy to Render

1. **Sign up at [render.com](https://render.com)** using your GitHub account

2. **Click "New +" → "Web Service"**

3. **Connect your GitHub repository**:
   - Select "humbee-profiler" repository
   - Click "Connect"

4. **Configure the service**:
   - **Name**: `humbee-profiler` (or any name you prefer)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Select "Free"

5. **Add Environment Variables** (Optional - already set in code):
   - Click "Advanced" → "Add Environment Variable"
   - `NODE_ENV` = `production`
   - `DATABASE_FILE` = `leads.db`

6. **Configure Persistent Disk** (IMPORTANT for SQLite):
   - Scroll to "Disks" section
   - Click "Add Disk"
   - **Name**: `database`
   - **Mount Path**: `/opt/render/project/src`
   - **Size**: `1 GB` (free tier)

7. **Click "Create Web Service"**

8. **Wait for deployment** (2-3 minutes)
   - Watch the build logs
   - Once complete, you'll see "Your service is live 🎉"

9. **Access your app**:
   - URL: `https://humbee-profiler.onrender.com` (or your chosen name)
   - Click the URL to open your live application!

### Post-Deployment

#### Test Your Application
1. Open the live URL
2. Click "Get Started" to test the profiler
3. Fill out the form and submit
4. Access admin panel: `https://your-app.onrender.com/?admin=true`

#### Monitor Your App
- **Logs**: Dashboard → Logs tab
- **Metrics**: Dashboard → Metrics tab
- **Shell Access**: Dashboard → Shell tab

#### Database Persistence
- Your SQLite database (`leads.db`) is stored on the persistent disk
- Data survives restarts and redeployments
- Backup: Use Render Shell to download database periodically

### Troubleshooting

**Issue**: App shows "Application Error"
- **Fix**: Check logs in Render dashboard → Logs tab

**Issue**: Database not persisting
- **Fix**: Ensure disk is mounted at `/opt/render/project/src`

**Issue**: Slow cold starts
- **Fix**: Free tier spins down after inactivity. Upgrade to paid tier for 24/7 availability

### Custom Domain (Optional)

1. Go to "Settings" → "Custom Domains"
2. Click "Add Custom Domain"
3. Enter your domain (e.g., `profiler.humbee.com`)
4. Update DNS records as shown
5. SSL certificate auto-generated

---

## Alternative: Deploy to Railway

### Quick Deploy (Even Easier!)

1. **Go to [railway.app](https://railway.app)**
2. **Click "Start a New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Authorize Railway and select your repository**
5. **Add a volume**:
   - Click "Settings" → "Volumes"
   - Mount Path: `/app`
6. **Done!** Your app is live at `https://your-app.up.railway.app`

---

## Need Help?

- **Render Docs**: https://render.com/docs
- **Railway Docs**: https://docs.railway.app
- **Support**: Check the main README.md for more deployment options

## 🎉 Your HUMBEE Partner Profiler is now live!
