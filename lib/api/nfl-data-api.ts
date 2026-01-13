/**
 * NFL Data API Client - Fetches player data from dynastyprocess CSV files
 * Source: https://github.com/dynastyprocess/data/tree/master/files
 */

import { Player, Position } from '@/lib/types';

const DYNASTY_PROCESS_BASE = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

interface PlayerCache {
  data: Player[];
  timestamp: number;
}

// In-memory cache
const playerCache = new Map<string, PlayerCache>();

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

interface DynastyPlayerData {
  sleeper_id: string;
  name: string;
  position: string;
  team: string;
  age?: string;
  draft_year?: string;
  draft_round?: string;
  height?: string;
  weight?: string;
  college?: string;
}

/**
 * Parse CSV text to array of objects
 * Handles quoted fields and complex CSV formats
 */
function parseCSV(csvText: string): any[] {
  try {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing - split by comma but handle quoted values
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim().replace(/"/g, ''));
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim().replace(/"/g, ''));

      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });

      data.push(obj);
    }

    return data;
  } catch (error) {
    console.error('CSV parsing error:', error);
    return [];
  }
}

/**
 * Fetch player IDs and metadata from dynastyprocess
 */
async function fetchPlayerIds(): Promise<DynastyPlayerData[]> {
  try {
    const response = await fetch(`${DYNASTY_PROCESS_BASE}/db_playerids.csv`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch player IDs: ${response.statusText}`);
    }

    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error fetching player IDs:', error);
    throw error;
  }
}

/**
 * Fetch FantasyPros rankings/ADP data
 */
async function fetchFantasyProsRankings(): Promise<any[]> {
  try {
    const response = await fetch(`${DYNASTY_PROCESS_BASE}/db_fpros.csv`, {
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch rankings: ${response.statusText}`);
    }

    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return [];
  }
}

/**
 * Calculate ADP based on position and rank with scoring format adjustment
 */
function calculateADP(
  position: Position,
  rank: number,
  scoringFormat: 'standard' | 'ppr' | 'half_ppr'
): number {
  const baseMultipliers: Record<Position, number> = {
    QB: 1.8,
    RB: 0.8,
    WR: 1.0,
    TE: 1.5,
    K: 3.0,
    DEF: 2.5
  };

  let adp = rank * baseMultipliers[position];

  // Adjust for scoring format
  if (scoringFormat === 'ppr') {
    if (position === 'WR') adp *= 0.85;
    if (position === 'TE') adp *= 0.80;
  } else if (scoringFormat === 'half_ppr') {
    if (position === 'WR') adp *= 0.92;
    if (position === 'TE') adp *= 0.90;
  }

  return Math.round(adp * 10) / 10;
}

/**
 * Calculate projected points based on position, rank, and scoring format
 */
