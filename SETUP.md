# GreenVerse Backend Setup Guide

## Prerequisites
- Node.js (v16 or higher)
- A Supabase account (free tier)

## Step 1: Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the database to be provisioned (2-3 minutes)
4. Go to **Project Settings** → **API**
5. Copy the following:
   - Project URL
   - `anon` public key
   - `service_role` secret key

## Step 2: Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire content from `backend/database/schema.sql`
4. Paste it into the SQL Editor
5. Click **Run** to execute the schema

This will create all tables, indexes, and insert sample data.

## Step 3: Configure Backend

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_KEY=your_service_role_key_here
   JWT_SECRET=your_random_secret_key_min_32_chars
   PORT=5000
   FRONTEND_URL=http://localhost:5173
   ```

## Step 4: Start Backend Server

```bash
npm run dev
```

The API will run on http://localhost:5000

## Step 5: Configure Frontend

1. Navigate to the frontend root folder:
   ```bash
   cd ..
   ```

2. Install axios (if not already installed):
   ```bash
   npm install axios
   ```

3. Create `.env` file in the root:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

## Step 6: Test the API

1. Backend health check:
   ```
   http://localhost:5000/api/health
   ```

2. Get all products:
   ```
   http://localhost:5000/api/products
   ```

## Default Admin Login

After running the schema, you can login with:
- **Email**: admin@greenverse.com
- **Password**: admin123

⚠️ **Change this password immediately in production!**

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Products (Public GET, Admin Create/Update/Delete)
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Orders (Authenticated)
- `GET /api/orders` - Get orders (filtered by role)
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PATCH /api/orders/:id/status` - Update status (admin)

### Clusters (Authenticated)
- `GET /api/clusters` - Get all clusters
- `GET /api/clusters/:id` - Get single cluster
- `POST /api/clusters` - Create cluster (admin)
- `PUT /api/clusters/:id` - Update cluster (admin)

### Users (Authenticated)
- `GET /api/users` - Get all users (admin)
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update profile

### Dashboard (Public)
- `GET /api/dashboard/stats` - Get real-time statistics
- `GET /api/dashboard/orders-trend` - Get orders trend

## Next Steps

Now update your frontend login/signup pages to use the new API:

1. Update `src/app/(auth)/login.jsx` to use `authAPI.login()`
2. Update `src/app/(auth)/register.jsx` to use `authAPI.signup()`
3. Update `src/app/(public)/home.jsx` to fetch real-time stats
4. Update dashboard pages to use real data

## Troubleshooting

### CORS Error
Make sure `FRONTEND_URL` in `.env` matches your frontend URL

### Database Connection Error
Verify your Supabase URL and keys are correct

### Token Expiration
Tokens expire after 7 days. User will need to login again.

## Production Deployment

### Backend (Railway/Render/Heroku)
1. Push code to GitHub
2. Connect your deployment platform
3. Add environment variables
4. Deploy

### Database (Supabase)
- Already cloud-hosted
- No additional setup needed
- Free tier includes 500MB database

### Frontend (Vercel/Netlify)
1. Update `VITE_API_URL` to your production backend URL
2. Deploy normally

## Support
For issues, check:
- Backend logs: `npm run dev` console
- Supabase logs: Dashboard → Logs
- Browser console: Network tab for API calls
