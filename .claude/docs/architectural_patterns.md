# Architectural Patterns

## State Management - Zustand Pattern

**Location**: `store/draft-store.ts:1`

### Pattern Overview
Single centralized store with actions and computed getters. Uses selector pattern for optimized re-renders.

### Store Structure
```typescript
interface DraftStore extends DraftState {
  // State
  draftId, teams, currentPickIndex, draftOrder, availablePlayers, picks

  // Actions
  setDraft, makePick, undoLastPick, updateAvailablePlayers, nextPick, reset

  // Computed Getters
  getCurrentTeam, getCurrentRound, getTeamRoster, getPickNumber, isUserTurn
}
```

### Selector Pattern
Exported selector hooks prevent unnecessary re-renders:
```typescript
export const useCurrentTeam = () => useDraftStore(state => state.getCurrentTeam());
export const useAvailablePlayers = () => useDraftStore(state => state.availablePlayers);
```

**Usage in components**: Components subscribe only to data they need.

### Immutability Pattern
All state updates use spread operators:
```typescript
set(state => ({
  picks: [...state.picks, pick],
  availablePlayers: state.availablePlayers.filter(p => p.id !== playerId)
}))
```

---

## API Design - RESTful with Next.js Route Handlers

**Locations**: `app/api/*/route.ts`

### Response Pattern
All endpoints follow consistent response structure:
```typescript
{ success: boolean; data?: T; error?: string }
```

**Success**: `{ success: true, data: {...} }`
**Error**: `{ success: false, error: "Error message" }`

### Storage Pattern
In-memory Map shared across API routes:
```typescript
// app/api/draft/create/route.ts:7
const drafts = new Map<string, DraftState>();
export { drafts };

// Other routes import
import { drafts } from '../create/route';
```

**Limitation**: Data lost on server restart. No persistence.

### Endpoint Design
- `POST` for mutations (create, pick)
- `GET` for queries (fetch draft, fetch players)
- Dynamic routes use `[id]` folder structure

---

## AI Decision Engine Architecture

**Locations**: `lib/ai/decision-engine.ts:1`, `lib/ai/*.ts`

### Modular Design
Decision engine composed of specialized modules:
- `decision-engine.ts:1` - Main algorithm and scoring
- `profiles.ts:1` - AI personality definitions
- `need-calculator.ts:1` - Position need evaluation
- `tier-analyzer.ts:1` - Tier break detection
- `psychology.ts:1` - Run detection, panic, scarcity

### Weighted Scoring System

**Pattern**: Multi-factor scoring with configurable weights

**Factors** (see `lib/ai/decision-engine.ts:70`):
1. **Base Score** (ADP ranking): 0-100
2. **Need Score** (30% weight): Position scarcity on team
3. **Value Score** (25% weight): ADP vs current pick delta
4. **Run Psychology** (20% weight): Panic during positional runs
5. **Tier Urgency** (15% weight): Player at tier break
6. **Bye Week Penalty** (10% weight): Duplicate bye week

**Formula** (lib/ai/decision-engine.ts:100-108):
```typescript
finalScore = (
  baseScore +
  needScore * 0.3 +
  valueScore * 0.25 +
  runPsychology * 0.2 +
  tierUrgency * 0.15 -
  byeWeekPenalty * 0.1
) * positionPreference * riskAdjustment + randomness
```

### Profile Pattern

**Location**: `lib/ai/profiles.ts:1`

Each AI has tunable parameters:
```typescript
interface AIProfile {
  reachFactor: number;       // Likelihood to reach (0.1-3.0)
  riskTolerance: number;     // Position risk preference (0.5-2.0)
  favoriteTeams: string[];   // Team bias (adds 10% score boost)
  positionPreferences: {};   // Position value multipliers
  panicThreshold: number;    // Run reaction sensitivity (0.3-0.8)
  byeWeekAwareness: number;  // Bye stacking penalty (0-1.0)
}
```

**6 Profiles**: Analyst (conservative), Gambler (high-risk), Homer (team bias), Reactor (panic-prone), Value Hunter (patient), Balanced (moderate).

### Human-like Behavior

**Randomness Injection** (lib/ai/decision-engine.ts:117):
```typescript
const randomness = (Math.random() - 0.5) * 10; // ±5 points
```

**Thinking Delay** (lib/ai/decision-engine.ts:136):
```typescript
await simulateThinkingDelay(); // 300-700ms random delay
```

**Purpose**: Makes AI feel less robotic, more human.

---

## Snake Draft Pattern

**Location**: `lib/draft/draft-engine.ts:1`

### Algorithm
```typescript
// Even rounds: forward order (1,2,3,4...)
// Odd rounds: reverse order (...4,3,2,1)
const roundOrder = round % 2 === 0
  ? teamIds
  : [...teamIds].reverse();
```

