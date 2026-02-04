# Frontend User Flows (FreshSwipe)

This document is a comprehensive walkthrough of every user-facing flow in the Next.js frontend. It focuses on what a user can do, what data is required, and which screens they reach.

## Route Map (App Router)

- `/` — Landing page with primary navigation and a “Get Started” CTA.
- `/login` — Sign-in page (Azure AD or admin credentials).
- `/onboarding` — 4-step onboarding flow (profile → unit → current skills → growth skills).
- `/swipe` — Tinder-style swipe experience for skills.
- `/insights` — Personal analytics dashboard and coffee-match banner.
- `/matches` — Peer/mentor match list.
- `/coffee-dates` — Suggestions + request management (sent/received/accepted).
- `/profile` — User profile editing.
- `/admin` — Organization analytics (admin-only).

## Access & Authentication Flow

### Protected routes
The following routes are protected by NextAuth middleware and require authentication:
- `/` (landing page)
- `/swipe`
- `/matches`
- `/profile`
- `/insights`
- `/onboarding`

If a user is not authenticated, they are routed to `/login` by NextAuth.

### Sign-in options
Users can sign in from `/login` via:
1. **Microsoft Entra ID (Azure AD)**
   - Clicking “Sign in with Microsoft” triggers `signIn('azure-ad', { callbackUrl: '/' })`.
2. **Admin credentials (credentials provider)**
   - Email/password form invokes `signIn('credentials', { callbackUrl: '/' })`.
   - Admin credentials must be set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment.

### Session data
- On successful sign-in, the session contains:
  - `session.accessToken` and `session.idToken` from Azure AD.
  - `session.user.id` (Azure AD object ID / OID) if provided by Entra ID.

## Global Navigation Flow

Most pages share a top nav with core routes:
- `Swipe`
- `Coffee` (`/coffee-dates`)
- `Matches`
- `Profile`
- `Insights`
- `Admin` (visible on `/` when the current user’s email matches the admin email)

The nav often uses the session user name (if available) to greet the user.

## Detailed User Flows

### 1) Landing Page (`/`)
**Goal:** Introduce the product and send users to onboarding.

Flow:
1. User lands on `/` after login.
2. Sees hero content, product explanation, and CTA “Get Started”.
3. Clicking CTA routes to `/onboarding`.
4. The admin link is only shown here if the user’s email matches the configured admin email.

### 2) Login (`/login`)
**Goal:** Authenticate with Microsoft or as admin.

Flow:
1. User chooses Microsoft login or admin credentials.
2. On success, user is redirected to `/`.
3. If admin env vars are missing, admin login silently fails and returns null (no sign-in).

### 3) Onboarding (`/onboarding`)
**Goal:** Create a backend user and capture skills preferences.

Steps:
1. **Profile**
   - Name + email fields.
   - If authenticated via SSO, name/email auto-populate and can be locked.
2. **Unit**
   - Select a unit from the predefined list.
3. **Current Skills**
   - Pick at least 1 skill from categorized chips.
4. **Growth Skills**
   - Pick at least 1 skill you want to grow in.

Completion:
- Submits to `POST /api/v1/users/onboard` via `usersApi.create` with:
  - `entra_oid` (from session user id), `name`, `email`, `unit`, `current_skills`, `growth_skills`.
- Saves user data in `localStorage`:
  - `freshswipe_user_id`, `freshswipe_user_name`, `freshswipe_user_email`.
- Redirects to `/swipe`.

Validation:
- Each step requires at least the minimum data before proceeding.

### 4) Swiping Skills (`/swipe`)
**Goal:** Record user interest in skills.

Flow:
1. If unauthenticated, user is redirected to `/login`.
2. Skills are fetched from `GET /api/v1/skills`.
3. Each card supports three swipe directions:
   - **Left** → not interested
   - **Right** → interested
   - **Up** → super-like
4. Each swipe sends `POST /api/v1/swipes/` with:
   - `user_id` (from localStorage, or fallback to session user id)
   - `skill_id`
   - `direction`
5. A summary screen appears when all skills have been swiped.
6. CTA takes user to `/insights`.

