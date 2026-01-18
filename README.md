# HOG Chapter Manager

A modern, microservices-based web application for Harley Davidson Owners Group chapters to manage memberships, rides, meetings, and more - with AI-powered assistance.

## Features

### Core Functionality
- **Member Management**: Track members, bikes, mileage, and engagement
- **Ride Management**: Plan rides, log routes, track participation (optional RSVP)
- **Meeting Management**: Schedule meetings, manage agendas, record minutes
- **Document Storage**: Store and search chapter documents

### AI-Powered Features
- **Meeting Minutes Summarization**: Auto-generate concise summaries from notes
- **Action Item Extraction**: Parse minutes for tasks and assignees
- **Ride Route Suggestions**: Weather-aware route planning
- **Safety Briefing Generator**: Create customized pre-ride briefings
- **Member Engagement Insights**: Identify inactive members
- **Smart Search**: Natural language queries across all data
- **Chapter Chatbot**: Answer member questions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX API Gateway                          │
└─────────────────────────────────────────────────────────────────┘
                              │
    ┌─────────┬───────────────┼───────────────┬─────────┐
    ▼         ▼               ▼               ▼         ▼
┌────────┐ ┌────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐
│  Auth  │ │ Member │ │    Ride    │ │  Meeting   │ │   AI   │
│Service │ │Service │ │  Service   │ │  Service   │ │Service │
└────────┘ └────────┘ └────────────┘ └────────────┘ └────────┘
    │         │               │               │         │
    └─────────┴───────────────┼───────────────┴─────────┘
                              ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    └──────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| API Gateway | Nginx |
| Backend Services | Node.js + Express + TypeScript |
| AI Service | Python + FastAPI + Claude API |
| Database | PostgreSQL 16 |
| Cache | Redis |
| File Storage | MinIO (S3-compatible) |
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Container | Docker + Docker Compose |

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Anthropic API Key (for AI features)

### Development

```bash
# Clone and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access the application
open http://localhost:3000
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:
- `ANTHROPIC_API_KEY`: Your Anthropic API key for AI features
- `JWT_SECRET`: Secret for JWT token signing
- `POSTGRES_PASSWORD`: Database password
- `GOOGLE_CLIENT_ID`: OAuth client ID
- `GOOGLE_CLIENT_SECRET`: OAuth client secret

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React web application |
| API Gateway | 80/443 | Nginx reverse proxy |
| Auth Service | 4001 | Authentication & authorization |
| Member Service | 4002 | Member management |
| Ride Service | 4003 | Ride planning & tracking |
| Meeting Service | 4004 | Meetings & minutes |
| AI Service | 4005 | AI-powered features |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Caching & sessions |
| MinIO | 9000 | File storage |

## Default Credentials

After first run, an admin user is created:
- Email: `admin@chapter.local`
- Password: `ChangeMe123!`

**Change this immediately after first login!**

## License

MIT License - See LICENSE file for details.
