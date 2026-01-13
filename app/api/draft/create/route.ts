import { NextResponse } from 'next/server';
import { CreateDraftRequest, DraftState, AIProfile } from '@/lib/types';
import { initializeDraft } from '@/lib/draft/draft-engine';
import { fetchNFLPlayers } from '@/lib/api/rapidapi-nfl';
import { assignRandomProfiles, getAIProfileById } from '@/lib/ai/profiles';

// In-memory draft storage (in production, use a database)
const drafts = new Map<string, DraftState>();

export async function POST(request: Request) {
  try {
    const body: CreateDraftRequest = await request.json();

    const { userTeamName, userDraftPosition, settings, aiProfiles } = body;

    // Validate input
    if (!userTeamName || !userDraftPosition || !settings) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        { status: 400 }
      );
    }

    if (userDraftPosition < 1 || userDraftPosition > settings.numTeams) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid draft position',
        },
        { status: 400 }
      );
    }

    // Fetch available players with scoring format
    const players = await fetchNFLPlayers({
      scoringFormat: settings.scoringType,
      year: 2025,
      limit: 250
    });

    const availablePlayers = players;

    // Build profile map per draft position (1-indexed)
    const profilesByPosition: Map<number, AIProfile> = new Map();
    const randomPool = assignRandomProfiles(settings.numTeams);
    let randomPoolIndex = 0;

    if (aiProfiles && aiProfiles.length > 0) {
      // aiProfiles is an array where index represents position-1 (0-indexed)
      // null values mean use random, non-null values are profile IDs
      for (let i = 0; i < aiProfiles.length; i++) {
        const position = i + 1; // Convert to 1-indexed
        if (position === userDraftPosition) continue; // Skip user position

        const profileId = aiProfiles[i];
        if (profileId && profileId !== 'random') {
          const profile = getAIProfileById(profileId);
          if (profile) {
            profilesByPosition.set(position, profile);
          } else {
            // Fallback to random if profile not found
            profilesByPosition.set(position, randomPool[randomPoolIndex++ % randomPool.length]);
          }
        } else {
          // Use random profile
          profilesByPosition.set(position, randomPool[randomPoolIndex++ % randomPool.length]);
        }
      }
    }

    // Fill any missing positions with random profiles
    for (let position = 1; position <= settings.numTeams; position++) {
      if (position === userDraftPosition) continue;
      if (!profilesByPosition.has(position)) {
        profilesByPosition.set(position, randomPool[randomPoolIndex++ % randomPool.length]);
      }
    }

    // Build profiles array in draft order (excluding user position)
    const profiles: AIProfile[] = [];
    for (let position = 1; position <= settings.numTeams; position++) {
      if (position === userDraftPosition) continue;
      const profile = profilesByPosition.get(position);
      if (profile) {
        profiles.push(profile);
      }
    }

    // Initialize draft
    const draftState = initializeDraft(
      userTeamName,
      userDraftPosition,
      settings,
      profiles.map((p) => p.id),
      availablePlayers
    );

    // Assign AI profiles to teams by their draft position
    draftState.teams.forEach((team) => {
      if (!team.isUser) {
        const profile = profilesByPosition.get(team.draftPosition);
        if (profile) {
          team.aiProfile = profile;
          team.name = profile.name;
        }
      }
    });

    // Store draft
    drafts.set(draftState.id, draftState);

    return NextResponse.json({
      success: true,
      data: draftState,
    });
  } catch (error) {
    console.error('Error creating draft:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create draft',
      },
      { status: 500 }
    );
  }
}

// Export drafts map for other routes to access
export { drafts };
