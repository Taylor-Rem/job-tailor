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
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await prisma.user_actions_count.create({
      data: {
        user_id: user.id,
        resume_uploads: 0,
        resume_generations: 0,
        jobs_fetched: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return { success: true, user: { id: user.id, email: user.email, username: user.username } };
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
        email: true,
        password: true,
        plan: true,
      },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return { success: false, error: 'Invalid password' };
    }

    return { 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        plan: user.plan 
      } 
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function createTemporaryUser() {
  try {
    const randomString = uuidv4();
    const tempEmail = `temp_${randomString}@example.com`;
    const tempUsername = `temp_${randomString}`;
    const tempPassword = randomString;

    const user = await prisma.users.create({
      data: {
        email: tempEmail,
        username: tempUsername,
        password: tempPassword,
        is_temporary: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create corresponding user_actions_count row
    await prisma.user_actions_count.create({
      data: {
        user_id: user.id,
        resume_uploads: 0,
        resume_generations: 0,
        jobs_fetched: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return { success: true, user: { id: user.id, username: 'Guest', email: tempEmail } };
  } catch (error) {
    console.error('Temporary user creation error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}