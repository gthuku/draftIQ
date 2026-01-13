import { nanoid } from 'nanoid';
import { DraftState, Team, DraftSettings, Player, DraftPick } from '@/lib/types';

/**
 * Generates snake draft order for all picks in the draft
 * Example: 12 teams, 3 rounds
 * Round 1: 1,2,3,4,5,6,7,8,9,10,11,12
 * Round 2: 12,11,10,9,8,7,6,5,4,3,2,1
 * Round 3: 1,2,3,4,5,6,7,8,9,10,11,12
 */
export function generateSnakeDraftOrder(
  teams: Team[],
  numRounds: number
): string[] {
  const draftOrder: string[] = [];
  const teamIds = teams.map((t) => t.id);

  for (let round = 0; round < numRounds; round++) {
    // Even rounds (0, 2, 4...) go forward
    // Odd rounds (1, 3, 5...) go backward (snake)
    const roundOrder = round % 2 === 0 ? teamIds : [...teamIds].reverse();
    draftOrder.push(...roundOrder);
  }

  return draftOrder;
}

/**
 * Validates if a pick is legal
 */
export function validatePick(
  draftState: DraftState,
  teamId: string,
  playerId: string
): { valid: boolean; error?: string } {
  // Check if draft is in progress
  if (draftState.status !== 'in_progress') {
    return { valid: false, error: 'Draft is not in progress' };
  }

  // Check if it's this team's turn
  const currentTeamId = draftState.draftOrder[draftState.currentPickIndex];
  if (currentTeamId !== teamId) {
    return { valid: false, error: 'Not this team\'s turn' };
  }

  // Check if player is available
  const playerAvailable = draftState.availablePlayers.some((p) => p.id === playerId);
  if (!playerAvailable) {
    return { valid: false, error: 'Player not available' };
  }

  // Check if player is already drafted
  const alreadyDrafted = draftState.picks.some((pick) => pick.playerId === playerId);
  if (alreadyDrafted) {
    return { valid: false, error: 'Player already drafted' };
  }

  return { valid: true };
}

/**
 * Checks if draft is complete
 */
export function isDraftComplete(draftState: DraftState): boolean {
  const totalPicks = draftState.settings.numTeams * draftState.settings.numRounds;
  return draftState.picks.length >= totalPicks;
}

/**
 * Gets the current round number
 */
export function getCurrentRound(draftState: DraftState): number {
  return Math.floor(draftState.currentPickIndex / draftState.settings.numTeams) + 1;
}

/**
 * Gets the current pick number within the round
 */
export function getCurrentPickInRound(draftState: DraftState): number {
  return (draftState.currentPickIndex % draftState.settings.numTeams) + 1;
}

/**
 * Gets remaining picks in the draft
 */
export function getRemainingPicks(draftState: DraftState): number {
  const totalPicks = draftState.settings.numTeams * draftState.settings.numRounds;
  return totalPicks - draftState.picks.length;
}

/**
 * Gets the team that should pick next
 */
export function getNextTeam(draftState: DraftState): Team | undefined {
  if (draftState.currentPickIndex >= draftState.draftOrder.length) {
    return undefined;
  }

  const nextTeamId = draftState.draftOrder[draftState.currentPickIndex];
  return draftState.teams.find((t) => t.id === nextTeamId);
}

/**
 * Gets recent picks for context (last N picks)
 */
export function getRecentPicks(draftState: DraftState, count: number = 5): DraftPick[] {
  return draftState.picks.slice(-count);
}

/**
 * Calculates roster composition for a team
 */
export function getRosterComposition(team: Team) {
  const composition: Record<string, number> = {
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
 * Calculates bye week distribution for a team
 */
export function getByeWeekDistribution(team: Team): Record<number, number> {
  const distribution: Record<number, number> = {};

  team.roster.forEach((player) => {
    if (player.byeWeek) {
      distribution[player.byeWeek] = (distribution[player.byeWeek] || 0) + 1;
    }
  });

  return distribution;
}

/**
 * Initializes a new draft
 */
export function initializeDraft(
  userTeamName: string,
  userDraftPosition: number,
  settings: DraftSettings,
  aiProfileIds: string[],
  availablePlayers: Player[]
): DraftState {
  const draftId = nanoid();

  // Create teams
  const teams: Team[] = [];

  // Create user team
  const userTeam: Team = {
    id: `team-user`,
    name: userTeamName,
    isUser: true,
    roster: [],
    needs: {
      QB: 100,
      RB: 100,
      WR: 100,
      TE: 100,
      K: 100,
      DEF: 100,
    },
    byeWeekCount: {},
    draftPosition: userDraftPosition,
  };

  teams.push(userTeam);

  // Create AI teams
  for (let i = 1; i <= settings.numTeams; i++) {
    if (i === userDraftPosition) continue; // Skip user position

    const aiTeam: Team = {
      id: `team-${i}`,
      name: `Team ${i}`,
      isUser: false,
      roster: [],
      needs: {
        QB: 100,
        RB: 100,
        WR: 100,
        TE: 100,
        K: 100,
        DEF: 100,
      },
      byeWeekCount: {},
      draftPosition: i,
    };

    teams.push(aiTeam);
  }

  // Sort teams by draft position
  teams.sort((a, b) => a.draftPosition - b.draftPosition);

  // Generate snake draft order
  const draftOrder = generateSnakeDraftOrder(teams, settings.numRounds);

  // Initialize draft state
  const draftState: DraftState = {
    id: draftId,
    teams,
    picks: [],
    currentPickIndex: 0,
    availablePlayers,
    draftOrder,
    settings,
    status: 'in_progress',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return draftState;
}

/**
 * Executes a pick in the draft
 */
export function executePick(
  draftState: DraftState,
  teamId: string,
  playerId: string
): { success: boolean; error?: string; updatedState?: DraftState } {
  // Validate pick
  const validation = validatePick(draftState, teamId, playerId);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Find player
  const player = draftState.availablePlayers.find((p) => p.id === playerId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  // Find team
  const team = draftState.teams.find((t) => t.id === teamId);
  if (!team) {
    return { success: false, error: 'Team not found' };
  }

  // Create pick record
  const pickNumber = draftState.currentPickIndex + 1;
  const round = getCurrentRound(draftState);
  const pickInRound = getCurrentPickInRound(draftState);

  const newPick: DraftPick = {
    id: `pick-${pickNumber}`,
    draftId: draftState.id,
    teamId,
    playerId,
    pickNumber,
    round,
    pickInRound,
    timestamp: Date.now(),
    isAIPick: !team.isUser,
  };

  // Update state
  const updatedTeams = draftState.teams.map((t) => {
    if (t.id === teamId) {
      return {
        ...t,
        roster: [...t.roster, player],
      };
    }
    return t;
  });

  const updatedAvailablePlayers = draftState.availablePlayers.filter(
    (p) => p.id !== playerId
  );

  const updatedPicks = [...draftState.picks, newPick];

  const updatedState: DraftState = {
    ...draftState,
    teams: updatedTeams,
    picks: updatedPicks,
    availablePlayers: updatedAvailablePlayers,
    currentPickIndex: draftState.currentPickIndex + 1,
    status: isDraftComplete({ ...draftState, picks: updatedPicks })
      ? 'completed'
      : 'in_progress',
    updatedAt: Date.now(),
  };

  return { success: true, updatedState };
}
