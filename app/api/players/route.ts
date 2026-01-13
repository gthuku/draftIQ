import { NextResponse } from 'next/server';
import { getFantasyPlayers, getTopPlayers } from '@/lib/api/sleeper';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const topOnly = searchParams.get('top');
    const count = searchParams.get('count');

    let players;

    if (topOnly && count) {
      players = await getTopPlayers(parseInt(count));
    } else if (topOnly) {
      players = await getTopPlayers(200); // Default top 200
    } else {
      players = await getFantasyPlayers();
    }

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
