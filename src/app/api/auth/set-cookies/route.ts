import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, email, idToken } = await request.json();

    console.log('SET_COOKIES API: Received request for user:', email);

    const response = NextResponse.json({ success: true });

    // Set auth cookies
    if (userId) {
      response.cookies.set('userId', userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
      console.log('SET_COOKIES API: Set userId cookie:', userId);
    }

    if (email) {
      response.cookies.set('userEmail', email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
      console.log('SET_COOKIES API: Set userEmail cookie:', email);
    }

    if (idToken) {
      response.cookies.set('authToken', idToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour
        path: '/',
      });
      console.log('SET_COOKIES API: Set authToken cookie');
    }

    console.log('SET_COOKIES API: All cookies set successfully');
    return response;
  } catch (error) {
    console.error('SET_COOKIES API: Error setting auth cookies:', error);
    return NextResponse.json(
      { error: 'Failed to set auth cookies' },
      { status: 500 }
    );
  }
}
