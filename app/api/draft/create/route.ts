import { NextResponse } from 'next/server';
import { CreateDraftRequest, DraftState } from '@/lib/types';
import { initializeDraft } from '@/lib/draft/draft-engine';
import { getFantasyPlayers } from '@/lib/api/sleeper';
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

    // Fetch available players
    const players = await getFantasyPlayers();

    // Get top 250 players for the draft
    const availablePlayers = players.slice(0, 250);

    // Assign AI profiles
    const numAITeams = settings.numTeams - 1; // Exclude user team
    let profiles;

    if (aiProfiles && aiProfiles.length > 0) {
      // Use specified profiles
      profiles = aiProfiles.map((id) => getAIProfileById(id)).filter(Boolean);
      // Fill remaining with random if not enough
      while (profiles.length < numAITeams) {
        profiles.push(...assignRandomProfiles(numAITeams - profiles.length));
      }
      profiles = profiles.slice(0, numAITeams);
    } else {
      // Assign random profiles
      profiles = assignRandomProfiles(numAITeams);
    }

    // Initialize draft
    const draftState = initializeDraft(
      userTeamName,
      userDraftPosition,
      settings,
      profiles.map((p) => p.id),
      availablePlayers
    );

    // Assign AI profiles to teams
    draftState.teams.forEach((team, index) => {
      if (!team.isUser) {
        const aiIndex = index < userDraftPosition - 1 ? index : index - 1;
        team.aiProfile = profiles[aiIndex];
        team.name = profiles[aiIndex].name;
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
