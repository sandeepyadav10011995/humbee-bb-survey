# HUMBEE Partner Profiler & Lead Intelligence Dashboard

A comprehensive partner profiling and lead management system built with Node.js, Express, and SQLite.

## Features

- 🎯 Interactive multi-step profiling questionnaire
- 📊 Real-time analytics dashboard with 6 KPIs
- 🔄 Multi-select support for profile roles and communication preferences
- 📈 Chart.js visualizations for data insights
- 📥 Excel export functionality
- 🔔 Server-Sent Events (SSE) for live notifications
- 🎉 Confetti animations for successful submissions

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: Vanilla JavaScript (SPA routing)
- **Visualization**: Chart.js
- **Real-time**: Server-Sent Events (SSE)

## Local Development

### Prerequisites

- Node.js >= 16.x
- npm >= 8.x

### Installation

```bash
# Install dependencies
npm install

# Create .env file from template
cp .env.example .env

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

### Seeding Database

```bash
npm run seed
```

## Cloud Deployment

### Option 1: Render (Recommended)

**Render** offers a free tier with persistent storage and easy deployment.

1. **Create a Render account**: [render.com](https://render.com)

2. **Create a new Web Service**:
   - Connect your GitHub repository
   - Select "Node" environment
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Add Environment Variables**:
   ```
   NODE_ENV=production
   DATABASE_FILE=leads.db
   ```

4. **Configure Persistent Disk** (Important for SQLite):
   - Go to "Disks" section
   - Add a new disk
   - Mount Path: `/opt/render/project/src`
   - Size: 1GB (free tier)

5. **Deploy**: Click "Create Web Service"

Your app will be live at `https://your-app-name.onrender.com`

### Option 2: Railway

1. **Create Railway account**: [railway.app](https://railway.app)

2. **Deploy from GitHub**:
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository

3. **Environment Variables**:
   ```
   NODE_ENV=production
   DATABASE_FILE=/data/leads.db
   ```

4. **Add Volume** (for persistent SQLite):
   - In project settings, add a volume
   - Mount path: `/data`

### Option 3: Heroku

1. **Install Heroku CLI** and login:
   ```bash
   heroku login
   ```

2. **Create Heroku app**:
   ```bash
   heroku create your-app-name
   ```

3. **Set environment variables**:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set DATABASE_FILE=leads.db
   ```

4. **Deploy**:
   ```bash
   git push heroku main
   ```

**Note**: Heroku's free tier has ephemeral filesystem. For production, consider:
- Using Heroku Postgres addon instead of SQLite
- Or use a paid dyno with persistent storage

### Option 4: AWS/Azure/GCP

For enterprise deployments:

1. **Containerize with Docker** (see Dockerfile section)
2. Deploy to:
   - AWS: Elastic Beanstalk or ECS
   - Azure: App Service or Container Instances
   - GCP: Cloud Run or App Engine

## Docker Deployment (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t humbee-profiler .
docker run -p 3000:3000 -v $(pwd)/leads.db:/app/leads.db humbee-profiler
```

## Production Considerations

### Database Migration

For production environments, consider migrating from SQLite to:
- **PostgreSQL** (recommended for Heroku, Render)
- **MySQL/MariaDB**
- **MongoDB** (requires schema changes)

### Environment Variables

Ensure these are set in production:
- `NODE_ENV=production`
- `PORT` (auto-set by most platforms)
- `DATABASE_FILE` (path to SQLite file or DB connection string)

### Security Enhancements

- Add rate limiting (e.g., `express-rate-limit`)
- Implement CORS whitelist for specific domains
- Use HTTPS (auto-handled by platforms like Render, Heroku)
- Add input sanitization
- Set up monitoring (e.g., Sentry, LogRocket)

### Performance Optimization

- Enable gzip compression
- Add caching headers for static assets
- Consider CDN for `public/` files
- Connection pooling for database (if migrating from SQLite)

## Project Structure

```
.
├── server.js           # Express server & API routes
├── database.js         # SQLite connection & helpers
├── seed.js            # Database seeding script
├── package.json       # Dependencies & scripts
├── .env               # Environment variables (not in git)
├── .env.example       # Environment template
├── Procfile           # Heroku deployment config
├── public/            # Frontend assets
│   ├── index.html     # Main UI (profiler + admin)
│   ├── app.js         # Client-side logic
│   └── style.css      # Styling
└── leads.db           # SQLite database (not in git)
```

## API Endpoints

- `POST /api/profile` - Submit new profile
- `GET /api/dashboard` - Dashboard KPIs
- `GET /api/leads` - Filtered lead list
- `GET /api/analytics` - Analytics data
- `GET /api/event-closure` - Event closure stats
- `GET /api/notifications/stream` - SSE endpoint

## Support

For issues or questions, contact the development team.

## License

ISC
