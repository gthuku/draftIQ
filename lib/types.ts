// Core position types
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
export type InjuryStatus = 'healthy' | 'questionable' | 'doubtful' | 'out';

// Player statistics
export interface PlayerStats {
  gamesPlayed?: number;
  passingYards?: number;
  passingTDs?: number;
  rushingYards?: number;
  rushingTDs?: number;
  receivingYards?: number;
  receivingTDs?: number;
  receptions?: number;
  targets?: number;
  // Add more stats as needed
}

// Player model
export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string;
  byeWeek: number;
  adp: number;
  tier: number;
  projectedPoints: number;
  stats: PlayerStats;
  injuryStatus?: InjuryStatus;
  // Additional metadata
  age?: number;
  experience?: number;
  riskScore?: number; // 0-10 (higher = more risky)
  ceilingScore?: number; // Upside potential
  floorScore?: number; // Safety floor
}

// AI Profile model
export interface AIProfile {
  id: string;
  name: string;
  riskTolerance: number; // 0-1 (0=safe, 1=risky)
  positionalPreferences: Record<Position, number>; // position weights
  reachThreshold: number; // 0-1 (how far from ADP they'll reach)
  panicFactor: number; // 0-1 (how much runs affect them)
  byeWeekAwareness: number; // 0-1 (how much they care about byes)
  favoriteTeams: string[]; // teams they reach for
  description: string; // Profile description for UI
}

// Draft Pick record
export interface DraftPick {
  id: string;
  draftId: string;
  teamId: string;
  playerId: string;
  pickNumber: number;
  round: number;
  pickInRound: number;
  timestamp: number;
  isAIPick: boolean;
}

// Draft Settings
export interface DraftSettings {
  numTeams: number;
  numRounds: number;
  pickTimeLimit?: number; // seconds per pick (0 = no limit)
  scoringType: 'standard' | 'ppr' | 'half-ppr';
  rosterSlots: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    FLEX: number; // RB/WR/TE
    K: number;
    DEF: number;
    BENCH: number;
  };
}

// Team model
export interface Team {
  id: string;
  name: string;
  isUser: boolean;
  aiProfile?: AIProfile;
  roster: Player[];
  needs: Record<Position, number>; // position need scores (0-100)
  byeWeekCount: Record<number, number>; // bye week distribution
  draftPosition: number; // 1-indexed position in draft order
}

// Draft State model
export interface DraftState {
  id: string;
  teams: Team[];
  picks: DraftPick[];
  currentPickIndex: number;
  availablePlayers: Player[];
  draftOrder: string[]; // team IDs in snake order for all picks
  settings: DraftSettings;
  status: 'setup' | 'in_progress' | 'completed';
  createdAt: number;
  updatedAt: number;
}

// Position tier analysis
export interface PositionTier {
  position: Position;
  tierNumber: number;
  players: Player[];
  avgADP: number;
  remaining: number;
}

// Draft psychology context
export interface DraftContext {
  recentPicks: DraftPick[]; // Last 5-10 picks
  positionalRunning: Map<Position, number>; // How many consecutive picks per position
  scarcityIndex: Map<Position, number>; // Scarcity score per position (0-100)
  currentRound: number;
  picksRemaining: number;
}

// AI decision scoring
export interface PickScore {
  playerId: string;
  totalScore: number;
  breakdown: {
    baseScore: number;
    needScore: number;
    valueScore: number;
    runScore: number;
    tierScore: number;
    byeScore: number;
  };
}

// API response types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateDraftRequest {
  userTeamName: string;
  userDraftPosition: number;
  settings: DraftSettings;
  aiProfiles?: string[]; // IDs of AI profiles to use
}

export interface MakePickRequest {
  draftId: string;
  teamId: string;
  playerId: string;
}

export interface AIPickRequest {
  draftId: string;
  teamId: string;
}

// Sleeper API types
export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string;
  injury_status?: string;
  years_exp?: number;
  age?: number;
  // Add more fields as needed from Sleeper API
}

export interface SleeperADPData {
  [playerId: string]: {
    adp: number;
    count: number;
  };
}
