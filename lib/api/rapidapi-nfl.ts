/**
 * RapidAPI NFL Data Client
 * Fetches player data and ADP from Tank01 NFL API
 * https://rapidapi.com/tank01/api/tank01-nfl-live-in-game-real-time-statistics-nfl
 */

import { Player, Position, InjuryStatus } from '@/lib/types';

const RAPIDAPI_HOST = 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

interface PlayerCache {
  data: Player[];
  timestamp: number;
}

// In-memory cache
const playerCache = new Map<string, PlayerCache>();
const rawPlayerCache: { data: RapidAPIPlayer[] | null; timestamp: number } = { data: null, timestamp: 0 };
const adpCache = new Map<string, { data: RapidAPIADPEntry[]; timestamp: number }>();

// 2025 NFL bye weeks
const BYE_WEEKS: Record<string, number> = {
  ARI: 11, ATL: 12, BAL: 14, BUF: 12, CAR: 11,
  CHI: 7, CIN: 12, CLE: 10, DAL: 7, DEN: 14,
  DET: 5, GB: 10, HOU: 14, IND: 14, JAX: 12,
  KC: 6, LAC: 5, LAR: 6, LV: 10, MIA: 6,
  MIN: 6, NE: 14, NO: 12, NYG: 11, NYJ: 12,
  PHI: 5, PIT: 9, SEA: 10, SF: 9, TB: 11,
  TEN: 5, WAS: 14
};

// RapidAPI response types
interface RapidAPIPlayer {
  playerID: string;
  longName?: string;
  espnName?: string;
  pos?: string;
  team?: string;
  teamID?: string;
  age?: string;
  exp?: string;
  injury?: {
    injReturnDate?: string;
    description?: string;
    injDate?: string;
    designation?: string;
  };
  jerseyNum?: string;
  height?: string;
  weight?: string;
  college?: string;
  bDay?: string;
}

interface RapidAPIADPEntry {
  playerID: string;
  adp?: string;
  avg?: string;
  high?: string;
  low?: string;
  stDev?: string;
  espnName?: string;
  pos?: string;
  team?: string;
  adpDate?: string; // Date of ADP data
}

interface RapidAPIPlayerResponse {
  statusCode: number;
  body: RapidAPIPlayer[];
}

interface RapidAPIADPResponse {
  statusCode: number;
  body: RapidAPIADPEntry[];
}

interface RapidAPIPlayerInfo {
  playerID: string;
  espnName?: string;
  espnHeadshot?: string;
  espnIDFull?: string;
  longName?: string;
  team?: string;
  pos?: string;
  age?: string;
  exp?: string;
  jerseyNum?: string;
  height?: string;
  weight?: string;
  college?: string;
  stats?: {
    gamesPlayed?: string;
    Rushing?: { rushYds?: string; rushTD?: string; };
    Receiving?: { recYds?: string; recTD?: string; receptions?: string; };
    Passing?: { passYds?: string; passTD?: string; };
  };
}

interface RapidAPIPlayerInfoResponse {
  statusCode: number;
  body: RapidAPIPlayerInfo;
}

// Cache for player info (headshots + stats)
const playerInfoCache = new Map<string, RapidAPIPlayerInfo>();
const headshotCache = new Map<string, string>();

/**
 * Get RapidAPI key from environment
 */
function getApiKey(): string {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    throw new Error('RAPIDAPI_KEY environment variable is not set');
  }
  return key;
}

/**
 * Fetch player list from RapidAPI
 */
