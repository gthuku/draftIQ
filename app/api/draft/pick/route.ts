import { NextResponse } from 'next/server';
import { MakePickRequest } from '@/lib/types';
import { executePick } from '@/lib/draft/draft-engine';
import { drafts } from '../create/route';

export async function POST(request: Request) {
  try {
    const body: MakePickRequest = await request.json();
    const { draftId, teamId, playerId } = body;

    // Validate input
    if (!draftId || !teamId || !playerId) {
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

    // Execute pick
    const result = executePick(draft, teamId, playerId);

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
      data: result.updatedState,
    });
  } catch (error) {
    console.error('Error making pick:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to make pick',
      },
      { status: 500 }
    );
  }
}
