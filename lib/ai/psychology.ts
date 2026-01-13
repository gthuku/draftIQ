import { DraftPick, Position, Player, DraftState } from '@/lib/types';

/**
 * Detects if a positional run is happening
 * Returns the position and intensity (0-100)
 */
export function detectPositionalRun(
  recentPicks: DraftPick[],
  availablePlayers: Player[]
): { position: Position | null; intensity: number } {
  if (recentPicks.length < 2) {
    return { position: null, intensity: 0 };
  }

  // Look at last 5 picks
  const last5 = recentPicks.slice(-5);

  // Count picks by position
  const positionCounts: Record<string, number> = {};

  last5.forEach((pick) => {
    const player = availablePlayers.find((p) => p.id === pick.playerId);
    if (player) {
      positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
    }
  });

  // Find position with most picks
  let maxCount = 0;
  let runPosition: Position | null = null;

  Object.entries(positionCounts).forEach(([pos, count]) => {
    if (count > maxCount) {
      maxCount = count;
      runPosition = pos as Position;
    }
  });

  // Calculate intensity
  // 2 in last 3 = 40 intensity
  // 3 in last 4 = 70 intensity
  // 4 in last 5 = 100 intensity
  const last3 = recentPicks.slice(-3);
  const last4 = recentPicks.slice(-4);

  let intensity = 0;

  if (runPosition) {
    const countLast3 = last3.filter((pick) => {
      const player = availablePlayers.find((p) => p.id === pick.playerId);
      return player?.position === runPosition;
    }).length;

    const countLast4 = last4.filter((pick) => {
      const player = availablePlayers.find((p) => p.id === pick.playerId);
      return player?.position === runPosition;
    }).length;

    if (countLast3 >= 2) intensity = 40;
    if (countLast3 >= 3) intensity = 70;
    if (countLast4 >= 3) intensity = 60;
    if (countLast4 >= 4) intensity = 90;
    if (maxCount >= 4) intensity = 100;
  }

  return { position: runPosition, intensity };
}

/**
 * Calculates panic score for an AI based on runs
 * Returns 0-100 (higher = more panic)
 */
export function calculatePanicScore(
  runInfo: { position: Position | null; intensity: number },
  aiPanicFactor: number,
  teamNeedForPosition: number
): number {
  if (!runInfo.position || runInfo.intensity === 0) return 0;

  // Base panic on run intensity and AI panic factor
  let panicScore = runInfo.intensity * aiPanicFactor;

  // Increase panic if team also needs this position
  if (teamNeedForPosition > 70) {
    panicScore *= 1.5; // 50% increase if high need
  } else if (teamNeedForPosition > 40) {
    panicScore *= 1.2; // 20% increase if moderate need
  }

  return Math.min(100, Math.round(panicScore));
}

/**
 * Determines if AI should make a panic pick due to positional run
 */
export function shouldPanicPick(
  runInfo: { position: Position | null; intensity: number },
  aiPanicFactor: number,
  teamNeedForPosition: number
): boolean {
  const panicScore = calculatePanicScore(runInfo, aiPanicFactor, teamNeedForPosition);

  // Panic threshold varies by AI profile
  const panicThreshold = 50 + (1 - aiPanicFactor) * 30; // 50-80 range

  return panicScore >= panicThreshold;
}

/**
 * Calculates bonus score to add when AI panics about a position
 */
export function calculatePanicBonus(
  player: Player,
  runInfo: { position: Position | null; intensity: number },
  aiPanicFactor: number
): number {
  if (player.position !== runInfo.position) return 0;

  // Panic bonus scales with intensity and AI panic factor
  const bonus = runInfo.intensity * aiPanicFactor * 0.8;

  return Math.round(bonus);
}

/**
 * Calculates scarcity index for each position (0-100)
 * Higher = more scarce
 */
export function calculateScarcityIndex(
  position: Position,
  availablePlayers: Player[],
  totalDrafted: number
): number {
  const positionPlayers = availablePlayers.filter((p) => p.position === position);
  const topTier = positionPlayers.filter((p) => p.tier <= 3);

  // Base scarcity on percentage of top-tier players remaining
  const initialTopTier = getInitialTopTierCount(position);
  const percentRemaining = topTier.length / initialTopTier;

  // More drafted = higher scarcity
  const draftProgress = Math.min(1, totalDrafted / 180); // 180 = 12 teams * 15 rounds

  // Scarcity increases as draft progresses and top players are taken
  let scarcity = (1 - percentRemaining) * 70 + draftProgress * 30;

  // Position-specific adjustments
  if (position === 'RB' || position === 'WR') {
    scarcity *= 1.2; // These positions have higher scarcity impact
  } else if (position === 'TE') {
    scarcity *= 1.3; // TE especially scarce after elite tier
  }

  return Math.min(100, Math.round(scarcity));
}

