import { NextResponse } from 'next/server';
import { drafts } from '../create/route';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: draftId } = await params;

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

    return NextResponse.json({
      success: true,
      data: draft,
    });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch draft',
      },
      { status: 500 }
    );
  }
}
