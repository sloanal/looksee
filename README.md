# Looksee

A multiplayer, collaborative movie & show recommendation engine and catalog.

## Features

- **Multi-room support**: Create or join rooms to share recommendations with friends/households
- **TMDB integration**: Search and add movies/shows from The Movie Database
- **Personal preferences**: Rate titles with status (want to see, seen, etc.) and excitement levels (1-5)
- **Smart recommendations**: Get personalized watch recommendations based on your preferences or the whole room's interests
- **Mobile-first design**: Optimized for mobile browsers with native-feeling interactions
- **Bring your titles to a new room**: After creating or joining a room, Looksee offers to copy titles you already have into it — everything you want to watch, are excited about, favorited, have already seen, or added yourself, or a hand-picked selection from a searchable checklist. It only shares existing titles with the room; nothing is created or re-rated
- **Letterboxd import**: Bring a watchlist in from a Letterboxd CSV export (their Settings → Data → Export your data), offered during onboarding and from Settings. Letterboxd has no public list API, so the export file is the only supported route; rows are matched against TMDB. You pick the status and excitement the films land on (excited about something you haven't seen, by default) and which rooms they go into — rows that carry star ratings keep those instead, coming in as already seen

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **UI**: React + Tailwind CSS
- **Database**: Prisma + PostgreSQL (Vercel Postgres)
- **Storage**: Vercel Blob Storage for file uploads
- **Auth**: NextAuth.js with credentials provider
- **External API**: TMDB (The Movie Database)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A TMDB API key (get one at https://www.themoviedb.org/settings/api)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up environment variables:

Create a `.env` file in the root directory:

```env
# Postgres connection string (local or hosted)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/looksee?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
TMDB_API_KEY="your-tmdb-v3-api-key-here"
# Optional: v4 "API Read Access Token" (a JWT starting with eyJ...). Used as a bearer token
# when set; TMDB_API_KEY is used as the api_key query param otherwise.
TMDB_API_READ_ACCESS_TOKEN=""
RESEND_API_KEY="re_your_resend_api_key"
EMAIL_FROM="Looksee <noreply@your-domain.com>"
# Web push (optional). Generate a key pair with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
VAPID_SUBJECT="mailto:you@your-domain.com"
```

Note: This project uses PostgreSQL. A sqlite `file:./dev.db` URL will not work with the current Prisma schema.

### Local Postgres (Docker)

If you don't have Postgres running locally, you can start one with Docker:

```bash
npm run db:up
```

This uses `docker-compose.yml` and exposes Postgres on `localhost:5432` with:

- user: `postgres`
- password: `postgres`
- database: `looksee`

Stop it with:

```bash
npm run db:down
```

3. Set up the database:

```bash
npm run db:push
npm run db:generate
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Sign up** for an account
2. **Create or join a room** using an invite code
3. **Rate existing titles** in the room (onboarding flow)
4. **Add new titles** by searching TMDB or adding manually
5. **Browse** the shared catalog with filters and search
6. **Get recommendations** for what to watch next (just for you or for the whole room)

## Database Schema

The app uses Prisma with the following main models:

- `User`: User accounts
- `Room`: Shared rooms for groups of users
- `RoomMembership`: Many-to-many relationship between users and rooms
- `MediaItem`: Movies, shows, videos, or links in a room
- `UserMediaPreference`: Per-user preferences for each media item (status, excitement, notes)

## API Routes

- `/api/auth/*` - Authentication (NextAuth)
- `/api/rooms` - Room management (create, list, join)
- `/api/rooms/[roomId]/media` - Media items in a room
- `/api/rooms/[roomId]/unrated` - Unrated items for onboarding
- `/api/rooms/[roomId]/recommendations` - Watch recommendations
- `/api/media/[mediaItemId]/preference` - User preferences
- `/api/tmdb/*` - TMDB API proxy

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:push` - Push Prisma schema to database
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio

## Production Deployment (Vercel)

This app is configured for deployment on Vercel with PostgreSQL and Blob Storage.

### Prerequisites

1. A GitHub account
2. A Vercel account (sign up at [vercel.com](https://vercel.com))
3. A TMDB API key (get one at https://www.themoviedb.org/settings/api)

### Deployment Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click "New Project" and import your repository
   - Vercel will automatically detect it's a Next.js app

3. **Set up Vercel Postgres Database**
   - In your Vercel project dashboard, go to the **Storage** tab
   - Click **Create Database** → Select **Postgres**
   - Choose a name and region
   - Vercel will automatically set the `DATABASE_URL` environment variable

4. **Set up Vercel Blob Storage** (for file uploads)
   - In the **Storage** tab, click **Create Database** → Select **Blob**
   - Choose a name
   - Vercel will automatically set the `BLOB_READ_WRITE_TOKEN` environment variable

5. **Configure Environment Variables**
   - Go to **Settings** → **Environment Variables**
   - Add the following:
     - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32` (or use any secure random string)
     - `TMDB_API_KEY` and/or `TMDB_API_READ_ACCESS_TOKEN`: TMDB credentials (see reference below)
     - `NEXTAUTH_URL`: Will be auto-set by Vercel, but you can override if needed
     - `RESEND_API_KEY`: API key from Resend
     - `EMAIL_FROM`: Verified sender identity in Resend (for example: `Looksee <noreply@your-domain.com>`)
     - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: Web push credentials (see below); omit all three to leave push notifications off

6. **Deploy**
   - Click **Deploy** (or push to your main branch for automatic deployment)
   - Vercel will build and deploy your app
   - Production builds now fail if `prisma migrate deploy` fails (safer default)

7. **Run Database Migrations** (IMPORTANT - Do this after creating the database!)
   
   **Option A: Using Vercel CLI (Recommended)**
   ```bash
   # Install Vercel CLI if you haven't
   npm i -g vercel
   
   # Link your project
   vercel link
   
   # Pull environment variables
   vercel env pull .env.local
   
   # Run migrations
   npx prisma migrate deploy
   ```
   
   **Option B: Using the API endpoint (opt-in)**
   - Set environment variables first:
     - `ALLOW_RUNTIME_MIGRATIONS=true`
     - `MIGRATION_TOKEN=<a long random secret, 24+ chars>`
   - After deployment, call: `POST https://your-app.vercel.app/api/admin/migrate`
   - Include header: `Authorization: Bearer <MIGRATION_TOKEN>`
   - In production, this endpoint is disabled unless `ALLOW_RUNTIME_MIGRATIONS=true`
   
   **Option C: Manual via Vercel Dashboard**
   - Go to your Postgres database in Vercel Storage
   - Click "Connect" or use the Query tab
   - Copy the connection string and run locally:
     ```bash
     DATABASE_URL="your-connection-string" npx prisma migrate deploy
     ```

### Automatic Deployments

Once connected, every push to your main branch will automatically trigger a new deployment on Vercel.

### Environment Variables Reference

- `DATABASE_URL` - Automatically set by Vercel Postgres
- `BLOB_READ_WRITE_TOKEN` - Automatically set by Vercel Blob Storage
- `NEXTAUTH_SECRET` - Required: Generate a secure random string
- `NEXTAUTH_URL` - Automatically set by Vercel (your app URL)
- `TMDB_API_KEY` / `TMDB_API_READ_ACCESS_TOKEN` - At least one is required. Both come from https://www.themoviedb.org/settings/api. `TMDB_API_READ_ACCESS_TOKEN` must be the v4 "API Read Access Token" (a JWT: three dot-separated segments starting with `eyJ`) and is sent as a bearer token; anything else in that slot is ignored. `TMDB_API_KEY` is the 32-character v3 key, used as the `api_key` query param when no valid token is set and as a fallback if the token is rejected
- `RESEND_API_KEY` - Required for production password reset emails
- `EMAIL_FROM` - Required sender identity for password reset emails (must be verified with your email provider)
- `MIGRATIONS_FAIL_OPEN` - Optional emergency bypass (`true` to continue prod builds when migrations fail)
- `MIGRATION_TOKEN` - Required if using `/api/admin/migrate` (use 24+ character random secret)
- `ALLOW_RUNTIME_MIGRATIONS` - Optional, defaults to off in production; set `true` only when you intentionally want `/api/admin/migrate` enabled
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` - Optional: VAPID key pair for web push (`npx web-push generate-vapid-keys`). Generate once and keep the pair stable; rotating it invalidates every existing browser subscription
- `VAPID_SUBJECT` - Required alongside the VAPID keys: a `mailto:` or `https:` contact URL that push services can use to reach you
- `PUSH_DEBOUNCE` - Optional: set to `off` to send room-addition pushes immediately instead of batching for ~8s (always immediate when `VERCEL` is set)

## Push Notifications

Members of a room can opt in (Settings → Notifications) to a web push when someone else in the room adds a title. This is standard PWA Web Push — no APNs/FCM SDKs. Subscriptions live in the `PushSubscription` table; a user with no rows is simply opted out.

When one person adds several titles in a row, the server batches them per actor+room for about 8 seconds and sends a single "added N titles" notification, and the service worker uses a per-room `tag` so anything that still arrives in a burst collapses on the device. The batching is an in-process timer, so on serverless hosts (Vercel) it's skipped and each add is sent immediately; the `tag` collapse still applies there.

iOS Safari only supports web push when the app has been added to the Home Screen and is opened from there.

## License

MIT

