# DraftIQ - Intelligent NFL Mock Draft

An NFL mock draft application with intelligent AI opponents that learn from real drafting behavior and react like humans, not static bots.

## Features

### Intelligent AI Opponents

AI drafts based on:
- **Team Needs**: Tracks roster composition and fills gaps strategically
- **Risk Tolerance**: Some AIs prefer safe picks (high floor), others chase upside (high ceiling)
- **Bye-Week Awareness**: Avoids drafting too many players with the same bye week
- **Draft Psychology**:
  - Reacts to positional runs (panic picks when seeing consecutive RBs/WRs)
  - Makes occasional reaches for favorite team players
  - Adjusts value based on scarcity (reaches earlier when top-tier players are running out)
  - Understands tier breaks and reaches to grab last player in a tier

### AI Personality Profiles

6 unique AI personalities:

1. **The Analyst** - Data-driven, follows ADP closely, high bye-week awareness
2. **The Gambler** - High-risk/high-reward, reaches for upside, ignores bye weeks
3. **The Homer** - Reaches for favorite team players, medium risk tolerance
4. **The Reactor** - Highly reactive to draft trends, panics during runs
5. **The Value Hunter** - Patient, waits for value, anti-reach mentality
6. **The Balanced** - Well-rounded, middle-of-road on all factors

### Core Features

- **Snake Draft Format**: Standard serpentine draft order
- **Real Player Data**: Integrates with Sleeper API for current player data
- **Live Draft Interface**: Real-time draft board with player search and filtering
- **Smart Decision Engine**: Weighted scoring system that considers:
  - Base ADP value (baseline)
  - Team needs (30% weight)
  - Value vs ADP (25% weight)
  - Positional run psychology (20% weight)
  - Tier break urgency (15% weight)
  - Bye week stacking (10% weight)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Next.js 14
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Data Source**: Sleeper API (free, real NFL data)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd draftIQ
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Use

1. **Setup Your Draft**
   - Enter your team name
   - Select your draft position (1-12)
   - Choose number of teams (8, 10, 12, or 14)
   - Choose number of rounds (10, 15, or 16)

2. **Draft Players**
   - When it's your turn, browse available players
   - Use search and position filters to find players
   - Click a player to select them
   - Click "Draft [Player Name]" to make your pick
   - AI opponents will automatically make their picks

3. **Watch the Draft Unfold**
   - See recent picks in real-time
   - Track your team roster
   - AI opponents react to positional runs and tier breaks
   - Watch AI personalities manifest in their draft decisions

## Project Structure

```
draftiq/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── players/          # Fetch players endpoint
│   │   ├── draft/            # Draft CRUD endpoints
│   │   └── ai-pick/          # AI decision endpoint
│   ├── draft/[id]/           # Draft room page
│   └── page.tsx              # Home page (setup)
├── components/               # React components
├── lib/                      # Core business logic
│   ├── ai/                   # AI decision engine
│   │   ├── decision-engine.ts   # Core AI algorithm
│   │   ├── profiles.ts          # AI personalities
│   │   ├── need-calculator.ts   # Team need scoring
│   │   ├── tier-analyzer.ts     # Tier break detection
│   │   └── psychology.ts        # Run detection & panic
│   ├── draft/                # Draft mechanics
│   │   └── draft-engine.ts      # Snake draft logic
│   ├── api/                  # External APIs
│   │   └── sleeper.ts           # Sleeper API client
│   └── types.ts              # TypeScript types
└── store/                    # State management
    └── draft-store.ts        # Zustand draft store
```

## AI Decision Algorithm

The AI uses a sophisticated weighted scoring system:

```
For each available player:
  baseScore = (200 - player.adp)

  // Factor 1: Team Need (30% weight)
  needScore = calculateNeedScore(team, player.position)

  // Factor 2: Value vs ADP (25% weight)
  valueScore = (currentPick - player.adp) * aiProfile.reachThreshold

  // Factor 3: Positional Run Psychology (20% weight)
  runScore = calculateRunPanic(recentPicks, player.position, aiProfile.panicFactor)

  // Factor 4: Tier Break Urgency (15% weight)
  tierScore = isLastInTier(player) ? 50 : 0

  // Factor 5: Bye Week Stacking (10% weight)
  byeScore = calculateByePenalty(team.byeWeekCount, player.byeWeek, aiProfile.byeWeekAwareness)

  totalScore = baseScore + (needScore * 0.3) + (valueScore * 0.25) +
               (runScore * 0.2) + (tierScore * 0.15) + (byeScore * 0.1)

Pick player with highest totalScore
```

## Future Enhancements

- [ ] Real-time multiplayer drafts
- [ ] Draft history and analytics
- [ ] Export draft results to CSV
- [ ] Custom scoring settings (Standard, PPR, Half-PPR)
- [ ] Undo/redo picks
- [ ] Pick timer with auto-draft
- [ ] Mock draft vs real draft comparisons
- [ ] Integration with FantasyPros API for better ADP data
- [ ] Player news and injury updates
- [ ] Trade analyzer post-draft
- [ ] Keeper league support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Acknowledgments

- Player data provided by [Sleeper API](https://docs.sleeper.com/)
- Built with [Next.js](https://nextjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

**DraftIQ** - Because AI opponents should draft like humans, not robots. 🏈🧠