/**
 * Gets initial top-tier player count by position (for scarcity calculation)
 */
function getInitialTopTierCount(position: Position): number {
  const counts: Record<Position, number> = {
    QB: 12, // ~12 top QBs
    RB: 24, // ~24 top RBs
    WR: 30, // ~30 top WRs
    TE: 10, // ~10 top TEs
    K: 12, // ~12 Ks
    DEF: 12, // ~12 DEFs
  };

  return counts[position];
}

/**
 * Calculates urgency bonus based on scarcity
 */
export function calculateScarcityBonus(
  player: Player,
  availablePlayers: Player[],
  totalDrafted: number
): number {
  const scarcity = calculateScarcityIndex(player.position, availablePlayers, totalDrafted);

  // High scarcity = higher bonus
  if (scarcity >= 80) return 30;
  if (scarcity >= 60) return 20;
  if (scarcity >= 40) return 10;

  return 0;
}

/**
 * Determines if AI should reach for a player due to scarcity
 */
export function shouldReachForScarcity(
  player: Player,
  currentPick: number,
  availablePlayers: Player[],
  totalDrafted: number
): boolean {
  const scarcity = calculateScarcityIndex(player.position, availablePlayers, totalDrafted);
  const reachAmount = currentPick - player.adp;

  // Only reach if scarcity is high
  if (scarcity < 60) return false;

  // Allow reaches based on scarcity level
  if (scarcity >= 80 && reachAmount <= 15) return true;
  if (scarcity >= 70 && reachAmount <= 10) return true;
  if (scarcity >= 60 && reachAmount <= 5) return true;

  return false;
}

/**
 * Detects if value is falling off the board (BPA vs need conflict)
 */
export function detectValueFallingOff(
  currentPick: number,
  availablePlayers: Player[]
): Player | null {
  // Find players who are falling significantly below their ADP
  const falling = availablePlayers.filter((p) => {
    const fall = currentPick - p.adp;
    return fall >= 15 && p.tier <= 5; // Falling 15+ picks and top-5 tier
  });

  if (falling.length === 0) return null;

  // Return the highest-tier player that's falling
  return falling.sort((a, b) => a.tier - b.tier)[0];
}

/**
 * Calculates reach penalty (negative score for reaching too far)
 */
export function calculateReachPenalty(
  player: Player,
  currentPick: number,
  aiReachThreshold: number
): number {
  const reachAmount = currentPick - player.adp;

  // No penalty if not reaching
  if (reachAmount <= 0) return 0;

  // Calculate penalty based on reach amount and AI reach tolerance
  const maxAllowedReach = 20 * aiReachThreshold; // 0-20 picks
  const excessReach = reachAmount - maxAllowedReach;

  if (excessReach <= 0) return 0;

  // Exponential penalty for excessive reaches
  const penalty = Math.pow(excessReach, 1.5) * 5;

  return Math.round(penalty);
}

/**
 * Simulates favorite team bias (reaching for players from favorite teams)
 */
export function calculateFavoriteTeamBonus(
  player: Player,
  favoriteTeams: string[]
): number {
  if (favoriteTeams.includes(player.team)) {
    return 25; // +25 score for favorite team players
  }

  return 0;
}

/**
 * Analyzes draft context to provide psychology insights
 */
export function analyzeDraftContext(
  draftState: DraftState,
  availablePlayers: Player[]
): {
  runsDetected: Array<{ position: Position; intensity: number }>;
  scarcityWarnings: Array<{ position: Position; scarcity: number }>;
  valueOpportunities: Player[];
} {
  const recentPicks = draftState.picks.slice(-5);

  // Detect runs
  const runInfo = detectPositionalRun(recentPicks, availablePlayers);
  const runsDetected = runInfo.position
    ? [{ position: runInfo.position, intensity: runInfo.intensity }]
    : [];

  // Check scarcity for all positions
  const scarcityWarnings: Array<{ position: Position; scarcity: number }> = [];
  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  positions.forEach((pos) => {
    const scarcity = calculateScarcityIndex(pos, availablePlayers, draftState.picks.length);
    if (scarcity >= 60) {
      scarcityWarnings.push({ position: pos, scarcity });
    }
  });

  // Find value opportunities
  const valueOpportunities: Player[] = [];
  availablePlayers.slice(0, 50).forEach((player) => {
    const falling = detectValueFallingOff(draftState.currentPickIndex + 1, [player]);
    if (falling) {
      valueOpportunities.push(falling);
    }
  });

  return {
    runsDetected,
    scarcityWarnings,
    valueOpportunities,
  };
}