Important data handling:
- If `freshswipe_user_id` is missing, the page attempts to resolve it by `usersApi.getByEmail(session.user.email)` and stores it in localStorage for future use.

### 5) Insights (`/insights`)
**Goal:** Show the user’s swipe analytics and coffee-date match banner.

Flow:
1. If `freshswipe_user_id` is missing, redirect to `/onboarding`.
2. Fetch user analytics via `GET /api/v1/analytics/user/:userId/summary`.
3. Render stats, category radar chart, and top interest bars.
4. Fetch accepted coffee dates and, if present, show a banner that links to Microsoft Teams chat.

Empty state:
- If no summary exists yet, a prompt encourages the user to start swiping.

### 6) Matches (`/matches`)
**Goal:** Show peer or mentor matches.

Flow:
1. User chooses **Peers** or **Mentors** tab.
2. Fetch matches from `GET /api/v1/matches?type=peer|mentor`.
3. Display match reasons and a point score.

Notes:
- “View Profile” and “Teams Chat” buttons are present but currently do not have handlers.

### 7) Coffee Dates (`/coffee-dates`)
**Goal:** Request and manage coffee chats with suggested matches.

Two tabs:
1. **Suggestions**
   - Fetches suggested matches via `GET /api/v1/coffee-dates/suggestions`.
   - User can request a coffee date; sends `POST /api/v1/coffee-dates/request`.
2. **My Requests**
   - Shows received requests, sent requests, and accepted dates.
   - Allows accepting/declining requests via `PATCH /api/v1/coffee-dates/:id/respond`.

Data grouping:
- Uses localStorage `freshswipe_user_id` to group “pending received”, “sent”, and “accepted” dates.

### 8) Profile (`/profile`)
**Goal:** Edit personal details and visibility settings.

Flow:
1. Fetch profile via `GET /api/v1/users/me`.
2. User can update:
   - Display name
   - Unit
   - Seniority
   - Availability
   - Search visibility
   - Email visibility
3. Save updates via `PATCH /api/v1/users/me`.

### 9) Admin Analytics (`/admin`)
**Goal:** Organization-wide analytics and user list (admin-only).

Authorization:
- Access is allowed only if the user’s email matches `karel.goense@freshminds.nl`.
- Both the session email and the localStorage email are checked.

Flow:
1. If not authorized, show “Access Denied” and link back to `/swipe`.
2. If authorized, fetch analytics and user data:
   - `GET /api/v1/analytics/organization/skills`
   - `GET /api/v1/analytics/organization/units`
   - `GET /api/v1/analytics/organization/trends?limit=10`
   - `GET /api/v1/analytics/organization/category-breakdown`
   - `GET /api/v1/users`
3. Show:
   - Organization summary stats
   - Charts (unit distribution, trending skills, category breakdown)
   - Skills table
   - Registered users table

## Data & State Persistence

- **Session:** Managed by NextAuth. Access tokens are stored in `session` and used for API requests where needed (e.g., `users/me`, `matches`).
- **Local storage:** Used for user ID, name, and email after onboarding and for fallback identity resolution:
  - `freshswipe_user_id`
  - `freshswipe_user_name`
  - `freshswipe_user_email`

## API Proxy Behavior

The frontend proxies API requests through `/api/v1/*`, which forwards to the backend service configured by `BACKEND_URL`. Authorization headers are forwarded when present.

## Known UX/Flow Gaps

- `/matches` buttons for “View Profile” and “Teams Chat” are placeholders without action handlers.
- The `Insights` top nav always includes an `Admin` link even if the current user is not an admin, but access is still enforced in the admin page.
- The admin email is currently hardcoded in the frontend.

## Quick Flow Index

- **New user:** `/login` → `/` → `/onboarding` → `/swipe` → `/insights`
- **Returning user:** `/login` → `/` → `/swipe` or `/insights` or `/profile`
- **Coffee date:** `/coffee-dates` → request → accept/decline → Teams chat (from Insights banner)
- **Admin:** `/login` (admin) → `/admin`
