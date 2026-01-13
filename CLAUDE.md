# DraftIQ

## What
An intelligent NFL mock draft application that simulates fantasy football drafts with sophisticated AI opponents. Users practice draft strategy against AI with distinct personalities that exhibit realistic human behaviors (panic picking, favorite team bias, reacting to runs).

## Tech Stack
- **Frontend**: React 19.2.3, Next.js 16.1.1 (App Router), TypeScript 5, Tailwind CSS 4
- **State Management**: Zustand 5.0.10
- **Backend**: Next.js API Routes (serverless functions)
- **Data**: RapidAPI Tank01 NFL API (player data & ADP), in-memory storage (Map)
- **AI**: Custom multi-factor decision engine with 6 personality profiles

## Project Structure

### Core Directories
- `app/` - Next.js App Router pages and API routes
  - `app/api/` - REST API endpoints (draft operations, AI picks, player data)
  - `app/draft/[id]/page.tsx:1` - Draft room UI (main interactive page)
  - `app/page.tsx:1` - Home/setup page
- `lib/` - Business logic and utilities
  - `lib/ai/` - AI decision engine and personality profiles
  - `lib/draft/` - Draft mechanics (snake draft, validation)
  - `lib/api/` - External API clients (RapidAPI NFL)
  - `lib/types.ts:1` - TypeScript interfaces (Player, Team, DraftState, AIProfile)
- `store/draft-store.ts:1` - Zustand state management

### Key Files
- `lib/ai/decision-engine.ts:1` - Main AI algorithm with weighted scoring system
- `lib/ai/profiles.ts:1` - 6 AI personalities (Analyst, Gambler, Homer, Reactor, Value Hunter, Balanced)
- `lib/draft/draft-engine.ts:1` - Snake draft logic and pick validation
- `store/draft-store.ts:1` - Centralized state with actions and computed selectors

## Essential Commands

```bash
# Development
npm run dev          # Start dev server on localhost:3000

# Production
npm run build        # Build optimized bundle
npm run start        # Serve production build

# Code Quality
npm run lint         # Run ESLint checks
```

## API Endpoints

All endpoints return `{ success: boolean; data?: T; error?: string }`

- `POST /api/draft/create` - Initialize new draft with AI teams
- `GET /api/draft/[id]` - Fetch draft state
- `POST /api/draft/pick` - Execute user pick
- `POST /api/ai-pick` - Trigger AI decision
- `GET /api/players` - Fetch player pool from RapidAPI

## Data Flow

**Draft Creation**: User setup → API creates draft → Fetch players from RapidAPI → Initialize state → Redirect to draft room

**User Pick**: Select player → Validate → Execute → Update Zustand store → Trigger AI turn

**AI Turn**: useEffect detects AI turn → POST to AI endpoint → Decision engine scores players → Execute pick → Loop until user's turn

## State Management Pattern

Using Zustand with selector pattern (see store/draft-store.ts:1):
- Single centralized store with actions
- Optimized selectors prevent unnecessary re-renders
- Computed getters: `getCurrentTeam()`, `isUserTurn()`, `getTeamRoster()`

```typescript
// Usage pattern
const availablePlayers = useDraftStore(state => state.availablePlayers);
const currentTeam = useCurrentTeam(); // Selector hook
```

## Configuration

- `tsconfig.json` - Strict mode enabled, path alias `@/*` maps to root
- `next.config.ts` - Minimal config (uses defaults)
- `postcss.config.mjs` - Tailwind CSS v4 PostCSS integration
- `eslint.config.mjs` - ESLint 9 flat config with Next.js rules

## Current Limitations

- **No persistence** - In-memory storage only (data lost on restart)
- **No testing** - No unit/integration tests configured
- **Monolithic components** - Draft room page not decomposed into reusable components
- **SQLite unused** - better-sqlite3 installed but not utilized

## Environment Variables

Required environment variables (see `.env.example`):
- `RAPIDAPI_KEY` - API key for Tank01 NFL API on RapidAPI

## Additional Documentation

For specialized topics, see:
- `.claude/docs/architectural_patterns.md` - Design patterns, state management, AI architecture

## Path Aliases

- `@/` → Root directory (configured in tsconfig.json)

Example: `import { Draft } from '@/lib/types'`
