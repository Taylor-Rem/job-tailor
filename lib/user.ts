// lib/user.ts
import { prisma } from './db';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export async function signup(email: string, username: string, password: string) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        email,
        username,
        password: hashedPassword,
        plan: 0,
        is_temporary: false,
      },
    });
    return { success: true, user };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function login(identifier: string, password: string) {
  try {
    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
        is_temporary: false,
      },
      select: {
        id: true,
        username: true,
        password: true,
      },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return { success: false, error: 'Invalid password' };
    }

    return { success: true, user: { id: user.id, username: user.username } };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function createTemporaryUser() {
  try {
    const randomString = uuidv4();
    const user = await prisma.users.create({
      data: {
        email: `temp_${randomString}@example.com`,
        username: `temp_${randomString}`,
        password: randomString,
        is_temporary: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return { success: true, user: { id: user.id, username: 'Guest' } };
  } catch (error) {
    console.error('Temporary user creation error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}