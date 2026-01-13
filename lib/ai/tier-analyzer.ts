import { Player, Position, PositionTier } from '@/lib/types';

/**
 * Analyzes players and groups them into tiers by position
 */
export function analyzePositionTiers(players: Player[]): PositionTier[] {
  const tiers: PositionTier[] = [];

  // Group players by position
  const positionGroups: Record<Position, Player[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DEF: [],
  };

  players.forEach((player) => {
    positionGroups[player.position].push(player);
  });

  // Analyze tiers for each position
  Object.entries(positionGroups).forEach(([pos, posPlayers]) => {
    const position = pos as Position;
    const positionTiers = identifyTiers(posPlayers, position);
    tiers.push(...positionTiers);
  });

  return tiers;
}

/**
 * Identifies tiers within a position group
 */
function identifyTiers(players: Player[], position: Position): PositionTier[] {
  if (players.length === 0) return [];

  // Sort by ADP
  const sorted = [...players].sort((a, b) => a.adp - b.adp);

  const tiers: PositionTier[] = [];
  let currentTier: Player[] = [];
  let tierNumber = 1;
  let lastADP = sorted[0].adp;

  sorted.forEach((player, index) => {
    // Tier break occurs when there's a significant ADP gap
    const adpGap = player.adp - lastADP;
    const tierBreakThreshold = getTierBreakThreshold(position, tierNumber);

    if (adpGap > tierBreakThreshold && currentTier.length > 0) {
      // Save current tier
      tiers.push({
        position,
        tierNumber,
        players: currentTier,
        avgADP: currentTier.reduce((sum, p) => sum + p.adp, 0) / currentTier.length,
        remaining: currentTier.length,
      });

      // Start new tier
      tierNumber++;
      currentTier = [player];
    } else {
      currentTier.push(player);
    }

    lastADP = player.adp;

    // Save last tier
    if (index === sorted.length - 1 && currentTier.length > 0) {
      tiers.push({
        position,
        tierNumber,
        players: currentTier,
        avgADP: currentTier.reduce((sum, p) => sum + p.adp, 0) / currentTier.length,
        remaining: currentTier.length,
      });
    }
  });

  return tiers;
}

/**
 * Gets the ADP gap threshold for tier breaks (varies by position)
 */
function getTierBreakThreshold(position: Position, tierNumber: number): number {
  // Early tiers have tighter breaks, later tiers have wider breaks
  const baseThresholds: Record<Position, number> = {
    QB: 15, // QBs have bigger gaps
    RB: 8, // RBs drafted close together
    WR: 10, // WRs moderate gaps
    TE: 12, // TEs have gaps after elite tier
    K: 20, // Kickers don't matter much
    DEF: 18, // Defense similar to K
  };

  // Later tiers have wider gaps
  const tierMultiplier = 1 + (tierNumber - 1) * 0.2;

  return baseThresholds[position] * tierMultiplier;
}

/**
 * Checks if a player is the last in their tier
 */
export function isLastInTier(
  player: Player,
  availablePlayers: Player[]
): boolean {
  // Get players of same position
  const samePosition = availablePlayers.filter((p) => p.position === player.position);

  // Find player's tier
  const playerIndex = samePosition.findIndex((p) => p.id === player.id);
  if (playerIndex === -1 || playerIndex === samePosition.length - 1) {
    return true; // Last available at position
  }

  // Check if next player is in different tier (big ADP gap)
  const nextPlayer = samePosition[playerIndex + 1];
  const adpGap = nextPlayer.adp - player.adp;
  const threshold = getTierBreakThreshold(player.position, player.tier);

  return adpGap > threshold;
}

/**
 * Gets remaining players in a specific tier
 */
export function getRemainingInTier(
  player: Player,
  availablePlayers: Player[]
): number {
  const samePosition = availablePlayers.filter(
    (p) => p.position === player.position && p.tier === player.tier
  );

  return samePosition.length;
}

/**
 * Calculates urgency score based on tier analysis
 * Returns 0-100 (higher = more urgent to draft now)
 */
export function calculateTierUrgency(
  player: Player,
  availablePlayers: Player[],
  currentPick: number
): number {
  const samePosition = availablePlayers.filter((p) => p.position === player.position);
  const sameTier = samePosition.filter((p) => p.tier === player.tier);

  // How many players left in this tier?
  const remainingInTier = sameTier.length;

  // Base urgency on scarcity
  let urgency = 0;

  if (remainingInTier === 1) {
    // Last in tier = very urgent
    urgency = 90;
  } else if (remainingInTier === 2) {
    // Second-to-last = urgent
    urgency = 70;
  } else if (remainingInTier === 3) {
    // Third-to-last = moderate urgency
    urgency = 50;
  } else {
    // More than 3 left = low urgency
    urgency = Math.max(0, 40 - remainingInTier * 5);
  }

  // Check next tier quality drop
  const nextTierPlayers = samePosition.filter((p) => p.tier === player.tier + 1);
  if (nextTierPlayers.length > 0) {
    const tierDropoff = nextTierPlayers[0].adp - player.adp;
    if (tierDropoff > 20) {
      // Significant drop to next tier = increase urgency
      urgency += 15;
    }
  }

  // If this player is much better than their ADP suggests, increase urgency
  if (player.adp > currentPick + 10 && remainingInTier <= 2) {
    urgency += 10;
  }

  return Math.min(100, Math.round(urgency));
}

/**
 * Finds the best player in a given tier at a position
 */
export function getBestInTier(
  position: Position,
  tier: number,
  availablePlayers: Player[]
): Player | undefined {
  const candidates = availablePlayers.filter(
    (p) => p.position === position && p.tier === tier
  );

  if (candidates.length === 0) return undefined;

  // Sort by ADP (lower is better) and return first
  return candidates.sort((a, b) => a.adp - b.adp)[0];
}

/**
 * Gets tier distribution summary for a position
 */
export function getTierDistribution(
  position: Position,
  availablePlayers: Player[]
): Record<number, number> {
  const distribution: Record<number, number> = {};

  availablePlayers
    .filter((p) => p.position === position)
    .forEach((player) => {
      distribution[player.tier] = (distribution[player.tier] || 0) + 1;
    });

  return distribution;
}

/**
 * Determines if now is a good time to draft a position based on tier availability
 */
export function shouldDraftPositionNow(
  position: Position,
  availablePlayers: Player[],
  currentRound: number
): boolean {
  const distribution = getTierDistribution(position, availablePlayers);
  const topTiers = [1, 2, 3];

  // Count players in top tiers
  const topTierCount = topTiers.reduce((sum, tier) => sum + (distribution[tier] || 0), 0);

  // If few top-tier players left, draft now
  if (topTierCount <= 3 && topTierCount > 0) return true;

  // Position-specific timing
  if (position === 'QB' && currentRound <= 6 && topTierCount <= 5) return true;
  if (position === 'TE' && currentRound <= 8 && distribution[1] && distribution[1] <= 2) return true;
  if ((position === 'RB' || position === 'WR') && topTierCount <= 4) return true;

  return false;
}
