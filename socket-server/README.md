# BAP Socket Server

Standalone Socket.IO server for the BAP application.

## Environment Variables

Set these in Railway (or your hosting provider):

```
MONGODB_URI=mongodb+srv://your-connection-string
JWT_SECRET=your-jwt-secret-same-as-backend
FRONTEND_URL=https://your-frontend.vercel.app
PORT=3002
```

## Deploy to Railway

1. Go to [Railway](https://railway.app) and create a new project
2. Choose "Deploy from GitHub repo"
3. Select this repository and set the root directory to `socket-server`
4. Add the environment variables listed above
5. Railway will automatically deploy

## After Deployment

1. Copy your Railway socket server URL (e.g., `https://bap-socket-server.railway.app`)
2. Update your frontend's `NEXT_PUBLIC_SOCKET_URL` environment variable to this URL
3. Add the Railway URL to the `ALLOWED_ORIGINS` in `index.ts` if not using `FRONTEND_URL`

## Local Development

```bash
npm install
npm run dev
```
