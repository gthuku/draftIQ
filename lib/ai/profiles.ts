import { AIProfile } from '@/lib/types';

/**
 * Pre-built AI personality profiles for draft opponents
 * Each profile has distinct behaviors and tendencies
 */

export const AI_PROFILES: Record<string, AIProfile> = {
  analyst: {
    id: 'analyst',
    name: 'The Analyst',
    description: 'Data-driven and methodical. Follows ADP closely, avoids risks, and is highly aware of bye weeks.',
    riskTolerance: 0.2, // Very conservative
    positionalPreferences: {
      QB: 0.9,
      RB: 1.1,
      WR: 1.1,
      TE: 0.95,
      K: 0.8,
      DEF: 0.85,
    },
    reachThreshold: 0.3, // Rarely reaches
    panicFactor: 0.3, // Doesn't panic much
    byeWeekAwareness: 0.95, // Highly aware of bye weeks
    favoriteTeams: [],
  },

  gambler: {
    id: 'gambler',
    name: 'The Gambler',
    description: 'High-risk, high-reward player. Reaches for upside, ignores bye weeks, chases ceiling over floor.',
    riskTolerance: 0.95, // Very aggressive
    positionalPreferences: {
      QB: 0.8, // Waits on QB
      RB: 1.2, // Loves RBs
      WR: 1.15, // Loves WRs
      TE: 0.7, // Punts TE
      K: 0.5, // Ignores K
      DEF: 0.5, // Ignores DEF
    },
    reachThreshold: 0.85, // Reaches often
    panicFactor: 0.5, // Moderate panic
    byeWeekAwareness: 0.1, // Doesn't care about byes
    favoriteTeams: [],
  },

  homer: {
    id: 'homer',
    name: 'The Homer',
    description: 'Loyal fan who reaches for favorite team players. Medium risk tolerance with team bias.',
    riskTolerance: 0.6, // Medium risk
    positionalPreferences: {
      QB: 1.0,
      RB: 1.05,
      WR: 1.05,
      TE: 1.0,
      K: 0.9,
      DEF: 1.2, // Really wants their team's defense
    },
    reachThreshold: 0.7, // Will reach for favorites
    panicFactor: 0.6, // Moderate panic
    byeWeekAwareness: 0.5, // Somewhat aware
    favoriteTeams: ['KC', 'SF', 'PHI', 'BUF'], // Chiefs, 49ers, Eagles, Bills
  },

  reactor: {
    id: 'reactor',
    name: 'The Reactor',
    description: 'Highly reactive to draft trends. Panics during runs, chases positions being drafted.',
    riskTolerance: 0.5, // Medium risk
    positionalPreferences: {
      QB: 1.0,
      RB: 1.0,
      WR: 1.0,
      TE: 1.0,
      K: 1.0,
      DEF: 1.0,
    },
    reachThreshold: 0.6, // Moderate reaches
    panicFactor: 0.95, // VERY high panic factor
    byeWeekAwareness: 0.4, // Low awareness (too busy panicking)
    favoriteTeams: [],
  },

  valueHunter: {
    id: 'valueHunter',
    name: 'The Value Hunter',
    description: 'Patient drafter who waits for value. Anti-reach mentality, tier-focused, lets players fall.',
    riskTolerance: 0.4, // Conservative
    positionalPreferences: {
      QB: 0.7, // Waits on QB
      RB: 1.0,
      WR: 1.0,
      TE: 0.85, // Waits on TE
      K: 0.6, // Very late K
      DEF: 0.65, // Very late DEF
    },
    reachThreshold: 0.15, // Almost never reaches
    panicFactor: 0.2, // Rarely panics
    byeWeekAwareness: 0.7, // Good awareness
    favoriteTeams: [],
  },

  balanced: {
    id: 'balanced',
    name: 'The Balanced',
    description: 'Well-rounded drafter. Middle-of-road on all factors, solid fundamentals.',
    riskTolerance: 0.5, // Balanced
    positionalPreferences: {
      QB: 1.0,
      RB: 1.0,
      WR: 1.0,
      TE: 1.0,
      K: 1.0,
      DEF: 1.0,
    },
    reachThreshold: 0.5, // Moderate reaches
    panicFactor: 0.5, // Moderate panic
    byeWeekAwareness: 0.65, // Good awareness
    favoriteTeams: [],
  },

  bestAvailable: {
    id: 'bestAvailable',
    name: 'Best Available',
    description: 'Pure value drafter. Always picks the best available player based on ADP, with smart position need awareness.',
    riskTolerance: 0.3, // Conservative - sticks to rankings
    positionalPreferences: {
      QB: 0.85, // Slightly deprioritizes QB early
      RB: 1.1, // Prioritizes RB value
      WR: 1.1, // Prioritizes WR value
      TE: 0.9, // Moderate TE priority
      K: 0.5, // Waits on K
      DEF: 0.5, // Waits on DEF
    },
    reachThreshold: 0.1, // Almost never reaches - pure BPA
    panicFactor: 0.1, // Doesn't panic - trusts the board
    byeWeekAwareness: 0.8, // Good bye week awareness
    favoriteTeams: [],
  },
};

/**
 * Gets a random AI profile
 */
export function getRandomAIProfile(): AIProfile {
  const profileIds = Object.keys(AI_PROFILES);
  const randomId = profileIds[Math.floor(Math.random() * profileIds.length)];
  return AI_PROFILES[randomId];
}

/**
 * Gets an AI profile by ID
 */
export function getAIProfileById(id: string): AIProfile | undefined {
  return AI_PROFILES[id];
}

/**
 * Gets all available AI profiles
 */
export function getAllAIProfiles(): AIProfile[] {
  return Object.values(AI_PROFILES);
}

/**
 * Assigns random AI profiles to teams
 * Ensures variety in draft opponents
 */
export function assignRandomProfiles(numTeams: number): AIProfile[] {
  const profiles: AIProfile[] = [];
  const availableIds = Object.keys(AI_PROFILES);

  // If more teams than profiles, repeat profiles
  for (let i = 0; i < numTeams; i++) {
    const profileId = availableIds[i % availableIds.length];
    profiles.push(AI_PROFILES[profileId]);
  }

  // Shuffle for variety
  return shuffle(profiles);
}

/**
 * Shuffles an array
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Creates a custom AI profile
 */
export function createCustomProfile(
  name: string,
  riskTolerance: number,
  panicFactor: number,
  byeWeekAwareness: number,
  favoriteTeams: string[] = []
): AIProfile {
  return {
    id: `custom-${Date.now()}`,
    name,
    description: 'Custom AI profile',
    riskTolerance,
    positionalPreferences: {
      QB: 1.0,
      RB: 1.0,
      WR: 1.0,
      TE: 1.0,
      K: 1.0,
      DEF: 1.0,
    },
    reachThreshold: riskTolerance,
    panicFactor,
    byeWeekAwareness,
    favoriteTeams,
  };
}
