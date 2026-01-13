import { NextResponse } from 'next/server';
import { AIPickRequest } from '@/lib/types';
import { executePick } from '@/lib/draft/draft-engine';
import { selectAIPick, simulateThinkingDelay } from '@/lib/ai/decision-engine';
import { drafts } from '../draft/create/route';

export async function POST(request: Request) {
  try {
    const body: AIPickRequest = await request.json();
    const { draftId, teamId } = body;

    // Validate input
    if (!draftId || !teamId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        },
        { status: 400 }
      );
    }

    // Get draft
    const draft = drafts.get(draftId);

    if (!draft) {
      return NextResponse.json(
        {
          success: false,
          error: 'Draft not found',
        },
        { status: 404 }
      );
    }

    // Find team
    const team = draft.teams.find((t) => t.id === teamId);

    if (!team) {
      return NextResponse.json(
        {
          success: false,
          error: 'Team not found',
        },
        { status: 404 }
      );
    }

    if (team.isUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot make AI pick for user team',
        },
        { status: 400 }
      );
    }

    // Simulate thinking delay
    await simulateThinkingDelay();

    // AI makes decision
    const selectedPlayer = selectAIPick(team, draft, draft.availablePlayers);

    if (!selectedPlayer) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI could not select a player',
        },
        { status: 500 }
      );
    }

    // Execute pick
    const result = executePick(draft, teamId, selectedPlayer.id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    // Update stored draft
    drafts.set(draftId, result.updatedState!);

    return NextResponse.json({
      success: true,
      data: {
        draft: result.updatedState,
        pick: {
          teamId,
          playerId: selectedPlayer.id,
          playerName: selectedPlayer.name,
          position: selectedPlayer.position,
        },
      },
    });
  } catch (error) {
    console.error('Error making AI pick:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to make AI pick',
      },
      { status: 500 }
    );
  }
}