### Validation Pattern

**Multi-step validation** (lib/draft/draft-engine.ts:32):
1. Draft not complete
2. Correct team picking
3. Player available
4. Player exists

**Returns structured result**:
```typescript
{ valid: boolean; error?: string }
```

### Immutable Updates
Draft state never mutated directly:
```typescript
return {
  ...draft,
  picks: [...draft.picks, pick],
  currentPickIndex: draft.currentPickIndex + 1
};
```

---

## Component Patterns

### Client Component with Form State

**Location**: `app/page.tsx:1`

**Pattern**: Client component for interactive forms
```typescript
'use client';
export default function Home() {
  const [numTeams, setNumTeams] = useState(10);
  // Form handling, then redirect after API call
}
```

### Complex Client Component with Side Effects

**Location**: `app/draft/[id]/page.tsx:1`

**Pattern**: Draft room orchestrates multiple concerns
- State subscription via Zustand
- Auto-trigger AI picks via `useEffect`
- Real-time UI updates
- Three-panel layout

**Auto-pick Logic** (app/draft/[id]/page.tsx:60):
```typescript
useEffect(() => {
  if (!isUserTurn && !isDraftComplete && !isAIPicking) {
    // Trigger AI pick
  }
}, [currentPickIndex, isUserTurn]);
```

**Layout Pattern**: 3-column grid with Tailwind
- Available players (scrollable)
- Recent picks (center)
- Your roster (right panel)

### Server Component Default

**Location**: `app/layout.tsx:1`

**Pattern**: No 'use client' directive = Server Component
- Renders on server
- Cannot use hooks or browser APIs
- Better for static layouts and metadata

---

## Data Fetching Pattern

### API Client Pattern

**Location**: `lib/api/sleeper.ts:1`

**Pattern**: Centralized API client with caching
```typescript
let cachedPlayers: Player[] | null = null;
let cacheTimestamp: number = 0;

export async function fetchNFLPlayers() {
  if (cachedPlayers && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedPlayers;
  }
  // Fetch and cache
}
```

**Cache TTL**: 1 hour (prevents excessive API calls)

### Client-side Fetching

**Pattern**: useEffect + fetch in client components
```typescript
useEffect(() => {
  fetch('/api/endpoint')
    .then(res => res.json())
    .then(data => setState(data));
}, []);
```

**Used in**: Home page (AI profiles), Draft room (initial load, AI triggers)

---

## Error Handling Pattern

### API Error Pattern
```typescript
try {
  // Operation
  return NextResponse.json({ success: true, data });
} catch (error) {
  return NextResponse.json(
    { success: false, error: error.message },
    { status: 500 }
  );
}
```

### Validation Result Pattern
```typescript
const result = validatePick(draft, teamId, playerId);
if (!result.valid) {
  return NextResponse.json({ success: false, error: result.error });
}
```

**Pattern**: Always return structured response, never throw to client.

---

## Type Safety Pattern

**Location**: `lib/types.ts:1`

### Shared Types
All data structures defined in single types file:
- `Player` - NFL player data
- `Team` - Draft team with roster
- `Pick` - Individual draft selection
- `DraftState` - Complete draft snapshot
- `AIProfile` - AI personality configuration

### Import Pattern
```typescript
import type { DraftState, Player, Team } from '@/lib/types';
```

**Benefits**:
- Single source of truth
- Type safety across frontend/backend
- Easy refactoring

---

## Key Design Decisions

### Why Zustand over Redux/Context?
- **Lighter**: No providers/context wrapper needed
- **Simpler**: Less boilerplate than Redux
- **Performant**: Selector pattern prevents re-renders
- **TypeScript**: Excellent TS support

### Why In-Memory Storage?
- **Simplicity**: Demo/prototype focused
- **Stateless serverless**: Works with Next.js edge functions
- **Trade-off**: Data lost on restart (acceptable for MVP)

### Why Next.js App Router?
- **Modern**: Latest Next.js paradigm
- **Server Components**: Better performance defaults
- **API Routes**: Integrated backend
- **File-based routing**: Intuitive structure

### Why Multi-Factor AI?
- **Realism**: Mimics human decision-making complexity
- **Tunability**: Easy to adjust via profiles
- **Emergent behavior**: Factors combine for realistic outcomes
- **Extensibility**: Can add new factors without refactoring

---

## Patterns to Maintain

1. **Keep UI and logic separated**: Never put AI logic in components
2. **Use selectors for Zustand**: Prevent unnecessary re-renders
3. **Consistent API responses**: Always `{ success, data?, error? }`
4. **Validate before mutating**: Check validity, then execute
5. **Type everything**: No `any` types in production code
6. **Modular AI factors**: Each factor in separate function
7. **Immutable updates**: Never mutate state directly