function calculateProjectedPoints(
  position: Position,
  rank: number,
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

  const base = basePoints[position];
  let projected = base * Math.pow(0.93, rank - 1);

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
function calculateRiskScore(age: number | null, experience: number): number {
  let risk = 5.0;

  if (experience === 0 || experience === 1) risk += 2; // Rookies
  if (age && age > 30) risk += 1; // Veteran decline risk
  if (experience > 10) risk += 1; // Longevity risk

  return Math.min(10, Math.max(0, risk));
}

/**
 * Calculate ceiling score
 */
function calculateCeilingScore(age: number | null, experience: number, rank: number): number {
  let ceiling = Math.max(0, 100 - (rank * 3));

  if (age && age < 25) ceiling += 5; // Young upside
  if (experience < 2) ceiling += 10; // Rookie/sophomore breakout potential

  return Math.min(100, Math.max(0, ceiling));
}

/**
 * Calculate floor score
 */
function calculateFloorScore(age: number | null, experience: number, rank: number): number {
  let floor = Math.max(0, 100 - (rank * 3));

  if (experience > 5) floor += 10; // Veteran consistency
  if (age && age > 30) floor -= 5; // Decline risk

  return Math.min(100, Math.max(0, floor));
}

/**
 * Map dynasty process data to Player interface
 */
function mapToPlayer(
  playerData: DynastyPlayerData,
  rank: number,
  scoringFormat: 'standard' | 'ppr' | 'half_ppr'
): Player | null {
  // Validate position
  const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const posStr = (playerData.position || '').toUpperCase();

  if (!validPositions.includes(posStr)) {
    return null;
  }

  const position = posStr as Position;
  const age = playerData.age ? parseInt(playerData.age) : null;
  const experience = age ? Math.max(0, age - 21) : 0; // Rough estimate

  const adp = calculateADP(position, rank, scoringFormat);
  const tier = Math.floor(adp / 18) + 1;
  const projectedPoints = calculateProjectedPoints(position, rank, scoringFormat);

  return {
    id: playerData.sleeper_id || `${position}_${rank}_${Date.now()}_${Math.random()}`,
    name: playerData.name || 'Unknown Player',
    position,
    team: playerData.team || 'FA',
    byeWeek: BYE_WEEKS[playerData.team] || 0,
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
    age,
    experience,
    riskScore: calculateRiskScore(age, experience),
    ceilingScore: calculateCeilingScore(age, experience, rank),
    floorScore: calculateFloorScore(age, experience, rank)
  };
}

/**
 * Generate mock player data as fallback
 */
function generateMockPlayers(scoringFormat: 'standard' | 'ppr' | 'half_ppr', limit: number): Player[] {
  const mockPlayers = [
    // QBs
    { name: 'Josh Allen', pos: 'QB', team: 'BUF', age: 28, exp: 7 },
    { name: 'Jalen Hurts', pos: 'QB', team: 'PHI', age: 26, exp: 5 },
    { name: 'Lamar Jackson', pos: 'QB', team: 'BAL', age: 28, exp: 7 },
    { name: 'Patrick Mahomes', pos: 'QB', team: 'KC', age: 29, exp: 8 },
    { name: 'Joe Burrow', pos: 'QB', team: 'CIN', age: 28, exp: 5 },
    { name: 'C.J. Stroud', pos: 'QB', team: 'HOU', age: 23, exp: 2 },
    { name: 'Dak Prescott', pos: 'QB', team: 'DAL', age: 31, exp: 9 },
    { name: 'Justin Herbert', pos: 'QB', team: 'LAC', age: 26, exp: 5 },
    { name: 'Jordan Love', pos: 'QB', team: 'GB', age: 26, exp: 5 },
    { name: 'Tua Tagovailoa', pos: 'QB', team: 'MIA', age: 27, exp: 5 },
    // RBs
    { name: 'Christian McCaffrey', pos: 'RB', team: 'SF', age: 28, exp: 8 },
    { name: 'Bijan Robinson', pos: 'RB', team: 'ATL', age: 22, exp: 2 },
    { name: 'Breece Hall', pos: 'RB', team: 'NYJ', age: 23, exp: 3 },
    { name: 'Jahmyr Gibbs', pos: 'RB', team: 'DET', age: 22, exp: 2 },
    { name: 'Saquon Barkley', pos: 'RB', team: 'PHI', age: 28, exp: 7 },
    { name: 'Jonathan Taylor', pos: 'RB', team: 'IND', age: 25, exp: 4 },
    { name: 'Derrick Henry', pos: 'RB', team: 'BAL', age: 31, exp: 9 },
    { name: 'Josh Jacobs', pos: 'RB', team: 'GB', age: 27, exp: 6 },
    { name: 'Kenneth Walker III', pos: 'RB', team: 'SEA', age: 24, exp: 3 },
    { name: "De'Von Achane", pos: 'RB', team: 'MIA', age: 23, exp: 2 },
    // WRs
    { name: 'CeeDee Lamb', pos: 'WR', team: 'DAL', age: 25, exp: 5 },
    { name: 'Tyreek Hill', pos: 'WR', team: 'MIA', age: 30, exp: 9 },
    { name: 'Amon-Ra St. Brown', pos: 'WR', team: 'DET', age: 25, exp: 4 },
    { name: 'Justin Jefferson', pos: 'WR', team: 'MIN', age: 25, exp: 5 },
    { name: 'A.J. Brown', pos: 'WR', team: 'PHI', age: 27, exp: 6 },
    { name: "Ja'Marr Chase", pos: 'WR', team: 'CIN', age: 25, exp: 4 },
    { name: 'Garrett Wilson', pos: 'WR', team: 'NYJ', age: 24, exp: 3 },
    { name: 'Puka Nacua', pos: 'WR', team: 'LAR', age: 23, exp: 2 },
    { name: 'Nico Collins', pos: 'WR', team: 'HOU', age: 25, exp: 4 },
    { name: 'Chris Olave', pos: 'WR', team: 'NO', age: 24, exp: 3 },
    // TEs
    { name: 'Travis Kelce', pos: 'TE', team: 'KC', age: 35, exp: 12 },
    { name: 'Sam LaPorta', pos: 'TE', team: 'DET', age: 24, exp: 2 },
    { name: 'Trey McBride', pos: 'TE', team: 'ARI', age: 25, exp: 3 },
    { name: 'Mark Andrews', pos: 'TE', team: 'BAL', age: 29, exp: 7 },
    { name: 'George Kittle', pos: 'TE', team: 'SF', age: 31, exp: 8 },
    // Ks
    { name: 'Justin Tucker', pos: 'K', team: 'BAL', age: 35, exp: 13 },
    { name: 'Harrison Butker', pos: 'K', team: 'KC', age: 29, exp: 7 },
    // DEFs
    { name: 'San Francisco 49ers', pos: 'DEF', team: 'SF', age: null, exp: 0 },
    { name: 'Baltimore Ravens', pos: 'DEF', team: 'BAL', age: null, exp: 0 },
  ];

  const players: Player[] = [];
  const positionRanks: Record<string, number> = {
    QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DEF: 1
  };

  for (const mock of mockPlayers) {
    const position = mock.pos as Position;
    const rank = positionRanks[position];

    const adp = calculateADP(position, rank, scoringFormat);
    const tier = Math.floor(adp / 18) + 1;
    const projectedPoints = calculateProjectedPoints(position, rank, scoringFormat);

    players.push({
      id: `mock_${mock.pos}_${rank}`,
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
      age: mock.age,
      experience: mock.exp,
      riskScore: calculateRiskScore(mock.age, mock.exp),
      ceilingScore: calculateCeilingScore(mock.age, mock.exp, rank),
      floorScore: calculateFloorScore(mock.age, mock.exp, rank)
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
  const { scoringFormat, year = 2025, limit = 300 } = params;
  const cacheKey = `${scoringFormat}_${year}`;

  // Check cache
  const cached = playerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached players:', cached.data.length);
    return cached.data.slice(0, limit);
  }

  try {
    console.log('Fetching player data from CSV...');

    // Fetch player data
    const playerIds = await fetchPlayerIds();
    console.log('Fetched player IDs:', playerIds.length);

    if (playerIds.length === 0) {
      throw new Error('No player data received from CSV');
    }

    // Filter for fantasy-relevant positions AND active players with NFL teams
    const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const validTeams = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
                        'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
                        'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
                        'TEN', 'WAS'];

    const filteredPlayers = playerIds.filter(p => {
      const position = (p.position || '').toUpperCase();
      const team = (p.team || '').toUpperCase();

      // Must have valid position and current NFL team
      return validPositions.includes(position) &&
             validTeams.includes(team) &&
             team !== 'FA' &&
             team !== '';
    });
    console.log('Filtered players:', filteredPlayers.length);

    // If no players after filtering, throw error to trigger fallback
    if (filteredPlayers.length === 0) {
      if (playerIds.length > 0) {
        console.log('Sample player data:', JSON.stringify(playerIds[0]));
        console.log('Available fields:', Object.keys(playerIds[0]));
      }
      throw new Error('No fantasy-relevant players found after filtering');
    }

    // Map to Player interface with ranks
    const players: Player[] = [];
    const positionRanks: Record<string, number> = {
      QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DEF: 1
    };

    for (const playerData of filteredPlayers) {
      const position = (playerData.position || '').toUpperCase();
      if (!position || !validPositions.includes(position)) continue;

      const rank = positionRanks[position] || 1;

      const player = mapToPlayer(playerData, rank, scoringFormat);
      if (player) {
        players.push(player);
        positionRanks[position] = rank + 1;
      }
    }

    // Sort by ADP
    players.sort((a, b) => a.adp - b.adp);

    console.log('Successfully mapped players:', players.length);

    // Cache the results
    playerCache.set(cacheKey, {
      data: players,
      timestamp: Date.now()
    });

    return players.slice(0, limit);
  } catch (error) {
    console.error('Error fetching NFL players from CSV:', error);

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
