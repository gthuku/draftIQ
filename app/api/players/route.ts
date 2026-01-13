import { NextResponse } from 'next/server';
import { fetchNFLPlayers } from '@/lib/api/nfl-data-api';
import { ScoringFormat } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scoringFormat = (searchParams.get('scoring_format') || 'ppr') as ScoringFormat;
    const limit = parseInt(searchParams.get('limit') || '300');

    // Validate scoring format
    if (!['standard', 'ppr', 'half_ppr'].includes(scoringFormat)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid scoring format. Must be standard, ppr, or half_ppr',
        },
        { status: 400 }
      );
    }

    const players = await fetchNFLPlayers({
      scoringFormat,
      year: 2025,
      limit
    });

    return NextResponse.json({
      success: true,
      data: players,
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch players',
      },
      { status: 500 }
    );
  }
}