async function fetchPlayerList(): Promise<RapidAPIPlayer[]> {
  // Check cache
  if (rawPlayerCache.data && Date.now() - rawPlayerCache.timestamp < CACHE_DURATION) {
    console.log('Returning cached raw player list:', rawPlayerCache.data.length);
    return rawPlayerCache.data;
  }

  try {
    const apiKey = getApiKey();

    const response = await fetch(`${RAPIDAPI_BASE_URL}/getNFLPlayerList`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch player list: ${response.status} ${response.statusText}`);
    }

    const data: RapidAPIPlayerResponse = await response.json();

    if (data.statusCode !== 200 || !Array.isArray(data.body)) {
      throw new Error(`Invalid response from player list API: ${data.statusCode}`);
    }

    // Cache the raw data
    rawPlayerCache.data = data.body;
    rawPlayerCache.timestamp = Date.now();

    console.log('Fetched player list from RapidAPI:', data.body.length);
    return data.body;
  } catch (error) {
    console.error('Error fetching player list from RapidAPI:', error);

    // Return cached data if available
    if (rawPlayerCache.data) {
      console.warn('Using stale cached player list');
      return rawPlayerCache.data;
    }

    throw error;
  }
}

/**
 * Map scoring format to RapidAPI adpType parameter
 */
function mapScoringFormatToAdpType(scoringFormat: 'standard' | 'ppr' | 'half_ppr'): string {
  switch (scoringFormat) {
    case 'ppr':
      return 'PPR';
    case 'half_ppr':
      return 'halfPPR';
    case 'standard':
    default:
      return 'STD';
  }
}

/**
 * Fetch ADP data from RapidAPI
 */
async function fetchADPData(scoringFormat: 'standard' | 'ppr' | 'half_ppr'): Promise<RapidAPIADPEntry[]> {
  const adpType = mapScoringFormatToAdpType(scoringFormat);
  const cacheKey = adpType;

  // Check cache
  const cached = adpCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached ADP data for:', adpType);
    return cached.data;
  }

  try {
    const apiKey = getApiKey();

    const response = await fetch(`${RAPIDAPI_BASE_URL}/getNFLADP?adpType=${adpType}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ADP data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Log raw response structure for debugging
    console.log('ADP API response keys:', Object.keys(data));

    // Handle different response structures
    let adpEntries: RapidAPIADPEntry[] = [];

    if (data.statusCode === 200 && Array.isArray(data.body)) {
      // Standard response: { statusCode: 200, body: [...] }
      adpEntries = data.body;
    } else if (Array.isArray(data)) {
      // Direct array response
      adpEntries = data;
    } else if (data.body && typeof data.body === 'object' && !Array.isArray(data.body)) {
      // Response where body is an object with player IDs as keys
      adpEntries = Object.values(data.body);
    } else {
      console.log('ADP API raw response sample:', JSON.stringify(data).slice(0, 500));
      throw new Error(`Invalid response from ADP API: ${JSON.stringify(Object.keys(data))}`);
    }

    // Cache the data
    adpCache.set(cacheKey, {
      data: adpEntries,
      timestamp: Date.now(),
    });

    console.log('Fetched ADP data from RapidAPI:', adpEntries.length, 'for type:', adpType);
    return adpEntries;
  } catch (error) {
    console.error('Error fetching ADP data from RapidAPI:', error);

    // Return cached data if available
    if (cached) {
      console.warn('Using stale cached ADP data');
      return cached.data;
    }

    return [];
  }
}

/**
 * Fetch full player info (including headshot and stats) from RapidAPI
 */
async function fetchFullPlayerInfo(playerID: string): Promise<RapidAPIPlayerInfo | undefined> {
  // Check cache first
  if (playerInfoCache.has(playerID)) {
    return playerInfoCache.get(playerID);
  }

  try {
    const apiKey = getApiKey();

    const response = await fetch(`${RAPIDAPI_BASE_URL}/getNFLPlayerInfo?playerID=${playerID}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return undefined;
    }

    const data: RapidAPIPlayerInfoResponse = await response.json();

    if (data.statusCode === 200 && data.body) {
      playerInfoCache.set(playerID, data.body);
      if (data.body.espnHeadshot) {
        headshotCache.set(playerID, data.body.espnHeadshot);
      }
      return data.body;
    }

    return undefined;
  } catch (error) {
    console.error('Error fetching player info:', error);
    return undefined;
  }
}

/**
 * Fetch player info (headshot only) from RapidAPI - for backward compatibility
 */
async function fetchPlayerInfo(playerID: string): Promise<string | undefined> {
  const info = await fetchFullPlayerInfo(playerID);
  return info?.espnHeadshot;
}

/**
 * Check if a player has produced meaningful stats
 * Returns true if player has stats OR is a rookie (exp <= 1)
 */
function hasProducedOrIsRookie(playerInfo: RapidAPIPlayerInfo | undefined, playerData: RapidAPIPlayer): boolean {
  const experience = playerData.exp ? parseInt(playerData.exp, 10) : 0;

  // Rookies and 2nd year players get a pass - they may not have stats yet
  if (experience <= 1) {
    return true;
  }

  // If we don't have player info, use basic player data
  if (!playerInfo?.stats) {
    // If player has experience > 1, they should have some history
    // We'll be lenient and include them, but they'll get fallback ADP
    return true;
  }

  const stats = playerInfo.stats;
  const gamesPlayed = parseInt(stats.gamesPlayed || '0', 10);

  // If they've played games, they're legitimate
  if (gamesPlayed > 0) {
    return true;
  }

  // Check for any meaningful stats
  const rushYds = parseInt(stats.Rushing?.rushYds || '0', 10);
  const recYds = parseInt(stats.Receiving?.recYds || '0', 10);
  const passYds = parseInt(stats.Passing?.passYds || '0', 10);

  return rushYds > 0 || recYds > 0 || passYds > 0;
}

/**
 * Fetch full player info for multiple players in batches
 */
async function fetchPlayerInfoForPlayers(playerIDs: string[]): Promise<Map<string, RapidAPIPlayerInfo>> {
  const results = new Map<string, RapidAPIPlayerInfo>();
  const uncachedIDs = playerIDs.filter(id => !playerInfoCache.has(id));

  // Return cached results for IDs we already have
  for (const id of playerIDs) {
    const cached = playerInfoCache.get(id);
    if (cached) {
      results.set(id, cached);
    }
  }

  // Fetch uncached info in parallel (limit to avoid rate limiting)
  const BATCH_SIZE = 20;
  for (let i = 0; i < uncachedIDs.length; i += BATCH_SIZE) {
    const batch = uncachedIDs.slice(i, i + BATCH_SIZE);
    const promises = batch.map(id => fetchFullPlayerInfo(id).then(info => ({ id, info })));

    const batchResults = await Promise.all(promises);
    for (const { id, info } of batchResults) {
      if (info) {
        results.set(id, info);
      }
    }
  }

  return results;
}

/**
 * Fetch headshots for multiple players in batches
 */
async function fetchHeadshotsForPlayers(playerIDs: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const uncachedIDs = playerIDs.filter(id => !headshotCache.has(id));

  // Return cached results for IDs we already have
  for (const id of playerIDs) {
    const cached = headshotCache.get(id);
    if (cached) {
      results.set(id, cached);
    }
  }

  // Fetch uncached headshots in parallel (limit to avoid rate limiting)
  const BATCH_SIZE = 20;
  for (let i = 0; i < uncachedIDs.length; i += BATCH_SIZE) {
    const batch = uncachedIDs.slice(i, i + BATCH_SIZE);
    const promises = batch.map(id => fetchPlayerInfo(id).then(headshot => ({ id, headshot })));

    const batchResults = await Promise.all(promises);
    for (const { id, headshot } of batchResults) {
      if (headshot) {
        results.set(id, headshot);
      }
    }
  }

  return results;
}

/**
 * Map injury designation to our InjuryStatus type
 */
function mapInjuryStatus(designation?: string): InjuryStatus {
  if (!designation) return 'healthy';

  const normalized = designation.toLowerCase();
  if (normalized === 'out' || normalized === 'ir') return 'out';
  if (normalized === 'doubtful') return 'doubtful';
  if (normalized === 'questionable') return 'questionable';

  return 'healthy';
}

/**
 * Calculate projected points based on position and ADP
 */
function calculateProjectedPoints(
  position: Position,
  adp: number,
  scoringFormat: 'standard' | 'ppr' | 'half_ppr'
): number {
  const basePoints: Record<Position, number> = {
    QB: 320,
    RB: 250,
    WR: 220,
    TE: 180,
    K: 140,
    DEF: 150
  };

  // Calculate based on ADP (higher ADP = lower points)
  const base = basePoints[position];
  const adpFactor = Math.max(0.1, 1 - (adp / 300));
  let projected = base * adpFactor;

  // Adjust for scoring format
  if (scoringFormat === 'ppr' && (position === 'WR' || position === 'TE')) {
    projected *= 1.15;
  } else if (scoringFormat === 'half_ppr' && (position === 'WR' || position === 'TE')) {
    projected *= 1.07;
  }

  return Math.round(projected * 10) / 10;
}

/**
 * Calculate risk score
 */
function calculateRiskScore(age: number | null, experience: number, injuryStatus: InjuryStatus): number {
  let risk = 5.0;

  if (experience === 0 || experience === 1) risk += 2; // Rookies
  if (age && age > 30) risk += 1; // Veteran decline risk
  if (experience > 10) risk += 1; // Longevity risk

  // Injury impacts risk
  if (injuryStatus === 'out') risk += 3;
  else if (injuryStatus === 'doubtful') risk += 2;
  else if (injuryStatus === 'questionable') risk += 1;

  return Math.min(10, Math.max(0, risk));
}

/**
 * Calculate ceiling score
 */
function calculateCeilingScore(age: number | null, experience: number, adp: number): number {
  let ceiling = Math.max(0, 100 - (adp * 0.4));

  if (age && age < 25) ceiling += 5; // Young upside
  if (experience < 2) ceiling += 10; // Rookie/sophomore breakout potential

  return Math.min(100, Math.max(0, ceiling));
}

/**
 * Calculate floor score
 */
function calculateFloorScore(age: number | null, experience: number, adp: number, injuryStatus: InjuryStatus): number {
  let floor = Math.max(0, 100 - (adp * 0.4));

  if (experience > 5) floor += 10; // Veteran consistency
  if (age && age > 30) floor -= 5; // Decline risk

  // Injury lowers floor
  if (injuryStatus !== 'healthy') floor -= 10;

  return Math.min(100, Math.max(0, floor));
}

/**
 * Map RapidAPI player and ADP data to Player interface
 */
function mapToPlayer(
  playerData: RapidAPIPlayer,
  adpEntry: RapidAPIADPEntry | undefined,
  scoringFormat: 'standard' | 'ppr' | 'half_ppr',
  fallbackRank: number,
  headshot?: string
): Player | null {
  // Validate position
  const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const posStr = (playerData.pos || '').toUpperCase();

  if (!validPositions.includes(posStr)) {
    return null;
  }

  const position = posStr as Position;
  const age = playerData.age ? parseInt(playerData.age, 10) : null;
  const experience = playerData.exp ? parseInt(playerData.exp, 10) : 0;
  const injuryStatus = mapInjuryStatus(playerData.injury?.designation);

  // Use ADP from API or calculate fallback
  let adp: number;
  let adpSource = 'fallback';

  if (adpEntry?.adp && !isNaN(parseFloat(adpEntry.adp))) {
    adp = parseFloat(adpEntry.adp);
    adpSource = 'adp';
  } else if (adpEntry?.avg && !isNaN(parseFloat(adpEntry.avg))) {
    adp = parseFloat(adpEntry.avg);
    adpSource = 'avg';
  } else {
    // Fallback ADP calculation based on position rank
    const baseMultipliers: Record<Position, number> = {
      QB: 1.8, RB: 0.8, WR: 1.0, TE: 1.5, K: 3.0, DEF: 2.5
    };
    adp = fallbackRank * baseMultipliers[position];
  }

  // Log ADP source for debugging (first few players)
  if (fallbackRank <= 3) {
    const playerName = playerData.longName || playerData.espnName;
    console.log(`ADP for ${playerName}: ${adp} (source: ${adpSource}, adpDate: ${adpEntry?.adpDate || 'N/A'})`);
  }

  const tier = Math.floor(adp / 18) + 1;
  const projectedPoints = calculateProjectedPoints(position, adp, scoringFormat);
  const team = (playerData.team || 'FA').toUpperCase();

  return {
    id: playerData.playerID,
    name: playerData.longName || playerData.espnName || 'Unknown Player',
    position,
    team,
    byeWeek: BYE_WEEKS[team] || 0,
    adp,
    tier,
    projectedPoints,
    stats: {
      passingYards: 0,
      passingTDs: 0,
      rushingYards: 0,
      rushingTDs: 0,
      receptions: 0,
      receivingYards: 0,
      receivingTDs: 0
    },
    injuryStatus,
    age: age ?? undefined,
    experience,
    riskScore: calculateRiskScore(age, experience, injuryStatus),
    ceilingScore: calculateCeilingScore(age, experience, adp),
    floorScore: calculateFloorScore(age, experience, adp, injuryStatus),
    headshot
  };
}

interface CuratedPlayer {
  name: string;
  pos: string;
  team: string;
  age: number;
  exp: number;
  adp: number; // Base ADP (will be adjusted for scoring format)
}

/**
 * Get comprehensive list of top fantasy players with accurate 2025 ADPs
 * ADPs based on consensus rankings from FantasyPros, ESPN, Yahoo
 */
function getTopFantasyPlayersWithADP(scoringFormat: 'standard' | 'ppr' | 'half_ppr'): CuratedPlayer[] {
  // Base ADPs (Half-PPR), will be adjusted for other formats
  const players: CuratedPlayer[] = [
    // Top 12 - Round 1
    { name: "Ja'Marr Chase", pos: 'WR', team: 'CIN', age: 25, exp: 4, adp: 1.0 },
    { name: 'Saquon Barkley', pos: 'RB', team: 'PHI', age: 28, exp: 7, adp: 2.0 },
    { name: 'Bijan Robinson', pos: 'RB', team: 'ATL', age: 22, exp: 2, adp: 3.0 },
    { name: 'CeeDee Lamb', pos: 'WR', team: 'DAL', age: 25, exp: 5, adp: 4.0 },
    { name: 'Jahmyr Gibbs', pos: 'RB', team: 'DET', age: 22, exp: 2, adp: 5.0 },
    { name: 'Breece Hall', pos: 'RB', team: 'NYJ', age: 23, exp: 3, adp: 6.0 },
    { name: 'Amon-Ra St. Brown', pos: 'WR', team: 'DET', age: 25, exp: 4, adp: 7.0 },
    { name: 'Justin Jefferson', pos: 'WR', team: 'MIN', age: 25, exp: 5, adp: 8.0 },
    { name: 'Tyreek Hill', pos: 'WR', team: 'MIA', age: 31, exp: 9, adp: 9.0 },
    { name: 'Jonathan Taylor', pos: 'RB', team: 'IND', age: 25, exp: 4, adp: 10.0 },
    { name: 'Derrick Henry', pos: 'RB', team: 'BAL', age: 31, exp: 9, adp: 11.0 },
    { name: 'Garrett Wilson', pos: 'WR', team: 'NYJ', age: 24, exp: 3, adp: 12.0 },

    // Round 2
    { name: 'Puka Nacua', pos: 'WR', team: 'LAR', age: 23, exp: 2, adp: 13.0 },
    { name: 'A.J. Brown', pos: 'WR', team: 'PHI', age: 27, exp: 6, adp: 14.0 },
    { name: 'Kyren Williams', pos: 'RB', team: 'LAR', age: 24, exp: 3, adp: 15.0 },
    { name: 'De\'Von Achane', pos: 'RB', team: 'MIA', age: 23, exp: 2, adp: 16.0 },
    { name: 'Nico Collins', pos: 'WR', team: 'HOU', age: 25, exp: 4, adp: 17.0 },
    { name: 'Malik Nabers', pos: 'WR', team: 'NYG', age: 21, exp: 1, adp: 18.0 },
    { name: 'Drake London', pos: 'WR', team: 'ATL', age: 23, exp: 3, adp: 19.0 },
    { name: 'Josh Jacobs', pos: 'RB', team: 'GB', age: 27, exp: 6, adp: 20.0 },
    { name: 'Chris Olave', pos: 'WR', team: 'NO', age: 24, exp: 3, adp: 21.0 },
    { name: 'Davante Adams', pos: 'WR', team: 'NYJ', age: 32, exp: 11, adp: 22.0 },
    { name: 'Kenneth Walker III', pos: 'RB', team: 'SEA', age: 24, exp: 3, adp: 23.0 },
    { name: 'Travis Etienne Jr.', pos: 'RB', team: 'JAX', age: 25, exp: 4, adp: 24.0 },

    // Round 3
    { name: 'Josh Allen', pos: 'QB', team: 'BUF', age: 28, exp: 7, adp: 25.0 },
    { name: 'Lamar Jackson', pos: 'QB', team: 'BAL', age: 28, exp: 7, adp: 26.0 },
    { name: 'Marvin Harrison Jr.', pos: 'WR', team: 'ARI', age: 22, exp: 1, adp: 27.0 },
    { name: 'Brian Thomas Jr.', pos: 'WR', team: 'JAX', age: 22, exp: 1, adp: 28.0 },
    { name: 'James Cook', pos: 'RB', team: 'BUF', age: 25, exp: 3, adp: 29.0 },
    { name: 'Jalen Hurts', pos: 'QB', team: 'PHI', age: 26, exp: 5, adp: 30.0 },
    { name: 'Tee Higgins', pos: 'WR', team: 'CIN', age: 26, exp: 5, adp: 31.0 },
    { name: 'DK Metcalf', pos: 'WR', team: 'SEA', age: 27, exp: 6, adp: 32.0 },
    { name: 'Travis Kelce', pos: 'TE', team: 'KC', age: 35, exp: 12, adp: 33.0 },
    { name: 'Sam LaPorta', pos: 'TE', team: 'DET', age: 24, exp: 2, adp: 34.0 },
    { name: 'Brock Bowers', pos: 'TE', team: 'LV', age: 22, exp: 1, adp: 35.0 },
    { name: 'Deebo Samuel', pos: 'WR', team: 'SF', age: 28, exp: 6, adp: 36.0 },

    // Round 4
    { name: 'Jaylen Waddle', pos: 'WR', team: 'MIA', age: 26, exp: 4, adp: 37.0 },
    { name: 'Stefon Diggs', pos: 'WR', team: 'HOU', age: 31, exp: 10, adp: 38.0 },
    { name: 'Najee Harris', pos: 'RB', team: 'PIT', age: 27, exp: 4, adp: 39.0 },
    { name: 'Aaron Jones', pos: 'RB', team: 'MIN', age: 30, exp: 8, adp: 40.0 },
    { name: 'Isiah Pacheco', pos: 'RB', team: 'KC', age: 25, exp: 3, adp: 41.0 },
    { name: 'D.J. Moore', pos: 'WR', team: 'CHI', age: 27, exp: 7, adp: 42.0 },
    { name: 'George Pickens', pos: 'WR', team: 'PIT', age: 24, exp: 3, adp: 43.0 },
    { name: 'Alvin Kamara', pos: 'RB', team: 'NO', age: 29, exp: 8, adp: 44.0 },
    { name: 'Rome Odunze', pos: 'WR', team: 'CHI', age: 22, exp: 1, adp: 45.0 },
    { name: 'Mike Evans', pos: 'WR', team: 'TB', age: 31, exp: 11, adp: 46.0 },
    { name: 'Patrick Mahomes', pos: 'QB', team: 'KC', age: 29, exp: 8, adp: 47.0 },
    { name: 'Terry McLaurin', pos: 'WR', team: 'WAS', age: 29, exp: 6, adp: 48.0 },

    // Round 5
    { name: 'Trey McBride', pos: 'TE', team: 'ARI', age: 25, exp: 3, adp: 49.0 },
    { name: 'David Njoku', pos: 'TE', team: 'CLE', age: 28, exp: 8, adp: 50.0 },
    { name: 'Joe Burrow', pos: 'QB', team: 'CIN', age: 28, exp: 5, adp: 51.0 },
    { name: 'C.J. Stroud', pos: 'QB', team: 'HOU', age: 23, exp: 2, adp: 52.0 },
    { name: 'Zay Flowers', pos: 'WR', team: 'BAL', age: 24, exp: 2, adp: 53.0 },
    { name: 'Cooper Kupp', pos: 'WR', team: 'LAR', age: 31, exp: 8, adp: 54.0 },
    { name: 'Tony Pollard', pos: 'RB', team: 'TEN', age: 27, exp: 6, adp: 55.0 },
    { name: 'Rashee Rice', pos: 'WR', team: 'KC', age: 24, exp: 2, adp: 56.0 },
    { name: 'Rhamondre Stevenson', pos: 'RB', team: 'NE', age: 26, exp: 4, adp: 57.0 },
    { name: 'Keenan Allen', pos: 'WR', team: 'CHI', age: 32, exp: 12, adp: 58.0 },
    { name: 'Christian Kirk', pos: 'WR', team: 'JAX', age: 28, exp: 7, adp: 59.0 },
    { name: 'Dalton Kincaid', pos: 'TE', team: 'BUF', age: 25, exp: 2, adp: 60.0 },

    // Round 6
    { name: 'DeVonta Smith', pos: 'WR', team: 'PHI', age: 26, exp: 4, adp: 61.0 },
    { name: 'Calvin Ridley', pos: 'WR', team: 'TEN', age: 30, exp: 7, adp: 62.0 },
    { name: 'Javonte Williams', pos: 'RB', team: 'DEN', age: 24, exp: 4, adp: 63.0 },
    { name: 'Jayden Daniels', pos: 'QB', team: 'WAS', age: 24, exp: 1, adp: 64.0 },
    { name: 'Amari Cooper', pos: 'WR', team: 'BUF', age: 30, exp: 10, adp: 65.0 },
    { name: 'Zamir White', pos: 'RB', team: 'LV', age: 25, exp: 3, adp: 66.0 },
    { name: 'Jaylen Warren', pos: 'RB', team: 'PIT', age: 26, exp: 3, adp: 67.0 },
    { name: 'Diontae Johnson', pos: 'WR', team: 'BAL', age: 28, exp: 6, adp: 68.0 },
    { name: 'Mark Andrews', pos: 'TE', team: 'BAL', age: 29, exp: 7, adp: 69.0 },
    { name: 'Kyler Murray', pos: 'QB', team: 'ARI', age: 27, exp: 6, adp: 70.0 },
    { name: 'Anthony Richardson', pos: 'QB', team: 'IND', age: 22, exp: 2, adp: 71.0 },
    { name: 'Jordan Love', pos: 'QB', team: 'GB', age: 26, exp: 5, adp: 72.0 },

    // Round 7
    { name: 'George Kittle', pos: 'TE', team: 'SF', age: 31, exp: 8, adp: 73.0 },
    { name: 'Dak Prescott', pos: 'QB', team: 'DAL', age: 31, exp: 9, adp: 74.0 },
    { name: 'David Montgomery', pos: 'RB', team: 'DET', age: 27, exp: 6, adp: 75.0 },
    { name: 'Raheem Mostert', pos: 'RB', team: 'MIA', age: 32, exp: 9, adp: 76.0 },
    { name: 'Jaxon Smith-Njigba', pos: 'WR', team: 'SEA', age: 22, exp: 2, adp: 77.0 },
    { name: 'Ladd McConkey', pos: 'WR', team: 'LAC', age: 23, exp: 1, adp: 78.0 },
    { name: 'Michael Pittman Jr.', pos: 'WR', team: 'IND', age: 27, exp: 5, adp: 79.0 },
    { name: 'Tank Dell', pos: 'WR', team: 'HOU', age: 25, exp: 2, adp: 80.0 },
    { name: 'Jakobi Meyers', pos: 'WR', team: 'LV', age: 28, exp: 6, adp: 81.0 },
    { name: 'Caleb Williams', pos: 'QB', team: 'CHI', age: 23, exp: 1, adp: 82.0 },
    { name: 'Tua Tagovailoa', pos: 'QB', team: 'MIA', age: 27, exp: 5, adp: 83.0 },
    { name: 'James Conner', pos: 'RB', team: 'ARI', age: 29, exp: 8, adp: 84.0 },

    // Round 8
    { name: 'Jayden Reed', pos: 'WR', team: 'GB', age: 24, exp: 2, adp: 85.0 },
    { name: 'Jonathon Brooks', pos: 'RB', team: 'CAR', age: 22, exp: 1, adp: 86.0 },
    { name: 'Brandon Aiyuk', pos: 'WR', team: 'SF', age: 26, exp: 5, adp: 87.0 },
    { name: 'Zack Moss', pos: 'RB', team: 'CIN', age: 26, exp: 5, adp: 88.0 },
    { name: 'Curtis Samuel', pos: 'WR', team: 'BUF', age: 28, exp: 8, adp: 89.0 },
    { name: 'Austin Ekeler', pos: 'RB', team: 'WAS', age: 29, exp: 8, adp: 90.0 },
    { name: 'Evan Engram', pos: 'TE', team: 'JAX', age: 30, exp: 8, adp: 91.0 },
    { name: 'Pat Freiermuth', pos: 'TE', team: 'PIT', age: 26, exp: 4, adp: 92.0 },
    { name: 'Jake Ferguson', pos: 'TE', team: 'DAL', age: 25, exp: 3, adp: 93.0 },
    { name: 'Tyler Lockett', pos: 'WR', team: 'SEA', age: 32, exp: 10, adp: 94.0 },
    { name: 'Courtland Sutton', pos: 'WR', team: 'DEN', age: 29, exp: 7, adp: 95.0 },
    { name: 'Gus Edwards', pos: 'RB', team: 'LAC', age: 29, exp: 7, adp: 96.0 },

    // Round 9-10
    { name: 'Marquise Brown', pos: 'WR', team: 'KC', age: 27, exp: 6, adp: 97.0 },
    { name: 'Tyler Allgeier', pos: 'RB', team: 'ATL', age: 25, exp: 3, adp: 98.0 },
    { name: 'Chase Brown', pos: 'RB', team: 'CIN', age: 24, exp: 2, adp: 99.0 },
    { name: 'Rico Dowdle', pos: 'RB', team: 'DAL', age: 26, exp: 5, adp: 100.0 },
    { name: 'Chuba Hubbard', pos: 'RB', team: 'CAR', age: 25, exp: 4, adp: 101.0 },
    { name: 'Wan\'Dale Robinson', pos: 'WR', team: 'NYG', age: 24, exp: 3, adp: 102.0 },
    { name: 'Dontayvion Wicks', pos: 'WR', team: 'GB', age: 24, exp: 2, adp: 103.0 },
    { name: 'Rashid Shaheed', pos: 'WR', team: 'NO', age: 25, exp: 3, adp: 104.0 },
    { name: 'Ja\'Lynn Polk', pos: 'WR', team: 'NE', age: 22, exp: 1, adp: 105.0 },
    { name: 'Adonai Mitchell', pos: 'WR', team: 'IND', age: 22, exp: 1, adp: 106.0 },
    { name: 'Xavier Worthy', pos: 'WR', team: 'KC', age: 21, exp: 1, adp: 107.0 },
    { name: 'Trey Benson', pos: 'RB', team: 'ARI', age: 22, exp: 1, adp: 108.0 },
    { name: 'Blake Corum', pos: 'RB', team: 'LAR', age: 24, exp: 1, adp: 109.0 },
    { name: 'Bucky Irving', pos: 'RB', team: 'TB', age: 22, exp: 1, adp: 110.0 },
    { name: 'Ray Davis', pos: 'RB', team: 'BUF', age: 24, exp: 1, adp: 111.0 },
    { name: 'MarShawn Lloyd', pos: 'RB', team: 'GB', age: 23, exp: 1, adp: 112.0 },

    // Round 11-12
    { name: 'Justin Herbert', pos: 'QB', team: 'LAC', age: 26, exp: 5, adp: 113.0 },
    { name: 'Trevor Lawrence', pos: 'QB', team: 'JAX', age: 25, exp: 4, adp: 114.0 },
    { name: 'Brock Purdy', pos: 'QB', team: 'SF', age: 24, exp: 3, adp: 115.0 },
    { name: 'Kyle Pitts', pos: 'TE', team: 'ATL', age: 24, exp: 4, adp: 116.0 },
    { name: 'Cole Kmet', pos: 'TE', team: 'CHI', age: 25, exp: 5, adp: 117.0 },
    { name: 'Elijah Moore', pos: 'WR', team: 'CLE', age: 24, exp: 4, adp: 118.0 },
    { name: 'Jameson Williams', pos: 'WR', team: 'DET', age: 23, exp: 3, adp: 119.0 },
    { name: 'Quentin Johnston', pos: 'WR', team: 'LAC', age: 23, exp: 2, adp: 120.0 },
    { name: 'Keon Coleman', pos: 'WR', team: 'BUF', age: 22, exp: 1, adp: 121.0 },
    { name: 'Jordan Addison', pos: 'WR', team: 'MIN', age: 23, exp: 2, adp: 122.0 },
    { name: 'Khalil Shakir', pos: 'WR', team: 'BUF', age: 25, exp: 3, adp: 123.0 },
    { name: 'Josh Downs', pos: 'WR', team: 'IND', age: 23, exp: 2, adp: 124.0 },

    // Round 13-15 (Late round value)
    { name: 'Dalton Schultz', pos: 'TE', team: 'HOU', age: 28, exp: 7, adp: 130.0 },
    { name: 'Hunter Henry', pos: 'TE', team: 'NE', age: 30, exp: 9, adp: 135.0 },
    { name: 'Tyler Conklin', pos: 'TE', team: 'NYJ', age: 29, exp: 7, adp: 140.0 },
    { name: 'Ezekiel Elliott', pos: 'RB', team: 'DAL', age: 29, exp: 9, adp: 145.0 },
    { name: 'Kareem Hunt', pos: 'RB', team: 'KC', age: 29, exp: 8, adp: 150.0 },
    { name: 'D\'Andre Swift', pos: 'RB', team: 'CHI', age: 25, exp: 5, adp: 155.0 },

    // Kickers
    { name: 'Harrison Butker', pos: 'K', team: 'KC', age: 29, exp: 8, adp: 160.0 },
    { name: 'Justin Tucker', pos: 'K', team: 'BAL', age: 35, exp: 13, adp: 161.0 },
    { name: 'Brandon Aubrey', pos: 'K', team: 'DAL', age: 29, exp: 2, adp: 162.0 },
    { name: 'Jake Moody', pos: 'K', team: 'SF', age: 25, exp: 2, adp: 163.0 },
    { name: 'Cameron Dicker', pos: 'K', team: 'LAC', age: 24, exp: 3, adp: 164.0 },
    { name: 'Ka\'imi Fairbairn', pos: 'K', team: 'HOU', age: 31, exp: 9, adp: 165.0 },

    // Defenses
    { name: 'San Francisco 49ers', pos: 'DEF', team: 'SF', age: 0, exp: 0, adp: 170.0 },
    { name: 'Dallas Cowboys', pos: 'DEF', team: 'DAL', age: 0, exp: 0, adp: 171.0 },
    { name: 'Baltimore Ravens', pos: 'DEF', team: 'BAL', age: 0, exp: 0, adp: 172.0 },
    { name: 'Cleveland Browns', pos: 'DEF', team: 'CLE', age: 0, exp: 0, adp: 173.0 },
    { name: 'New York Jets', pos: 'DEF', team: 'NYJ', age: 0, exp: 0, adp: 174.0 },
    { name: 'Miami Dolphins', pos: 'DEF', team: 'MIA', age: 0, exp: 0, adp: 175.0 },
    { name: 'Pittsburgh Steelers', pos: 'DEF', team: 'PIT', age: 0, exp: 0, adp: 176.0 },
    { name: 'Buffalo Bills', pos: 'DEF', team: 'BUF', age: 0, exp: 0, adp: 177.0 },
    { name: 'Kansas City Chiefs', pos: 'DEF', team: 'KC', age: 0, exp: 0, adp: 178.0 },
    { name: 'Houston Texans', pos: 'DEF', team: 'HOU', age: 0, exp: 0, adp: 179.0 },
  ];

  // Adjust ADPs based on scoring format
  return players.map(p => {
    let adjustedADP = p.adp;

    if (scoringFormat === 'ppr') {
      // PPR boosts WRs and pass-catching RBs/TEs
      if (p.pos === 'WR') adjustedADP *= 0.95;
      if (p.pos === 'TE') adjustedADP *= 0.92;
    } else if (scoringFormat === 'standard') {
      // Standard boosts RBs, lowers WRs slightly
      if (p.pos === 'RB') adjustedADP *= 0.95;
      if (p.pos === 'WR') adjustedADP *= 1.05;
    }

    return { ...p, adp: Math.round(adjustedADP * 10) / 10 };
  });
}

/**
 * Generate mock player data as fallback
 */
function generateMockPlayers(scoringFormat: 'standard' | 'ppr' | 'half_ppr', limit: number): Player[] {
  const mockPlayers = [
    // QBs
    { id: 'mock_qb_1', name: 'Josh Allen', pos: 'QB', team: 'BUF', age: 28, exp: 7 },
    { id: 'mock_qb_2', name: 'Jalen Hurts', pos: 'QB', team: 'PHI', age: 26, exp: 5 },
    { id: 'mock_qb_3', name: 'Lamar Jackson', pos: 'QB', team: 'BAL', age: 28, exp: 7 },
    { id: 'mock_qb_4', name: 'Patrick Mahomes', pos: 'QB', team: 'KC', age: 29, exp: 8 },
    { id: 'mock_qb_5', name: 'Joe Burrow', pos: 'QB', team: 'CIN', age: 28, exp: 5 },
    // RBs
    { id: 'mock_rb_1', name: 'Christian McCaffrey', pos: 'RB', team: 'SF', age: 28, exp: 8 },
    { id: 'mock_rb_2', name: 'Bijan Robinson', pos: 'RB', team: 'ATL', age: 22, exp: 2 },
    { id: 'mock_rb_3', name: 'Breece Hall', pos: 'RB', team: 'NYJ', age: 23, exp: 3 },
    { id: 'mock_rb_4', name: 'Jahmyr Gibbs', pos: 'RB', team: 'DET', age: 22, exp: 2 },
    { id: 'mock_rb_5', name: 'Saquon Barkley', pos: 'RB', team: 'PHI', age: 28, exp: 7 },
    // WRs
    { id: 'mock_wr_1', name: 'CeeDee Lamb', pos: 'WR', team: 'DAL', age: 25, exp: 5 },
    { id: 'mock_wr_2', name: 'Tyreek Hill', pos: 'WR', team: 'MIA', age: 30, exp: 9 },
    { id: 'mock_wr_3', name: 'Amon-Ra St. Brown', pos: 'WR', team: 'DET', age: 25, exp: 4 },
    { id: 'mock_wr_4', name: 'Justin Jefferson', pos: 'WR', team: 'MIN', age: 25, exp: 5 },
    { id: 'mock_wr_5', name: "Ja'Marr Chase", pos: 'WR', team: 'CIN', age: 25, exp: 4 },
    // TEs
    { id: 'mock_te_1', name: 'Travis Kelce', pos: 'TE', team: 'KC', age: 35, exp: 12 },
    { id: 'mock_te_2', name: 'Sam LaPorta', pos: 'TE', team: 'DET', age: 24, exp: 2 },
    { id: 'mock_te_3', name: 'Trey McBride', pos: 'TE', team: 'ARI', age: 25, exp: 3 },
    // Ks
    { id: 'mock_k_1', name: 'Justin Tucker', pos: 'K', team: 'BAL', age: 35, exp: 13 },
    { id: 'mock_k_2', name: 'Harrison Butker', pos: 'K', team: 'KC', age: 29, exp: 7 },
    // DEFs
    { id: 'mock_def_1', name: 'San Francisco 49ers', pos: 'DEF', team: 'SF', age: null, exp: 0 },
    { id: 'mock_def_2', name: 'Baltimore Ravens', pos: 'DEF', team: 'BAL', age: null, exp: 0 },
  ];

  const players: Player[] = [];
  const positionRanks: Record<string, number> = {
    QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DEF: 1
  };

  for (const mock of mockPlayers) {
    const position = mock.pos as Position;
    const rank = positionRanks[position];

    const baseMultipliers: Record<Position, number> = {
      QB: 1.8, RB: 0.8, WR: 1.0, TE: 1.5, K: 3.0, DEF: 2.5
    };

    const adp = rank * baseMultipliers[position];
    const tier = Math.floor(adp / 18) + 1;
    const projectedPoints = calculateProjectedPoints(position, adp, scoringFormat);

    players.push({
      id: mock.id,
      name: mock.name,
      position,
      team: mock.team,
      byeWeek: BYE_WEEKS[mock.team] || 0,
      adp,
      tier,
      projectedPoints,
      stats: {
        passingYards: 0,
        passingTDs: 0,
        rushingYards: 0,
        rushingTDs: 0,
        receptions: 0,
        receivingYards: 0,
        receivingTDs: 0
      },
      injuryStatus: 'healthy',
      age: mock.age ?? undefined,
      experience: mock.exp,
      riskScore: calculateRiskScore(mock.age, mock.exp, 'healthy'),
      ceilingScore: calculateCeilingScore(mock.age, mock.exp, adp),
      floorScore: calculateFloorScore(mock.age, mock.exp, adp, 'healthy')
    });

    positionRanks[position] = rank + 1;
  }

  players.sort((a, b) => a.adp - b.adp);
  return players.slice(0, limit);
}

/**
 * Fetch and parse NFL players with scoring format
 */
export async function fetchNFLPlayers(params: {
  scoringFormat: 'standard' | 'ppr' | 'half_ppr';
  year?: number;
  limit?: number;
}): Promise<Player[]> {
  const { scoringFormat, limit = 300 } = params;
  const cacheKey = `${scoringFormat}`;

  // Check cache
  const cached = playerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached players:', cached.data.length);
    return cached.data.slice(0, limit);
  }

  try {
    console.log('Fetching player data from RapidAPI...');

    // Fetch both player list and ADP data in parallel
    const [rawPlayers, adpData] = await Promise.all([
      fetchPlayerList(),
      fetchADPData(scoringFormat)
    ]);

    console.log('Fetched players:', rawPlayers.length, 'ADP entries:', adpData.length);

    // Create ADP lookup maps by playerID and by name for fallback matching
    // If multiple entries exist for same player, keep the one with most recent adpDate
    const adpMapByID = new Map<string, RapidAPIADPEntry>();
    const adpMapByName = new Map<string, RapidAPIADPEntry>();

    // Log sample ADP entry to see structure
    if (adpData.length > 0) {
      console.log('Sample ADP entry:', JSON.stringify(adpData[0]));
    }

    for (const entry of adpData) {
      if (entry.playerID) {
        const existing = adpMapByID.get(entry.playerID);
        // Keep entry with most recent adpDate, or replace if no existing
        if (!existing || (entry.adpDate && existing.adpDate && entry.adpDate > existing.adpDate)) {
          adpMapByID.set(entry.playerID, entry);
        }
      }
      // Also create name-based lookup for fallback matching
      if (entry.espnName) {
        const normalizedName = entry.espnName.toLowerCase().trim();
        const existing = adpMapByName.get(normalizedName);
        if (!existing || (entry.adpDate && existing.adpDate && entry.adpDate > existing.adpDate)) {
          adpMapByName.set(normalizedName, entry);
        }
      }
    }

    console.log('ADP map by ID:', adpMapByID.size, 'ADP map by name:', adpMapByName.size);

    // Filter for fantasy-relevant positions and active players
    const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const validTeams = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
                        'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
                        'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
                        'TEN', 'WAS'];

    const filteredPlayers = rawPlayers.filter(p => {
      const position = (p.pos || '').toUpperCase();
      const team = (p.team || '').toUpperCase();
      return validPositions.includes(position) && validTeams.includes(team);
    });

    console.log('Filtered players:', filteredPlayers.length);

    if (filteredPlayers.length === 0) {
      throw new Error('No fantasy-relevant players found after filtering');
    }

    // Map to Player interface with position ranks for fallback ADP
    const players: Player[] = [];
    const positionRanks: Record<string, number> = {
      QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DEF: 1
    };

    let adpMatchedByID = 0;
    let adpMatchedByName = 0;

    // Use curated top fantasy players list with accurate ADPs
    // This ensures we have reliable ADP data for the best players
    const topFantasyPlayers = getTopFantasyPlayersWithADP(scoringFormat);
    const topPlayerNames = new Set(topFantasyPlayers.map(p => p.name.toLowerCase()));

    // First, add all curated top players (matched with API data for headshots)
    for (const curatedPlayer of topFantasyPlayers) {
      const normalizedName = curatedPlayer.name.toLowerCase();

      // Find matching player from API for additional data
      const apiPlayer = filteredPlayers.find(p => {
        const apiName = (p.longName || p.espnName || '').toLowerCase();
        return apiName === normalizedName || apiName.includes(normalizedName) || normalizedName.includes(apiName);
      });

      const position = curatedPlayer.pos as Position;

      players.push({
        id: apiPlayer?.playerID || `curated_${curatedPlayer.name.replace(/\s+/g, '_').toLowerCase()}`,
        name: curatedPlayer.name,
        position,
        team: curatedPlayer.team,
        byeWeek: BYE_WEEKS[curatedPlayer.team] || 0,
        adp: curatedPlayer.adp,
        tier: Math.floor(curatedPlayer.adp / 12) + 1,
        projectedPoints: calculateProjectedPoints(position, curatedPlayer.adp, scoringFormat),
        stats: {
          passingYards: 0,
          passingTDs: 0,
          rushingYards: 0,
          rushingTDs: 0,
          receptions: 0,
          receivingYards: 0,
          receivingTDs: 0
        },
        injuryStatus: 'healthy',
        age: curatedPlayer.age,
        experience: curatedPlayer.exp,
        riskScore: calculateRiskScore(curatedPlayer.age, curatedPlayer.exp, 'healthy'),
        ceilingScore: calculateCeilingScore(curatedPlayer.age, curatedPlayer.exp, curatedPlayer.adp),
        floorScore: calculateFloorScore(curatedPlayer.age, curatedPlayer.exp, curatedPlayer.adp, 'healthy')
      });
    }

    console.log('Added curated top players:', topFantasyPlayers.length);

    // Then add remaining players from API that aren't in our curated list
    for (const playerData of filteredPlayers) {
      const position = (playerData.pos || '').toUpperCase();
      if (!validPositions.includes(position)) continue;

      const playerName = (playerData.longName || playerData.espnName || '').toLowerCase();

      // Skip if already added from curated list
      if (topPlayerNames.has(playerName)) continue;

      const rank = positionRanks[position] || 1;

      // Try to find ADP entry by playerID first, then by name
      let adpEntry = adpMapByID.get(playerData.playerID);

      if (adpEntry) {
        adpMatchedByID++;
      } else {
        if (playerName) {
          adpEntry = adpMapByName.get(playerName);
          if (adpEntry) {
            adpMatchedByName++;
          }
        }
      }

      const player = mapToPlayer(playerData, adpEntry, scoringFormat, rank);
      if (player) {
        // Assign high ADP to non-curated players (they're depth/bench players)
        player.adp = player.adp + 200;
        player.tier = Math.floor(player.adp / 12) + 1;
        players.push(player);
        positionRanks[position] = rank + 1;
      }
    }

    console.log('ADP matched by ID:', adpMatchedByID, 'by name:', adpMatchedByName);

    // Sort by ADP
    players.sort((a, b) => a.adp - b.adp);

    console.log('Successfully mapped players:', players.length);

    // Fetch headshots for the top players (limit to avoid too many API calls)
    const TOP_PLAYERS_FOR_HEADSHOTS = Math.min(limit, 150);
    const topPlayerIDs = players.slice(0, TOP_PLAYERS_FOR_HEADSHOTS).map(p => p.id);

    console.log('Fetching headshots for top', topPlayerIDs.length, 'players...');
    const headshots = await fetchHeadshotsForPlayers(topPlayerIDs);

    // Update players with headshots
    for (const player of players) {
      const headshot = headshots.get(player.id);
      if (headshot) {
        player.headshot = headshot;
      }
    }

    console.log('Added headshots for', headshots.size, 'players');

    // Cache the results
    playerCache.set(cacheKey, {
      data: players,
      timestamp: Date.now()
    });

    return players.slice(0, limit);
  } catch (error) {
    console.error('Error fetching NFL players from RapidAPI:', error);

    // Return cached data if available, even if stale
    if (cached) {
      console.warn('Using stale cached data due to fetch error');
      return cached.data.slice(0, limit);
    }

    // Fallback to mock data
    console.warn('Falling back to mock player data');
    const mockPlayers = generateMockPlayers(scoringFormat, limit);

    // Cache the mock data
    playerCache.set(cacheKey, {
      data: mockPlayers,
      timestamp: Date.now()
    });

    return mockPlayers;
  }
}

/**
 * Get a single player by ID
 */
export async function getPlayerById(
  playerId: string,
  scoringFormat: 'standard' | 'ppr' | 'half_ppr'
): Promise<Player | undefined> {
  const players = await fetchNFLPlayers({ scoringFormat });
  return players.find(p => p.id === playerId);
}

/**
 * Get players filtered by position
 */
export async function getPlayersByPosition(
  position: Position,
  scoringFormat: 'standard' | 'ppr' | 'half_ppr'
): Promise<Player[]> {
  const players = await fetchNFLPlayers({ scoringFormat });
  return players.filter(p => p.position === position);
}
