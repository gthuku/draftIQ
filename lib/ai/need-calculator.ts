import { Team, DraftSettings, Position, Player } from '@/lib/types';

/**
 * Calculates the need score (0-100) for each position for a given team
 * Higher score = higher need
 */
export function calculateTeamNeeds(
  team: Team,
  settings: DraftSettings,
  currentRound: number
): Record<Position, number> {
  const rosterComposition = getRosterComposition(team);
  const targetComposition = getTargetComposition(settings);

  const needs: Record<Position, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };

  // Calculate need for each position
  Object.keys(targetComposition).forEach((pos) => {
    const position = pos as Position;
    const current = rosterComposition[position] || 0;
    const target = targetComposition[position];

    // Basic need calculation: difference from target
    let need = 0;

    if (current === 0) {
      // No player at this position = highest need
      need = 100;
    } else if (current < target) {
      // Under target = high need
      need = 80 - (current / target) * 30;
    } else if (current === target) {
      // At target = moderate need (for depth)
      need = 40;
    } else {
      // Over target = low need
      need = Math.max(0, 30 - (current - target) * 10);
    }

    // Adjust need based on current round
    // Early rounds: prioritize skill positions (RB, WR)
    // Late rounds: fill remaining needs (K, DEF)
    if (currentRound <= 5) {
      if (position === 'K' || position === 'DEF') {
        need *= 0.3; // Reduce need for K/DEF early
      } else if (position === 'QB') {
        need *= 0.7; // Slightly reduce QB need early (can wait)
      }
    } else if (currentRound >= 12) {
      // Late rounds: increase need for K/DEF if not filled
      if ((position === 'K' || position === 'DEF') && current === 0) {
        need = 100;
      }
    }

    needs[position] = Math.round(need);
  });

  return needs;
}

/**
 * Gets current roster composition by position
 */
function getRosterComposition(team: Team): Record<Position, number> {
  const composition: Record<Position, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
  };

  team.roster.forEach((player) => {
    composition[player.position] = (composition[player.position] || 0) + 1;
  });

  return composition;
}

/**
 * Gets target roster composition based on draft settings
 */
function getTargetComposition(settings: DraftSettings): Record<Position, number> {
  const { rosterSlots } = settings;

  return {
    QB: rosterSlots.QB + Math.floor(rosterSlots.BENCH * 0.1), // 1 QB + 10% bench
    RB: rosterSlots.RB + Math.ceil(rosterSlots.FLEX * 0.5) + Math.floor(rosterSlots.BENCH * 0.35), // RBs + half FLEX + 35% bench
    WR: rosterSlots.WR + Math.ceil(rosterSlots.FLEX * 0.5) + Math.floor(rosterSlots.BENCH * 0.35), // WRs + half FLEX + 35% bench
    TE: rosterSlots.TE + Math.floor(rosterSlots.BENCH * 0.1), // 1 TE + 10% bench
    K: rosterSlots.K,
    DEF: rosterSlots.DEF,
  };
}

/**
 * Calculates the need score for a specific position
 * Takes into account current roster, target, and context
 */
export function calculatePositionNeed(
  team: Team,
  position: Position,
  settings: DraftSettings,
  currentRound: number
): number {
  const allNeeds = calculateTeamNeeds(team, settings, currentRound);
  return allNeeds[position];
}

/**
 * Gets the position with the highest need for a team
 */
export function getHighestNeedPosition(
  team: Team,
  settings: DraftSettings,
  currentRound: number
): Position {
  const needs = calculateTeamNeeds(team, settings, currentRound);

  let highestNeed = 0;
  let position: Position = 'RB';

  Object.entries(needs).forEach(([pos, need]) => {
    if (need > highestNeed) {
      highestNeed = need;
      position = pos as Position;
    }
  });

  return position;
}

/**
 * Calculates how much value a player adds to fill team needs
 * Returns a score (0-100)
 */
export function calculateNeedValue(
  team: Team,
  player: Player,
  settings: DraftSettings,
  currentRound: number
): number {
  const positionNeed = calculatePositionNeed(team, player.position, settings, currentRound);

  // Base need value
  let needValue = positionNeed;

  // Bonus for filling empty position
  const hasPosition = team.roster.some((p) => p.position === player.position);
  if (!hasPosition) {
    needValue *= 1.3; // 30% bonus for filling empty slot
  }

  // Bonus for high-quality player at need position
  if (positionNeed > 70 && player.tier <= 3) {
    needValue *= 1.2; // 20% bonus for top-tier player at high need
  }

  return Math.min(100, Math.round(needValue));
}

/**
 * Determines if a team should reach for a player to fill a critical need
 */
export function shouldReachForNeed(
  team: Team,
  player: Player,
  currentPick: number,
  settings: DraftSettings,
  currentRound: number
): boolean {
  const positionNeed = calculatePositionNeed(team, player.position, settings, currentRound);

  // Critical need threshold
  if (positionNeed < 80) return false;

  // How far is the reach?
  const reachAmount = currentPick - player.adp;

  // Allow small reaches for critical needs
  if (reachAmount <= 10 && positionNeed >= 90) return true;
  if (reachAmount <= 5 && positionNeed >= 80) return true;

  // Late-round emergency reaches (K, DEF in final rounds)
  if (currentRound >= 13 && (player.position === 'K' || player.position === 'DEF')) {
    const hasPosition = team.roster.some((p) => p.position === player.position);
    if (!hasPosition) return true;
  }

  return false;
}

/**
 * Evaluates if a team has balanced roster construction
 */
export function evaluateRosterBalance(team: Team, settings: DraftSettings): {
  balanced: boolean;
  weakPositions: Position[];
  strongPositions: Position[];
} {
  const composition = getRosterComposition(team);
  const targets = getTargetComposition(settings);

  const weakPositions: Position[] = [];
  const strongPositions: Position[] = [];

  Object.entries(composition).forEach(([pos, count]) => {
    const position = pos as Position;
    const target = targets[position];

    if (count < target * 0.5) {
      weakPositions.push(position);
    } else if (count > target * 1.5) {
      strongPositions.push(position);
    }
  });

  return {
    balanced: weakPositions.length === 0,
    weakPositions,
    strongPositions,
  };
}
