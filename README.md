# ReadingHub

ReadingHub is a full-stack personal library and reading tracker. It lets readers manage books, record reading sessions, organize collections, review progress, and receive AI-assisted recommendations and insights.

## Features

- Secure account registration and JWT authentication
- Personal profile, avatar, privacy setting, and annual reading goal
- Book creation, editing, deletion, search, filtering, sorting, and pagination
- Five reading states: want to read, in progress, completed, on hold, and did not finish
- Reading-session tracking with pages, duration, mood, location, and notes
- Custom book collections
- Reading analytics, streaks, genre distribution, and goal progress
- Gemini-powered recommendations, summaries, goals, insights, and book chat
- Book discovery through Google Books with an automatic Open Library fallback
- Responsive React interface

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 18, React Router 7, Vite 8, Tailwind CSS 4 |
| Backend | Node.js, Express |
| Database | PostgreSQL, Prisma ORM |
| Authentication | JSON Web Tokens, bcrypt |
| AI | Google Gemini |
| Book search | Google Books, Open Library fallback |
| Hosting | Vercel frontend, Render backend, Neon PostgreSQL |

## Project structure

```text
readinghub/
├── backend/
│   ├── config/              # Runtime environment validation
│   ├── lib/                 # Shared Prisma client
│   ├── middleware/          # Authentication middleware
│   ├── prisma/              # Schema and database migrations
│   ├── routes/              # REST API routes
│   ├── services/            # Gemini and book-search integrations
│   ├── .env.example
│   ├── render.yaml
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── config.js
│   ├── .env.example
│   └── vite.config.js
├── .github/workflows/ci.yml
└── DEPLOYMENT.md
```

## Requirements

- Node.js 20.19 or newer
- npm
- A PostgreSQL database
- A Gemini API key for AI features
- A Google Books API key is optional

## Local setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd readinghub
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
npm install
```

Update `backend/.env`:

```env
NODE_ENV=development
PORT=5001
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN=7d
JWT_ISSUER=readinghub-api
JWT_AUDIENCE=readinghub-web
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# Optional: Google Books is preferred when this is configured.
# Open Library is used automatically when it is omitted or quota-limited.
GOOGLE_BOOKS_API_KEY=
```

Generate a secure JWT secret with:

```bash
openssl rand -base64 48
```

Apply database migrations and start the API:

```bash
npx prisma migrate deploy
npm run dev
```

The API runs at `http://localhost:5001`.

Verify it with:

```text
http://localhost:5001/health
http://localhost:5001/ready
```

### 3. Configure the frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend environment file should contain:

```env
VITE_API_URL=http://localhost:5001
```

The frontend runs at `http://localhost:3000`.

> Variables beginning with `VITE_` are included in browser code. Never store secrets in a frontend environment variable.

## Useful commands

### Backend

```bash
cd backend
npm run dev                 # Start the API
npm run build               # Generate the Prisma client
npx prisma validate         # Validate the Prisma schema
npx prisma migrate deploy   # Apply committed migrations
npx prisma studio           # Open the database browser
npm audit                   # Check dependencies
```

### Frontend

```bash
cd frontend
npm run dev                 # Start Vite development server
npm run build               # Create production build
npm run preview             # Preview production build
npm audit                   # Check dependencies
```

## API overview

Authenticated endpoints expect this header:

```http
Authorization: Bearer <token>
```

### Authentication and profile

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Create an account |
| `POST` | `/api/auth/login` | Log in and receive a token |
| `GET` | `/api/auth/me` | Get the current user |
| `GET` | `/api/auth/profile` | Get the complete profile |
| `PUT` | `/api/auth/profile` | Update the profile and reading goal |

### Books

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/books` | List and filter books |
| `GET` | `/api/books/search?q=...` | Search external book catalogs |
| `GET` | `/api/books/:id` | Get a book |
| `POST` | `/api/books` | Add a book |
| `PUT` | `/api/books/:id` | Update a book |
| `DELETE` | `/api/books/:id` | Delete a book |
| `GET` | `/api/books/stats/overview` | Get book totals |

### Reading data

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/reading-sessions` | List reading sessions |
| `POST` | `/api/reading-sessions` | Record a reading session |
| `DELETE` | `/api/reading-sessions/:id` | Delete a session |
| `GET` | `/api/collections` | List collections |
| `POST` | `/api/collections` | Create a collection |
| `DELETE` | `/api/collections/:id` | Delete a collection |
| `GET` | `/api/analytics/stats` | Get reading statistics |
| `GET` | `/api/analytics/reading-progress` | Get progress history |
| `GET` | `/api/analytics/genres` | Get genre distribution |

