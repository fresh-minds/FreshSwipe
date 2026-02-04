# FreshSwipe 🎯

A Tinder-style professional skills swipe application for internal enterprise use. Employees can swipe on skill domains to express interest, growth ambitions, and active engagement.

![FreshSwipe Demo](docs/demo.gif)

## 🚀 Quick Start

### Prerequisites
- Docker
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### Run with Docker (Recommended - Unified Container)

```bash
# Build and run the unified container + local Postgres (default)
./container/verify_local.sh

# Or run with local SQL Server
DB_ENGINE=mssql ./container/verify_local.sh

# Access the application
# App (UI + API): http://localhost:8081
# API Docs: http://localhost:8081/docs
```

### Run Locally (Development)

**Backend:**
```bash
cd app/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql+asyncpg://freshswipe:freshswipe@localhost:5432/freshswipe"
export DB_ENGINE="postgres"

# Run development server
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd app/frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                    (Next.js 14 + React)                     │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│   │   Home  │  │Onboard  │  │  Swipe  │  │ Insights│       │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│        │            │            │            │             │
│        └────────────┴────────────┴────────────┘             │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTP
┌──────────────────────────┼───────────────────────────────────┐
│                          ▼                                   │
│                    Backend (FastAPI)                         │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────┐     │
│   │  Users  │  │  Skills │  │  Swipes │  │ Analytics │     │
│   │   API   │  │   API   │  │   API   │  │    API    │     │
│   └────┬────┘  └────┬────┘  └────┬────┘  └─────┬─────┘     │
│        │            │            │              │           │
│        └────────────┴────────────┴──────────────┘           │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │ SQL
┌──────────────────────────┼───────────────────────────────────┐
│                          ▼                                   │
│                PostgreSQL / Azure SQL                        │
│   ┌─────────┐  ┌─────────┐  ┌─────────────┐                │
│   │  users  │  │  skills │  │   swipes    │                │
│   └─────────┘  └─────────┘  └─────────────┘                │
│   ┌───────────────────┐                                     │
│   │    user_skills    │                                     │
│   └───────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
swipefreshminds/
├── app/
│   ├── backend/
│   │   ├── app/               # FastAPI application
│   │   ├── seed_data.py       # Demo data seeder
│   │   └── requirements.txt
│   └── frontend/
│       ├── app/               # Next.js app router
│       ├── lib/               # API client + helpers
│       └── package.json
├── container/
│   ├── Dockerfile             # Unified container build
│   ├── nginx.conf
│   ├── supervisord.conf
│   ├── verify_local.sh
│   └── deploy_single_container.sh
├── scripts/
│   ├── db/
│   └── tests/
├── old/
│   └── multi_container/       # Legacy multi-container setup (archived)
└── README.md
```

## 🎨 Features

### User Onboarding
- Multi-step form collecting name, email, unit
- Current skills selection
- Growth areas selection
- Persistent profile storage

### Swipe Interface
- Tinder-style card stack with drag gestures
- **Swipe Right** → Interested in this skill
- **Swipe Left** → Not relevant for me
- **Swipe Up** → Super-like (actively working on/strong interest)
- Visual feedback with color-coded indicators
- Smooth spring-physics animations via Framer Motion

### User Insights
- Personal skill interest radar chart
- Category distribution visualization
- Top interests ranked with super-likes highlighted
- Swipe statistics breakdown

### Admin Analytics
- Organization-wide skill interest metrics
- User distribution by unit (pie chart)
- Trending skills (bar chart)
- Interest rate by category (stacked bar)
- Filterable by unit
- Detailed statistics table

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14 | React framework with App Router |
| UI Animation | Framer Motion | Gesture-based swipe animations |
| Charts | Recharts | Data visualization |
| Backend | FastAPI | High-performance async API |
| ORM | SQLAlchemy 2.0 | Async database operations |
| Database | PostgreSQL / Azure SQL | Relational data storage |
| Containerization | Docker | Consistent deployment |

## 📊 Data Model

### Users
- `id` (UUID, PK)
- `name` (string)
- `email` (string, unique)
- `unit` (enum: Software, Data, Cloud, Security, Staff)
- `created_at`, `updated_at` (timestamps)

### Skills
- `id` (UUID, PK)
- `name` (string, unique)
- `category` (string)
- `description` (text)
- `icon` (emoji)
- `display_order` (int)
- `is_active` (boolean)

### Swipes
- `id` (UUID, PK)
- `user_id` (FK → users)
- `skill_id` (FK → skills)
- `direction` (enum: left, right, super)
- `created_at` (timestamp)

### User Skills
- `id` (UUID, PK)
- `user_id` (FK → users)
- `skill_id` (FK → skills)
- `skill_type` (enum: current, growth)

## 🔌 API Endpoints

### Users
- `POST /api/v1/users/onboard` - Complete user onboarding
- `GET /api/v1/users` - List all users
- `GET /api/v1/users/{id}` - Get user with skills
- `GET /api/v1/users/by-email/{email}` - Find user by email

### Skills
- `GET /api/v1/skills` - List all active skills
- `GET /api/v1/skills/for-user/{userId}` - Get unswiped skills for user
- `GET /api/v1/skills/categories` - List skill categories

### Swipes
- `POST /api/v1/swipes` - Record a swipe
- `GET /api/v1/swipes/user/{userId}` - Get user's swipe history
- `GET /api/v1/swipes/user/{userId}/interests` - Get user's positive swipes

### Analytics
- `GET /api/v1/analytics/user/{userId}/summary` - User insights
- `GET /api/v1/analytics/organization/skills` - Org skill stats
- `GET /api/v1/analytics/organization/units` - Unit distribution
- `GET /api/v1/analytics/organization/trends` - Trending skills
- `GET /api/v1/analytics/organization/category-breakdown` - Category stats

## 🎯 Design Decisions

### Why Tinder-like UX?
- Familiar, intuitive interaction pattern
- Low cognitive load per decision
- Gamification increases engagement
- Mobile-first responsive design

### Why FastAPI?
- Async support for database operations
- Automatic OpenAPI documentation
- Type hints with Pydantic validation
- High performance

### Why Next.js 14?
- App Router for modern React patterns
- CSS Modules for scoped styling
- Built-in optimization
- Server-side rendering ready

### Why PostgreSQL?
- Robust for analytics queries
- Excellent UUID support
- Scalable for production
- ACID compliance

## 📝 Seed Data

The application comes pre-seeded with:
- **18 skills** across 5 categories (Cloud, Data, Security, Software, AI)
- **10 demo users** with sample profiles
- **Sample swipe history** for analytics demonstration

## 🔒 Security Notes

This is an internal MVP without authentication. For production:
- Add SSO/OAuth integration
- Implement role-based access control
- Add rate limiting
- Enable HTTPS

## 📈 Future Enhancements

- [ ] AI-powered skill recommendations
- [ ] Team matching based on skill synergies
- [ ] Learning path suggestions
- [ ] Slack/Teams integration
- [ ] Export reports to PDF
- [ ] Custom skill submission

## 📄 License

Internal use only. Not for distribution.

---

Built with ❤️ for professional development and skill discovery.
