import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });

    // Clear auth cookies
    response.cookies.delete('userId');
    response.cookies.delete('userEmail');
    response.cookies.delete('authToken');

    return response;
  } catch (error) {
    console.error('Error clearing auth cookies:', error);
    return NextResponse.json(
      { error: 'Failed to clear auth cookies' },
      { status: 500 }
    );
  }
}
