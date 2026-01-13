import { Player, Team, DraftState, AIProfile, PickScore } from '@/lib/types';
import { calculateNeedValue } from './need-calculator';
import { calculateTierUrgency, isLastInTier } from './tier-analyzer';
import {
  detectPositionalRun,
  calculatePanicBonus,
  calculateScarcityBonus,
  calculateReachPenalty,
  calculateFavoriteTeamBonus,
} from './psychology';
import { getCurrentRound } from '@/lib/draft/draft-engine';

/**
 * Main AI decision engine
 * Evaluates all available players and selects the best pick for an AI team
 */
export function selectAIPick(
  team: Team,
  draftState: DraftState,
  availablePlayers: Player[]
): Player | null {
  if (availablePlayers.length === 0) return null;
  if (!team.aiProfile) return availablePlayers[0]; // Fallback to BPA

  const currentRound = getCurrentRound(draftState);
  const currentPick = draftState.currentPickIndex + 1;
  const recentPicks = draftState.picks.slice(-5);

  // Score all available players
  const scores = availablePlayers.map((player) =>
    scorePlayer(player, team, draftState, currentRound, currentPick, recentPicks, availablePlayers)
  );

  // Sort by total score (descending)
  scores.sort((a, b) => b.totalScore - a.totalScore);

  // Get the best player
  const bestScore = scores[0];

  // Find and return the player
  return availablePlayers.find((p) => p.id === bestScore.playerId) || null;
}

/**
 * Scores a single player for an AI team
 * Returns a PickScore with total and breakdown
 */
export function scorePlayer(
  player: Player,
  team: Team,
  draftState: DraftState,
  currentRound: number,
  currentPick: number,
  recentPicks: any[],
  availablePlayers: Player[]
): PickScore {
  const aiProfile = team.aiProfile!;
  const settings = draftState.settings;

  // Factor 1: Base Score (based on ADP)
  // Higher score for better ADP
  const baseScore = Math.max(0, 200 - player.adp);

  // Factor 2: Team Need (30% weight)
  const needScore = calculateNeedValue(team, player, settings, currentRound);

  // Factor 3: Value vs ADP (25% weight)
  // Positive if player's ADP is better than current pick (value)
  // Negative if reaching
  const valueScore = (player.adp - currentPick) * 2;

  // Factor 4: Positional Run Psychology (20% weight)
  const runInfo = detectPositionalRun(recentPicks, availablePlayers);
  const runScore = calculatePanicBonus(player, runInfo, aiProfile.panicFactor);

  // Factor 5: Tier Break Urgency (15% weight)
  const isLast = isLastInTier(player, availablePlayers);
  const tierScore = isLast ? 50 : calculateTierUrgency(player, availablePlayers, currentPick);

  // Factor 6: Bye Week Stacking (10% weight)
  const byeScore = calculateByeWeekPenalty(team, player, aiProfile.byeWeekAwareness);

  // Additional modifiers
  const scarcityBonus = calculateScarcityBonus(player, availablePlayers, draftState.picks.length);
  const favoriteTeamBonus = calculateFavoriteTeamBonus(player, aiProfile.favoriteTeams);
  const reachPenalty = calculateReachPenalty(player, currentPick, aiProfile.reachThreshold);

  // Apply positional preferences
  const positionalMultiplier = aiProfile.positionalPreferences[player.position] || 1.0;

  // Apply risk tolerance
  const riskAdjustment = calculateRiskAdjustment(player, aiProfile.riskTolerance);

  // Calculate weighted total
  let totalScore =
    baseScore * positionalMultiplier +
    needScore * 0.3 +
    valueScore * 0.25 +
    runScore * 0.2 +
    tierScore * 0.15 +
    byeScore * 0.1 +
    scarcityBonus +
    favoriteTeamBonus +
    riskAdjustment -
    reachPenalty;

  // Add some randomness (±5%) to simulate human unpredictability
  const randomness = (Math.random() - 0.5) * 0.1; // -5% to +5%
  totalScore *= 1 + randomness;

  return {
    playerId: player.id,
    totalScore: Math.round(totalScore),
    breakdown: {
      baseScore: Math.round(baseScore * positionalMultiplier),
      needScore: Math.round(needScore * 0.3),
      valueScore: Math.round(valueScore * 0.25),
      runScore: Math.round(runScore * 0.2),
      tierScore: Math.round(tierScore * 0.15),
      byeScore: Math.round(byeScore * 0.1),
    },
  };
}

