import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { username, email, password } = body;

    // Build update data
    const updateData: any = {};
    if (username) updateData.username = username;
    
    // Handle email: if empty string, set to null to avoid unique constraint violation
    if (email !== undefined) {
      updateData.email = email || null;
    }
    
    if (password) {
      updateData.password = await hashPassword(password);
    }

    // Check uniqueness if updating username or email
    if (username || (email && email.trim() !== '')) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(username ? [{ username }] : []),
            ...(email ? [{ email }] : []),
          ],
          NOT: {
            id: id,
          },
        },
      });

      if (existingUser) {
        if (username && existingUser.username === username) {
          return NextResponse.json(
            { error: 'Username already taken' },
            { status: 409 }
          );
        }
        if (email && existingUser.email === email) {
          return NextResponse.json(
            { error: 'Email already registered' },
            { status: 409 }
          );
        }
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
