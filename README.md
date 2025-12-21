# SEO Keyword Research Tool

A comprehensive keyword research tool that uses AI to cluster keywords and recommend URL structures for SEO optimization.

## Features

- **Keyword Data Fetching**: Integrates with DataForSEO API to get search volume, difficulty, CPC, and competition data
- **AI-Powered Clustering**: Uses Claude AI to intelligently cluster keywords into logical groups (5-8 keywords per cluster)
- **Cannibalization Detection**: Identifies keywords that might compete with each other
- **URL Recommendations**: Suggests SEO-friendly URL structures for each keyword cluster
- **Search Intent Analysis**: Classifies keywords by search intent (informational, transactional, navigational, commercial)
- **Google Sheets Export**: Export results to formatted Google Sheets
- **Real-time Processing**: Background job queue with status updates
- **User Authentication**: Secure authentication with Clerk

## Tech Stack

### Frontend
- **React** with TypeScript (Vite)
- **Clerk** for authentication
- **shadcn/ui** + Tailwind CSS for UI
- **TanStack Query** for data fetching
- **Zustand** for state management
- **React Router** for routing

### Backend
- **Node.js** + Express + TypeScript
- **PostgreSQL** database (Supabase)
- **Prisma** ORM
- **BullMQ** + Redis for job queue
- **Anthropic Claude API** for keyword clustering
- **DataForSEO API** for keyword data

## Project Structure

```
Claude-SEO/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Express server
│   │   ├── routes/                  # API routes
│   │   ├── controllers/             # Request handlers
│   │   ├── services/                # Business logic
│   │   ├── queues/                  # BullMQ job queue
│   │   ├── middleware/              # Auth middleware
│   │   └── utils/                   # Utilities
│   ├── prisma/
│   │   └── schema.prisma            # Database schema
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/              # React components
│   │   ├── pages/                   # Page components
│   │   ├── lib/                     # Utilities & API client
│   │   ├── store/                   # Zustand stores
│   │   ├── App.tsx                  # Main app component
│   │   └── main.tsx                 # Entry point
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Supabase account)
- Redis instance (or Upstash account)
- API Keys:
  - Clerk account (https://clerk.com)
  - DataForSEO account (https://dataforseo.com)
  - Anthropic API key (https://console.anthropic.com)
  - Google Cloud Project (for Sheets export)

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/seo_tool"

   # Clerk
   CLERK_SECRET_KEY="sk_test_..."
   CLERK_WEBHOOK_SECRET="whsec_..."

   # APIs
   DATAFORSEO_LOGIN="your_email@example.com"
   DATAFORSEO_PASSWORD="your_password"
   ANTHROPIC_API_KEY="sk-ant-..."

   # Redis
   REDIS_URL="redis://localhost:6379"

   # Server
   PORT=3001
   NODE_ENV="development"
   FRONTEND_URL="http://localhost:5173"
   ```

5. **Setup database**:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```

The backend will be running at `http://localhost:3001`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**:
   ```env
   VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
   VITE_API_URL="http://localhost:3001"
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

The frontend will be running at `http://localhost:5173`

## Usage Guide

### 1. Create a Project

- Sign in with Clerk
- Click "New Project" on the dashboard
- Enter project name and domain (optional)

### 2. Start Keyword Research

- Open a project
- Click "New Research"
- Enter seed keywords (one per line)
- Click "Start Research"

### 3. View Results

- Research will process in the background
- Page auto-refreshes with status updates
- View organized keyword clusters with:
  - Recommended URL structure
  - Search intent classification
  - Search volume, difficulty, CPC
  - Main clusters and sub-clusters

### 4. Export to Google Sheets

- Click "Export to Google Sheets" button
- Opens formatted spreadsheet with all data

## API Endpoints

### Projects
- `GET /api/projects` - Get all user projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project by ID
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Keyword Research
- `POST /api/keyword-research` - Create new keyword research job
- `GET /api/keyword-research/:id` - Get keyword research by ID
- `GET /api/keyword-research/project/:projectId` - Get all research for a project
- `POST /api/keyword-research/:id/export` - Export to Google Sheets
- `DELETE /api/keyword-research/:id` - Delete keyword research

### Authentication
- `POST /api/auth/webhook` - Clerk webhook for user sync

## Deployment

### Backend (Railway/Render)

1. Create new project on Railway or Render
2. Connect your GitHub repository
3. Set environment variables
4. Deploy

### Frontend (Vercel)

1. Import project to Vercel
2. Set root directory to `frontend`
3. Set environment variables
4. Deploy

### Database (Supabase)

1. Create new Supabase project
2. Copy connection string to `DATABASE_URL`
3. Run migrations: `npx prisma migrate deploy`

### Redis (Upstash)

1. Create new Upstash Redis database
2. Copy connection string to `REDIS_URL`

## Development

### Database Migrations

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio
```

### TypeScript

Both frontend and backend use TypeScript with strict mode enabled.

```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build
```

## Environment Variables Summary

### Backend
| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook secret | Yes |
| `DATAFORSEO_LOGIN` | DataForSEO email | Yes |
| `DATAFORSEO_PASSWORD` | DataForSEO password | Yes |
| `ANTHROPIC_API_KEY` | Claude API key | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `PORT` | Server port | No (default: 3001) |
| `NODE_ENV` | Environment | No (default: development) |
| `FRONTEND_URL` | Frontend URL for CORS | No |

### Frontend
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `VITE_API_URL` | Backend API URL | Yes |

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check `DATABASE_URL` is correct
   - Ensure PostgreSQL is running
   - Run `npx prisma migrate deploy`

2. **Redis connection failed**
   - Check `REDIS_URL` is correct
   - Ensure Redis is running

3. **Clerk authentication errors**
   - Verify `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`
   - Check Clerk dashboard for webhook configuration

4. **API rate limits**
   - DataForSEO: Check your credit balance
   - Anthropic: Check your API usage limits

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
