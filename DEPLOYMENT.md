# Deployment Guide: Hybrid-Env Monorepo

This guide outlines how to deploy the **Hybrid-Env** monorepo separately:
1. **AI Core (Python)** on **Render** (Web Service)
2. **Backend Express API (Node.js)** on **Render** (Web Service)
3. **Frontend (Vite/React)** on **Vercel** (Static Hosting)

---

## 1. Deploy AI Core (Python API) on Render

The AI Core is a FastAPI application situated in `apps/ai-core`.

1. Sign in to **Render** and click **New > Web Service**.
2. Connect your Git repository.
3. Configure the following settings:
   - **Name**: `hybrid-env-ai-core`
   - **Language**: `Python`
   - **Root Directory**: `apps/ai-core` (Crucial: points Render to run inside the subfolder)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free` (or higher)
4. Click **Create Web Service**.
5. Once deployed, note down the generated URL (e.g., `https://hybrid-env-ai-core.onrender.com`). You will need this for the Node.js backend.

---

## 2. Deploy Backend (Node.js API) on Render

The backend is an Express server situated in `apps/backend`. It relies on the root project's workspaces to resolve dependency packages.

1. In **Render**, click **New > Web Service**.
2. Connect your Git repository.
3. Configure the following settings:
   - **Name**: `hybrid-env-backend`
   - **Language**: `Node`
   - **Root Directory**: Leave empty/root `.` (so it has access to root `package.json` workspaces and configurations)
   - **Build Command**: `npm install && npm run build -w apps/backend`
   - **Start Command**: `npm run start -w apps/backend`
4. Add the following **Environment Variables** in the environment tab:
   - `PORT`: `4000` (or let Render bind it automatically)
   - `AI_CORE_URL`: `https://hybrid-env-ai-core.onrender.com` (Replace with your actual deployed AI Core URL)
   - `NOMINATIM_URL`: `https://nominatim.openstreetmap.org/search`
   - `NOMINATIM_USER_AGENT`: `agentic-environment-intelligence/1.0`
   - `ENVIRONMENT_POLL_INTERVAL_MS`: `0` (Disables the background scheduler interval to stay within Render's free tier resources, or set to `60000` to enable it)
5. Click **Create Web Service**.
6. Once deployed, note down the generated URL (e.g., `https://hybrid-env-backend.onrender.com`).

---

## 3. Deploy Frontend (Vite/React) on Vercel

The frontend is a Vite app located in `apps/frontend`.

1. Go to **Vercel** and click **Add New > Project**.
2. Connect your Git repository.
3. Configure the following settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Leave empty/root `.` (important so Vercel can run npm install at the root level and resolve workspace symlinks correctly)
   - **Build Command**: `npm install && npm run build -w apps/frontend`
   - **Output Directory**: `apps/frontend/dist`
4. Expand **Environment Variables** and add:
   - `VITE_USE_MOCK`: `false` (Forces the frontend to fetch live data rather than local mock scenarios)
   - `VITE_API_URL`: `https://hybrid-env-backend.onrender.com` (Replace with your actual deployed Express backend URL)
5. Click **Deploy**.

---

## Verification
1. Once all three services are active, navigate to your Vercel deployment URL.
2. Focus the search bar: you will see the **Famous Indian Landmarks** populate instantly.
3. Select any landmark or search for a location in India:
   - The frontend will call your Express backend on Render.
   - The backend will fetch the infrastructure elements from OpenStreetMap and forward them to your AI Core on Render.
   - The AI Core will process the multi-agent cognitive cycle and return the custom recommendation.
