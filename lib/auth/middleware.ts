import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'your-secret-key-change-in-production'
);

export interface AuthUser {
  userId: string;
  username: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Try to get token from cookie first
    let token = request.cookies.get('auth-token')?.value;

    // If not in cookie, try Authorization header
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return null;
    }

    // Verify JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    return {
      userId: payload.userId as string,
      username: payload.username as string,
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