/**
 * Calculates bye week penalty
 * Returns negative score if too many players on same bye
 */
function calculateByeWeekPenalty(
  team: Team,
  player: Player,
  byeWeekAwareness: number
): number {
  if (!player.byeWeek || byeWeekAwareness === 0) return 0;

  const byeCount = team.byeWeekCount[player.byeWeek] || 0;

  // Penalty increases with more players on same bye
  let penalty = 0;

  if (byeCount >= 3) {
    penalty = -40; // Heavy penalty for 4th+ player on same bye
  } else if (byeCount === 2) {
    penalty = -25; // Moderate penalty for 3rd player
  } else if (byeCount === 1) {
    penalty = -10; // Light penalty for 2nd player
  }

  // Scale by bye week awareness
  return Math.round(penalty * byeWeekAwareness);
}

/**
 * Calculates risk adjustment based on AI risk tolerance and player risk
 */
function calculateRiskAdjustment(player: Player, riskTolerance: number): number {
  if (!player.riskScore) return 0;

  // High risk tolerance = likes risky players
  // Low risk tolerance = penalizes risky players

  const riskDiff = player.riskScore - 5; // Center at 5

  if (riskTolerance > 0.7) {
    // Risk-seeking: bonus for high-risk players
    return riskDiff * 3;
  } else if (riskTolerance < 0.3) {
    // Risk-averse: penalty for high-risk players
    return -riskDiff * 4;
  }

  return 0; // Neutral
}

/**
 * Simulates AI "thinking" by adding a small delay
 * Makes the AI feel more human-like
 */
export async function simulateThinkingDelay(): Promise<void> {
  const delay = 300 + Math.random() * 400; // 300-700ms
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Explains why an AI made a particular pick (for debugging/UI)
 */
export function explainPick(
  player: Player,
  score: PickScore,
  team: Team
): string {
  const reasons: string[] = [];

  // Analyze the breakdown
  if (score.breakdown.needScore > 20) {
    reasons.push(`filled team need at ${player.position}`);
  }

  if (score.breakdown.valueScore > 15) {
    reasons.push('great value pick');
  }

  if (score.breakdown.runScore > 15) {
    reasons.push(`reacted to ${player.position} run`);
  }

  if (score.breakdown.tierScore > 15) {
    reasons.push('last in tier');
  }

  if (score.breakdown.baseScore > 150) {
    reasons.push('elite player');
  }

  if (reasons.length === 0) {
    return `${team.name} selected ${player.name} (${player.position})`;
  }

  return `${team.name} selected ${player.name} (${player.position}) - ${reasons.join(', ')}`;
}

/**
 * Gets top N candidates for a team (for UI display)
 */
export function getTopCandidates(
  team: Team,
  draftState: DraftState,
  availablePlayers: Player[],
  count: number = 5
): Array<{ player: Player; score: PickScore }> {
  const currentRound = getCurrentRound(draftState);
  const currentPick = draftState.currentPickIndex + 1;
  const recentPicks = draftState.picks.slice(-5);

  const scores = availablePlayers.map((player) => ({
    player,
    score: scorePlayer(
      player,
      team,
      draftState,
      currentRound,
      currentPick,
      recentPicks,
      availablePlayers
    ),
  }));

  scores.sort((a, b) => b.score.totalScore - a.score.totalScore);

  return scores.slice(0, count);
}

/**
 * Validates that an AI pick makes logical sense
 * Returns true if pick is valid, false if AI made a mistake
 */
export function validateAIPick(
  player: Player,
  team: Team,
  draftState: DraftState
): boolean {
  // Check if player is available
  const available = draftState.availablePlayers.some((p) => p.id === player.id);
  if (!available) return false;

  // Check if reaching too far (>40 picks from ADP)
  const currentPick = draftState.currentPickIndex + 1;
  const reachAmount = currentPick - player.adp;
  if (reachAmount > 40) return false; // Probably a mistake

  // Otherwise, trust the AI
  return true;
}
