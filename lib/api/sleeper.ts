import { Player, SleeperPlayer, SleeperADPData, Position } from '@/lib/types';

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// In-memory cache for player data
let playerCache: { data: Player[]; timestamp: number } | null = null;

/**
 * Fetches all NFL players from Sleeper API
 */
export async function fetchSleeperPlayers(): Promise<SleeperPlayer[]> {
  try {
    const response = await fetch(`${SLEEPER_API_BASE}/players/nfl`, {
      cache: 'no-store', // Disable Next.js cache (response too large, using in-memory cache instead)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch players: ${response.statusText}`);
    }

    const data = await response.json();

    // Convert object to array
    return Object.values(data);
  } catch (error) {
    console.error('Error fetching Sleeper players:', error);
    throw error;
  }
}

/**
 * Fetches ADP data from Sleeper for current season
 * Note: Sleeper doesn't have a direct ADP endpoint, so we'll use mock data
 * or integrate with FantasyPros/ESPN API later
 */
export async function fetchADPData(): Promise<SleeperADPData> {
  // TODO: Integrate with actual ADP source (FantasyPros, ESPN, etc.)
  // For now, we'll calculate ADP based on position and rank
  return {};
}

/**
 * Converts Sleeper player to our Player model with tier and ADP assignment
 */
function convertSleeperPlayer(
  sleeperPlayer: SleeperPlayer,
  adpData: SleeperADPData,
  positionRank: number
): Player | null {
  // Only include relevant fantasy positions
  const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  if (!sleeperPlayer.position || !validPositions.includes(sleeperPlayer.position)) {
    return null;
  }

  // Calculate ADP based on position and rank (temporary until we have real ADP)
  const adp = calculateMockADP(sleeperPlayer.position as Position, positionRank);

  // Calculate tier (every ~15-20 players in same tier)
  const tier = Math.ceil(adp / 18);

  return {
    id: sleeperPlayer.player_id,
    name: `${sleeperPlayer.first_name} ${sleeperPlayer.last_name}`,
    position: sleeperPlayer.position as Position,
    team: sleeperPlayer.team || 'FA',
    byeWeek: 0, // TODO: Add bye week data
    adp,
    tier,
    projectedPoints: calculateMockProjection(sleeperPlayer.position as Position, positionRank),
    stats: {},
    injuryStatus: mapInjuryStatus(sleeperPlayer.injury_status),
    age: sleeperPlayer.age,
    experience: sleeperPlayer.years_exp,
    riskScore: calculateRiskScore(sleeperPlayer),
    ceilingScore: calculateCeilingScore(sleeperPlayer, positionRank),
    floorScore: calculateFloorScore(sleeperPlayer, positionRank),
  };
}

/**
 * Maps Sleeper injury status to our InjuryStatus type
 */
function mapInjuryStatus(status?: string) {
  if (!status) return 'healthy';
  const normalized = status.toLowerCase();
  if (normalized === 'out') return 'out';
  if (normalized === 'doubtful') return 'doubtful';
  if (normalized === 'questionable') return 'questionable';
  return 'healthy';
}

/**
 * Calculates mock ADP based on position and rank
 * This is temporary until we integrate real ADP data
 */
function calculateMockADP(position: Position, rank: number): number {
  const adpMultipliers: Record<Position, number> = {
    QB: 1.8, // QBs drafted later
    RB: 0.8, // RBs go early
    WR: 1.0, // WRs standard
    TE: 1.5, // TEs go later
    K: 3.0, // Kickers very late
    DEF: 2.5, // Defense late
  };

  return Math.round(rank * adpMultipliers[position]);
}

/**
 * Calculates mock projected points based on position and rank
 */
function calculateMockProjection(position: Position, rank: number): number {
  const basePoints: Record<Position, number> = {
    QB: 320,
    RB: 250,
    WR: 220,
    TE: 180,
    K: 140,
    DEF: 150,
  };

  // Top players get base points, declining by ~5-10% per rank
  const declineRate = 0.07;
  return Math.round(basePoints[position] * Math.pow(1 - declineRate, rank - 1));
}

/**
 * Calculates risk score (0-10, higher = riskier)
 */
function calculateRiskScore(player: SleeperPlayer): number {
  let risk = 5; // Base risk

  // Injury increases risk
  if (player.injury_status === 'out') risk += 3;
  else if (player.injury_status === 'doubtful') risk += 2;
  else if (player.injury_status === 'questionable') risk += 1;

  // Rookies are riskier (0 years exp)
  if (player.years_exp === 0) risk += 2;

  // Very old players are riskier
  if (player.age && player.age > 30) risk += 1;

  return Math.min(10, Math.max(0, risk));
}

/**
 * Calculates ceiling score (upside potential, 0-100)
 */
function calculateCeilingScore(player: SleeperPlayer, rank: number): number {
  let ceiling = 100 - (rank * 3); // Base on rank

  // Rookies have higher ceiling potential
  if (player.years_exp === 0) ceiling += 10;

  // Young players have higher ceiling
  if (player.age && player.age < 25) ceiling += 5;

  return Math.min(100, Math.max(0, ceiling));
}

/**
 * Calculates floor score (safety, 0-100)
 */
function calculateFloorScore(player: SleeperPlayer, rank: number): number {
  let floor = 100 - (rank * 3); // Base on rank

  // Veterans have higher floor
  if (player.years_exp && player.years_exp > 5) floor += 10;

  // Injury lowers floor
  if (player.injury_status) floor -= 15;

  return Math.min(100, Math.max(0, floor));
}

/**
 * Fetches and processes all fantasy-relevant players
 */
export async function getFantasyPlayers(forceRefresh = false): Promise<Player[]> {
  // Check cache
  if (
    !forceRefresh &&
    playerCache &&
    Date.now() - playerCache.timestamp < CACHE_DURATION
  ) {
    return playerCache.data;
  }

  try {
    const sleeperPlayers = await fetchSleeperPlayers();
    const adpData = await fetchADPData();

    // Filter for fantasy-relevant players and convert
    const fantasyPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const relevantPlayers = sleeperPlayers.filter(
      (p) => p.position && fantasyPositions.includes(p.position)
    );

    // Group by position and rank within position
    const positionGroups: Record<string, SleeperPlayer[]> = {};
    relevantPlayers.forEach((player) => {
      const pos = player.position!;
      if (!positionGroups[pos]) positionGroups[pos] = [];
      positionGroups[pos].push(player);
    });

    // Convert players with position-based ranking
    const players: Player[] = [];
    Object.entries(positionGroups).forEach(([position, posPlayers]) => {
      posPlayers.forEach((sleeperPlayer, index) => {
        const player = convertSleeperPlayer(sleeperPlayer, adpData, index + 1);
        if (player) players.push(player);
      });
    });

    // Sort by ADP
    players.sort((a, b) => a.adp - b.adp);

    // Update cache
    playerCache = {
      data: players,
      timestamp: Date.now(),
    };

    return players;
  } catch (error) {
    console.error('Error getting fantasy players:', error);
    // Return cached data if available, otherwise throw
    if (playerCache) return playerCache.data;
    throw error;
  }
}

/**
 * Gets top N players overall
 */
export async function getTopPlayers(count: number = 200): Promise<Player[]> {
  const allPlayers = await getFantasyPlayers();
  return allPlayers.slice(0, count);
}

/**
 * Gets players by position
 */
export async function getPlayersByPosition(position: Position): Promise<Player[]> {
  const allPlayers = await getFantasyPlayers();
  return allPlayers.filter((p) => p.position === position);
}

/**
 * Finds a player by ID
 */
export async function getPlayerById(playerId: string): Promise<Player | undefined> {
  const allPlayers = await getFantasyPlayers();
  return allPlayers.find((p) => p.id === playerId);
}