### AI

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/ai/recommendations` | Generate book recommendations |
| `GET` | `/api/ai/insights` | Analyze reading patterns |
| `GET` | `/api/ai/summary/:bookId` | Generate a book summary |
| `GET` | `/api/ai/goals` | Suggest reading goals |
| `POST` | `/api/ai/chat` | Chat about books and reading |

## Production deployment

The recommended order is:

1. Create a Neon PostgreSQL database.
2. Deploy the backend to Render.
3. Deploy the frontend to Vercel.
4. Update the backend's allowed frontend origin.

### Render backend

Create a Node Web Service with:

```text
Root Directory: backend
Build Command: npm ci && npx prisma migrate deploy
Start Command: npm start
Health Check Path: /ready
```

Configure:

```env
NODE_ENV=production
DATABASE_URL=<neon-connection-string>
JWT_SECRET=<32-or-more-random-characters>
FRONTEND_URL=https://your-frontend.vercel.app
GEMINI_API_KEY=<gemini-key>
GEMINI_MODEL=gemini-2.5-flash
GOOGLE_BOOKS_API_KEY=<optional-google-books-key>
```

Render supplies `PORT`; do not hardcode it.

### Vercel frontend

Import the same repository and configure:

```text
Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

Set this for Production and Preview:

```env
VITE_API_URL=https://your-backend.onrender.com
```

After adding or changing `VITE_API_URL`, redeploy the frontend because Vite reads this value during the build.

The checked-in `frontend/vercel.json` sends client-side routes such as `/login` and `/profile` to `index.html`. Keep this file when deploying to Vercel so page refreshes, direct links, and logout navigation do not return a platform 404.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for a more detailed deployment checklist.

## Production safeguards

- Exact CORS origin allowlisting
- Helmet security headers on the API
- Global, authentication, and AI-specific rate limits
- JSON request-size limits
- JWT algorithm, issuer, audience, and expiration validation
- Centralized Prisma connection handling
- Input validation and user-scoped database access
- Database-aware readiness checks
- Graceful server shutdown
- Automated frontend and backend builds through GitHub Actions

## Troubleshooting

### The backend fails during startup

Check that `DATABASE_URL`, `JWT_SECRET`, and production `FRONTEND_URL` are configured. Production JWT secrets must contain at least 32 characters.

### The frontend build reports `VITE_API_URL is required`

Set `VITE_API_URL` in Vercel or in `frontend/.env` for a local production build.

### Refreshing a frontend page returns a Vercel 404

Confirm that Vercel's Root Directory is `frontend`, that `frontend/vercel.json` is committed, and that the latest commit has been redeployed. The included SPA rewrite sends client-side routes to `/index.html`.

### The browser reports a CORS error

Set Render's `FRONTEND_URL` to the exact frontend origin without a trailing slash. Put additional exact origins in `ALLOWED_ORIGINS`, separated by commas.

### Book search fails

The backend automatically falls back to Open Library when Google Books is unavailable. Check the Render logs and make sure outbound HTTPS traffic is available. A Google Books key is optional.

### AI features show fallback content

Verify `GEMINI_API_KEY` and `GEMINI_MODEL`. The rest of the application continues working when Gemini is temporarily unavailable.

### Existing sessions become invalid after a JWT change

Users must log in again after `JWT_SECRET`, `JWT_ISSUER`, or `JWT_AUDIENCE` changes.

## Security notes

- Never commit `.env` files, database URLs, JWT secrets, or API keys.
- Rotate credentials immediately if they are exposed.
- Use HTTPS origins in production.
- Keep dependency audits and database backups in the deployment routine.

## License

Add a `LICENSE` file before distributing the project publicly under a specific open-source license.
