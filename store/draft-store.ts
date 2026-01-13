import { create } from 'zustand';
import { DraftState, Player, Team, DraftPick, Position } from '@/lib/types';

interface DraftStore extends DraftState {
  // Actions
  setDraft: (draft: DraftState) => void;
  makePick: (teamId: string, player: Player) => void;
  undoLastPick: () => void;
  updateAvailablePlayers: (players: Player[]) => void;
  nextPick: () => void;
  reset: () => void;

  // Computed getters
  getCurrentTeam: () => Team | undefined;
  getCurrentRound: () => number;
  getTeamRoster: (teamId: string) => Player[];
  getPickNumber: () => number;
  isUserTurn: () => boolean;
}

const initialState: DraftState = {
  id: '',
  teams: [],
  picks: [],
  currentPickIndex: 0,
  availablePlayers: [],
  draftOrder: [],
  settings: {
    numTeams: 12,
    numRounds: 15,
    pickTimeLimit: 90,
    scoringType: 'ppr',
    rosterSlots: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      K: 1,
      DEF: 1,
      BENCH: 6,
    },
  },
  status: 'setup',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export const useDraftStore = create<DraftStore>((set, get) => ({
  ...initialState,

  setDraft: (draft: DraftState) => {
    set({
      ...draft,
      updatedAt: Date.now(),
    });
  },

  makePick: (teamId: string, player: Player) => {
    const state = get();
    const currentTeam = state.teams.find((t) => t.id === teamId);

    if (!currentTeam) {
      console.error('Team not found:', teamId);
      return;
    }

    // Create pick record
    const pickNumber = state.currentPickIndex + 1;
    const round = Math.floor(state.currentPickIndex / state.settings.numTeams) + 1;
    const pickInRound = (state.currentPickIndex % state.settings.numTeams) + 1;

    const newPick: DraftPick = {
      id: `pick-${pickNumber}`,
      draftId: state.id,
      teamId,
      playerId: player.id,
      pickNumber,
      round,
      pickInRound,
      timestamp: Date.now(),
      isAIPick: !currentTeam.isUser,
    };

    // Update team roster
    const updatedTeams = state.teams.map((team) => {
      if (team.id === teamId) {
        return {
          ...team,
          roster: [...team.roster, player],
        };
      }
      return team;
    });

    // Remove player from available players
    const updatedAvailablePlayers = state.availablePlayers.filter(
      (p) => p.id !== player.id
    );

    set({
      picks: [...state.picks, newPick],
      teams: updatedTeams,
      availablePlayers: updatedAvailablePlayers,
      currentPickIndex: state.currentPickIndex + 1,
      updatedAt: Date.now(),
      status:
        state.currentPickIndex + 1 >= state.settings.numTeams * state.settings.numRounds
          ? 'completed'
          : 'in_progress',
    });
  },

  undoLastPick: () => {
    const state = get();
    if (state.picks.length === 0) return;

    const lastPick = state.picks[state.picks.length - 1];
    const pickedPlayer = state.availablePlayers.find((p) => p.id === lastPick.playerId);

    if (!pickedPlayer) {
      console.error('Cannot undo: Player not found');
      return;
    }

    // Remove last pick
    const updatedPicks = state.picks.slice(0, -1);

    // Return player to team roster
    const updatedTeams = state.teams.map((team) => {
      if (team.id === lastPick.teamId) {
        return {
          ...team,
          roster: team.roster.filter((p) => p.id !== lastPick.playerId),
        };
      }
      return team;
    });

    // Add player back to available players (maintain ADP sort)
    const updatedAvailablePlayers = [...state.availablePlayers, pickedPlayer].sort(
      (a, b) => a.adp - b.adp
    );

    set({
      picks: updatedPicks,
      teams: updatedTeams,
      availablePlayers: updatedAvailablePlayers,
      currentPickIndex: Math.max(0, state.currentPickIndex - 1),
      updatedAt: Date.now(),
      status: 'in_progress',
    });
  },

  updateAvailablePlayers: (players: Player[]) => {
    set({
      availablePlayers: players,
      updatedAt: Date.now(),
    });
  },

  nextPick: () => {
    const state = get();
    set({
      currentPickIndex: state.currentPickIndex + 1,
      updatedAt: Date.now(),
    });
  },

  reset: () => {
    set({
      ...initialState,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  // Computed getters
  getCurrentTeam: () => {
    const state = get();
    if (state.currentPickIndex >= state.draftOrder.length) return undefined;
    const currentTeamId = state.draftOrder[state.currentPickIndex];
    return state.teams.find((t) => t.id === currentTeamId);
  },

  getCurrentRound: () => {
    const state = get();
    return Math.floor(state.currentPickIndex / state.settings.numTeams) + 1;
  },

  getTeamRoster: (teamId: string) => {
    const state = get();
    const team = state.teams.find((t) => t.id === teamId);
    return team?.roster || [];
  },

  getPickNumber: () => {
    const state = get();
    return state.currentPickIndex + 1;
  },

  isUserTurn: () => {
    const currentTeam = get().getCurrentTeam();
    return currentTeam?.isUser || false;
  },
}));

// Selector hooks for optimized re-renders
export const useCurrentTeam = () => useDraftStore((state) => state.getCurrentTeam());
export const useCurrentRound = () => useDraftStore((state) => state.getCurrentRound());
export const useAvailablePlayers = () => useDraftStore((state) => state.availablePlayers);
export const useDraftPicks = () => useDraftStore((state) => state.picks);
export const useTeams = () => useDraftStore((state) => state.teams);
export const useDraftStatus = () => useDraftStore((state) => state.status);
export const useIsUserTurn = () => useDraftStore((state) => state.isUserTurn());
